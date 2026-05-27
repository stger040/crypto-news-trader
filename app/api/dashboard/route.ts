import { NextResponse } from "next/server";
import {
  getRecentArticles,
  getClosedTrades,
  getLatestSentimentSnapshot,
  getLastCronRun,
  countPositionsOpenedToday,
  getLastSignalForStrategy,
  getOpenPositionsByStrategy,
  getArticleTriggerIds,
  getSignalQualityStats,
} from "@/lib/db";
import { getPositionsWithPnL } from "@/lib/positionsView";
import { buildAnalytics, getCategoryWinRatesAnalytics } from "@/lib/analytics";
import { computePortfolioSnapshot } from "@/lib/portfolio";
import { isCorroborated } from "@/lib/confirmation";
import { getVelocityMultiplier } from "@/lib/velocity";
import type {
  BotHealthStatus,
  StrategyPanelStatus,
  NewsArticleMeta,
} from "@/lib/types";

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
      signalQuality,
      categoryStats,
      triggerMap,
    ] = await Promise.all([
      getRecentArticles(20),
      getPositionsWithPnL(),
      getClosedTrades(30),
      buildAnalytics(),
      computePortfolioSnapshot(),
      getLatestSentimentSnapshot(),
      getLastCronRun(),
      getSignalQualityStats(),
      getCategoryWinRatesAnalytics(),
      getArticleTriggerIds(),
    ]);

    const strategies: StrategyPanelStatus[] = await Promise.all([
      buildStrategyStatus("momentum", "Breaking News Momentum"),
      buildStrategyStatus("sentimentMomentum", "Sentiment Momentum"),
      buildStrategyStatus("fearGreed", "Fear & Greed Contrarian"),
    ]);

    const articleMeta: Record<number, NewsArticleMeta> = {};
    await Promise.all(
      news.map(async (article) => {
        const pair = article.affected_pairs?.[0];
        let velocityHigh = false;
        if (pair && article.processed) {
          try {
            const v = await getVelocityMultiplier(pair);
            velocityHigh = v > 2;
          } catch {
            /* ignore */
          }
        }
        let corroborated = false;
        if (article.processed) {
          try {
            corroborated = await isCorroborated(article.id, 30);
          } catch {
            /* ignore */
          }
        }
        articleMeta[article.id] = {
          corroborated,
          velocityHigh,
          triggeredPositionId: triggerMap[article.id] ?? null,
        };
      })
    );

    const health = buildBotHealth(lastCron);

    return NextResponse.json({
      news,
      articleMeta,
      sentiment,
      strategies,
      positions,
      trades,
      analytics,
      portfolio,
      signalQuality,
      categoryStats,
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
    getOpenPositionsByStrategy(id),
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
