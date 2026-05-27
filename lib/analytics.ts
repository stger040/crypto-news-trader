import { getClosedTrades, getTotalFees } from "./db";
import type { AnalyticsSummary } from "./types";

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

export async function buildAnalytics(): Promise<AnalyticsSummary> {
  const trades = await getClosedTrades(500);
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

  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthPnl = monthlyMap.get(currentMonth) ?? 0;
  const monthReturnPct = (monthPnl / 10000) * 100;
  const onTrack = monthReturnPct >= MONTHLY_TARGET_PCT * 0.5;

  return {
    winRate,
    avgReturnPct,
    monthlyPnl,
    sharpeRatio: computeSharpe(returns),
    totalTrades: trades.length,
    totalFees,
    monthlyTargetPct: MONTHLY_TARGET_PCT,
    onTrack,
  };
}
