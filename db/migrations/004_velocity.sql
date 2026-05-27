ALTER TABLE strategy_signals
  ADD COLUMN IF NOT EXISTS velocity_multiplier DECIMAL(6,2);
