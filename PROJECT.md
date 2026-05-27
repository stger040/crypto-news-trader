# Crypto News Trader

## Goal

Achieve **9% net monthly return** through news and sentiment-driven crypto trading on Kraken spot markets. The bot runs in **paper/simulation mode** by default while strategies are validated.

## Three Strategies

### 1. Breaking News Momentum (`lib/strategies/momentum.ts`)

Enters long when a freshly scored article has sentiment ≥ 0.65, confidence ≥ 0.7, and category in `bullish`, `regulatory_positive`, or `listing_announcement`, published within 30 minutes. Position size 3%, stop −2.5%, take profit +4%, 4-hour time stop. Max 2 simultaneous positions.

Bearish hack/regulatory headlines: **no short** on spot — logged to `strategy_signals` with `skip_reason = no_short_on_spot`.

*Research basis:* Event-driven momentum around information shocks (market microstructure literature).

### 2. Sentiment Momentum — Daily Lag (`lib/strategies/sentimentMomentum.ts`)

Runs at ~00:05 UTC. Compares average sentiment over the last 24h vs the prior 24h. If change > +0.15 and current avg > 0, opens BTC (4%) and ETH (4%). If change < −0.15, closes sentiment-momentum positions. 24-hour hold cycle.

*Research basis:* Sasso (2024) — lagged aggregate sentiment and subsequent returns.

### 3. Fear & Greed Contrarian (`lib/strategies/fearGreed.ts`)

F&G ≤ 20: DCA BTC at 3% (max 5 positions, 15% total). F&G ≥ 80: close all F&G positions. No time stop.

*Research basis:* Behavioral contrarianism at sentiment extremes.

## Data Sources (all free, no API keys)

| Source | URL |
|--------|-----|
| CoinTelegraph | https://cointelegraph.com/rss |
| CoinDesk | https://coindesk.com/arc/outboundfeeds/rss/ |
| Decrypt | https://decrypt.co/feed |
| Crypto.news | https://crypto.news/feed |
| Bitcoin Magazine | https://bitcoinmagazine.com/.rss/full/ |
| Binance Announcements | https://www.binance.com/en/support/announcement/rss |
| Reddit r/cryptocurrency | hot.json (score > 50, ratio > 0.6) |
| Reddit r/bitcoin | hot.json |
| Fear & Greed Index | https://api.alternative.me/fng/?limit=2 |

Parsed via `rss-parser` and plain HTTP. Articles deduplicated by URL in PostgreSQL.

## Database — Neon PostgreSQL

Project: `crypto-news-trader` (Neon)  
Database: `crypto_news_trader`

| Table | Purpose |
|-------|---------|
| `news_articles` | RSS/Reddit headlines + GPT sentiment scores |
| `sentiment_snapshots` | Hourly F&G + rolling avg sentiment |
| `positions` | Open/closed trades |
| `portfolio_snapshots` | Portfolio value history |
| `strategy_signals` | Signal log (including skipped bearish) |
| `feed_sync` | Last fetch time per RSS source |
| `cron_runs` | Cron health tracking |

Schema: `db/migrations/001_initial.sql`

## Infrastructure

| Service | Role |
|---------|------|
| **Neon PostgreSQL** | Primary data store |
| **Vercel Pro** | Hosting + 5-min cron |
| **Kraken** | Spot prices + trading (paper default) |
| **OpenAI** | gpt-4o-mini sentiment |
| **ntfy.sh** | Trade notifications (`NTFY_TOPIC=news-bot`) |

**Note:** Sister project TA bot (`arbitrage-bot1`) runs separately on Upstash Redis — no shared state with this app.

## Risk Parameters

| Parameter | Value |
|-----------|-------|
| Default mode | Paper (`LIVE_TRADING=false`) |
| Momentum size | 3% per trade |
| Momentum max positions | 2 |
| Sentiment momentum size | 4% BTC + 4% ETH |
| F&G size | 3% per entry, max 15% total |
| Stop loss (momentum) | −2.5% |
| Take profit (momentum) | +4% |
| Time stop (momentum) | 4 hours |
| No spot shorting | Bearish = cash only |

## What Has Not Been Built Yet

- Live Kraken order signing
- Backtest / walk-forward framework
- Slippage modeling
- Multi-user dashboard auth
- Email/Slack alerting

## Session Log

### 2026-05-26

- Initial build from scratch
- Neon DB `crypto_news_trader` created via MCP (project `shiny-breeze-29552014`)
- All tables + indexes executed through Neon MCP
- All RSS sources confirmed free / no API key required
