# AGENTS.md

## Cursor Cloud specific instructions

### What this is
Single Next.js 14 (App Router, TypeScript) app — the "Crypto News Trader" dashboard plus
its bot API routes (no separate backend). Everything runs in one `next` process on port 3000.
Standard commands live in `package.json` (`dev`, `build`, `start`, `lint`) and setup is in
`README.md`. Data is stored in Neon PostgreSQL via the `@neondatabase/serverless` HTTP driver.

### Running it
- Dev server: `npm run dev` (port 3000). Lint: `npm run lint`. Prod build check: `npm run build`.
- Trigger a bot cycle locally: click **Force Test Run** on the dashboard, or
  `curl -X POST http://localhost:3000/api/test-run` / `/api/request-test-run`
  (auth is bypassed when `CRON_SECRET` is unset). Read-only state dump: `/api/debug-state`.

### Environment / secrets
- `DATABASE_URL` is required by nearly every code path and is stored in `.env.local`
  (gitignored). A Neon database was provisioned for this environment and its schema is already
  applied; `.env.local` persists via the VM snapshot. If it is missing, recreate `.env.local`
  with a Postgres `DATABASE_URL` and apply `db/migrations/*.sql` (see below).
- `OPENAI_API_KEY` is required for a **successful** Force Test Run / cron cycle (GPT-4o-mini
  sentiment scoring). Add it via the Secrets panel; do not put an empty `OPENAI_API_KEY=` in
  `.env.local` (an empty value can shadow the injected secret). Without it, news ingestion and
  the dashboard still work, but the cycle aborts at the scoring step and bot health goes red.
- Kraken keys / `NTFY_TOPIC` are optional (paper trading is the default; live order placement
  is a stub).

### Database schema (non-obvious)
- There is no migration runner. `db/migrations/*.sql` are applied manually (e.g. via the Neon
  SQL console or MCP). The files are idempotent (`IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`).
- The migrations are an incomplete snapshot of the real schema: `lib/db.ts`'s
  `saveRegimeSnapshot` writes/reads a `fear_greed_value` column on `regime_snapshots` (it stores
  BTC dominance) that migration `006_regime.sql` never creates. This column has been added to the
  provisioned DB. If you ever point at a fresh database, also run:
  `ALTER TABLE regime_snapshots ADD COLUMN IF NOT EXISTS fear_greed_value DECIMAL(6,2);`
  Otherwise the cron cycle throws `column "fear_greed_value" does not exist` after the scoring step.

### Dev-mode caching gotcha (important)
`next dev` caches the Neon HTTP query results. The first result for a given query+params is
cached for the life of the `.next` data cache, so the dashboard can show **stale or empty** data
after the DB changes (e.g. it keeps showing 0 articles even though rows exist, while
`/api/debug-state` — which uses a different `LIMIT` — shows them). If the dashboard looks stale,
stop the server, `rm -rf .next`, and `npm run dev` again; the first request after restart caches
the current data. Do a full `.next` wipe, not just `.next/cache`.

### External-call notes (non-blocking)
During a cycle the bot calls public APIs. From this environment the Reddit JSON feeds return
HTTP 403 and the Binance RSS feed fails to parse — both are caught and reported in the `errors`
array but do not stop the cycle. The other RSS feeds (cointelegraph, coindesk, decrypt,
crypto.news, bitcoinmagazine) and the Kraken/Fear&Greed/CoinGecko endpoints work.
