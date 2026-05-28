import {
  getOpenPositionsByStrategy,
  openPosition,
  logSignal,
  getLatestSentimentSnapshot,
  getSentimentSnapshotNearHoursAgo,
} from "../db";
import {
  getKrakenPrice,
  get24hPriceChangePct,
  placeMarketOrder,
} from "../kraken";
import { getPortfolioCash, getPortfolioTotal } from "../portfolio";
import { fetchFundingRates } from "../fundingRate";
import { notify } from "../notify";
import type { CronOptions } from "../types";

const POSITION_SIZE_PCT = 0.05;
const STOP_LOSS_PCT = -8;
const TAKE_PROFIT_PCT = 10;
const MIN_TEST_SIZE_USD = 50;
const FUNDING_BEAR_THRESHOLD = -0.00005;

export interface CapitulationBounceResult {
  action: string;
  detail: string;
}

export async function runCapitulationBounceStrategy(
  options: CronOptions = {}
): Promise<CapitulationBounceResult> {
  const regime = options.regime ?? "neutral";
  const open = await getOpenPositionsByStrategy("capitulationBounce");

  if (open.length > 0 && !options.testRun) {
    await logSignal({
      strategy: "capitulationBounce",
      pair: "BTC",
      signal_type: "skip",
      acted_on: false,
      skip_reason: "position_already_open",
      regime,
    });
    return { action: "hold", detail: "Capitulation bounce position already open" };
  }

  const dropPct = options.testRun
    ? -16
    : await get24hPriceChangePct("BTC");
  const absDrop = Math.abs(dropPct);

  if (dropPct > -15 && !options.testRun) {
    await logSignal({
      strategy: "capitulationBounce",
      pair: "BTC",
      signal_type: "skip",
      acted_on: false,
      skip_reason: `btc_24h_drop_${dropPct.toFixed(1)}pct`,
      regime,
    });
    return {
      action: "skip",
      detail: `BTC 24h change ${dropPct.toFixed(1)}% — need >15% drop`,
    };
  }

  const latestFg = await getLatestSentimentSnapshot();
  const fgNow = latestFg?.fear_greed_value ?? 50;
  const fg48h = await getSentimentSnapshotNearHoursAgo(48);
  const fgPrior = fg48h?.fear_greed_value ?? fgNow;
  const fgDrop = fgPrior - fgNow;

  if (fgDrop <= 10 && !options.testRun) {
    await logSignal({
      strategy: "capitulationBounce",
      pair: "BTC",
      signal_type: "skip",
      fear_greed_value: fgNow,
      acted_on: false,
      skip_reason: `fg_drop_${fgDrop.toFixed(0)}pts`,
      regime,
    });
    return {
      action: "skip",
      detail: `F&G drop ${fgDrop.toFixed(0)} pts — need >10 pt drop`,
    };
  }

  const fundingRates = await fetchFundingRates(["BTC"]);
  const funding = fundingRates.BTC ?? 0;

  if (funding >= FUNDING_BEAR_THRESHOLD && !options.testRun) {
    await logSignal({
      strategy: "capitulationBounce",
      pair: "BTC",
      signal_type: "skip",
      funding_rate: funding,
      acted_on: false,
      skip_reason: "funding_not_negative_enough",
      regime,
    });
    return {
      action: "skip",
      detail: `Funding ${(funding * 100).toFixed(4)}% — need deeply negative`,
    };
  }

  const portfolioTotal = await getPortfolioTotal();
  let sizeUsd = portfolioTotal * POSITION_SIZE_PCT;
  if (options.testRun) sizeUsd = Math.max(sizeUsd, MIN_TEST_SIZE_USD);

  const cash = await getPortfolioCash();
  if (cash < sizeUsd) {
    return { action: "skip", detail: "Insufficient cash" };
  }

  const entryPrice = await getKrakenPrice("BTC");
  await placeMarketOrder("BTC", "buy", sizeUsd);

  await openPosition({
    pair: "BTC",
    side: "long",
    strategy: "capitulationBounce",
    entry_price: entryPrice,
    size_usd: sizeUsd,
    simulated: true,
    regime,
  });

  await logSignal({
    strategy: "capitulationBounce",
    pair: "BTC",
    signal_type: "entry",
    fear_greed_value: fgNow,
    funding_rate: funding,
    acted_on: true,
    regime,
  });

  await notify(
    "Capitulation Bounce",
    `⚡ Capitulation Bounce — BTC dropped ${absDrop.toFixed(1)}% in 24h, F&G at ${fgNow}, funding ${(funding * 100).toFixed(4)}%. Long BTC @ $${entryPrice.toFixed(2)}. TP +10% / SL -8% / 48h time stop.`
  );

  return {
    action: "open",
    detail: `Long BTC ${absDrop.toFixed(1)}% capitulation bounce`,
  };
}

export { STOP_LOSS_PCT, TAKE_PROFIT_PCT };
