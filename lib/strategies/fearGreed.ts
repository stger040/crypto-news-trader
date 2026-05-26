import { getKrakenPrice, placeMarketOrder } from "../kraken";
import { getPortfolio, updatePortfolioCash } from "../portfolio";
import {
  addPosition,
  closePosition,
  generatePositionId,
  getOpenPositions,
} from "../positions";
import { notify } from "../notify";
import type { FearAndGreedData } from "../types";

const EXTREME_FEAR = 20;
const EXTREME_GREED = 80;
const POSITION_SIZE_PCT = 0.03;
const MAX_POSITIONS = 5;
const MAX_ALLOCATION_PCT = 0.15;

export interface FearGreedResult {
  opened: boolean;
  closed: number;
  detail: string;
}

export async function runFearGreedContrarian(
  fng: FearAndGreedData
): Promise<FearGreedResult> {
  const openPositions = await getOpenPositions();
  const fgPositions = openPositions.filter(
    (p) => p.strategy === "fear_greed_contrarian"
  );

  let closed = 0;

  if (fng.value >= EXTREME_GREED) {
    for (const pos of fgPositions) {
      const price = await getKrakenPrice(pos.pair);
      const trade = await closePosition(pos.id, price, "F&G extreme greed exit");
      await placeMarketOrder(pos.pair, "sell", pos.sizeAsset);
      if (trade) await updatePortfolioCash(pos.sizeAsset * price);
      closed++;
    }

    if (closed > 0) {
      await notify("F&G Exit", `Closed ${closed} positions at extreme greed`);
    }

    return {
      opened: false,
      closed,
      detail:
        closed > 0
          ? `Closed ${closed} at greed ${fng.value}`
          : `Greed ${fng.value} — no F&G positions`,
    };
  }

  if (fng.value > EXTREME_FEAR) {
    return {
      opened: false,
      closed: 0,
      detail: `F&G ${fng.value} — not extreme fear`,
    };
  }

  if (fgPositions.length >= MAX_POSITIONS) {
    return {
      opened: false,
      closed: 0,
      detail: `Max ${MAX_POSITIONS} F&G positions reached`,
    };
  }

  const portfolio = await getPortfolio();
  const fgAllocation = fgPositions.reduce((s, p) => s + p.sizeUsd, 0);
  const maxAllocation = portfolio.totalUsd * MAX_ALLOCATION_PCT;
  const sizeUsd = portfolio.totalUsd * POSITION_SIZE_PCT;

  if (fgAllocation + sizeUsd > maxAllocation) {
    return {
      opened: false,
      closed: 0,
      detail: "F&G max portfolio allocation (15%) reached",
    };
  }

  if (portfolio.cashUsd < sizeUsd) {
    return {
      opened: false,
      closed: 0,
      detail: "Insufficient cash for F&G DCA",
    };
  }

  const hasBtcFg = fgPositions.some((p) => p.pair === "BTC");
  if (hasBtcFg) {
    return {
      opened: false,
      closed: 0,
      detail: "BTC F&G position already open",
    };
  }

  const entryPrice = await getKrakenPrice("BTC");
  const sizeAsset = sizeUsd / entryPrice;

  await placeMarketOrder("BTC", "buy", sizeAsset);

  await updatePortfolioCash(-sizeUsd);

  await addPosition({
    id: generatePositionId(),
    pair: "BTC",
    strategy: "fear_greed_contrarian",
    side: "long",
    entryPrice,
    sizeUsd,
    sizeAsset,
    stopLossPct: 0,
    takeProfitPct: 0,
    openedAt: new Date().toISOString(),
    entryReason: `Extreme fear DCA (F&G=${fng.value})`,
    paper: process.env.LIVE_TRADING !== "true",
  });

  await notify(
    "F&G DCA Entry",
    `Bought BTC @ $${entryPrice.toFixed(2)} — Extreme Fear (${fng.value})`
  );

  return {
    opened: true,
    closed: 0,
    detail: `DCA BTC at F&G ${fng.value}`,
  };
}
