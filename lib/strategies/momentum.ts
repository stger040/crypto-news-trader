import { meetsVolumeRequirement, getKrakenPrice, placeMarketOrder } from "../kraken";
import { getPortfolio, updatePortfolioCash } from "../portfolio";
import {
  addPosition,
  generatePositionId,
  getOpenPositions,
  isPairInBearishCooldown,
  logBearishSignal,
} from "../positions";
import { notify } from "../notify";
import type { CryptoPanicPost, ScoredNewsItem, SentimentResult, TradingPair } from "../types";

const BULLISH_THRESHOLD = 0.6;
const BEARISH_THRESHOLD = -0.6;
const MIN_IMPORTANT_VOTES = 3;
const POSITION_SIZE_PCT = 0.03;
const STOP_LOSS_PCT = 2.5;
const TAKE_PROFIT_PCT = 4;
const TIME_STOP_HOURS = 4;

const BEARISH_CATEGORIES = new Set([
  "hack_exploit",
  "regulatory_negative",
  "bearish",
]);

export interface MomentumResult {
  opened: string[];
  bearishLogged: string[];
  skipped: string[];
}

export async function runBreakingNewsMomentum(
  news: ScoredNewsItem[]
): Promise<MomentumResult> {
  const result: MomentumResult = {
    opened: [],
    bearishLogged: [],
    skipped: [],
  };

  const portfolio = await getPortfolio();
  const openPositions = await getOpenPositions();
  const openPairs = new Set(openPositions.map((p) => p.pair));

  for (const item of news) {
    if (!item.sentiment) continue;
    if (item.votes.important < MIN_IMPORTANT_VOTES) continue;

    const { sentiment } = item;

    if (
      sentiment.score <= BEARISH_THRESHOLD &&
      BEARISH_CATEGORIES.has(sentiment.category)
    ) {
      for (const pair of sentiment.affectedPairs) {
        const until = new Date(
          Date.now() + TIME_STOP_HOURS * 60 * 60 * 1000
        ).toISOString();
        await logBearishSignal(pair, item.title, until);
        result.bearishLogged.push(pair);
        await notify(
          "Bearish Signal",
          `${pair}: staying in cash — ${item.title.slice(0, 80)}`
        );
      }
      continue;
    }

    if (sentiment.score < BULLISH_THRESHOLD) continue;

    for (const pair of sentiment.affectedPairs) {
      if (openPairs.has(pair)) {
        result.skipped.push(`${pair}: already open`);
        continue;
      }

      if (await isPairInBearishCooldown(pair)) {
        result.skipped.push(`${pair}: bearish cooldown`);
        continue;
      }

      if (!(await meetsVolumeRequirement(pair))) {
        result.skipped.push(`${pair}: low volume`);
        continue;
      }

      const sizeUsd = portfolio.totalUsd * POSITION_SIZE_PCT;
      if (portfolio.cashUsd < sizeUsd) {
        result.skipped.push(`${pair}: insufficient cash`);
        continue;
      }

      const entryPrice = await getKrakenPrice(pair);
      const sizeAsset = sizeUsd / entryPrice;

      await placeMarketOrder(pair, "buy", sizeAsset);

      const timeStopAt = new Date(
        Date.now() + TIME_STOP_HOURS * 60 * 60 * 1000
      ).toISOString();

      await addPosition({
        id: generatePositionId(),
        pair,
        strategy: "breaking_news_momentum",
        side: "long",
        entryPrice,
        sizeUsd,
        sizeAsset,
        stopLossPct: STOP_LOSS_PCT,
        takeProfitPct: TAKE_PROFIT_PCT,
        openedAt: new Date().toISOString(),
        timeStopAt,
        entryReason: item.title,
        paper: process.env.LIVE_TRADING !== "true",
      });

      await updatePortfolioCash(-sizeUsd);
      openPairs.add(pair);
      result.opened.push(pair);

      await notify(
        "Momentum Long",
        `Opened ${pair} @ $${entryPrice.toFixed(2)} — ${item.title.slice(0, 60)}`
      );
    }
  }

  return result;
}

export function attachSentimentToNews(
  news: CryptoPanicPost[],
  scores: Map<string, import("../types").SentimentResult>
): ScoredNewsItem[] {
  return news.map((n) => ({
    ...n,
    sentiment: scores.get(n.title),
  }));
}
