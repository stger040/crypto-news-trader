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
  getNewsFeedStats,
} from "@/lib/db";
import { getPositionsWithPnL } from "@/lib/positionsView";
import { buildAnalytics, getCategoryWinRatesAnalytics } from "@/lib/analytics";
import { computePortfolioSnapshot } from "@/lib/portfolio";
import { isCorroborated } from "@/lib/confirmation";
import { getVelocityMultiplier } from "@/lib/velocity";
import { getRegimeStatusForDashboard } from "@/lib/regime";
import { getCircuitBreakerDashboardStatus } from "@/lib/circuitBreaker";
import type {
  BotHealthStatus,
  StrategyPanelStatus,
  NewsArticleMeta,
  RegimeStatus,
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
      regimeBase,
      cbDash,
      feedStats,
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
      getRegimeStatusForDashboard(),
      getCircuitBreakerDashboardStatus(),
      getNewsFeedStats(),
    ]);

    const strategies: StrategyPanelStatus[] = await Promise.all([
      buildStrategyStatus("momentum", "Breaking News Momentum"),
      buildStrategyStatus("sentimentMomentum", "Sentiment Momentum"),
      buildStrategyStatus("fearGreed", "Fear & Greed Contrarian"),
      buildStrategyStatus("capitulationBounce", "Capitulation Bounce"),
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

    const regimeStatus: RegimeStatus = {
      ...regimeBase,
      circuitBreakerActive: cbDash.active,
      circuitBreakerType: cbDash.type,
      macroHaltActive: cbDash.macroHaltActive,
    };

    const health = buildBotHealth(lastCron, feedStats);

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
      regimeStatus,
      feedStats,
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

function toIso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

function buildBotHealth(
  lastCron: { ran_at: string | Date; success: boolean } | null,
  feedStats: { totalArticles: number; latestFetchedAt: string | null }
): BotHealthStatus {
  if (!lastCron) {
    const feedAge = feedStats.latestFetchedAt
      ? Date.now() - new Date(feedStats.latestFetchedAt).getTime()
      : null;
    if (feedAge != null && feedAge < 15 * 60 * 1000) {
      return {
        status: "yellow",
        message: "Cron log missing but feed recently updated",
        lastCronAt: feedStats.latestFetchedAt,
      };
    }
    return { status: "yellow", message: "No cron run recorded", lastCronAt: null };
  }

  const ageMs = Date.now() - new Date(toIso(lastCron.ran_at)).getTime();
  const ageMin = ageMs / 60000;

  if (!lastCron.success) {
    return {
      status: "red",
      message: "Last cron failed",
      lastCronAt: toIso(lastCron.ran_at),
    };
  }
  if (ageMin < 6) {
    return {
      status: "green",
      message: `Healthy — last run ${Math.round(ageMin)}m ago`,
      lastCronAt: toIso(lastCron.ran_at),
    };
  }
  if (ageMin < 15) {
    return {
      status: "yellow",
      message: `Stale — last run ${Math.round(ageMin)}m ago`,
      lastCronAt: toIso(lastCron.ran_at),
    };
  }
  return {
    status: "red",
    message: `Critical — last run ${Math.round(ageMin)}m ago`,
    lastCronAt: toIso(lastCron.ran_at),
  };
}
