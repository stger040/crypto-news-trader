import {
  getOpenPositionsByStrategy,
  openPosition,
  closePosition,
  logSignal,
  getArticlesLast24h,
  getArticlesPrior24h,
} from "../db";
import {
  getKrakenPrice,
  placeMarketOrder,
  estimateFee,
} from "../kraken";
import { getPortfolioCash, getPortfolioTotal } from "../portfolio";
import { notify } from "../notify";
import type { NewsArticle, CronOptions } from "../types";

const POSITION_SIZE_PCT = 0.04;
const CHANGE_THRESHOLD = 0.15;
const MIN_TEST_SIZE_USD = 50;

export interface SentimentMomentumResult {
  action: string;
  detail: string;
}

export function computeDecayWeightedAvg(
  articles: Pick<NewsArticle, "published_at" | "sentiment_score">[],
  now = Date.now()
): number {
  let weightedSum = 0;
  let weightTotal = 0;
  for (const a of articles) {
    if (a.sentiment_score == null) continue;
    const hoursOld =
      (now - new Date(a.published_at).getTime()) / (1000 * 60 * 60);
    const w = Math.exp(-0.5 * hoursOld);
    weightedSum += Number(a.sentiment_score) * w;
    weightTotal += w;
  }
  return weightTotal ? weightedSum / weightTotal : 0;
}

export function shouldRunSentimentMomentumDaily(
  now = new Date(),
  testRun = false
): boolean {
  if (testRun) return true;
  const h = now.getUTCHours();
  const m = now.getUTCMinutes();
  return h === 0 && m >= 2 && m <= 8;
}

export async function runSentimentMomentumStrategy(
  options: CronOptions = {}
): Promise<SentimentMomentumResult> {
  const currentArticles = await getArticlesLast24h();
  const priorArticles = await getArticlesPrior24h();
  const currentAvg = computeDecayWeightedAvg(currentArticles);
  const priorAvg = computeDecayWeightedAvg(priorArticles);
  const scoreChange = currentAvg - priorAvg;

  const openPositions = await getOpenPositionsByStrategy("sentimentMomentum");

  if (scoreChange < -CHANGE_THRESHOLD) {
    for (const pos of openPositions) {
      const price = await getKrakenPrice(pos.pair);
      await closePosition(
        pos.id,
        price,
        "sentiment_shift_bearish",
        estimateFee(Number(pos.size_usd))
      );
      await placeMarketOrder(pos.pair, "sell", Number(pos.size_usd));
    }
    await logSignal({
      strategy: "sentimentMomentum",
      signal_type: "bearish",
      sentiment_score: currentAvg,
      acted_on: openPositions.length > 0,
      skip_reason: openPositions.length ? undefined : "no_positions_to_close",
    });
    return {
      action: "close",
      detail: `Weighted sentiment dropped ${scoreChange.toFixed(3)} — closed ${openPositions.length} positions`,
    };
  }

  if (scoreChange > CHANGE_THRESHOLD && currentAvg > 0) {
    const portfolioTotal = await getPortfolioTotal();
    const cash = await getPortfolioCash();
    const opened: string[] = [];

    for (const pair of ["BTC", "ETH"]) {
      if (openPositions.some((p) => p.pair === pair)) continue;

      let sizeUsd = portfolioTotal * POSITION_SIZE_PCT;
      if (options.testRun) sizeUsd = Math.max(sizeUsd, MIN_TEST_SIZE_USD);
      if (cash < sizeUsd) continue;

      const entryPrice = await getKrakenPrice(pair);
      await placeMarketOrder(pair, "buy", sizeUsd);

      await openPosition({
        pair,
        side: "long",
        strategy: "sentimentMomentum",
        entry_price: entryPrice,
        size_usd: sizeUsd,
        simulated: true,
      });

      opened.push(pair);
      await notify(
        "Sentiment Momentum",
        `Long ${pair} — weighted sentiment change +${scoreChange.toFixed(3)}`
      );
    }

    await logSignal({
      strategy: "sentimentMomentum",
      signal_type: "bullish",
      sentiment_score: currentAvg,
      acted_on: opened.length > 0,
    });

    return {
      action: "long",
      detail: `Opened: ${opened.join(", ") || "none"} (weighted Δ ${scoreChange.toFixed(3)})`,
    };
  }

  if (options.testRun) {
    const portfolioTotal = await getPortfolioTotal();
    const sizeUsd = Math.max(
      portfolioTotal * POSITION_SIZE_PCT,
      MIN_TEST_SIZE_USD
    );
    const entryPrice = await getKrakenPrice("BTC");
    await openPosition({
      pair: "BTC",
      side: "long",
      strategy: "sentimentMomentum",
      entry_price: entryPrice,
      size_usd: sizeUsd,
      simulated: true,
    });
    return { action: "test_long", detail: "Test run forced BTC long" };
  }

  return {
    action: "hold",
    detail: `No significant weighted change (Δ ${scoreChange.toFixed(3)})`,
  };
}
