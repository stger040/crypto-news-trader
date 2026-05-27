ALTER TABLE strategy_signals
  ADD COLUMN IF NOT EXISTS funding_rate DECIMAL(10,6);
