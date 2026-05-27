# Crypto News Trader

News and sentiment-driven crypto trading bot with a Neon PostgreSQL backend, Kraken integration, and Vercel-hosted dashboard.

## Prerequisites

- Node.js 18+
- Neon PostgreSQL database (`crypto_news_trader`)
- OpenAI API key
- Kraken API keys (optional until live trading)
- Vercel Pro (for cron)

## Local Setup

```bash
npm install
cp .env.example .env.local
# Fill in DATABASE_URL and other vars
npm run dev
```

Open http://localhost:3000 and click **Force Test Run** to seed articles and run a cycle.

## Deploy to Vercel

1. Push to GitHub and import as a **new Vercel project**.
2. Add environment variables from `.env.example`:
   - `DATABASE_URL` — Neon console → Connect → connection string for `crypto_news_trader`
   - `OPENAI_API_KEY`, `KRAKEN_API_KEY`, `KRAKEN_API_SECRET`
   - `NTFY_TOPIC=news-bot`
   - `LIVE_TRADING=false`, `NEXT_PUBLIC_LIVE_TRADING=false`
   - `CRON_SECRET`, `NEXT_PUBLIC_CRON_SECRET` (same value)
   - `NEXT_PUBLIC_SITE_URL`
3. Deploy — `vercel.json` registers cron every 5 minutes on `/api/cron`.
4. Verify: dashboard loads, **Force Test Run** succeeds, Bot Health turns green.

## Database Setup

Tables were created via Neon MCP. If setting up manually, run `db/migrations/001_initial.sql` in the Neon SQL console.

## API Endpoints

| Route | Auth | Description |
|-------|------|-------------|
| `GET /api/cron` | `CRON_SECRET` (optional if unset) | Main bot loop |
| `GET /api/test-run` | `CRON_SECRET` or `NEXT_PUBLIC_CRON_SECRET` | Force test cycle |
| `GET /api/debug-state` | `CRON_SECRET` | Debug dump |
| `GET /api/dashboard` | None | Dashboard JSON |

See `PROJECT.md` for strategy details.
