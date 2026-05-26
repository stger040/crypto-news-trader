# News Sentiment Crypto Trading Bot

A news and sentiment-driven crypto trading bot for Kraken, with a Bloomberg-style dashboard. Runs in **paper mode** by default on Vercel Pro with Upstash Redis (`news:` key prefix).

## Prerequisites

- Node.js 18+
- Vercel Pro account
- Kraken API key (read + trade if going live later)
- Upstash Redis (REST)
- OpenAI API key
- CryptoPanic API key
- ntfy.sh topic (optional but recommended)

## Local Development

1. Clone the repository and install dependencies:

```bash
npm install
```

2. Copy environment variables:

```bash
cp .env.example .env.local
```

Fill in all values in `.env.local`.

3. Run the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

4. Trigger a test cron cycle from the dashboard **Force Test Run** button, or:

```bash
curl -X POST "http://localhost:3000/api/test-run?secret=YOUR_CRON_SECRET"
```

## Deploy to Vercel

### 1. Create a new Vercel project

1. Push this repo to GitHub.
2. In [Vercel Dashboard](https://vercel.com/dashboard), click **Add New → Project**.
3. Import the repository (separate from your TA bot project).
4. Framework preset: **Next.js**.

### 2. Environment variables

In **Project → Settings → Environment Variables**, add every variable from `.env.example` for **Production**, **Preview**, and **Development**:

| Variable | Notes |
|----------|--------|
| `KRAKEN_API_KEY` / `KRAKEN_API_SECRET` | Same as sibling bot |
| `OPENAI_API_KEY` | Sentiment scoring |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Shared Redis DB |
| `CRYPTOPANIC_API_KEY` | New key for this bot |
| `NTFY_TOPIC` | Set to `news-bot` |
| `LIVE_TRADING` | `false` |
| `NEXT_PUBLIC_LIVE_TRADING` | `false` |
| `CRON_SECRET` | Random secret for cron auth |
| `NEXT_PUBLIC_CRON_SECRET` | Same value (for dashboard test button) |
| `NEXT_PUBLIC_SITE_URL` | `https://your-app.vercel.app` |

### 3. Cron job

`vercel.json` registers a cron every 5 minutes on `/api/cron`. On Vercel Pro, crons run automatically.

Vercel sends `Authorization: Bearer <CRON_SECRET>` when `CRON_SECRET` is set in the project. The route also accepts `?secret=` and `x-cron-secret` for manual testing.

### 4. Deploy

```bash
npm run build
```

Or push to `main` — Vercel builds on push.

### 5. Verify

1. Open the deployment URL — dashboard should load.
2. Click **Force Test Run** — should return OK and populate Redis.
3. Check **Bot Health** turns green after a successful cron.
4. Optional: `GET /api/debug-state?secret=YOUR_CRON_SECRET` to inspect all `news:*` keys.

## API Endpoints

| Path | Method | Auth | Description |
|------|--------|------|-------------|
| `/api/cron` | GET/POST | `CRON_SECRET` | Main 5-minute bot loop |
| `/api/test-run` | GET/POST | `CRON_SECRET` or `NEXT_PUBLIC_CRON_SECRET` | Manual full cycle |
| `/api/debug-state` | GET | `CRON_SECRET` | Dump all `news:*` Redis keys |
| `/api/dashboard` | GET | None | Dashboard JSON data |

## Redis Key Prefix

All application state uses the `news:` prefix (e.g. `news:portfolio:current`, `news:score:{hash}`). The sibling TA bot must use a different prefix.

## Safety

- Default is paper trading — no real orders until `LIVE_TRADING=true`.
- Not financial advice. Use at your own risk.

See `PROJECT.md` for strategy details and session log.
