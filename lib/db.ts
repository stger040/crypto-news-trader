import { neon, neonConfig } from "@neondatabase/serverless";
import type {
  CircuitBreakerState,
  MarketRegime,
  NewsArticle,
  PortfolioSnapshot,
  Position,
  RegimeSnapshot,
  SentimentSnapshot,
  StrategySignal,
} from "./types";

neonConfig.fetchConnectionCache = true;

function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  return neon(url);
}

async function q<T>(promise: PromiseLike<unknown>): Promise<T[]> {
  const rows = (await promise) as T[];
  return rows;
}

async function q1<T>(promise: PromiseLike<unknown>): Promise<T | null> {
  const rows = (await promise) as T[];
  return rows[0] ?? null;
}

export async function getUnprocessedArticles(
  limit = 100
): Promise<NewsArticle[]> {
  const sql = getSql();
  return q<NewsArticle>(sql`
    SELECT * FROM news_articles
    WHERE processed = false
    ORDER BY published_at DESC
    LIMIT ${limit}
  `);
}

export async function insertArticle(data: {
  source: string;
  title: string;
  url: string;
  published_at: string;
  summary?: string | null;
  is_syndicated?: boolean;
}): Promise<NewsArticle | null> {
  const sql = getSql();
  return q1<NewsArticle>(sql`
    INSERT INTO news_articles (source, title, url, published_at, summary, is_syndicated)
    VALUES (
      ${data.source}, ${data.title}, ${data.url}, ${data.published_at},
      ${data.summary ?? null}, ${data.is_syndicated ?? false}
    )
    ON CONFLICT (url) DO NOTHING
    RETURNING *
  `);
}

export async function articleExistsByUrl(url: string): Promise<boolean> {
  const sql = getSql();
  const rows = await sql`
    SELECT id FROM news_articles WHERE url = ${url} LIMIT 1
  `;
  return rows.length > 0;
}

export async function updateArticleSentiment(
  id: number,
  score: number,
  category: string,
  confidence: number,
  pairs: string[]
): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE news_articles
    SET sentiment_score = ${score},
        sentiment_category = ${category},
        confidence = ${confidence},
        affected_pairs = ${pairs},
        processed = true
    WHERE id = ${id}
  `;
}

export async function getRecentArticles(limit = 20): Promise<NewsArticle[]> {
  const sql = getSql();
  return q<NewsArticle>(sql`
    SELECT * FROM news_articles
    ORDER BY published_at DESC
    LIMIT ${limit}
  `);
}

export async function getRecentHighScoreArticles(
  minutes = 30,
  primaryOnly = true,
  minScore = 0.65
): Promise<NewsArticle[]> {
  const sql = getSql();
  if (primaryOnly) {
    return q<NewsArticle>(sql`
      SELECT * FROM news_articles
      WHERE processed = true
        AND COALESCE(is_syndicated, false) = false
        AND sentiment_score >= ${minScore}
        AND confidence >= 0.7
        AND sentiment_category IN ('bullish', 'regulatory_positive', 'listing_announcement')
        AND published_at > NOW() - INTERVAL '1 minute' * ${minutes}
      ORDER BY published_at DESC
    `);
  }
  return q<NewsArticle>(sql`
    SELECT * FROM news_articles
    WHERE processed = true
      AND sentiment_score >= ${minScore}
      AND confidence >= 0.7
      AND sentiment_category IN ('bullish', 'regulatory_positive', 'listing_announcement')
      AND published_at > NOW() - INTERVAL '1 minute' * ${minutes}
    ORDER BY published_at DESC
  `);
}

export async function getBearishRecentArticles(): Promise<NewsArticle[]> {
  const sql = getSql();
  return q<NewsArticle>(sql`
    SELECT * FROM news_articles
    WHERE processed = true
      AND sentiment_score <= -0.65
      AND sentiment_category IN ('hack_exploit', 'regulatory_negative', 'bearish')
      AND published_at > NOW() - INTERVAL '30 minutes'
    ORDER BY published_at DESC
  `);
}

export async function getAvgSentimentHours(
  hours: number
): Promise<{ avg: number; count: number }> {
  const sql = getSql();
  const rows = await sql`
    SELECT AVG(sentiment_score)::float AS avg, COUNT(*)::int AS count
    FROM news_articles
    WHERE processed = true
      AND sentiment_score IS NOT NULL
      AND published_at > NOW() - INTERVAL '1 hour' * ${hours}
  `;
  const row = rows[0] as { avg: number | null; count: number };
  return { avg: row?.avg ?? 0, count: row?.count ?? 0 };
}

export async function getAvgSentimentPrior24h(): Promise<number> {
  const sql = getSql();
  const rows = await sql`
    SELECT AVG(sentiment_score)::float AS avg
    FROM news_articles
    WHERE processed = true
      AND sentiment_score IS NOT NULL
      AND published_at BETWEEN NOW() - INTERVAL '48 hours' AND NOW() - INTERVAL '24 hours'
  `;
  return (rows[0] as { avg: number | null })?.avg ?? 0;
}

export async function getDominantCategory24h(): Promise<string | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT sentiment_category, COUNT(*) AS cnt
    FROM news_articles
    WHERE processed = true
      AND published_at > NOW() - INTERVAL '24 hours'
      AND sentiment_category IS NOT NULL
    GROUP BY sentiment_category
    ORDER BY cnt DESC
    LIMIT 1
  `;
  return (rows[0] as { sentiment_category: string })?.sentiment_category ?? null;
}

export async function getOpenPositions(): Promise<Position[]> {
  const sql = getSql();
  return q<Position>(sql`
    SELECT p.*, na.title AS trigger_title
    FROM positions p
    LEFT JOIN news_articles na ON na.id = p.trigger_article_id
    WHERE p.closed_at IS NULL
    ORDER BY p.opened_at DESC
  `);
}

export async function getOpenPositionsByStrategy(
  strategy: string
): Promise<Position[]> {
  const sql = getSql();
  return q<Position>(sql`
    SELECT * FROM positions
    WHERE closed_at IS NULL AND strategy = ${strategy}
    ORDER BY opened_at DESC
  `);
}

export async function openPosition(data: {
  pair: string;
  side: string;
  strategy: string;
  entry_price: number;
  size_usd: number;
  trigger_article_id?: number | null;
  simulated?: boolean;
  regime?: string | null;
}): Promise<Position> {
  const sql = getSql();
  const row = await q1<Position>(sql`
    INSERT INTO positions (
      pair, side, strategy, entry_price, size_usd,
      trigger_article_id, simulated, regime
    ) VALUES (
      ${data.pair}, ${data.side}, ${data.strategy}, ${data.entry_price},
      ${data.size_usd}, ${data.trigger_article_id ?? null},
      ${data.simulated ?? true}, ${data.regime ?? null}
    )
    RETURNING *
  `);
  if (!row) throw new Error("Failed to open position");
  return row;
}

export async function closePosition(
  id: number,
  exitPrice: number,
  reason: string,
  feesUsd = 0
): Promise<Position | null> {
  const sql = getSql();
  return q1<Position>(sql`
    UPDATE positions
    SET closed_at = NOW(),
        exit_price = ${exitPrice},
        exit_reason = ${reason},
        fees_usd = ${feesUsd},
        pnl_usd = ((${exitPrice} - entry_price) / entry_price) * size_usd - ${feesUsd},
        pnl_pct = ((${exitPrice} - entry_price) / entry_price) * 100
    WHERE id = ${id} AND closed_at IS NULL
    RETURNING *
  `);
}

export async function getLatestSentimentSnapshot(): Promise<SentimentSnapshot | null> {
  const sql = getSql();
  return q1<SentimentSnapshot>(sql`
    SELECT * FROM sentiment_snapshots
    ORDER BY captured_at DESC
    LIMIT 1
  `);
}

export async function saveSentimentSnapshot(data: {
  avg_score_1h: number;
  avg_score_6h: number;
  avg_score_24h: number;
  weighted_avg_24h?: number;
  fear_greed_value: number;
  fear_greed_label: string;
  article_count_24h: number;
  dominant_category: string | null;
}): Promise<SentimentSnapshot> {
  const sql = getSql();
  const row = await q1<SentimentSnapshot>(sql`
    INSERT INTO sentiment_snapshots (
      avg_score_1h, avg_score_6h, avg_score_24h, weighted_avg_24h,
      fear_greed_value, fear_greed_label,
      article_count_24h, dominant_category
    ) VALUES (
      ${data.avg_score_1h}, ${data.avg_score_6h}, ${data.avg_score_24h},
      ${data.weighted_avg_24h ?? data.avg_score_24h},
      ${data.fear_greed_value}, ${data.fear_greed_label},
      ${data.article_count_24h}, ${data.dominant_category}
    )
    RETURNING *
  `);
  if (!row) throw new Error("Failed to save sentiment snapshot");
  return row;
}

export async function savePortfolioSnapshot(data: {
  total_value_usd: number;
  cash_usd: number;
  positions_value_usd: number;
  daily_pnl_usd: number;
  total_pnl_usd: number;
}): Promise<PortfolioSnapshot> {
  const sql = getSql();
  const row = await q1<PortfolioSnapshot>(sql`
    INSERT INTO portfolio_snapshots (
      total_value_usd, cash_usd, positions_value_usd,
      daily_pnl_usd, total_pnl_usd
    ) VALUES (
      ${data.total_value_usd}, ${data.cash_usd}, ${data.positions_value_usd},
      ${data.daily_pnl_usd}, ${data.total_pnl_usd}
    )
    RETURNING *
  `);
  if (!row) throw new Error("Failed to save portfolio snapshot");
  return row;
}

export async function getPortfolioHistory(
  days = 30
): Promise<PortfolioSnapshot[]> {
  const sql = getSql();
  return q<PortfolioSnapshot>(sql`
    SELECT * FROM portfolio_snapshots
    WHERE captured_at > NOW() - INTERVAL '1 day' * ${days}
    ORDER BY captured_at ASC
  `);
}

export async function getLatestPortfolioSnapshot(): Promise<PortfolioSnapshot | null> {
  const sql = getSql();
  return q1<PortfolioSnapshot>(sql`
    SELECT * FROM portfolio_snapshots ORDER BY captured_at DESC LIMIT 1
  `);
}

export async function getClosedTrades(limit = 30): Promise<Position[]> {
  const sql = getSql();
  return q<Position>(sql`
    SELECT p.*, na.title AS trigger_title
    FROM positions p
    LEFT JOIN news_articles na ON na.id = p.trigger_article_id
    WHERE p.closed_at IS NOT NULL
    ORDER BY p.closed_at DESC
    LIMIT ${limit}
  `);
}

export async function logSignal(data: {
  strategy: string;
  pair?: string | null;
  signal_type?: string | null;
  sentiment_score?: number | null;
  fear_greed_value?: number | null;
  acted_on?: boolean;
  skip_reason?: string | null;
  funding_rate?: number | null;
  velocity_multiplier?: number | null;
  regime?: string | null;
}): Promise<StrategySignal> {
  const sql = getSql();
  const row = await q1<StrategySignal>(sql`
    INSERT INTO strategy_signals (
      strategy, pair, signal_type, sentiment_score,
      fear_greed_value, acted_on, skip_reason,
      funding_rate, velocity_multiplier, regime
    ) VALUES (
      ${data.strategy}, ${data.pair ?? null}, ${data.signal_type ?? null},
      ${data.sentiment_score ?? null}, ${data.fear_greed_value ?? null},
      ${data.acted_on ?? false}, ${data.skip_reason ?? null},
      ${data.funding_rate ?? null}, ${data.velocity_multiplier ?? null},
      ${data.regime ?? null}
    )
    RETURNING *
  `);
  if (!row) throw new Error("Failed to log signal");
  return row;
}

export async function getRecentSignals(limit = 5): Promise<StrategySignal[]> {
  const sql = getSql();
  return q<StrategySignal>(sql`
    SELECT * FROM strategy_signals
    ORDER BY triggered_at DESC
    LIMIT ${limit}
  `);
}

export async function getLastFeedSync(source: string): Promise<Date | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT last_fetched_at FROM feed_sync WHERE source = ${source}
  `;
  const ts = (rows[0] as { last_fetched_at: string })?.last_fetched_at;
  return ts ? new Date(ts) : null;
}

export async function updateFeedSync(source: string): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO feed_sync (source, last_fetched_at)
    VALUES (${source}, NOW())
    ON CONFLICT (source) DO UPDATE SET last_fetched_at = NOW()
  `;
}

export async function recordCronRun(
  success: boolean,
  durationMs: number,
  errorMessage?: string
): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO cron_runs (success, duration_ms, error_message)
    VALUES (${success}, ${durationMs}, ${errorMessage ?? null})
  `;
}

export async function getLastCronRun(): Promise<{
  ran_at: string;
  success: boolean;
} | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT ran_at, success FROM cron_runs ORDER BY ran_at DESC LIMIT 1
  `;
  return (rows[0] as { ran_at: string; success: boolean }) ?? null;
}

export async function countPositionsOpenedToday(
  strategy: string
): Promise<number> {
  const sql = getSql();
  const rows = await sql`
    SELECT COUNT(*)::int AS cnt FROM positions
    WHERE strategy = ${strategy}
      AND opened_at >= CURRENT_DATE
  `;
  return (rows[0] as { cnt: number })?.cnt ?? 0;
}

export async function getLastSignalForStrategy(
  strategy: string
): Promise<StrategySignal | null> {
  const sql = getSql();
  return q1<StrategySignal>(sql`
    SELECT * FROM strategy_signals
    WHERE strategy = ${strategy}
    ORDER BY triggered_at DESC
    LIMIT 1
  `);
}

export async function getTotalFees(): Promise<number> {
  const sql = getSql();
  const rows = await sql`
    SELECT COALESCE(SUM(fees_usd), 0)::float AS total FROM positions WHERE closed_at IS NOT NULL
  `;
  return (rows[0] as { total: number })?.total ?? 0;
}

export async function hasOpenPositionForPair(pair: string): Promise<boolean> {
  const sql = getSql();
  const rows = await sql`
    SELECT id FROM positions WHERE pair = ${pair} AND closed_at IS NULL LIMIT 1
  `;
  return rows.length > 0;
}

export async function getClosedPnlSum(): Promise<number> {
  const sql = getSql();
  const rows = await sql`
    SELECT COALESCE(SUM(pnl_usd), 0)::float AS total
    FROM positions
    WHERE closed_at IS NOT NULL AND pnl_usd IS NOT NULL
  `;
  return (rows[0] as { total: number })?.total ?? 0;
}

export async function getPortfolioSnapshot24hAgo(): Promise<PortfolioSnapshot | null> {
  const sql = getSql();
  return q1<PortfolioSnapshot>(sql`
    SELECT * FROM portfolio_snapshots
    WHERE captured_at > NOW() - INTERVAL '25 hours'
    ORDER BY captured_at ASC
    LIMIT 1
  `);
}

export async function getArticleById(id: number): Promise<NewsArticle | null> {
  const sql = getSql();
  return q1<NewsArticle>(sql`
    SELECT * FROM news_articles WHERE id = ${id}
  `);
}

export async function getArticlesNearTime(
  publishedAt: Date,
  windowMinutes: number
): Promise<NewsArticle[]> {
  const sql = getSql();
  const iso = publishedAt.toISOString();
  return q<NewsArticle>(sql`
    SELECT * FROM news_articles
    WHERE published_at BETWEEN ${iso}::timestamptz - INTERVAL '1 minute' * ${windowMinutes}
      AND ${iso}::timestamptz + INTERVAL '1 minute' * ${windowMinutes}
    ORDER BY published_at DESC
  `);
}

export async function getArticlesLast24h(): Promise<NewsArticle[]> {
  const sql = getSql();
  return q<NewsArticle>(sql`
    SELECT * FROM news_articles
    WHERE processed = true
      AND sentiment_score IS NOT NULL
      AND published_at > NOW() - INTERVAL '24 hours'
    ORDER BY published_at DESC
  `);
}

export async function getPairArticleCounts(
  pair: string
): Promise<{ recent1h: number; baseline7dHourly: number }> {
  const sql = getSql();
  const rows = await sql`
    SELECT
      COUNT(*) FILTER (
        WHERE published_at > NOW() - INTERVAL '1 hour'
          AND ${pair} = ANY(affected_pairs)
      )::int AS recent1h,
      COUNT(*) FILTER (
        WHERE published_at > NOW() - INTERVAL '7 days'
          AND published_at <= NOW() - INTERVAL '1 hour'
          AND ${pair} = ANY(affected_pairs)
      )::float / (7 * 24) AS baseline7d_hourly
    FROM news_articles
    WHERE affected_pairs IS NOT NULL
  `;
  const row = rows[0] as { recent1h: number; baseline7d_hourly: number | null };
  return {
    recent1h: row?.recent1h ?? 0,
    baseline7dHourly: row?.baseline7d_hourly ?? 1,
  };
}

export async function getArticleTriggerIds(): Promise<Record<number, number>> {
  const sql = getSql();
  const rows = await q<{ trigger_article_id: number; id: number }>(sql`
    SELECT id, trigger_article_id FROM positions
    WHERE trigger_article_id IS NOT NULL
  `);
  const map: Record<number, number> = {};
  for (const r of rows) {
    map[r.trigger_article_id] = r.id;
  }
  return map;
}

export interface CategoryStatsRow {
  category: string;
  totalTrades: number;
  wins: number;
  winRate: number;
  avgPnlUsd: number;
  avgReturnPct: number;
  isReliable: boolean;
}

export async function getCategoryWinRates(): Promise<CategoryStatsRow[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT
      COALESCE(na.sentiment_category, 'unknown') AS category,
      COUNT(*)::int AS total_trades,
      SUM(CASE WHEN p.pnl_usd > 0 THEN 1 ELSE 0 END)::int AS wins,
      AVG(p.pnl_usd)::float AS avg_pnl_usd,
      AVG(p.pnl_pct)::float AS avg_return_pct
    FROM positions p
    JOIN strategy_signals ss ON ss.strategy = p.strategy
      AND ss.acted_on = true
      AND ABS(EXTRACT(EPOCH FROM (p.opened_at - ss.triggered_at))) < 600
    LEFT JOIN news_articles na ON na.id = p.trigger_article_id
    WHERE p.closed_at IS NOT NULL AND p.pnl_usd IS NOT NULL
    GROUP BY na.sentiment_category
    ORDER BY total_trades DESC
  `;

  return (rows as Array<{
    category: string;
    total_trades: number;
    wins: number;
    avg_pnl_usd: number | null;
    avg_return_pct: number | null;
  }>).map((r) => ({
    category: r.category,
    totalTrades: r.total_trades,
    wins: r.wins,
    winRate: r.total_trades ? r.wins / r.total_trades : 0,
    avgPnlUsd: r.avg_pnl_usd ?? 0,
    avgReturnPct: r.avg_return_pct ?? 0,
    isReliable: r.total_trades >= 10,
  }));
}

export interface SignalQualityStats {
  confirmationRate: number;
  fundingSkipRate: number;
  avgVelocityThisWeek: number;
  maxVelocityThisWeek: number;
}

export async function getSignalQualityStats(): Promise<SignalQualityStats> {
  const sql = getSql();
  const rows = await sql`
    SELECT
      COUNT(*) FILTER (
        WHERE skip_reason IS NULL OR skip_reason NOT LIKE 'single_source%'
      )::float AS acted_or_other,
      COUNT(*) FILTER (
        WHERE skip_reason LIKE 'single_source%'
      )::float AS single_source,
      COUNT(*) FILTER (
        WHERE skip_reason LIKE 'funding_crowded%'
      )::float AS funding_skipped,
      COUNT(*)::float AS total,
      AVG(velocity_multiplier) FILTER (
        WHERE triggered_at > NOW() - INTERVAL '7 days'
          AND velocity_multiplier IS NOT NULL
      )::float AS avg_velocity,
      MAX(velocity_multiplier) FILTER (
        WHERE triggered_at > NOW() - INTERVAL '7 days'
      )::float AS max_velocity
    FROM strategy_signals
    WHERE strategy = 'momentum'
      AND triggered_at > NOW() - INTERVAL '7 days'
  `;
  const r = rows[0] as {
    acted_or_other: number;
    single_source: number;
    funding_skipped: number;
    total: number;
    avg_velocity: number | null;
    max_velocity: number | null;
  };
  const total = r?.total ?? 0;
  const confirmed = total - (r?.single_source ?? 0);
  return {
    confirmationRate: total ? confirmed / total : 0,
    fundingSkipRate: total ? (r?.funding_skipped ?? 0) / total : 0,
    avgVelocityThisWeek: r?.avg_velocity ?? 0,
    maxVelocityThisWeek: r?.max_velocity ?? 0,
  };
}
export async function getArticlesPrior24h(): Promise<NewsArticle[]> {
  const sql = getSql();
  return q<NewsArticle>(sql`
    SELECT * FROM news_articles
    WHERE processed = true
      AND sentiment_score IS NOT NULL
      AND published_at BETWEEN NOW() - INTERVAL '48 hours' AND NOW() - INTERVAL '24 hours'
    ORDER BY published_at DESC
  `);
}


export async function saveRegimeSnapshot(data: {
  regime: MarketRegime;
  signals_bull: number;
  signals_bear: number;
  signals_neutral: number;
  btc_vs_200d_sma?: number | null;
  sma50_vs_sma200?: number | null;
  return_30d?: number | null;
  fear_greed_avg7d?: number | null;
  btc_dominance_pct?: number | null;
  btc_dominance_trend?: string | null;
  funding_direction?: string | null;
  previous_regime?: string | null;
  regime_age_days?: number;
  locked_until?: Date | null;
}): Promise<RegimeSnapshot> {
  const sql = getSql();
  const row = await q1<RegimeSnapshot>(sql`
    INSERT INTO regime_snapshots (
      regime, signals_bull, signals_bear, signals_neutral,
      btc_vs_200d_sma, sma50_vs_sma200, return_30d,
      fear_greed_avg7d, fear_greed_value, btc_dominance_trend, funding_direction,
      previous_regime, regime_age_days, locked_until
    ) VALUES (
      ${data.regime}, ${data.signals_bull}, ${data.signals_bear},
      ${data.signals_neutral}, ${data.btc_vs_200d_sma ?? null},
      ${data.sma50_vs_sma200 ?? null}, ${data.return_30d ?? null},
      ${data.fear_greed_avg7d ?? null}, ${data.btc_dominance_pct ?? null},
      ${data.btc_dominance_trend ?? null}, ${data.funding_direction ?? null},
      ${data.previous_regime ?? null}, ${data.regime_age_days ?? 0},
      ${data.locked_until ? data.locked_until.toISOString() : null}
    )
    RETURNING *
  `);
  if (!row) throw new Error("Failed to save regime snapshot");
  return row;
}

export async function getLatestRegimeSnapshot(): Promise<RegimeSnapshot | null> {
  const sql = getSql();
  return q1<RegimeSnapshot>(sql`
    SELECT * FROM regime_snapshots ORDER BY captured_at DESC LIMIT 1
  `);
}

export async function getRecentRegimeSnapshots(
  limit = 2
): Promise<RegimeSnapshot[]> {
  const sql = getSql();
  return q<RegimeSnapshot>(sql`
    SELECT * FROM regime_snapshots ORDER BY captured_at DESC LIMIT ${limit}
  `);
}

export async function getFearGreedAvg7d(): Promise<number | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT AVG(fear_greed_value)::float AS avg
    FROM (
      SELECT fear_greed_value FROM sentiment_snapshots
      ORDER BY captured_at DESC LIMIT 7
    ) recent
  `;
  const avg = (rows[0] as { avg: number | null })?.avg;
  return avg ?? null;
}

export async function getRecentSentimentSnapshots(
  limit = 3
): Promise<SentimentSnapshot[]> {
  const sql = getSql();
  return q<SentimentSnapshot>(sql`
    SELECT * FROM sentiment_snapshots ORDER BY captured_at DESC LIMIT ${limit}
  `);
}

export async function getSentimentSnapshotNearHoursAgo(
  hours: number
): Promise<SentimentSnapshot | null> {
  const sql = getSql();
  return q1<SentimentSnapshot>(sql`
    SELECT * FROM sentiment_snapshots
    WHERE captured_at <= NOW() - INTERVAL '1 hour' * ${hours}
    ORDER BY captured_at DESC
    LIMIT 1
  `);
}

export async function getCircuitBreakerState(): Promise<CircuitBreakerState | null> {
  const sql = getSql();
  return q1<CircuitBreakerState>(sql`
    SELECT * FROM circuit_breaker_state WHERE id = 1
  `);
}

export async function updateCircuitBreakerState(data: {
  daily_halt_until?: Date | null;
  weekly_halt_until?: Date | null;
  macro_halt_active?: boolean;
  portfolio_high_water_mark?: number;
}): Promise<void> {
  const sql = getSql();
  const current = await getCircuitBreakerState();
  if (!current) {
    await sql`
      INSERT INTO circuit_breaker_state (id) VALUES (1) ON CONFLICT DO NOTHING
    `;
  }
  await sql`
    UPDATE circuit_breaker_state SET
      daily_halt_until = ${data.daily_halt_until !== undefined ? (data.daily_halt_until ? data.daily_halt_until.toISOString() : null) : current?.daily_halt_until ?? null},
      weekly_halt_until = ${data.weekly_halt_until !== undefined ? (data.weekly_halt_until ? data.weekly_halt_until.toISOString() : null) : current?.weekly_halt_until ?? null},
      macro_halt_active = ${data.macro_halt_active ?? current?.macro_halt_active ?? false},
      portfolio_high_water_mark = ${data.portfolio_high_water_mark ?? current?.portfolio_high_water_mark ?? 10000},
      last_checked_at = NOW()
    WHERE id = 1
  `;
}

export async function getPortfolioSnapshot7dAgo(): Promise<PortfolioSnapshot | null> {
  const sql = getSql();
  return q1<PortfolioSnapshot>(sql`
    SELECT * FROM portfolio_snapshots
    WHERE captured_at <= NOW() - INTERVAL '7 days'
    ORDER BY captured_at DESC
    LIMIT 1
  `);
}

export async function getFirstPortfolioSnapshot(): Promise<PortfolioSnapshot | null> {
  const sql = getSql();
  return q1<PortfolioSnapshot>(sql`
    SELECT * FROM portfolio_snapshots ORDER BY captured_at ASC LIMIT 1
  `);
}

export async function getClosedTradesSince(
  days: number,
  limit = 500
): Promise<Position[]> {
  const sql = getSql();
  return q<Position>(sql`
    SELECT p.*, na.title AS trigger_title
    FROM positions p
    LEFT JOIN news_articles na ON na.id = p.trigger_article_id
    WHERE p.closed_at IS NOT NULL
      AND p.closed_at > NOW() - INTERVAL '1 day' * ${days}
    ORDER BY p.closed_at DESC
    LIMIT ${limit}
  `);
}

export async function getClosedTradesAll(limit = 500): Promise<Position[]> {
  const sql = getSql();
  return q<Position>(sql`
    SELECT p.*, na.title AS trigger_title
    FROM positions p
    LEFT JOIN news_articles na ON na.id = p.trigger_article_id
    WHERE p.closed_at IS NOT NULL
    ORDER BY p.closed_at DESC
    LIMIT ${limit}
  `);
}

export async function getRegimeSnapshotDaysAgo(
  daysAgo: number
): Promise<RegimeSnapshot | null> {
  const sql = getSql();
  return q1<RegimeSnapshot>(sql`
    SELECT * FROM regime_snapshots
    WHERE captured_at <= NOW() - INTERVAL '1 day' * ${daysAgo}
    ORDER BY captured_at DESC
    LIMIT 1
  `);
}
