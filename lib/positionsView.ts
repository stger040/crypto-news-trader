import { getKrakenPrice } from "./kraken";
import { getOpenPositions } from "./db";
import type { PositionWithPnL } from "./types";

export async function getPositionsWithPnL(): Promise<PositionWithPnL[]> {
  const positions = await getOpenPositions();
  const result: PositionWithPnL[] = [];

  for (const pos of positions) {
    try {
      const currentPrice = await getKrakenPrice(pos.pair);
      const entry = Number(pos.entry_price);
      const sizeAsset = Number(pos.size_usd) / entry;
      const currentValue = sizeAsset * currentPrice;
      const pnlUsd = currentValue - Number(pos.size_usd);
      const pnlPct = ((currentPrice - entry) / entry) * 100;
      const timeOpenMs = Date.now() - new Date(pos.opened_at).getTime();

      let timeRemainingMs: number | undefined;
      if (pos.strategy === "momentum") {
        const stopAt =
          new Date(pos.opened_at).getTime() + 4 * 60 * 60 * 1000;
        timeRemainingMs = Math.max(0, stopAt - Date.now());
      }

      result.push({
        position: pos,
        currentPrice,
        pnlUsd,
        pnlPct,
        timeOpenMs,
        timeRemainingMs,
      });
    } catch {
      result.push({
        position: pos,
        currentPrice: Number(pos.entry_price),
        pnlUsd: 0,
        pnlPct: 0,
        timeOpenMs: Date.now() - new Date(pos.opened_at).getTime(),
      });
    }
  }

  return result;
}
