import { TRADING_PAIRS } from "./constants";
import { fetchAllDataSources } from "./dataSources";
import { scoreHeadlines } from "./sentiment";
import {
  attachSentimentToNews,
  runBreakingNewsMomentum,
} from "./strategies/momentum";
import { runSentimentMomentumDaily } from "./strategies/sentimentMomentum";
import { runFearGreedContrarian } from "./strategies/fearGreed";
import { manageOpenPositions } from "./positionManager";
import {
  getTotalPositionsValueUsd,
  getOpenPositions,
} from "./positions";
import { setPortfolioTotal, savePortfolioSnapshot } from "./portfolio";
import { rebuildAnalytics } from "./analytics";
import { setJson, getJson } from "./redis";
import type { BotHealth, ScoredNewsItem } from "./types";

const HEALTH_KEY = "bot:health";
const LAST_CRON_KEY = "bot:last_cron";
const SCORED_NEWS_KEY = "feed:scored_news";

export interface CronRunResult {
  ok: boolean;
  steps: Record<string, unknown>;
  durationMs: number;
}

export async function runCronCycle(forceDailySentiment = false): Promise<CronRunResult> {
  const start = Date.now();
  const steps: Record<string, unknown> = {};

  try {
    const data = await fetchAllDataSources(TRADING_PAIRS);
    steps.dataSources = {
      news: data.news.length,
      reddit: data.reddit.length,
      listings: data.listings.length,
      fng: data.fearGreed.value,
    };

    const headlines = [
      ...data.news.map((n) => n.title),
      ...data.reddit.map((r) => r.title),
      ...data.listings.map((l) => l.title),
    ];
    const scores = await scoreHeadlines(headlines);
    steps.scored = scores.size;

    const scoredNews = attachSentimentToNews(data.news, scores);
    await setJson(SCORED_NEWS_KEY, scoredNews);

    const momentum = await runBreakingNewsMomentum(scoredNews);
    steps.momentum = momentum;

    const now = new Date();
    const runSentiment =
      forceDailySentiment ||
      (now.getUTCHours() === 0 && now.getUTCMinutes() < 10);
    if (runSentiment) {
      steps.sentimentMomentum = await runSentimentMomentumDaily(
        scoredNews,
        forceDailySentiment
      );
    } else {
      steps.sentimentMomentum = { skipped: "Not hourly aggregation window" };
    }

    steps.fearGreed = await runFearGreedContrarian(data.fearGreed);

    steps.positionManagement = await manageOpenPositions();

    const positionsValue = await getTotalPositionsValueUsd();
    const portfolio = await getJson<{ cashUsd: number }>("portfolio:current");
    const cashUsd = portfolio?.cashUsd ?? 10000;
    await setPortfolioTotal(cashUsd, positionsValue);

    const openCount = (await getOpenPositions()).length;
    steps.snapshot = await savePortfolioSnapshot(
      positionsValue,
      0,
      0
    );

    steps.analytics = await rebuildAnalytics();

    const health: BotHealth = {
      status: "green",
      message: `Cron OK — ${openCount} open positions`,
      lastCronAt: new Date().toISOString(),
    };
    await setJson(HEALTH_KEY, health);
    await setJson(LAST_CRON_KEY, new Date().toISOString());

    return {
      ok: true,
      steps,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    const health: BotHealth = {
      status: "red",
      message: "Cron failed",
      lastCronAt: new Date().toISOString(),
      lastError: err,
    };
    await setJson(HEALTH_KEY, health);

    return {
      ok: false,
      steps: { ...steps, error: err },
      durationMs: Date.now() - start,
    };
  }
}

export async function getScoredNewsFeed(): Promise<ScoredNewsItem[]> {
  return (await getJson<ScoredNewsItem[]>(SCORED_NEWS_KEY)) ?? [];
}
