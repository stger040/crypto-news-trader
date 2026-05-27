const PAIR_TO_BINANCE: Record<string, string> = {
  BTC: "BTCUSDT",
  ETH: "ETHUSDT",
  SOL: "SOLUSDT",
  LINK: "LINKUSDT",
  AVAX: "AVAXUSDT",
  DOT: "DOTUSDT",
};

const CACHE_TTL_MS = 5 * 60 * 1000;
let cache: { at: number; rates: Record<string, number> } | null = null;

export async function fetchFundingRates(
  pairs: string[]
): Promise<Record<string, number>> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    const out: Record<string, number> = {};
    for (const p of pairs) {
      if (cache.rates[p] !== undefined) out[p] = cache.rates[p];
    }
    if (Object.keys(out).length === pairs.length) return out;
  }

  try {
    const rates: Record<string, number> = { ...(cache?.rates ?? {}) };

    await Promise.all(
      pairs.map(async (pair) => {
        const symbol = PAIR_TO_BINANCE[pair];
        if (!symbol) return;
        try {
          const res = await fetch(
            `https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${symbol}`
          );
          if (!res.ok) return;
          const data = (await res.json()) as { lastFundingRate?: string };
          rates[pair] = parseFloat(data.lastFundingRate ?? "0");
        } catch {
          /* fail-open per pair */
        }
      })
    );

    cache = { at: Date.now(), rates };
    return rates;
  } catch {
    return {};
  }
}
