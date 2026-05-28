export type TradingPair = "BTC" | "ETH" | "SOL" | "LINK" | "AVAX" | "DOT";

export type MarketRegime = "bull" | "bear" | "neutral";

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
  summary?: string | null;
  is_syndicated?: boolean | null;
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
  weighted_avg_24h?: number | null;
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
  regime?: string | null;
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
  funding_rate?: number | null;
  velocity_multiplier?: number | null;
  regime?: string | null;
}

export interface RegimeSnapshot {
  id: number;
  captured_at: string;
  regime: MarketRegime;
  signals_bull: number;
  signals_bear: number;
  signals_neutral: number;
  btc_vs_200d_sma: number | null;
  sma50_vs_sma200: number | null;
  return_30d: number | null;
  fear_greed_avg7d: number | null;
  fear_greed_value?: number | null;
  btc_dominance_trend: string | null;
  funding_direction: string | null;
  previous_regime: string | null;
  regime_age_days: number;
  locked_until: string | null;
}

export interface CircuitBreakerState {
  id: number;
  daily_halt_until: string | null;
  weekly_halt_until: string | null;
  macro_halt_active: boolean;
  last_checked_at: string;
  portfolio_high_water_mark: number;
}

export interface CircuitBreakerStatus {
  halted: boolean;
  reason: string | null;
  haltType: "daily" | "weekly" | "macro" | null;
  haltUntil: Date | null;
}

export interface RollingMetrics {
  periodDays: number;
  sharpe: number;
  sortino: number;
  tradeCount: number;
}

export interface RegimeAttribution {
  regime: string;
  tradeCount: number;
  winRate: number;
  avgReturnPct: number;
  profitFactor: number;
  totalPnlUsd: number;
  isReliable: boolean;
}

export interface BenchmarkExcess {
  botReturnPct: number;
  btcReturnPct: number;
  excessReturnPct: number;
  highWaterMark: number;
  currentDrawdownPct: number;
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
  sortinoRatio: number;
  profitFactor: number;
  totalTrades: number;
  totalFees: number;
  monthlyTargetPct: number;
  onTrack: boolean;
  benchmark: BenchmarkExcess;
  rollingMetrics: RollingMetrics[];
  regimeAttribution: RegimeAttribution[];
  healthInterpretation: string;
}

export interface RegimeStatus {
  regime: MarketRegime;
  regimeAgeDays: number;
  signalsBull: number;
  signalsBear: number;
  signalsNeutral: number;
  lockedUntil: string | null;
  circuitBreakerActive: boolean;
  circuitBreakerType: string | null;
  macroHaltActive: boolean;
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
  regime?: MarketRegime;
  previousRegime?: MarketRegime;
  macroHalt?: boolean;
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

export interface CategoryStats {
  category: string;
  totalTrades: number;
  wins: number;
  winRate: number;
  avgPnlUsd: number;
  avgReturnPct: number;
  isReliable: boolean;
}

export interface SignalQualityStats {
  confirmationRate: number;
  fundingSkipRate: number;
  avgVelocityThisWeek: number;
  maxVelocityThisWeek: number;
}

export interface NewsArticleMeta {
  corroborated: boolean;
  velocityHigh: boolean;
  triggeredPositionId: number | null;
}
