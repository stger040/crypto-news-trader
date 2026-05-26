import { PAIR_TO_KRAKEN, MIN_24H_VOLUME_USD } from "./constants";
import type { TradingPair } from "./types";

interface TickerResponse {
  error?: string[];
  result?: Record<
    string,
    {
      c?: string[];
      v?: string[];
    }
  >;
}

export function isLiveTrading(): boolean {
  return process.env.LIVE_TRADING === "true";
}

export async function getKrakenPrice(pair: TradingPair): Promise<number> {
  const krakenPair = PAIR_TO_KRAKEN[pair];
  const res = await fetch(
    `https://api.kraken.com/0/public/Ticker?pair=${krakenPair}`
  );
  const data = (await res.json()) as TickerResponse;
  if (data.error?.length) {
    throw new Error(`Kraken ticker error: ${data.error.join(", ")}`);
  }
  const ticker = data.result?.[krakenPair] ?? Object.values(data.result ?? {})[0];
  const price = parseFloat(ticker?.c?.[0] ?? "0");
  if (!price) throw new Error(`No price for ${pair}`);
  return price;
}

export async function get24hVolumeUsd(pair: TradingPair): Promise<number> {
  const krakenPair = PAIR_TO_KRAKEN[pair];
  const res = await fetch(
    `https://api.kraken.com/0/public/Ticker?pair=${krakenPair}`
  );
  const data = (await res.json()) as TickerResponse;
  const ticker = data.result?.[krakenPair] ?? Object.values(data.result ?? {})[0];
  const volume = parseFloat(ticker?.v?.[1] ?? "0");
  const price = parseFloat(ticker?.c?.[0] ?? "0");
  return volume * price;
}

export async function meetsVolumeRequirement(pair: TradingPair): Promise<boolean> {
  try {
    const vol = await get24hVolumeUsd(pair);
    return vol >= MIN_24H_VOLUME_USD;
  } catch {
    return false;
  }
}

export async function getKrakenPrices(
  pairs: TradingPair[]
): Promise<Record<TradingPair, number>> {
  const prices = {} as Record<TradingPair, number>;
  await Promise.all(
    pairs.map(async (p) => {
      try {
        prices[p] = await getKrakenPrice(p);
      } catch {
        prices[p] = 0;
      }
    })
  );
  return prices;
}

export async function placeMarketOrder(
  pair: TradingPair,
  side: "buy" | "sell",
  volumeAsset: number
): Promise<{ success: boolean; orderId?: string; paper: boolean }> {
  if (!isLiveTrading()) {
    return { success: true, orderId: `paper-${Date.now()}`, paper: true };
  }

  const apiKey = process.env.KRAKEN_API_KEY;
  const apiSecret = process.env.KRAKEN_API_SECRET;
  if (!apiKey || !apiSecret) {
    throw new Error("Kraken API credentials required for live trading");
  }

  // Live Kraken signing would go here — paper mode is default
  console.warn("Live Kraken order stub — implement signing for production");
  return { success: true, orderId: `live-${Date.now()}`, paper: false };
}
