import type { TradingPair } from "./types";

export const REDIS_PREFIX = "news:";

export const TRADING_PAIRS: TradingPair[] = [
  "BTC",
  "ETH",
  "SOL",
  "LINK",
  "AVAX",
  "DOT",
];

export const PAIR_TO_KRAKEN: Record<TradingPair, string> = {
  BTC: "XBTUSD",
  ETH: "ETHUSD",
  SOL: "SOLUSD",
  LINK: "LINKUSD",
  AVAX: "AVAXUSD",
  DOT: "DOTUSD",
};

export const INITIAL_PORTFOLIO_USD = 10000;

export const MIN_24H_VOLUME_USD = 1_000_000;

export const REDDIT_SUBREDDITS = ["CryptoCurrency", "Bitcoin", "ethereum"];
