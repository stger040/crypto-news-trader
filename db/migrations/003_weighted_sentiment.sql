ALTER TABLE sentiment_snapshots
  ADD COLUMN IF NOT EXISTS weighted_avg_24h DECIMAL(4,3);
