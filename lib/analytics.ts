import { getJson, setJson } from "./redis";
import { getClosedTrades } from "./positions";
import type { Analytics } from "./types";

const ANALYTICS_KEY = "analytics:summary";

function computeSharpe(returns: number[]): number {
  if (returns.length < 2) return 0;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance =
    returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / (returns.length - 1);
  const std = Math.sqrt(variance);
  if (std === 0) return 0;
  return (mean / std) * Math.sqrt(252);
}

export async function rebuildAnalytics(): Promise<Analytics> {
  const trades = await getClosedTrades();
  const wins = trades.filter((t) => t.pnlUsd > 0);
  const winRate = trades.length ? wins.length / trades.length : 0;
  const avgReturnPct = trades.length
    ? trades.reduce((s, t) => s + t.pnlPct, 0) / trades.length
    : 0;

  const monthlyMap = new Map<string, number>();
  for (const t of trades) {
    const month = t.closedAt.slice(0, 7);
    monthlyMap.set(month, (monthlyMap.get(month) ?? 0) + t.pnlUsd);
  }

  const monthlyPnl = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, pnl]) => ({ month, pnl }));

  const returns = trades.map((t) => t.pnlPct / 100);
  const sharpeRatio = computeSharpe(returns);

  const analytics: Analytics = {
    winRate,
    avgReturnPct,
    monthlyPnl,
    sharpeRatio,
    totalTrades: trades.length,
    updatedAt: new Date().toISOString(),
  };

  await setJson(ANALYTICS_KEY, analytics);
  return analytics;
}

export async function getAnalytics(): Promise<Analytics> {
  const cached = await getJson<Analytics>(ANALYTICS_KEY);
  if (cached) return cached;
  return rebuildAnalytics();
}
