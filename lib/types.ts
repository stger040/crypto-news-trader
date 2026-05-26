export type TradingPair = "BTC" | "ETH" | "SOL" | "LINK" | "AVAX" | "DOT";

export type SentimentCategory =
  | "bullish"
  | "bearish"
  | "neutral"
  | "fud"
  | "hype"
  | "regulatory_positive"
  | "regulatory_negative"
  | "hack_exploit"
  | "listing_announcement"
  | "macro";

export interface SentimentResult {
  score: number;
  confidence: number;
  category: SentimentCategory;
  affectedPairs: TradingPair[];
}

export interface CryptoPanicPost {
  id: string;
  title: string;
  url: string;
  source: string;
  published_at: string;
  votes: {
    positive: number;
    negative: number;
    important: number;
  };
}

export interface FearAndGreedData {
  value: number;
  classification: string;
  previousValue: number;
  change: number;
}

export interface RedditPost {
  title: string;
  score: number;
  upvote_ratio: number;
  num_comments: number;
  created_utc: number;
}

export interface ExchangeListing {
  exchange: string;
  title: string;
  url: string;
  published_at: string;
}

export interface ScoredNewsItem extends CryptoPanicPost {
  sentiment?: SentimentResult;
}

export type StrategyId =
  | "breaking_news_momentum"
  | "sentiment_momentum"
  | "fear_greed_contrarian";

export interface Position {
  id: string;
  pair: TradingPair;
  strategy: StrategyId;
  side: "long";
  entryPrice: number;
  sizeUsd: number;
  sizeAsset: number;
  stopLossPct: number;
  takeProfitPct: number;
  openedAt: string;
  timeStopAt?: string;
  entryReason: string;
  paper: boolean;
}

export interface ClosedTrade {
  id: string;
  pair: TradingPair;
  strategy: StrategyId;
  side: "long";
  entryPrice: number;
  exitPrice: number;
  sizeUsd: number;
  pnlUsd: number;
  pnlPct: number;
  openedAt: string;
  closedAt: string;
  closeReason: string;
  paper: boolean;
}

export interface PortfolioSnapshot {
  timestamp: string;
  totalUsd: number;
  cashUsd: number;
  positionsValueUsd: number;
  dailyPnlUsd: number;
  monthlyPnlUsd: number;
}

export interface Analytics {
  winRate: number;
  avgReturnPct: number;
  monthlyPnl: { month: string; pnl: number }[];
  sharpeRatio: number;
  totalTrades: number;
  updatedAt: string;
}

export interface StrategyStatus {
  id: StrategyId;
  name: string;
  status: "active" | "waiting" | "triggered" | "idle";
  detail: string;
  lastRunAt?: string;
}

export interface BotHealth {
  status: "green" | "yellow" | "red";
  message: string;
  lastCronAt?: string;
  lastError?: string;
}

export interface DailySentimentAggregate {
  date: string;
  score: number;
  itemCount: number;
}

export interface PositionPnL {
  position: Position;
  currentPrice: number;
  pnlUsd: number;
  pnlPct: number;
  timeRemainingMs?: number;
}
