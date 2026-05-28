import {
  getOpenPositions,
  openPosition,
  logSignal,
  hasOpenPositionForPair,
  getRecentHighScoreArticles,
  getBearishRecentArticles,
  getLatestSentimentSnapshot,
} from "../db";
import {
  getKrakenPrice,
  get24hPriceChangePct,
  placeMarketOrder,
} from "../kraken";
import { getPortfolioCash, getPortfolioTotal } from "../portfolio";
import { notify } from "../notify";
import { fetchFundingRates } from "../fundingRate";
import { isCorroborated } from "../confirmation";
import { getVelocityMultiplier, boostConfidence } from "../velocity";
import type { CronOptions, MarketRegime } from "../types";

const MAX_MOMENTUM_POSITIONS = 2;
const BASE_POSITION_SIZE_PCT = 0.03;
const MIN_TEST_SIZE_USD = 50;
const MIN_CONFIDENCE = 0.7;
const FUNDING_THRESHOLD = 0.0003;

const REGIME_THRESHOLDS: Record<MarketRegime, number> = {
  bull: 0.55,
  neutral: 0.65,
  bear: 0.75,
};

const REGIME_SIZE_MULTIPLIER: Record<MarketRegime, number> = {
  bull: 1.0,
  neutral: 1.0,
  bear: 0.5,
};

export interface MomentumResult {
  opened: number;
  skipped: string[];
}

export async function runMomentumStrategy(
  options: CronOptions = {}
): Promise<MomentumResult> {
  const result: MomentumResult = { opened: 0, skipped: [] };
  const regime: MarketRegime = options.regime ?? "neutral";
  const sentimentThreshold = REGIME_THRESHOLDS[regime];
  const sizeMultiplier = REGIME_SIZE_MULTIPLIER[regime];

  const openAll = await getOpenPositions();
  const momentumOpen = openAll.filter((p) => p.strategy === "momentum");

  const bearish = await getBearishRecentArticles();
  for (const article of bearish) {
    await logSignal({
      strategy: "momentum",
      pair: article.affected_pairs?.[0] ?? null,
      signal_type: "bearish",
      sentiment_score: article.sentiment_score,
      acted_on: false,
      skip_reason: "no_short_on_spot",
      regime,
    });
  }

  if (momentumOpen.length >= MAX_MOMENTUM_POSITIONS && !options.testRun) {
    result.skipped.push("Max momentum positions (2) reached");
    return result;
  }

  const minScore = regime === "bull" ? 0.55 : regime === "bear" ? 0.65 : 0.65;
  const articles = options.testRun
    ? await getRecentHighScoreArticles(9999, true, minScore)
    : await getRecentHighScoreArticles(30, true, minScore);

  const portfolioTotal = await getPortfolioTotal();
  let slotsLeft = MAX_MOMENTUM_POSITIONS - momentumOpen.length;

  let latestFg: number | null = null;
  if (regime === "bear" && !options.testRun) {
    const snap = await getLatestSentimentSnapshot();
    latestFg = snap?.fear_greed_value ?? null;
  }

  for (const article of articles) {
    if (slotsLeft <= 0 && !options.testRun) break;

    const score = Number(article.sentiment_score ?? 0);
    if (score < sentimentThreshold && !options.testRun) {
      continue;
    }

    const pairs = article.affected_pairs ?? [];
    for (const pair of pairs) {
      if (slotsLeft <= 0 && !options.testRun) break;

      if (await hasOpenPositionForPair(pair)) {
        result.skipped.push(`${pair}: position already open`);
        continue;
      }

      if (
        regime === "bear" &&
        !options.testRun &&
        (latestFg == null || latestFg >= 45)
      ) {
        result.skipped.push(`${pair}: bear regime requires F&G < 45`);
        await logSignal({
          strategy: "momentum",
          pair,
          signal_type: "bullish",
          sentiment_score: article.sentiment_score,
          acted_on: false,
          skip_reason: "bear_fg_confirmation_failed",
          regime,
        });
        continue;
      }

      const velocityMultiplier = await getVelocityMultiplier(pair);
      const baseConfidence = Number(article.confidence ?? 0);
      const effectiveConfidence = options.testRun
        ? baseConfidence
        : boostConfidence(baseConfidence, velocityMultiplier);

      if (effectiveConfidence < MIN_CONFIDENCE && !options.testRun) {
        result.skipped.push(
          `${pair}: effective confidence ${effectiveConfidence.toFixed(2)}`
        );
        continue;
      }

      const changePct = options.testRun
        ? 0
        : await get24hPriceChangePct(pair);
      if (changePct > 8) {
        result.skipped.push(`${pair}: already moved +${changePct.toFixed(1)}%`);
        await logSignal({
          strategy: "momentum",
          pair,
          signal_type: "bullish",
          sentiment_score: article.sentiment_score,
          velocity_multiplier: velocityMultiplier,
          acted_on: false,
          skip_reason: "price_already_moved_8pct",
          regime,
        });
        continue;
      }

      if (!options.testRun) {
        const corroborated = await isCorroborated(article.id, 30);
        if (!corroborated) {
          result.skipped.push(
            `${pair}: single-source signal — awaiting corroboration`
          );
          await logSignal({
            strategy: "momentum",
            pair,
            signal_type: "bullish",
            sentiment_score: article.sentiment_score,
            velocity_multiplier: velocityMultiplier,
            acted_on: false,
            skip_reason: "single_source_unconfirmed",
            regime,
          });
          continue;
        }
      }

      const fundingRates = await fetchFundingRates([pair]);
      const funding = fundingRates[pair] ?? 0;

      if (funding > FUNDING_THRESHOLD && !options.testRun) {
        result.skipped.push(
          `${pair}: funding too high (${funding.toFixed(4)}) — crowded longs`
        );
        await logSignal({
          strategy: "momentum",
          pair,
          signal_type: "bullish",
          sentiment_score: article.sentiment_score,
          funding_rate: funding,
          velocity_multiplier: velocityMultiplier,
          acted_on: false,
          skip_reason: `funding_crowded_${funding.toFixed(4)}`,
          regime,
        });
        continue;
      }

      let sizeUsd = portfolioTotal * BASE_POSITION_SIZE_PCT * sizeMultiplier;
      if (options.testRun) {
        sizeUsd = Math.max(sizeUsd, MIN_TEST_SIZE_USD);
      }

      const cash = await getPortfolioCash();
      if (cash < sizeUsd) {
        result.skipped.push(`${pair}: insufficient cash`);
        continue;
      }

      const entryPrice = await getKrakenPrice(pair);
      await placeMarketOrder(pair, "buy", sizeUsd);

      await openPosition({
        pair,
        side: "long",
        strategy: "momentum",
        entry_price: entryPrice,
        size_usd: sizeUsd,
        trigger_article_id: article.id,
        simulated: options.testRun ? true : process.env.LIVE_TRADING !== "true",
        regime,
      });

      await logSignal({
        strategy: "momentum",
        pair,
        signal_type: "bullish",
        sentiment_score: article.sentiment_score,
        funding_rate: funding,
        velocity_multiplier: velocityMultiplier,
        acted_on: true,
        regime,
      });

      await notify(
        "Momentum Long",
        `${pair} @ $${entryPrice.toFixed(2)} — ${article.title.slice(0, 60)} [${regime}]`
      );

      result.opened++;
      slotsLeft--;
    }
  }

  return result;
}
