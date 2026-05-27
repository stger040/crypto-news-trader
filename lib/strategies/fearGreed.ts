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
import type { CronOptions } from "../types";

const EXTREME_FEAR = 20;
const EXTREME_GREED = 80;
const MAX_POSITIONS = 5;
const POSITION_SIZE_PCT = 0.03;
const MAX_ALLOCATION_PCT = 0.15;
const MIN_TEST_SIZE_USD = 50;

export interface FearGreedResult {
  action: string;
  detail: string;
}

export async function runFearGreedStrategy(
  fngValue: number,
  options: CronOptions = {}
): Promise<FearGreedResult> {
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
    });

    return {
      action: "close",
      detail: `Extreme greed (${fngValue}) — closed ${closed}`,
    };
  }

  const effectiveFng = options.testRun ? EXTREME_FEAR : fngValue;

  if (effectiveFng > EXTREME_FEAR && !options.testRun) {
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
    });
    return { action: "skip", detail: "Max 5 F&G positions reached" };
  }

  const portfolioTotal = await getPortfolioTotal();
  const fgAllocation = fgPositions.reduce(
    (s, p) => s + Number(p.size_usd),
    0
  );
  let sizeUsd = portfolioTotal * POSITION_SIZE_PCT;
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
  });

  await logSignal({
    strategy: "fearGreed",
    pair: "BTC",
    signal_type: "entry",
    fear_greed_value: fngValue,
    acted_on: true,
  });

  await notify(
    "F&G DCA",
    `BTC @ $${entryPrice.toFixed(2)} — Extreme Fear (${fngValue})`
  );

  return { action: "open", detail: `DCA BTC at F&G ${fngValue}` };
}

export async function getLatestFearGreedFromDb(): Promise<number> {
  const snap = await getLatestSentimentSnapshot();
  return snap?.fear_greed_value ?? 50;
}
