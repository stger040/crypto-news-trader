import {
  getClosedTradesAll,
  getTotalFees,
  getCategoryWinRates,
  getFirstPortfolioSnapshot,
  getCircuitBreakerState,
} from "./db";
import { getKrakenPrice, INITIAL_CASH_USD } from "./kraken";
import { getPortfolioTotal } from "./portfolio";
import type {
  AnalyticsSummary,
  CategoryStats,
  RegimeAttribution,
  RollingMetrics,
} from "./types";

const MONTHLY_TARGET_PCT = 9;

function computeSharpe(returns: number[]): number {
  if (returns.length < 2) return 0;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance =
    returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1);
  const std = Math.sqrt(variance);
  if (std === 0) return 0;
  return (mean / std) * Math.sqrt(252);
}

function computeSortino(returns: number[]): number {
  if (returns.length < 2) return 0;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const downside = returns.filter((r) => r < 0);
  if (downside.length === 0) return mean > 0 ? Infinity : 0;
  const downsideVar =
    downside.reduce((s, r) => s + r ** 2, 0) / downside.length;
  const downsideStd = Math.sqrt(downsideVar);
  if (downsideStd === 0) return 0;
  return (mean / downsideStd) * Math.sqrt(252);
}

function computeProfitFactor(trades: { pnl_usd: number | null }[]): number {
  const wins = trades
    .filter((t) => Number(t.pnl_usd ?? 0) > 0)
    .reduce((s, t) => s + Number(t.pnl_usd ?? 0), 0);
  const losses = trades
    .filter((t) => Number(t.pnl_usd ?? 0) < 0)
    .reduce((s, t) => s + Number(t.pnl_usd ?? 0), 0);
  if (losses === 0) return wins > 0 ? Infinity : 0;
  return wins / Math.abs(losses);
}

function buildRegimeAttribution(
  trades: Awaited<ReturnType<typeof getClosedTradesAll>>
): RegimeAttribution[] {
  const regimes = ["bull", "bear", "neutral", "unknown"];
  return regimes.map((regime) => {
    const subset = trades.filter((t) => {
      const r = t.regime ?? "unknown";
      return regime === "unknown" ? r == null || r === "unknown" : r === regime;
    });
    const wins = subset.filter((t) => Number(t.pnl_usd ?? 0) > 0);
    return {
      regime,
      tradeCount: subset.length,
      winRate: subset.length ? wins.length / subset.length : 0,
      avgReturnPct: subset.length
        ? subset.reduce((s, t) => s + Number(t.pnl_pct ?? 0), 0) /
          subset.length
        : 0,
      profitFactor: computeProfitFactor(subset),
      totalPnlUsd: subset.reduce((s, t) => s + Number(t.pnl_usd ?? 0), 0),
      isReliable: subset.length >= 10,
    };
  });
}

function buildRollingMetrics(
  allTrades: Awaited<ReturnType<typeof getClosedTradesAll>>
): RollingMetrics[] {
  return [30, 60, 90].map((days) => {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const subset = allTrades.filter(
      (t) => t.closed_at && new Date(t.closed_at).getTime() > cutoff
    );
    const returns = subset.map((t) => Number(t.pnl_pct ?? 0) / 100);
    return {
      periodDays: days,
      sharpe: computeSharpe(returns),
      sortino: computeSortino(returns),
      tradeCount: subset.length,
    };
  });
}

function buildHealthInterpretation(
  analytics: {
    totalTrades: number;
    winRate: number;
    profitFactor: number;
    rollingMetrics: RollingMetrics[];
    benchmark: { excessReturnPct: number; btcReturnPct: number };
  }
): string {
  if (analytics.totalTrades < 20) {
    return "⏳ Insufficient data — need 20+ closed trades for reliable evaluation";
  }

  const rolling30 = analytics.rollingMetrics.find((r) => r.periodDays === 30);
  const rolling90 = analytics.rollingMetrics.find((r) => r.periodDays === 90);

  if (rolling30 && rolling30.sortino > 1.0 && analytics.benchmark.excessReturnPct > 0) {
    return "✅ Bot is outperforming BTC on risk-adjusted basis";
  }
  if (
    rolling90 &&
    rolling90.sharpe < 0 &&
    analytics.benchmark.btcReturnPct > 0
  ) {
    return "⚠️ Strategy underperforming — review signals";
  }
  if (analytics.profitFactor > 1.5 && analytics.winRate > 0.55) {
    return "✅ Strong edge detected across closed trades";
  }

  return "Monitoring performance — continue accumulating trade data";
}

async function fetchBtcPriceAtDate(isoDate: string): Promise<number | null> {
  try {
    const target = Math.floor(new Date(isoDate).getTime() / 1000);
    const res = await fetch(
      `https://api.kraken.com/0/public/OHLC?pair=XBTUSD&interval=1440&since=${target - 86400 * 3}`
    );
    const data = (await res.json()) as {
      result?: Record<string, number[][]>;
    };
    const candles =
      data.result?.XXBTZUSD ??
      data.result?.XBTUSD ??
      Object.values(data.result ?? {})[0];
    if (!candles?.length) return null;

    let best = candles[0];
    let bestDiff = Math.abs(candles[0][0] - target);
    for (const c of candles) {
      const diff = Math.abs(c[0] - target);
      if (diff < bestDiff) {
        best = c;
        bestDiff = diff;
      }
    }
    return parseFloat(String(best[4]));
  } catch {
    return null;
  }
}

export async function buildAnalytics(): Promise<AnalyticsSummary> {
  const trades = await getClosedTradesAll(500);
  const wins = trades.filter((t) => Number(t.pnl_usd ?? 0) > 0);
  const winRate = trades.length ? wins.length / trades.length : 0;
  const avgReturnPct = trades.length
    ? trades.reduce((s, t) => s + Number(t.pnl_pct ?? 0), 0) / trades.length
    : 0;

  const monthlyMap = new Map<string, number>();
  for (const t of trades) {
    if (!t.closed_at) continue;
    const month = t.closed_at.slice(0, 7);
    monthlyMap.set(
      month,
      (monthlyMap.get(month) ?? 0) + Number(t.pnl_usd ?? 0)
    );
  }

  const monthlyPnl = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, pnl]) => ({ month, pnl }));

  const returns = trades.map((t) => Number(t.pnl_pct ?? 0) / 100);
  const totalFees = await getTotalFees();
  const profitFactor = computeProfitFactor(trades);
  const sortinoRatio = computeSortino(returns);
  const rollingMetrics = buildRollingMetrics(trades);
  const regimeAttribution = buildRegimeAttribution(trades);

  const currentPortfolioValue = await getPortfolioTotal();
  const botReturnPct =
    ((currentPortfolioValue - INITIAL_CASH_USD) / INITIAL_CASH_USD) * 100;

  const firstSnapshot = await getFirstPortfolioSnapshot();
  let btcReturnPct = 0;
  if (firstSnapshot?.captured_at) {
    const [startPrice, endPrice] = await Promise.all([
      fetchBtcPriceAtDate(firstSnapshot.captured_at),
      getKrakenPrice("BTC"),
    ]);
    if (startPrice && endPrice) {
      btcReturnPct = ((endPrice - startPrice) / startPrice) * 100;
    }
  }

  const cbState = await getCircuitBreakerState();
  const hwm = Number(cbState?.portfolio_high_water_mark ?? INITIAL_CASH_USD);
  const currentDrawdownPct =
    hwm > 0 ? ((hwm - currentPortfolioValue) / hwm) * 100 : 0;

  const benchmark = {
    botReturnPct,
    btcReturnPct,
    excessReturnPct: botReturnPct - btcReturnPct,
    highWaterMark: hwm,
    currentDrawdownPct: Math.max(0, currentDrawdownPct),
  };

  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthPnl = monthlyMap.get(currentMonth) ?? 0;
  const monthReturnPct = (monthPnl / INITIAL_CASH_USD) * 100;
  const onTrack = monthReturnPct >= MONTHLY_TARGET_PCT * 0.5;

  const summary: AnalyticsSummary = {
    winRate,
    avgReturnPct,
    monthlyPnl,
    sharpeRatio: computeSharpe(returns),
    sortinoRatio,
    profitFactor,
    totalTrades: trades.length,
    totalFees,
    monthlyTargetPct: MONTHLY_TARGET_PCT,
    onTrack,
    benchmark,
    rollingMetrics,
    regimeAttribution,
    healthInterpretation: "",
  };

  summary.healthInterpretation = buildHealthInterpretation(summary);

  return summary;
}

export async function getCategoryWinRatesAnalytics(): Promise<CategoryStats[]> {
  return getCategoryWinRates();
}

export async function computeBtc30dSortino(): Promise<number> {
  try {
    const res = await fetch(
      "https://api.kraken.com/0/public/OHLC?pair=XBTUSD&interval=1440"
    );
    const data = (await res.json()) as {
      result?: Record<string, number[][]>;
    };
    const candles =
      data.result?.XXBTZUSD ??
      data.result?.XBTUSD ??
      Object.values(data.result ?? {})[0];
    if (!candles || candles.length < 31) return 0;

    const closes = candles.slice(-31).map((c) => parseFloat(String(c[4])));
    const dailyReturns: number[] = [];
    for (let i = 1; i < closes.length; i++) {
      dailyReturns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
    }
    return computeSortino(dailyReturns);
  } catch {
    return 0;
  }
}
