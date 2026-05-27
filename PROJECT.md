# Crypto News Trader — PROJECT.md

> **Living document.** Update this file with every meaningful change to the repo, deployment, or strategy.  
> Your other LLM can edit the **Goals** and **Session Log** sections as the project evolves.

---

## Goals

### Primary objective

Achieve **9% net monthly return** (after fees) through **news and sentiment-driven** crypto trading on **Kraken spot** markets.

### Current phase

**Paper / simulation mode only.** Validate whether RSS news + GPT sentiment scoring + the three strategies produce positive risk-adjusted returns before enabling live trading.

### Success criteria (paper phase)

- [ ] Cron runs reliably every 5 minutes (Bot Health stays green)
- [ ] News articles fetched, scored, and stored in Neon daily
- [ ] Strategies fire on real signals (not just Force Test Run)
- [ ] Positions open/close with correct stop-loss, take-profit, and time-stop logic
- [ ] Portfolio snapshots and analytics accumulate over 2–4 weeks
- [ ] Paper results reviewed against 9% monthly target before `LIVE_TRADING=true`

### User-defined goals

<!-- Other LLM / owner: add your specific goals, constraints, and decision gates below -->

- _Example: Run paper mode for 30 days minimum before evaluating live._
- _Example: Max drawdown tolerance on paper portfolio._
- _Example: Which pairs or strategies to prioritize or disable._

---

## Current Status

| Item | Status |
|------|--------|
| **GitHub repo** | `stger040/crypto-news-trader` |
| **Production branch** | `main` (app code merged 2026-05-27) |
| **Vercel deployment** | Live — dashboard accessible at production domain |
| **Neon database** | `crypto_news_trader` on project `shiny-breeze-29552014` |
| **Trading mode** | Paper (`LIVE_TRADING=false`) |
| **Cron** | Every 5 min via `vercel.json` → `/api/cron` |
| **Force Test Run** | Validated — ntfy notifications received (2026-05-27) |
| **Live Kraken orders** | Not implemented (stub only) |

---

## What This Bot Does

1. **Fetches** crypto news from free RSS feeds + Reddit (no CryptoPanic or paid news APIs).
2. **Scores** headlines with OpenAI `gpt-4o-mini` (sentiment, category, affected pairs).
3. **Runs three strategies** on scored data + Fear & Greed index.
4. **Manages positions** in paper mode (stop-loss, take-profit, time stops).
5. **Snapshots portfolio** and analytics to Neon after each cron cycle.
6. **Notifies** via ntfy.sh when trades open or close.

---

## Three Strategies

### 1. Breaking News Momentum (`lib/strategies/momentum.ts`)

- **Entry:** Article with sentiment ≥ 0.65, confidence ≥ 0.7, category in `bullish` / `regulatory_positive` / `listing_announcement`, published within 30 minutes.
- **Action:** Long first affected Kraken spot pair (skip if pair already open or 24h move > +8%).
- **Size:** 3% of portfolio. **Max 2** simultaneous momentum positions.
- **Exits:** Stop −2.5%, take profit +4%, time stop 4 hours.
- **Bearish:** Score ≤ −0.65 (hack/regulatory/bearish) → **no short**; log to `strategy_signals` with `skip_reason = no_short_on_spot`.

*Research basis:* Event-driven momentum around information shocks.

### 2. Sentiment Momentum — Daily Lag (`lib/strategies/sentimentMomentum.ts`)

- **Schedule:** ~00:05 UTC daily (checked each cron; runs in 00:02–00:08 UTC window).
- **Logic:** Compare avg sentiment last 24h vs prior 24h.
- **If change > +0.15 and avg > 0:** Long BTC 4% + ETH 4%.
- **If change < −0.15:** Close sentiment-momentum positions.
- **Hold:** 24 hours then re-evaluate.

*Research basis:* Sasso (2024) — lagged aggregate sentiment and subsequent returns.

### 3. Fear & Greed Contrarian (`lib/strategies/fearGreed.ts`)

- **Entry:** F&G ≤ 20 → DCA BTC at 3% (max 5 positions, 15% total allocation).
- **Exit:** F&G ≥ 80 → close all F&G positions.
- **No time stop** — hold until greed exit.

*Research basis:* Behavioral contrarianism at sentiment extremes.

---

## Data Sources (all free, no API keys)

| Source | URL / method | Cache / filter |
|--------|----------------|----------------|
| CoinTelegraph | https://cointelegraph.com/rss | Last 6h, dedupe by URL |
| CoinDesk | https://coindesk.com/arc/outboundfeeds/rss/ | Last 6h |
| Decrypt | https://decrypt.co/feed | Last 6h |
| Crypto.news | https://crypto.news/feed | Last 6h |
| Bitcoin Magazine | https://bitcoinmagazine.com/.rss/full/ | Last 6h |
| Binance Announcements | https://www.binance.com/en/support/announcement/rss | Last 6h |
| Reddit r/cryptocurrency | hot.json?limit=25 | score > 50, ratio > 0.6 |
| Reddit r/bitcoin | hot.json?limit=10 | score > 50, ratio > 0.6 |
| Fear & Greed | https://api.alternative.me/fng/?limit=2 | 1h cache via DB snapshot |

Implementation: `lib/newsFetcher.ts` (rss-parser + fetch). Per-source last fetch tracked in `feed_sync` table.

---

## Database — Neon PostgreSQL

- **Neon project:** `crypto-news-trader` (`shiny-breeze-29552014`)
- **Database name:** `crypto_news_trader`
- **Schema file:** `db/migrations/001_initial.sql`

| Table | Purpose |
|-------|---------|
| `news_articles` | Headlines + GPT scores + affected pairs |
| `sentiment_snapshots` | Rolling avg sentiment + F&G per capture |
| `positions` | Open and closed trades |
| `portfolio_snapshots` | Portfolio value over time |
| `strategy_signals` | Every signal, including skipped bearish |
| `feed_sync` | Last RSS fetch time per source |
| `cron_runs` | Cron success/failure + duration (Bot Health) |

All SQL lives in `lib/db.ts` — no inline SQL elsewhere.

---

## Infrastructure

| Service | Role |
|---------|------|
| **Neon PostgreSQL** | Primary data store |
| **Vercel Pro** | Next.js 14 hosting + 5-min cron |
| **Kraken** | Public ticker prices; live orders stubbed |
| **OpenAI** | gpt-4o-mini sentiment (`lib/sentiment.ts`) |
| **ntfy.sh** | Push alerts (`NTFY_TOPIC`, e.g. `news-bot` or custom topic) |

**Sister project:** TA bot (`arbitrage-bot1`) uses Upstash Redis — **no shared state** with this app.

---

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Neon connection string for `crypto_news_trader` |
| `OPENAI_API_KEY` | Sentiment scoring |
| `KRAKEN_API_KEY` / `KRAKEN_API_SECRET` | Live trading (future) |
| `NTFY_TOPIC` | ntfy.sh topic name |
| `LIVE_TRADING` | `false` = paper (default) |
| `NEXT_PUBLIC_LIVE_TRADING` | Dashboard badge |
| `CRON_SECRET` | Secures `/api/cron` and `/api/debug-state` |
| `NEXT_PUBLIC_CRON_SECRET` | Optional legacy; Force Test Run uses `/api/request-test-run` (no client secret) |
| `NEXT_PUBLIC_SITE_URL` | Production URL, e.g. `https://crypto-news-trader.vercel.app` |

See `.env.example` for full list and comments.

---

## API Endpoints

| Route | Auth | Description |
|-------|------|-------------|
| `GET /api/cron` | `CRON_SECRET` (optional if unset) | Main 5-min bot loop |
| `GET /api/test-run` | `CRON_SECRET` only | Programmatic force cycle (server-to-server) |
| `POST /api/request-test-run` | None | Dashboard Force Test Run (server-side only) |
| `GET /api/debug-state` | `CRON_SECRET` | Last articles, positions, signals, portfolio |
| `GET /api/dashboard` | None | Dashboard JSON (polls every 60s) |

---

## Dashboard

Dark navy/slate UI with amber accents (`app/page.tsx` + `components/`).

| Panel | Data source |
|-------|-------------|
| News Feed | Last 20 `news_articles` |
| Sentiment Gauge | Latest `sentiment_snapshots` |
| Strategies | Open positions + `strategy_signals` |
| Open Positions | Live Kraken prices + DB positions |
| Trade History | Last 30 closed positions |
| Analytics | Win rate, Sharpe, monthly P&L, 9% target badge |
| Bot Health | Last `cron_runs` entry (< 6m green, < 15m yellow, else red) |
| Force Test Run | Calls `/api/request-test-run` (no secret in browser) |

---

## Risk Parameters

| Parameter | Value |
|-----------|-------|
| Default mode | Paper (`LIVE_TRADING=false`) |
| Initial paper portfolio | $10,000 (simulated) |
| Momentum size | 3% per trade, max 2 positions |
| Sentiment momentum | 4% BTC + 4% ETH |
| F&G size | 3% per entry, max 5 positions (15% cap) |
| Momentum stop / TP / time | −2.5% / +4% / 4 hours |
| Kraken taker fee | 0.40% per side (0.80% round-trip, base tier) |
| Break-even win rate (Momentum) | ~50.8% (after round-trip fees) |
| Funding rate threshold | Skip long if funding > 0.03%/8h |
| Spot shorting | Never — bearish = cash + log signal |

---

## Operational Expectations

### Normal cron (every 5 minutes)

- Fetches RSS + Reddit, scores new articles, updates F&G snapshot.
- Checks open positions for exits.
- Runs momentum + F&G every cycle; sentiment momentum only ~00:05 UTC.
- **ntfy alerts are sparse** — only when a trade opens or closes.

### Force Test Run

- Bypasses time windows and forces signals (min ~$50 positions, always simulated).
- Expect **many ntfy notifications at once** — this is normal for test only.

### What to monitor

1. Bot Health green on dashboard.
2. New articles in News Feed over time.
3. `cron_runs` rows in Neon advancing every ~5 min.
4. Positions opening/closing with sensible exit reasons.
5. Analytics filling in after closed trades accumulate.

---

## Repo Structure (key paths)

```
app/api/cron/route.ts          # Vercel cron entry
app/api/test-run/route.ts      # Manual test cycle
app/api/dashboard/route.ts     # Dashboard API
lib/db.ts                      # All Neon queries
lib/newsFetcher.ts             # RSS + Reddit + F&G
lib/sentiment.ts               # OpenAI scoring
lib/strategies/                # momentum, sentimentMomentum, fearGreed
lib/fundingRate.ts             # Binance perp funding filter
lib/confirmation.ts          # Multi-source corroboration
lib/velocity.ts                # News velocity multiplier
lib/deduplication.ts           # Semantic syndication detection
lib/cronRunner.ts              # Orchestrates each cycle
components/Dashboard.tsx       # Main UI
db/migrations/001_initial.sql  # Schema reference
vercel.json                    # Cron schedule
```

---

## What Has Not Been Built Yet

- Live Kraken order signing and execution
- Coinbase listing detector (Stage 2)
- ETF flow regime overlay (Stage 2)
- Polymarket overlay (Stage 3)
- Walk-forward backtesting harness (future)
- Multi-user dashboard authentication
- Email / Slack alerting (ntfy only today)
- Automated monthly gate vs 9% target (manual review for now)

---

## Session Log

### 2026-05-26 — Initial build

- Scaffolded Next.js 14 + TypeScript + Tailwind + Recharts app from scratch.
- Created Neon project and database `crypto_news_trader` via Neon MCP.
- Executed full schema (tables + indexes) through MCP; backup at `db/migrations/001_initial.sql`.
- Implemented RSS/Reddit news fetcher, GPT-4o-mini sentiment, three strategies, cron loop, dashboard.
- Confirmed all RSS sources are free / no API keys required.
- Opened draft PR on feature branch `cursor/crypto-news-trader-neon-698e`.


### 2026-05-27 — Bug fixes + signal improvements (Parts A–C)

- Fixed portfolio accounting drift (anchored to `INITIAL_CASH_USD`, 24h daily P&L from snapshot)
- Fixed F&G ladder (removed single-BTC-position block; MAX_POSITIONS + 15% cap remain)
- Fixed test-run auth (removed `NEXT_PUBLIC_CRON_SECRET` from auth; new `/api/request-test-run`)
- Updated fee model to Kraken taker 0.40%/side (0.80% round-trip)
- Added Binance funding rate filter on momentum longs (`lib/fundingRate.ts`)
- Added multi-source corroboration gate (`lib/confirmation.ts`)
- Added exponential sentiment decay λ=0.5/hr for daily strategy
- Added news velocity multiplier (`lib/velocity.ts`)
- Added title+summary GPT scoring + `summary` column
- Added semantic deduplication + `is_syndicated` flag (`lib/deduplication.ts`)
- Added category win-rate tracking + Signal Quality dashboard panel
- DB migrations 002–005 applied via Neon MCP

### 2026-05-27 — Production deploy + validation

- Merged app code from `cursor/crypto-news-trader-neon-698e` into `main` (was previously README-only; Vercel build had failed with "No Next.js version detected").
- Vercel deployment succeeded; production dashboard live.
- `NEXT_PUBLIC_SITE_URL` set to Vercel production domain.
- **Force Test Run validated:** ntfy notifications received for F&G DCA, Momentum Long (BTC/ETH), and Sentiment Momentum — confirms cron pipeline, strategies, Kraken price fetch, and ntfy integration end-to-end.
- Expanded `PROJECT.md` as living project document for ongoing updates.

---

## Change Log Template

<!-- Copy this block for each future change -->

<!--
### YYYY-MM-DD — Short title

- What changed
- Why
- Deployment / env notes if any
-->
