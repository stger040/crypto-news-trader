-- Initial schema for crypto-news-trader
-- Executed via Neon MCP on project shiny-breeze-29552014, database crypto_news_trader

CREATE TABLE IF NOT EXISTS news_articles (
  id SERIAL PRIMARY KEY,
  source VARCHAR(50) NOT NULL,
  title TEXT NOT NULL,
  url TEXT UNIQUE NOT NULL,
  published_at TIMESTAMPTZ NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  sentiment_score DECIMAL(4,3),
  sentiment_category VARCHAR(30),
  confidence DECIMAL(4,3),
  affected_pairs TEXT[],
  processed BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS sentiment_snapshots (
  id SERIAL PRIMARY KEY,
  captured_at TIMESTAMPTZ DEFAULT NOW(),
  avg_score_1h DECIMAL(4,3),
  avg_score_6h DECIMAL(4,3),
  avg_score_24h DECIMAL(4,3),
  fear_greed_value INTEGER,
  fear_greed_label VARCHAR(20),
  article_count_24h INTEGER,
  dominant_category VARCHAR(30)
);

CREATE TABLE IF NOT EXISTS positions (
  id SERIAL PRIMARY KEY,
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  pair VARCHAR(20) NOT NULL,
  side VARCHAR(10) NOT NULL,
  strategy VARCHAR(30) NOT NULL,
  entry_price DECIMAL(18,8) NOT NULL,
  exit_price DECIMAL(18,8),
  size_usd DECIMAL(10,2) NOT NULL,
  pnl_usd DECIMAL(10,2),
  pnl_pct DECIMAL(8,4),
  fees_usd DECIMAL(8,4),
  exit_reason VARCHAR(30),
  trigger_article_id INTEGER REFERENCES news_articles(id),
  simulated BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  id SERIAL PRIMARY KEY,
  captured_at TIMESTAMPTZ DEFAULT NOW(),
  total_value_usd DECIMAL(12,2),
  cash_usd DECIMAL(12,2),
  positions_value_usd DECIMAL(12,2),
  daily_pnl_usd DECIMAL(10,2),
  total_pnl_usd DECIMAL(10,2)
);

CREATE TABLE IF NOT EXISTS strategy_signals (
  id SERIAL PRIMARY KEY,
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  strategy VARCHAR(30) NOT NULL,
  pair VARCHAR(20),
  signal_type VARCHAR(20),
  sentiment_score DECIMAL(4,3),
  fear_greed_value INTEGER,
  acted_on BOOLEAN DEFAULT FALSE,
  skip_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_news_articles_published_at ON news_articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_articles_processed ON news_articles(processed);
CREATE INDEX IF NOT EXISTS idx_positions_opened_at ON positions(opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_positions_closed_at ON positions(closed_at);

-- Supporting tables (feed sync + cron health)
CREATE TABLE IF NOT EXISTS feed_sync (
  source VARCHAR(50) PRIMARY KEY,
  last_fetched_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cron_runs (
  id SERIAL PRIMARY KEY,
  ran_at TIMESTAMPTZ DEFAULT NOW(),
  success BOOLEAN DEFAULT TRUE,
  duration_ms INTEGER,
  error_message TEXT
);
