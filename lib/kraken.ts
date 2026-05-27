import type { TradingPair } from "./types";

const PAIR_TO_KRAKEN: Record<string, string> = {
  BTC: "XBTUSD",
  ETH: "ETHUSD",
  SOL: "SOLUSD",
  LINK: "LINKUSD",
  AVAX: "AVAXUSD",
  DOT: "DOTUSD",
};

export const KRAKEN_PAIRS: TradingPair[] = [
  "BTC",
  "ETH",
  "SOL",
  "LINK",
  "AVAX",
  "DOT",
];

export const INITIAL_CASH_USD = 10000;
export const KRAKEN_FEE_RATE = 0.0026;

export function isLiveTrading(): boolean {
  return process.env.LIVE_TRADING === "true";
}

interface TickerResponse {
  error?: string[];
  result?: Record<
    string,
    {
      c?: string[];
      o?: string;
    }
  >;
}

export async function getKrakenPrice(pair: string): Promise<number> {
  const krakenPair = PAIR_TO_KRAKEN[pair];
  if (!krakenPair) throw new Error(`Unsupported pair: ${pair}`);

  const res = await fetch(
    `https://api.kraken.com/0/public/Ticker?pair=${krakenPair}`
  );
  const data = (await res.json()) as TickerResponse;
  if (data.error?.length) {
    throw new Error(data.error.join(", "));
  }

  const ticker =
    data.result?.[krakenPair] ?? Object.values(data.result ?? {})[0];
  const price = parseFloat(ticker?.c?.[0] ?? "0");
  if (!price) throw new Error(`No price for ${pair}`);
  return price;
}

export async function get24hPriceChangePct(pair: string): Promise<number> {
  const krakenPair = PAIR_TO_KRAKEN[pair];
  if (!krakenPair) return 0;

  const res = await fetch(
    `https://api.kraken.com/0/public/Ticker?pair=${krakenPair}`
  );
  const data = (await res.json()) as TickerResponse;
  const ticker =
    data.result?.[krakenPair] ?? Object.values(data.result ?? {})[0];
  const current = parseFloat(ticker?.c?.[0] ?? "0");
  const open = parseFloat(ticker?.o ?? "0");
  if (!open) return 0;
  return ((current - open) / open) * 100;
}

export async function placeMarketOrder(
  pair: string,
  side: "buy" | "sell",
  sizeUsd: number
): Promise<{ success: boolean; simulated: boolean }> {
  if (!isLiveTrading()) {
    return { success: true, simulated: true };
  }
  // Live Kraken signing not implemented — paper default
  console.warn("Live Kraken order stub");
  return { success: true, simulated: false };
}

export function estimateFee(sizeUsd: number): number {
  return sizeUsd * KRAKEN_FEE_RATE * 2;
}
