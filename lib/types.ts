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
  | "macro_event";

export interface SentimentResult {
  score: number;
  confidence: number;
  category: SentimentCategory;
  affectedPairs: TradingPair[];
}

export interface NewsArticle {
  id: number;
  source: string;
  title: string;
  url: string;
  published_at: string;
  fetched_at: string;
  sentiment_score: number | null;
  sentiment_category: string | null;
  confidence: number | null;
  affected_pairs: string[] | null;
  processed: boolean;
}

export interface SentimentSnapshot {
  id: number;
  captured_at: string;
  avg_score_1h: number | null;
  avg_score_6h: number | null;
  avg_score_24h: number | null;
  fear_greed_value: number | null;
  fear_greed_label: string | null;
  article_count_24h: number | null;
  dominant_category: string | null;
}

export interface Position {
  id: number;
  opened_at: string;
  closed_at: string | null;
  pair: string;
  side: string;
  strategy: string;
  entry_price: number;
  exit_price: number | null;
  size_usd: number;
  pnl_usd: number | null;
  pnl_pct: number | null;
  fees_usd: number | null;
  exit_reason: string | null;
  trigger_article_id: number | null;
  simulated: boolean;
  trigger_title?: string | null;
}

export interface PortfolioSnapshot {
  id: number;
  captured_at: string;
  total_value_usd: number | null;
  cash_usd: number | null;
  positions_value_usd: number | null;
  daily_pnl_usd: number | null;
  total_pnl_usd: number | null;
}

export interface StrategySignal {
  id: number;
  triggered_at: string;
  strategy: string;
  pair: string | null;
  signal_type: string | null;
  sentiment_score: number | null;
  fear_greed_value: number | null;
  acted_on: boolean;
  skip_reason: string | null;
}

export interface PositionWithPnL {
  position: Position;
  currentPrice: number;
  pnlUsd: number;
  pnlPct: number;
  timeOpenMs: number;
  timeRemainingMs?: number;
}

export interface AnalyticsSummary {
  winRate: number;
  avgReturnPct: number;
  monthlyPnl: { month: string; pnl: number }[];
  sharpeRatio: number;
  totalTrades: number;
  totalFees: number;
  monthlyTargetPct: number;
  onTrack: boolean;
}

export interface StrategyPanelStatus {
  id: string;
  name: string;
  status: string;
  lastSignalAt: string | null;
  positionsToday: number;
}

export interface BotHealthStatus {
  status: "green" | "yellow" | "red";
  message: string;
  lastCronAt: string | null;
}

export interface CronOptions {
  testRun?: boolean;
  forceSignal?: boolean;
}

export interface CronResult {
  ok: boolean;
  articlesFetched: number;
  articlesScored: number;
  strategyDecisions: Record<string, unknown>;
  tradesAttempted: number;
  tradesExecuted: number;
  skipReasons: string[];
  errors: string[];
  durationMs: number;
}
