import {
  getOpenPositions,
  closePosition,
} from "./db";
import {
  getKrakenPrice,
  placeMarketOrder,
  estimateFee,
} from "./kraken";
import { notify } from "./notify";

const MOMENTUM_STOP_LOSS = 2.5;
const MOMENTUM_TAKE_PROFIT = 4;
const MOMENTUM_TIME_STOP_HOURS = 4;

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

    const entry = Number(pos.entry_price);
    const pnlPct = ((currentPrice - entry) / entry) * 100;
    const openedAt = new Date(pos.opened_at).getTime();
    const ageHours = (Date.now() - openedAt) / 3600000;

    let shouldClose = false;
    let reason = "";

    if (pos.strategy === "momentum") {
      if (pnlPct <= -MOMENTUM_STOP_LOSS) {
        shouldClose = true;
        reason = `stop_loss (${pnlPct.toFixed(2)}%)`;
      } else if (pnlPct >= MOMENTUM_TAKE_PROFIT) {
        shouldClose = true;
        reason = `take_profit (${pnlPct.toFixed(2)}%)`;
      } else if (ageHours >= MOMENTUM_TIME_STOP_HOURS) {
        shouldClose = true;
        reason = "time_stop_4h";
      }
    }

    if (pos.strategy === "sentimentMomentum" && ageHours >= 24) {
      shouldClose = true;
      reason = "sentiment_24h_hold";
    }

    if (!shouldClose) continue;

    const trade = await closePosition(
      pos.id,
      currentPrice,
      reason,
      estimateFee(Number(pos.size_usd))
    );

    if (trade) {
      await placeMarketOrder(pos.pair, "sell", Number(pos.size_usd));
      closed.push(`${pos.pair}: ${reason}`);
      await notify(
        "Position Closed",
        `${pos.pair} ${reason} — P&L $${Number(trade.pnl_usd ?? 0).toFixed(2)}`
      );
    }
  }

  return { closed };
}
