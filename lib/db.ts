import { neon, neonConfig } from "@neondatabase/serverless";
import type {
  NewsArticle,
  PortfolioSnapshot,
  Position,
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
}): Promise<NewsArticle | null> {
  const sql = getSql();
  return q1<NewsArticle>(sql`
    INSERT INTO news_articles (source, title, url, published_at)
    VALUES (${data.source}, ${data.title}, ${data.url}, ${data.published_at})
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
  minutes = 30
): Promise<NewsArticle[]> {
  const sql = getSql();
  return q<NewsArticle>(sql`
    SELECT * FROM news_articles
    WHERE processed = true
      AND sentiment_score >= 0.65
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
}): Promise<Position> {
  const sql = getSql();
  const row = await q1<Position>(sql`
    INSERT INTO positions (
      pair, side, strategy, entry_price, size_usd,
      trigger_article_id, simulated
    ) VALUES (
      ${data.pair}, ${data.side}, ${data.strategy}, ${data.entry_price},
      ${data.size_usd}, ${data.trigger_article_id ?? null},
      ${data.simulated ?? true}
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
  fear_greed_value: number;
  fear_greed_label: string;
  article_count_24h: number;
  dominant_category: string | null;
}): Promise<SentimentSnapshot> {
  const sql = getSql();
  const row = await q1<SentimentSnapshot>(sql`
    INSERT INTO sentiment_snapshots (
      avg_score_1h, avg_score_6h, avg_score_24h,
      fear_greed_value, fear_greed_label,
      article_count_24h, dominant_category
    ) VALUES (
      ${data.avg_score_1h}, ${data.avg_score_6h}, ${data.avg_score_24h},
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
}): Promise<StrategySignal> {
  const sql = getSql();
  const row = await q1<StrategySignal>(sql`
    INSERT INTO strategy_signals (
      strategy, pair, signal_type, sentiment_score,
      fear_greed_value, acted_on, skip_reason
    ) VALUES (
      ${data.strategy}, ${data.pair ?? null}, ${data.signal_type ?? null},
      ${data.sentiment_score ?? null}, ${data.fear_greed_value ?? null},
      ${data.acted_on ?? false}, ${data.skip_reason ?? null}
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
