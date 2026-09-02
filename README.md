# Auto Buzz Trader

A personal dashboard that watches [Stocktwits' trending symbols](https://api.stocktwits.com/api/2/trending/symbols.json)
and automatically places small **paper** trades on Alpaca based on one simple, explainable rule:

> **Buy** $35 of a symbol when it newly appears on the trending list and isn't already held.
> **Sell** a position (that this bot opened) if it drops off the trending list.
> Never more than **5 open positions** at once. Never more than **$35 per trade**.

This is a single-user dashboard wired to one personal Alpaca account — there is no login, no
multi-tenant support, and it is **not** intended to run against a live/real-money account.

> ⚠️ **Paper trading only.** The base URL is hard-pinned to
> `https://paper-api.alpaca.markets`. Do not point this at a live Alpaca account.

## How it works

- A Vercel Cron job hits `/api/cron/trade-cycle` once each weekday morning (market hours).
- The job pulls the current Stocktwits trending list and the account's current Alpaca positions
  and orders, then applies the buy/sell rule above.
- Every order the bot places is tagged with a `buzz-` prefixed `client_order_id`. The activity
  log and the sell logic both key off that tag, so only positions this bot opened are ever
  auto-sold — a pre-existing or manually-placed position in the same account is left alone.
- Auto-trading can be paused instantly from the dashboard (top-right toggle) without a
  redeploy — the flag lives in a Vercel Edge Config store, not in code.
- There's no separate trade database: the activity log and position ownership are both read
  live from Alpaca's own `/v2/orders` and `/v2/positions` endpoints.

## Stack

- **Frontend:** React + Vite, deployed on Vercel.
- **Backend:** Vercel serverless functions under `/api` — all Alpaca credentials stay
  server-side (`process.env`), never shipped to the browser.
- **Data sources:** Stocktwits public trending endpoint (no key required), Alpaca paper
  trading API.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in real values — this file is gitignored
npm run dev
```

`.env.local` needs:

| Variable | Purpose |
|---|---|
| `ALPACA_API_KEY_ID` / `ALPACA_API_SECRET_KEY` | Paper trading credentials |
| `ALPACA_BASE_URL` | Always `https://paper-api.alpaca.markets` |
| `CRON_SECRET` | Shared secret Vercel Cron sends as `Authorization: Bearer …`; the trade-cycle endpoint rejects any request without it |
| `EDGE_CONFIG` / `VERCEL_EDGE_CONFIG_ID` | Vercel Edge Config store backing the pause/resume flag |
| `VERCEL_API_TOKEN` | Personal Vercel API token used to write the pause flag |

## Deployment

Deployed on Vercel with a `vercel.json` cron entry running `/api/cron/trade-cycle` on
weekday mornings. On Vercel's free Hobby plan, cron jobs are capped at once per day —
that's the current cadence. A Vercel Pro plan would allow checking more frequently
(e.g. every 15–60 minutes) if tighter reaction time to trending changes is wanted later.

## Safety notes

- Credentials never touch the client bundle — every Alpaca call happens inside a
  serverless function.
- The cron endpoint verifies a bearer secret, so it can't be triggered by anyone else.
- The pause toggle takes effect immediately (no redeploy needed) and is checked first
  thing in every trade cycle.
