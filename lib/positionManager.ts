import { getKrakenPrice, placeMarketOrder } from "./kraken";
import { closePosition, getOpenPositions } from "./positions";
import { updatePortfolioCash } from "./portfolio";
import { notify } from "./notify";

export interface ManageResult {
  closed: string[];
}

export async function manageOpenPositions(): Promise<ManageResult> {
  const positions = await getOpenPositions();
  const closed: string[] = [];

  for (const pos of positions) {
    let currentPrice: number;
    try {
      currentPrice = await getKrakenPrice(pos.pair);
    } catch {
      continue;
    }

    const pnlPct =
      ((currentPrice - pos.entryPrice) / pos.entryPrice) * 100;

    let shouldClose = false;
    let reason = "";

    if (pos.stopLossPct > 0 && pnlPct <= -pos.stopLossPct) {
      shouldClose = true;
      reason = `Stop loss (${pnlPct.toFixed(2)}%)`;
    } else if (pos.takeProfitPct > 0 && pnlPct >= pos.takeProfitPct) {
      shouldClose = true;
      reason = `Take profit (${pnlPct.toFixed(2)}%)`;
    } else if (
      pos.timeStopAt &&
      new Date(pos.timeStopAt).getTime() <= Date.now()
    ) {
      shouldClose = true;
      reason = "Time stop (4h)";
    }

    if (!shouldClose) continue;

    const trade = await closePosition(pos.id, currentPrice, reason);
    if (trade) {
      await placeMarketOrder(pos.pair, "sell", pos.sizeAsset);
      const proceeds = pos.sizeAsset * currentPrice;
      await updatePortfolioCash(proceeds);
      closed.push(`${pos.pair}: ${reason}`);
      await notify(
        "Position Closed",
        `${pos.pair} ${reason} — P&L $${trade.pnlUsd.toFixed(2)}`
      );
    }
  }

  return { closed };
}
