import {
  getOpenPositions,
  getLatestPortfolioSnapshot,
  getClosedTrades,
} from "./db";
import { getKrakenPrice, INITIAL_CASH_USD } from "./kraken";

export async function getPortfolioCash(): Promise<number> {
  const open = await getOpenPositions();
  const latest = await getLatestPortfolioSnapshot();
  const baseCash = latest?.cash_usd ?? INITIAL_CASH_USD;
  const deployed = open.reduce((s, p) => s + Number(p.size_usd), 0);
  return Math.max(0, Number(baseCash) - deployed);
}

export async function getPortfolioTotal(): Promise<number> {
  const open = await getOpenPositions();
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

  const latest = await getLatestPortfolioSnapshot();
  const cash = latest?.cash_usd ?? INITIAL_CASH_USD;
  return Number(cash) + positionsValue;
}

export async function computePortfolioSnapshot(): Promise<{
  total_value_usd: number;
  cash_usd: number;
  positions_value_usd: number;
  daily_pnl_usd: number;
  total_pnl_usd: number;
}> {
  const open = await getOpenPositions();
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

  const latest = await getLatestPortfolioSnapshot();
  const initialCash = INITIAL_CASH_USD;
  const cashUsd = Math.max(
    0,
    (latest?.cash_usd ?? initialCash) -
      open.reduce((s, p) => s + Number(p.size_usd), 0) +
      (await getClosedTrades(500)).reduce(
        (s, t) => s + Number(t.pnl_usd ?? 0),
        0
      )
  );

  const totalValue = cashUsd + positionsValue;
  const totalPnl = totalValue - initialCash;

  const history = latest;
  const dailyPnl = history
    ? totalValue - Number(history.total_value_usd ?? initialCash)
    : 0;

  return {
    total_value_usd: totalValue,
    cash_usd: cashUsd,
    positions_value_usd: positionsValue,
    daily_pnl_usd: dailyPnl,
    total_pnl_usd: totalPnl,
  };
}
