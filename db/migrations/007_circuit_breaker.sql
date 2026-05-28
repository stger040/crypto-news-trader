CREATE TABLE IF NOT EXISTS circuit_breaker_state (
  id INTEGER PRIMARY KEY DEFAULT 1,
  daily_halt_until TIMESTAMPTZ,
  weekly_halt_until TIMESTAMPTZ,
  macro_halt_active BOOLEAN DEFAULT FALSE,
  last_checked_at TIMESTAMPTZ DEFAULT NOW(),
  portfolio_high_water_mark DECIMAL(12,2) DEFAULT 10000
);

INSERT INTO circuit_breaker_state (id)
  VALUES (1) ON CONFLICT DO NOTHING;
