import {
  getOpenPositionsByStrategy,
  openPosition,
  closePosition,
  logSignal,
  getAvgSentimentHours,
  getAvgSentimentPrior24h,
} from "../db";
import {
  getKrakenPrice,
  placeMarketOrder,
  estimateFee,
} from "../kraken";
import { getPortfolioCash, getPortfolioTotal } from "../portfolio";
import { notify } from "../notify";
import type { CronOptions } from "../types";

const POSITION_SIZE_PCT = 0.04;
const CHANGE_THRESHOLD = 0.15;
const MIN_TEST_SIZE_USD = 50;

export interface SentimentMomentumResult {
  action: string;
  detail: string;
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
  const current = await getAvgSentimentHours(24);
  const priorOnly = await getAvgSentimentPrior24h();
  const scoreChange = current.avg - priorOnly;

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
      sentiment_score: current.avg,
      acted_on: openPositions.length > 0,
      skip_reason: openPositions.length ? undefined : "no_positions_to_close",
    });
    return {
      action: "close",
      detail: `Sentiment dropped ${scoreChange.toFixed(3)} — closed ${openPositions.length} positions`,
    };
  }

  if (scoreChange > CHANGE_THRESHOLD && current.avg > 0) {
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
        `Long ${pair} — daily sentiment change +${scoreChange.toFixed(3)}`
      );
    }

    await logSignal({
      strategy: "sentimentMomentum",
      signal_type: "bullish",
      sentiment_score: current.avg,
      acted_on: opened.length > 0,
    });

    return {
      action: "long",
      detail: `Opened: ${opened.join(", ") || "none"} (Δ ${scoreChange.toFixed(3)})`,
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
    detail: `No significant change (Δ ${scoreChange.toFixed(3)})`,
  };
}
