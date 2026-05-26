# News Sentiment Crypto Trading Bot

## Goal

Test whether crypto market news and sentiment data can drive profitable trades on Kraken. Target: **9% net monthly return** after fees. The bot starts in **paper/simulation mode only** (`LIVE_TRADING=false`).

## Infrastructure

| Component | Notes |
|-----------|--------|
| **Vercel Pro** | Separate project from the TA sibling bot |
| **Kraken API** | Same API keys as sibling; spot only, no shorts |
| **Upstash Redis** | Same database; **all keys prefixed `news:`** |
| **OpenAI** | `gpt-4o-mini` for headline sentiment scoring |
| **CryptoPanic** | Dedicated API key (`CRYPTOPANIC_API_KEY`) |
| **ntfy.sh** | Topic `news-bot` (`NTFY_TOPIC`) |

## Strategies

### 1. Breaking News Momentum (`lib/strategies/momentum.ts`)

Reacts to high-importance CryptoPanic headlines scored bullish (≥ 0.6) with ≥ 3 important votes. Enters long at 3% portfolio per pair; stop −2.5%, take profit +4%, time stop 4 hours. Requires > $1M Kraken 24h volume.

Bearish hack/regulatory headlines (≤ −0.6): **no short** on spot — logs signal and stays in cash for that pair for 4 hours.

*Basis:* Event-driven momentum around information shocks (market microstructure / news reaction literature).

### 2. Sentiment Momentum — Daily Lag (`lib/strategies/sentimentMomentum.ts`)

Inspired by **Sasso (2024)** on lagged sentiment and returns: daily at ~00:01 UTC, aggregates yesterday’s GPT-scored news (confidence × importance weighted). If day-over-day change > +0.15, goes long BTC and ETH at 5% each for 24h; if < −0.15, stays in cash (no short).

### 3. Fear & Greed Contrarian (`lib/strategies/fearGreed.ts`)

Contrarian DCA: F&G ≤ 20 (Extreme Fear) → 3% portfolio BTC long. F&G ≥ 80 → closes F&G positions. Max 5 F&G positions (15% portfolio cap). No time stop; holds until greed exit.

*Basis:* Behavioral finance contrarianism (extreme sentiment as reversal indicator).

## Data Sources

| Source | Function | Cache TTL |
|--------|----------|-----------|
| CryptoPanic | `fetchCryptoPanicNews` | 60s |
| Fear & Greed | `fetchFearAndGreed` | 3600s |
| Reddit (hot) | `fetchRedditSentiment` | 300s |
| Binance + Coinbase RSS | `fetchExchangeListings` | 120s |

Cron runs every **5 minutes** (`vercel.json`).

## Risk Parameters

- Paper trading default; live requires `LIVE_TRADING=true`
- Per-strategy position sizing caps (3–5% per entry)
- Stop loss / take profit / time stops on news momentum trades
- No spot shorting; bearish = cash only
- F&G strategy max 15% allocation

## What Has Not Been Built Yet

- Live Kraken order signing and execution
- Full backtest / walk-forward framework
- Slippage and fee modeling in analytics
- Multi-user auth on dashboard
- Alerting beyond ntfy (email, Slack)
- Automated monthly performance vs 9% target gate

## Session Log

### 2026-05-26

- Initial scaffold: Next.js 14, data sources, sentiment engine, three strategies, cron loop, dashboard, docs.
