CREATE TABLE IF NOT EXISTS regime_snapshots (
  id SERIAL PRIMARY KEY,
  captured_at TIMESTAMPTZ DEFAULT NOW(),
  regime VARCHAR(10) NOT NULL,
  signals_bull INTEGER NOT NULL DEFAULT 0,
  signals_bear INTEGER NOT NULL DEFAULT 0,
  signals_neutral INTEGER NOT NULL DEFAULT 0,
  btc_vs_200d_sma DECIMAL(8,4),
  sma50_vs_sma200 DECIMAL(8,4),
  return_30d DECIMAL(8,4),
  fear_greed_avg7d DECIMAL(6,2),
  btc_dominance_trend VARCHAR(10),
  funding_direction VARCHAR(10),
  previous_regime VARCHAR(10),
  regime_age_days INTEGER DEFAULT 0,
  locked_until TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_regime_snapshots_captured_at
  ON regime_snapshots(captured_at DESC);

ALTER TABLE positions
  ADD COLUMN IF NOT EXISTS regime VARCHAR(10);
ALTER TABLE strategy_signals
  ADD COLUMN IF NOT EXISTS regime VARCHAR(10);
