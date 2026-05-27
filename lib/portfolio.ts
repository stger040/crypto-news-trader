import {
  getOpenPositions,
  getPortfolioSnapshot24hAgo,
  getClosedPnlSum,
} from "./db";
import { getKrakenPrice, INITIAL_CASH_USD } from "./kraken";

async function computePositionsValue(
  open: Awaited<ReturnType<typeof getOpenPositions>>
): Promise<number> {
  let positionsValue = 0;
  for (const pos of open) {
    try {
      const price = await getKrakenPrice(pos.pair);
      const sizeAsset = Number(pos.size_usd) / Number(pos.entry_price);
      positionsValue += sizeAsset * price;
    } catch {
      positionsValue += Number(pos.size_usd);
    }
  }
  return positionsValue;
}

async function computeAnchoredCash(): Promise<number> {
  const open = await getOpenPositions();
  const deployed = open.reduce((s, p) => s + Number(p.size_usd), 0);
  const closedPnl = await getClosedPnlSum();
  return INITIAL_CASH_USD - deployed + closedPnl;
}

export async function getPortfolioCash(): Promise<number> {
  return Math.max(0, await computeAnchoredCash());
}

export async function getPortfolioTotal(): Promise<number> {
  const open = await getOpenPositions();
  const positionsValue = await computePositionsValue(open);
  const cashUsd = await computeAnchoredCash();
  return Math.max(0, cashUsd) + positionsValue;
}

export async function computePortfolioSnapshot(): Promise<{
  total_value_usd: number;
  cash_usd: number;
  positions_value_usd: number;
  daily_pnl_usd: number;
  total_pnl_usd: number;
}> {
  const open = await getOpenPositions();
  const positionsValue = await computePositionsValue(open);
  const cashUsd = Math.max(0, await computeAnchoredCash());
  const totalValue = cashUsd + positionsValue;
  const totalPnl = totalValue - INITIAL_CASH_USD;

  const snapshot24h = await getPortfolioSnapshot24hAgo();
  const dailyPnl = snapshot24h
    ? totalValue - Number(snapshot24h.total_value_usd ?? INITIAL_CASH_USD)
    : 0;

  return {
    total_value_usd: totalValue,
    cash_usd: cashUsd,
    positions_value_usd: positionsValue,
    daily_pnl_usd: dailyPnl,
    total_pnl_usd: totalPnl,
  };
}
