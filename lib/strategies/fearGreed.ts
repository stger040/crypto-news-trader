import {
  getOpenPositionsByStrategy,
  openPosition,
  closePosition,
  logSignal,
  getLatestSentimentSnapshot,
} from "../db";
import {
  getKrakenPrice,
  placeMarketOrder,
  estimateFee,
} from "../kraken";
import { getPortfolioCash, getPortfolioTotal } from "../portfolio";
import { notify } from "../notify";
import type { CronOptions, MarketRegime } from "../types";

const EXTREME_GREED = 80;
const MAX_POSITIONS = 5;
const BASE_POSITION_SIZE_PCT = 0.03;
const MAX_ALLOCATION_PCT = 0.15;
const MIN_TEST_SIZE_USD = 50;

function getFearTriggerThreshold(regime: MarketRegime): number {
  return regime === "bull" ? 15 : 20;
}

function getTieredSizePct(fngValue: number): number {
  if (fngValue < 10) return BASE_POSITION_SIZE_PCT * 2;
  if (fngValue <= 14) return BASE_POSITION_SIZE_PCT * 1.5;
  if (fngValue <= 20) return BASE_POSITION_SIZE_PCT;
  return BASE_POSITION_SIZE_PCT;
}

export interface FearGreedResult {
  action: string;
  detail: string;
}

export async function runFearGreedStrategy(
  fngValue: number,
  options: CronOptions = {}
): Promise<FearGreedResult> {
  const regime: MarketRegime = options.regime ?? "neutral";
  const fgPositions = await getOpenPositionsByStrategy("fearGreed");

  if (fngValue >= EXTREME_GREED || (options.testRun && fngValue >= 80)) {
    let closed = 0;
    for (const pos of fgPositions) {
      const price = await getKrakenPrice(pos.pair);
      await closePosition(
        pos.id,
        price,
        "extreme_greed_exit",
        estimateFee(Number(pos.size_usd))
      );
      await placeMarketOrder(pos.pair, "sell", Number(pos.size_usd));
      closed++;
    }

    if (closed > 0) {
      await notify("F&G Exit", `Closed ${closed} positions at greed ${fngValue}`);
    }

    await logSignal({
      strategy: "fearGreed",
      pair: "BTC",
      signal_type: "exit",
      fear_greed_value: fngValue,
      acted_on: closed > 0,
      regime,
    });

    return {
      action: "close",
      detail: `Extreme greed (${fngValue}) — closed ${closed}`,
    };
  }

  const fearThreshold = getFearTriggerThreshold(regime);
  const effectiveFng = options.testRun ? fearThreshold : fngValue;

  if (effectiveFng > fearThreshold && !options.testRun) {
    return { action: "wait", detail: `F&G ${fngValue} — not extreme fear` };
  }

  if (fgPositions.length >= MAX_POSITIONS) {
    await logSignal({
      strategy: "fearGreed",
      pair: "BTC",
      signal_type: "entry",
      fear_greed_value: fngValue,
      acted_on: false,
      skip_reason: "max_fg_positions",
      regime,
    });
    return { action: "skip", detail: "Max 5 F&G positions reached" };
  }

  const portfolioTotal = await getPortfolioTotal();
  const fgAllocation = fgPositions.reduce(
    (s, p) => s + Number(p.size_usd),
    0
  );
  const tierPct = getTieredSizePct(effectiveFng);
  let sizeUsd = portfolioTotal * tierPct;
  if (options.testRun) sizeUsd = Math.max(sizeUsd, MIN_TEST_SIZE_USD);

  if (fgAllocation + sizeUsd > portfolioTotal * MAX_ALLOCATION_PCT) {
    return { action: "skip", detail: "F&G 15% allocation cap reached" };
  }

  const cash = await getPortfolioCash();
  if (cash < sizeUsd) {
    return { action: "skip", detail: "Insufficient cash" };
  }

  const entryPrice = await getKrakenPrice("BTC");
  await placeMarketOrder("BTC", "buy", sizeUsd);

  await openPosition({
    pair: "BTC",
    side: "long",
    strategy: "fearGreed",
    entry_price: entryPrice,
    size_usd: sizeUsd,
    simulated: true,
    regime,
  });

  await logSignal({
    strategy: "fearGreed",
    pair: "BTC",
    signal_type: "entry",
    fear_greed_value: fngValue,
    acted_on: true,
    regime,
  });

  const tierLabel =
    effectiveFng < 10 ? "Panic" : effectiveFng <= 14 ? "Deep Fear" : "Extreme Fear";

  await notify(
    "F&G DCA",
    `BTC @ $${entryPrice.toFixed(2)} — ${tierLabel} (${fngValue}) [${regime}]`
  );

  return {
    action: "open",
    detail: `DCA BTC at F&G ${fngValue} (${(tierPct * 100).toFixed(1)}% size)`,
  };
}

export async function getLatestFearGreedFromDb(): Promise<number> {
  const snap = await getLatestSentimentSnapshot();
  return snap?.fear_greed_value ?? 50;
}
