import { getJson, setJson } from "./redis";
import { getKrakenPrice } from "./kraken";
import type { ClosedTrade, Position, PositionPnL, TradingPair } from "./types";

const POSITIONS_KEY = "positions:open";
const TRADES_KEY = "trades:closed";
const SIGNALS_KEY = "signals:bearish";

export async function getOpenPositions(): Promise<Position[]> {
  return (await getJson<Position[]>(POSITIONS_KEY)) ?? [];
}

export async function saveOpenPositions(positions: Position[]): Promise<void> {
  await setJson(POSITIONS_KEY, positions);
}

export async function addPosition(position: Position): Promise<void> {
  const positions = await getOpenPositions();
  positions.push(position);
  await saveOpenPositions(positions);
}

export async function getClosedTrades(): Promise<ClosedTrade[]> {
  return (await getJson<ClosedTrade[]>(TRADES_KEY)) ?? [];
}

export async function recordClosedTrade(trade: ClosedTrade): Promise<void> {
  const trades = await getClosedTrades();
  trades.unshift(trade);
  await setJson(TRADES_KEY, trades.slice(0, 500));
}

export async function getPositionsWithPnL(): Promise<PositionPnL[]> {
  const positions = await getOpenPositions();
  const result: PositionPnL[] = [];

  for (const pos of positions) {
    try {
      const currentPrice = await getKrakenPrice(pos.pair);
      const currentValue = pos.sizeAsset * currentPrice;
      const pnlUsd = currentValue - pos.sizeUsd;
      const pnlPct = ((currentPrice - pos.entryPrice) / pos.entryPrice) * 100;

      let timeRemainingMs: number | undefined;
      if (pos.timeStopAt) {
        timeRemainingMs = Math.max(
          0,
          new Date(pos.timeStopAt).getTime() - Date.now()
        );
      }

      result.push({
        position: pos,
        currentPrice,
        pnlUsd,
        pnlPct,
        timeRemainingMs,
      });
    } catch {
      result.push({
        position: pos,
        currentPrice: pos.entryPrice,
        pnlUsd: 0,
        pnlPct: 0,
        timeRemainingMs: pos.timeStopAt
          ? Math.max(0, new Date(pos.timeStopAt).getTime() - Date.now())
          : undefined,
      });
    }
  }

  return result;
}

export async function closePosition(
  positionId: string,
  exitPrice: number,
  closeReason: string
): Promise<ClosedTrade | null> {
  const positions = await getOpenPositions();
  const idx = positions.findIndex((p) => p.id === positionId);
  if (idx === -1) return null;

  const pos = positions[idx];
  const currentValue = pos.sizeAsset * exitPrice;
  const pnlUsd = currentValue - pos.sizeUsd;
  const pnlPct = ((exitPrice - pos.entryPrice) / pos.entryPrice) * 100;

  const trade: ClosedTrade = {
    id: pos.id,
    pair: pos.pair,
    strategy: pos.strategy,
    side: "long",
    entryPrice: pos.entryPrice,
    exitPrice,
    sizeUsd: pos.sizeUsd,
    pnlUsd,
    pnlPct,
    openedAt: pos.openedAt,
    closedAt: new Date().toISOString(),
    closeReason,
    paper: pos.paper,
  };

  positions.splice(idx, 1);
  await saveOpenPositions(positions);
  await recordClosedTrade(trade);
  return trade;
}

export function generatePositionId(): string {
  return `pos-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function logBearishSignal(
  pair: TradingPair,
  reason: string,
  until: string
): Promise<void> {
  const signals =
    (await getJson<Record<string, { reason: string; until: string }>>(
      SIGNALS_KEY
    )) ?? {};
  signals[pair] = { reason, until };
  await setJson(SIGNALS_KEY, signals);
}

export async function isPairInBearishCooldown(
  pair: TradingPair
): Promise<boolean> {
  const signals =
    (await getJson<Record<string, { reason: string; until: string }>>(
      SIGNALS_KEY
    )) ?? {};
  const sig = signals[pair];
  if (!sig) return false;
  if (new Date(sig.until).getTime() > Date.now()) return true;
  return false;
}

export async function getTotalPositionsValueUsd(): Promise<number> {
  const withPnl = await getPositionsWithPnL();
  return withPnl.reduce(
    (sum, p) => sum + p.position.sizeAsset * p.currentPrice,
    0
  );
}
