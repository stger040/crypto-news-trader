import { NextResponse } from "next/server";
import {
  getRecentArticles,
  getClosedTrades,
  getLatestSentimentSnapshot,
  getLastCronRun,
  countPositionsOpenedToday,
  getLastSignalForStrategy,
} from "@/lib/db";
import { getPositionsWithPnL } from "@/lib/positionsView";
import { buildAnalytics } from "@/lib/analytics";
import { computePortfolioSnapshot } from "@/lib/portfolio";
import type { BotHealthStatus, StrategyPanelStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [
      news,
      positions,
      trades,
      analytics,
      portfolio,
      sentiment,
      lastCron,
    ] = await Promise.all([
      getRecentArticles(20),
      getPositionsWithPnL(),
      getClosedTrades(30),
      buildAnalytics(),
      computePortfolioSnapshot(),
      getLatestSentimentSnapshot(),
      getLastCronRun(),
    ]);

    const strategies: StrategyPanelStatus[] = await Promise.all([
      buildStrategyStatus("momentum", "Breaking News Momentum"),
      buildStrategyStatus("sentimentMomentum", "Sentiment Momentum"),
      buildStrategyStatus("fearGreed", "Fear & Greed Contrarian"),
    ]);

    const health = buildBotHealth(lastCron);

    return NextResponse.json({
      news,
      sentiment,
      strategies,
      positions,
      trades,
      analytics,
      portfolio,
      health,
      liveTrading: process.env.NEXT_PUBLIC_LIVE_TRADING === "true",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function buildStrategyStatus(
  id: string,
  name: string
): Promise<StrategyPanelStatus> {
  const [lastSignal, todayCount, open] = await Promise.all([
    getLastSignalForStrategy(id),
    countPositionsOpenedToday(id),
    import("@/lib/db").then((m) => m.getOpenPositionsByStrategy(id)),
  ]);

  let status = "waiting";
  if (open.length > 0) status = "active";
  else if (lastSignal?.acted_on) status = "triggered";

  return {
    id,
    name,
    status,
    lastSignalAt: lastSignal?.triggered_at ?? null,
    positionsToday: todayCount,
  };
}

function buildBotHealth(
  lastCron: { ran_at: string; success: boolean } | null
): BotHealthStatus {
  if (!lastCron) {
    return { status: "yellow", message: "No cron run recorded", lastCronAt: null };
  }

  const ageMs = Date.now() - new Date(lastCron.ran_at).getTime();
  const ageMin = ageMs / 60000;

  if (!lastCron.success) {
    return {
      status: "red",
      message: "Last cron failed",
      lastCronAt: lastCron.ran_at,
    };
  }
  if (ageMin < 6) {
    return {
      status: "green",
      message: `Healthy — last run ${Math.round(ageMin)}m ago`,
      lastCronAt: lastCron.ran_at,
    };
  }
  if (ageMin < 15) {
    return {
      status: "yellow",
      message: `Stale — last run ${Math.round(ageMin)}m ago`,
      lastCronAt: lastCron.ran_at,
    };
  }
  return {
    status: "red",
    message: `Critical — last run ${Math.round(ageMin)}m ago`,
    lastCronAt: lastCron.ran_at,
  };
}
