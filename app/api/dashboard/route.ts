import { NextResponse } from "next/server";
import { getJson } from "@/lib/redis";
import { getScoredNewsFeed } from "@/lib/cronRunner";
import { fetchFearAndGreed } from "@/lib/dataSources";
import {
  getPositionsWithPnL,
  getClosedTrades,
} from "@/lib/positions";
import { getAnalytics } from "@/lib/analytics";
import { getPortfolio } from "@/lib/portfolio";
import { getSentimentMomentumStatus } from "@/lib/strategies/sentimentMomentum";
import type { BotHealth, StrategyStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [news, fearGreed, positions, trades, analytics, portfolio, sentimentStatus, health] =
      await Promise.all([
        getScoredNewsFeed(),
        fetchFearAndGreed().catch(() => null),
        getPositionsWithPnL(),
        getClosedTrades(),
        getAnalytics(),
        getPortfolio(),
        getSentimentMomentumStatus(),
        getJson<BotHealth>("bot:health"),
      ]);

    const strategies: StrategyStatus[] = [
      {
        id: "breaking_news_momentum",
        name: "Breaking News Momentum",
        status: positions.some(
          (p) => p.position.strategy === "breaking_news_momentum"
        )
          ? "active"
          : "waiting",
        detail: "Monitors CryptoPanic important posts",
      },
      {
        id: "sentiment_momentum",
        name: "Sentiment Momentum (Daily)",
        status:
          sentimentStatus.lastRun === new Date().toISOString().slice(0, 10)
            ? "triggered"
            : "waiting",
        detail: `Last aggregate: ${sentimentStatus.lastRun ?? "never"}`,
        lastRunAt: sentimentStatus.lastRun ?? undefined,
      },
      {
        id: "fear_greed_contrarian",
        name: "Fear & Greed Contrarian",
        status: positions.some(
          (p) => p.position.strategy === "fear_greed_contrarian"
        )
          ? "active"
          : fearGreed && fearGreed.value <= 20
            ? "triggered"
            : "idle",
        detail: fearGreed
          ? `F&G: ${fearGreed.value} (${fearGreed.classification})`
          : "F&G unavailable",
      },
    ];

    return NextResponse.json({
      news,
      fearGreed,
      strategies,
      positions,
      trades: trades.slice(0, 50),
      analytics,
      portfolio,
      health: health ?? {
        status: "yellow",
        message: "No cron run recorded yet",
      },
      liveTrading: process.env.NEXT_PUBLIC_LIVE_TRADING === "true",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
