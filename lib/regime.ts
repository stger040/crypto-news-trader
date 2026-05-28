import {
  getFearGreedAvg7d,
  getLatestRegimeSnapshot,
  getRegimeSnapshotDaysAgo,
  saveRegimeSnapshot,
} from "./db";
import { fetchFundingRates } from "./fundingRate";
import type { MarketRegime } from "./types";

export interface RegimeResult {
  regime: MarketRegime;
  signalsBull: number;
  signalsBear: number;
  signalsNeutral: number;
  btcVs200dSma: number | null;
  lockedUntil: Date | null;
  regimeAgeDays: number;
}

type SignalScore = MarketRegime;

let pendingFlipRegime: MarketRegime | null = null;
let pendingFlipCount = 0;

let dominanceCache: { at: number; pct: number } | null = null;
const DOMINANCE_CACHE_MS = 30_000;

function computeSma(closes: number[], period: number, endIndex?: number): number {
  const end = endIndex ?? closes.length - 1;
  const start = end - period + 1;
  if (start < 0) return 0;
  const slice = closes.slice(start, end + 1);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

async function fetchBtcDailyCloses(): Promise<number[]> {
  const res = await fetch(
    "https://api.kraken.com/0/public/OHLC?pair=XBTUSD&interval=1440"
  );
  const data = (await res.json()) as {
    error?: string[];
    result?: Record<string, number[][]>;
  };
  if (data.error?.length) throw new Error(data.error.join(", "));

  const candles =
    data.result?.XXBTZUSD ??
    data.result?.XBTUSD ??
    Object.values(data.result ?? {})[0];
  if (!candles?.length) throw new Error("No BTC OHLC data");

  return candles.map((c) => parseFloat(String(c[4])));
}

async function fetchBtcDominance(): Promise<number> {
  if (dominanceCache && Date.now() - dominanceCache.at < DOMINANCE_CACHE_MS) {
    return dominanceCache.pct;
  }

  const res = await fetch("https://api.coingecko.com/api/v3/global");
  if (!res.ok) throw new Error(`CoinGecko global API ${res.status}`);
  const json = (await res.json()) as {
    data?: { market_cap_percentage?: { btc?: number } };
  };
  const pct = json.data?.market_cap_percentage?.btc ?? 0;
  dominanceCache = { at: Date.now(), pct };
  return pct;
}

function scoreBtcVs200dSma(
  price: number,
  sma200: number
): { score: SignalScore; ratio: number } {
  const ratio = sma200 ? (price - sma200) / sma200 : 0;
  if (price > sma200 * 1.05) return { score: "bull", ratio };
  if (price < sma200 * 0.95) return { score: "bear", ratio };
  return { score: "neutral", ratio };
}

function scoreSmaCross(closes: number[]): SignalScore {
  if (closes.length < 205) return "neutral";
  const sma50Now = computeSma(closes, 50);
  const sma200Now = computeSma(closes, 200);
  const sma50FiveDaysAgo = computeSma(closes, 50, closes.length - 6);

  if (sma50Now > sma200Now && sma50Now > sma50FiveDaysAgo) return "bull";
  if (sma50Now < sma200Now && sma50Now < sma50FiveDaysAgo) return "bear";
  return "neutral";
}

function score30dReturn(closes: number[]): SignalScore {
  if (closes.length < 31) return "neutral";
  const today = closes[closes.length - 1];
  const prior = closes[closes.length - 31];
  const ret = prior ? (today - prior) / prior : 0;
  if (ret > 0.1) return "bull";
  if (ret < -0.15) return "bear";
  return "neutral";
}

function scoreFearGreedAvg(avg: number | null): SignalScore {
  if (avg == null) return "neutral";
  if (avg > 60) return "bull";
  if (avg < 35) return "bear";
  return "neutral";
}

function scoreDominanceTrend(
  current: number,
  prior: number | null
): { score: SignalScore; trend: string } {
  if (prior == null) return { score: "neutral", trend: "neutral" };
  const delta = current - prior;
  if (delta > 2) return { score: "bear", trend: "rising" };
  if (delta < -2) return { score: "bull", trend: "falling" };
  return { score: "neutral", trend: "neutral" };
}

function scoreFunding(funding: number): { score: SignalScore; direction: string } {
  if (funding < -0.00005) return { score: "bear", direction: "negative" };
  if (funding > 0.0002) return { score: "bull", direction: "positive" };
  return { score: "neutral", direction: "neutral" };
}

function voteRegime(signals: SignalScore[]): MarketRegime {
  const bull = signals.filter((s) => s === "bull").length;
  const bear = signals.filter((s) => s === "bear").length;
  if (bear >= 4) return "bear";
  if (bull >= 4) return "bull";
  return "neutral";
}

export async function detectRegime(): Promise<RegimeResult> {
  const latest = await getLatestRegimeSnapshot();
  const currentRegime: MarketRegime = latest?.regime ?? "neutral";

  if (latest?.locked_until && new Date(latest.locked_until) > new Date()) {
    return {
      regime: currentRegime,
      signalsBull: latest.signals_bull,
      signalsBear: latest.signals_bear,
      signalsNeutral: latest.signals_neutral,
      btcVs200dSma: latest.btc_vs_200d_sma != null ? Number(latest.btc_vs_200d_sma) : null,
      lockedUntil: new Date(latest.locked_until),
      regimeAgeDays: latest.regime_age_days ?? 0,
    };
  }

  const closes = await fetchBtcDailyCloses();
  const price = closes[closes.length - 1];
  const sma200 = computeSma(closes, 200);

  const s1 = scoreBtcVs200dSma(price, sma200);
  const s2 = scoreSmaCross(closes);
  const s3 = score30dReturn(closes);

  const fgAvg = await getFearGreedAvg7d();
  const s4 = scoreFearGreedAvg(fgAvg);

  let dominancePct = 0;
  let s5: SignalScore = "neutral";
  let dominanceTrend = "neutral";
  try {
    dominancePct = await fetchBtcDominance();
    const snap7d = await getRegimeSnapshotDaysAgo(7);
    const priorDom =
      snap7d?.fear_greed_value != null ? Number(snap7d.fear_greed_value) : null;
    const dom = scoreDominanceTrend(dominancePct, priorDom);
    s5 = dom.score;
    dominanceTrend = dom.trend;
  } catch {
    s5 = "neutral";
  }

  const fundingRates = await fetchFundingRates(["BTC"]);
  const funding = fundingRates.BTC ?? 0;
  const s6Result = scoreFunding(funding);
  const s6 = s6Result.score;

  const signals = [s1.score, s2, s3, s4, s5, s6];
  const rawVote = voteRegime(signals);
  const bullCount = signals.filter((s) => s === "bull").length;
  const bearCount = signals.filter((s) => s === "bear").length;
  const neutralCount = signals.filter((s) => s === "neutral").length;

  let finalRegime = currentRegime;
  let lockedUntil: Date | null = null;
  let regimeAgeDays = latest?.regime_age_days ?? 0;
  const previousRegime = currentRegime;

  if (rawVote === currentRegime) {
    pendingFlipRegime = null;
    pendingFlipCount = 0;
    finalRegime = currentRegime;
    regimeAgeDays = (latest?.regime_age_days ?? 0) + 1;
  } else {
    if (pendingFlipRegime === rawVote) {
      pendingFlipCount++;
    } else {
      pendingFlipRegime = rawVote;
      pendingFlipCount = 1;
    }

    if (pendingFlipCount >= 2) {
      finalRegime = rawVote;
      lockedUntil = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
      regimeAgeDays = 0;
      pendingFlipRegime = null;
      pendingFlipCount = 0;
    } else {
      finalRegime = currentRegime;
      regimeAgeDays = (latest?.regime_age_days ?? 0) + 1;
    }
  }

  const return30d =
    closes.length >= 31
      ? (closes[closes.length - 1] - closes[closes.length - 31]) /
        closes[closes.length - 31]
      : null;

  await saveRegimeSnapshot({
    regime: finalRegime,
    signals_bull: bullCount,
    signals_bear: bearCount,
    signals_neutral: neutralCount,
    btc_vs_200d_sma: s1.ratio,
    sma50_vs_sma200:
      closes.length >= 200
        ? (computeSma(closes, 50) - computeSma(closes, 200)) /
          computeSma(closes, 200)
        : null,
    return_30d: return30d,
    fear_greed_avg7d: fgAvg,
    btc_dominance_pct: dominancePct,
    btc_dominance_trend: dominanceTrend,
    funding_direction: s6Result.direction,
    previous_regime: previousRegime,
    regime_age_days: regimeAgeDays,
    locked_until: lockedUntil,
  });

  return {
    regime: finalRegime,
    signalsBull: bullCount,
    signalsBear: bearCount,
    signalsNeutral: neutralCount,
    btcVs200dSma: s1.ratio,
    lockedUntil,
    regimeAgeDays,
  };
}

export async function getCurrentRegime(): Promise<MarketRegime> {
  const latest = await getLatestRegimeSnapshot();
  return latest?.regime ?? "neutral";
}

export async function getRegimeStatusForDashboard(): Promise<{
  regime: MarketRegime;
  regimeAgeDays: number;
  signalsBull: number;
  signalsBear: number;
  signalsNeutral: number;
  lockedUntil: string | null;
}> {
  const latest = await getLatestRegimeSnapshot();
  return {
    regime: latest?.regime ?? "neutral",
    regimeAgeDays: latest?.regime_age_days ?? 0,
    signalsBull: latest?.signals_bull ?? 0,
    signalsBear: latest?.signals_bear ?? 0,
    signalsNeutral: latest?.signals_neutral ?? 0,
    lockedUntil: latest?.locked_until ?? null,
  };
}
