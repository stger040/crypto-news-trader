import { getJson, setJson } from "../redis";
import { getKrakenPrice, placeMarketOrder } from "../kraken";
import { getPortfolio, updatePortfolioCash } from "../portfolio";
import {
  addPosition,
  generatePositionId,
  getOpenPositions,
  closePosition,
} from "../positions";
import { notify } from "../notify";
import type {
  DailySentimentAggregate,
  ScoredNewsItem,
  TradingPair,
} from "../types";

const AGGREGATE_KEY = "sentiment:daily";
const LAST_RUN_KEY = "sentiment:last_aggregate_run";
const CHANGE_THRESHOLD = 0.15;
const POSITION_SIZE_PCT = 0.05;
const HOLD_HOURS = 24;
const TARGET_PAIRS: TradingPair[] = ["BTC", "ETH"];

export interface SentimentMomentumResult {
  action: "long" | "cash" | "hold" | "none";
  todayScore?: number;
  scoreChange?: number;
  detail: string;
}

function utcDateString(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function yesterdayDateString(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return utcDateString(d);
}

export function computeWeightedSentimentScore(
  items: ScoredNewsItem[]
): number {
  const scored = items.filter((i) => i.sentiment);
  if (!scored.length) return 0;

  let weightedSum = 0;
  let weightTotal = 0;

  for (const item of scored) {
    const w =
      (item.sentiment!.confidence || 0.5) *
      (1 + item.votes.important * 0.1);
    weightedSum += item.sentiment!.score * w;
    weightTotal += w;
  }

  return weightTotal ? weightedSum / weightTotal : 0;
}

export async function saveDailyAggregate(
  date: string,
  score: number,
  itemCount: number
): Promise<void> {
  const history =
    (await getJson<DailySentimentAggregate[]>(AGGREGATE_KEY)) ?? [];
  const filtered = history.filter((h) => h.date !== date);
  filtered.push({ date, score, itemCount });
  filtered.sort((a, b) => a.date.localeCompare(b.date));
  await setJson(AGGREGATE_KEY, filtered.slice(-90));
}

export async function getDailyAggregates(): Promise<DailySentimentAggregate[]> {
  return (await getJson<DailySentimentAggregate[]>(AGGREGATE_KEY)) ?? [];
}

export function shouldRecomputeDailyAggregate(): boolean {
  const now = new Date();
  const hour = now.getUTCHours();
  const minute = now.getUTCMinutes();
  return hour === 0 && minute < 10;
}

export async function runSentimentMomentumDaily(
  news: ScoredNewsItem[],
  force = false
): Promise<SentimentMomentumResult> {
  const lastRun = await getJson<string>(LAST_RUN_KEY);
  const today = utcDateString();
  const yesterday = yesterdayDateString();

  if (!force && !shouldRecomputeDailyAggregate()) {
    if (lastRun === today) {
      return { action: "none", detail: "Already aggregated today" };
    }
    return { action: "none", detail: "Outside 00:01 UTC window" };
  }

  if (!force && lastRun === today) {
    return { action: "none", detail: "Already ran today" };
  }

  const yesterdayItems = news.filter((n) => {
    const pub = n.published_at.slice(0, 10);
    return pub === yesterday;
  });

  const todayScore = computeWeightedSentimentScore(yesterdayItems);
  await saveDailyAggregate(yesterday, todayScore, yesterdayItems.length);
  await setJson(LAST_RUN_KEY, today);

  const aggregates = await getDailyAggregates();
  const prior = aggregates
    .filter((a) => a.date < yesterday)
    .sort((a, b) => b.date.localeCompare(a.date))[0];

  const priorScore = prior?.score ?? 0;
  const scoreChange = todayScore - priorScore;

  const openPositions = await getOpenPositions();
  const sentimentPositions = openPositions.filter(
    (p) => p.strategy === "sentiment_momentum"
  );

  if (sentimentPositions.length > 0) {
    const oldest = sentimentPositions.sort(
      (a, b) =>
        new Date(a.openedAt).getTime() - new Date(b.openedAt).getTime()
    )[0];
    const holdMs = HOLD_HOURS * 60 * 60 * 1000;
    if (Date.now() - new Date(oldest.openedAt).getTime() < holdMs) {
      return {
        action: "hold",
        todayScore,
        scoreChange,
        detail: `Holding positions (${sentimentPositions.length})`,
      };
    }

    for (const pos of sentimentPositions) {
      const price = await getKrakenPrice(pos.pair);
      const trade = await closePosition(pos.id, price, "24h sentiment hold complete");
      await placeMarketOrder(pos.pair, "sell", pos.sizeAsset);
      if (trade) await updatePortfolioCash(pos.sizeAsset * price);
    }
  }

  if (scoreChange > CHANGE_THRESHOLD) {
    const portfolio = await getPortfolio();
    const opened: string[] = [];

    for (const pair of TARGET_PAIRS) {
      const sizeUsd = portfolio.totalUsd * POSITION_SIZE_PCT;
      if (portfolio.cashUsd < sizeUsd) continue;

      const entryPrice = await getKrakenPrice(pair);
      const sizeAsset = sizeUsd / entryPrice;
      await placeMarketOrder(pair, "buy", sizeAsset);

      await addPosition({
        id: generatePositionId(),
        pair,
        strategy: "sentiment_momentum",
        side: "long",
        entryPrice,
        sizeUsd,
        sizeAsset,
        stopLossPct: 0,
        takeProfitPct: 0,
        openedAt: new Date().toISOString(),
        entryReason: `Daily sentiment change +${scoreChange.toFixed(3)}`,
        paper: process.env.LIVE_TRADING !== "true",
      });

      await updatePortfolioCash(-sizeUsd);
      opened.push(pair);
    }

    await notify(
      "Sentiment Momentum Long",
      `Opened BTC/ETH — score change ${scoreChange.toFixed(3)}`
    );

    return {
      action: "long",
      todayScore,
      scoreChange,
      detail: `Opened: ${opened.join(", ") || "none"}`,
    };
  }

  if (scoreChange < -CHANGE_THRESHOLD) {
    return {
      action: "cash",
      todayScore,
      scoreChange,
      detail: "Bearish sentiment shift — staying in cash",
    };
  }

  return {
    action: "none",
    todayScore,
    scoreChange,
    detail: "No significant sentiment change",
  };
}

export async function getSentimentMomentumStatus(): Promise<{
  aggregates: DailySentimentAggregate[];
  lastRun: string | null;
}> {
  return {
    aggregates: await getDailyAggregates(),
    lastRun: await getJson<string>(LAST_RUN_KEY),
  };
}
