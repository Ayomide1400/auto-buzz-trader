# Auto Buzz Trader

A personal, multi-page trading dashboard that watches [Stocktwits' trending
symbols](https://api.stocktwits.com/api/2/trending/symbols.json) and automatically
places small **paper** trades on Alpaca based on one explainable, tunable rule —
"Buzz Momentum."

This is a single-user dashboard wired to one personal Alpaca account — there is no
login, no multi-tenant support, and it is **not** intended to run against a
live/real-money account.

> ⚠️ **Paper trading only.** The base URL is hard-pinned to
> `https://paper-api.alpaca.markets`. Do not point this at a live Alpaca account.

## The strategy

| | |
|---|---|
| **Candidates** | Symbols newly appearing on Stocktwits' trending list (ranked by chatter volume) that aren't already held |
| **Entry filter** | Must be up at least a configurable % on the day (default 2%), priced $5+, with 500k+ daily volume — buzz alone doesn't qualify |
| **Ranking** | Among qualifying candidates, open slots go to the **strongest movers first** (highest day-change %), not whichever Stocktwits ranked highest by chatter |
| **Sizing** | ~$35/position (configurable), max 5 concurrent bot-owned positions (configurable) |
| **Exit** | Automatic bracket order — take-profit (+10%) and stop-loss (-5%), both configurable — plus a forced close if the symbol drops off the trending list before either target hits |

Every number above is a runtime setting (`/settings` in the app, backed by
`state/strategy-config.json`), not a hardcoded constant.

## How it works

- A **GitHub Actions workflow** (`.github/workflows/trade-cycle.yml`) triggers
  `/api/cron/trade-cycle` every 15 minutes during US market hours, Mon–Fri. Vercel's
  free Hobby plan caps scheduled cron at once per day, which doesn't fit an
  "automatic" strategy at all — GitHub Actions has no such limit.
- Every cycle: logs a daily equity snapshot, reconciles any position that closed on
  its own since the last run (bracket fill, etc.), self-heals any bot-owned position
  missing a protective exit order, sells anything that dropped off trending, then
  buys new qualifying candidates up to the position cap.
- Every order the bot places is tagged with a `buzz-` prefixed `client_order_id`, so
  only positions this bot opened are ever auto-managed — a pre-existing or
  manually-placed position in the same account is left alone (see the `DELL`
  position in a fresh account, if present).
- **Fractional-share positions can't carry a bracket/OCO order on Alpaca** — only a
  simple order. Positions bought via a dollar amount (all pre-hardening legacy buys)
  are fractional, so they get a stop-loss-only order instead of the full pair.
- Closing a position that has a resting protective order requires **canceling that
  order first** — `DELETE /v2/positions/{symbol}` does not release shares held by a
  stop/OCO order on its own.
- Every buy/sell is logged with a plain-language reason to `state/trade-log.json`,
  along with which buy a given sell closes (`matchedBuyId`) — without that, the
  reconciliation logic can re-log the same real trade a second time on a later run.
- No separate database: `state/*.json` files in this repo, read/written live via the
  GitHub Contents API, so every state change is also a small timestamped commit.

## The product

- **Dashboard** — account stats, the strategy as a structured card, trending list
  with a 0–100 confidence score (momentum + liquidity + buzz), open positions, and a
  benchmark chart (this strategy's real P/L vs. the same dollars in the S&P 500,
  aligned by calendar date).
- **Stock Detail** (`/stock/:symbol`) — 90-day price chart, news, a manual buy/sell
  form (capped $200, bypasses the strategy entirely), and that symbol's trade
  history.
- **Watchlist** — a personal symbol list separate from the algorithmic trending
  list (validated against real price data before adding), plus an earnings
  calendar scoped to symbols actually held or watched.
- **Market** — market-wide gainers/losers, combined news (Alpaca + Finnhub, a wider
  range including real-world stories, not just company press releases), and a
  performance heatmap (indices + holdings + watchlist).
- **Settings** — every strategy threshold as a slider.
- **History** — full trade log and a portfolio allocation chart.
- A live scrolling ticker (indices + current holdings) and a Market Open/Closed
  badge appear in the header on every page.

## Stack

- **Frontend:** React + Vite + React Router, deployed on Vercel.
- **Backend:** Vercel serverless functions under `/api` — all credentials stay
  server-side, never shipped to the browser. Capped at **12 functions total**
  (Vercel Hobby plan limit) — related lookups (search, market movers, the ticker
  feed) are folded into existing routes via query params rather than one file per
  feature.
- **Data sources:** Stocktwits public trending endpoint (no key), Alpaca paper
  trading + market data API, Finnhub (general news + earnings calendar — its
  economic/macro calendar is a separate paid product, confirmed by testing, not
  used here).

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
| `CRON_SECRET` | Shared secret the GitHub Actions workflow sends as `Authorization: Bearer …`; the trade-cycle endpoint rejects any request without it |
| `GITHUB_TOKEN` | Token with `repo` scope, used to read/write the `state/*.json` files |
| `GITHUB_REPO` | `Ayomide1400/auto-buzz-trader` |
| `FINNHUB_API_KEY` | Free-tier key for general news + earnings calendar |
| `NTFY_TOPIC` | Optional — push notifications on every trade via [ntfy.sh](https://ntfy.sh), no signup required |

Note: `vercel env pull` returns `[SENSITIVE]` placeholders for any env var marked
Sensitive-type — that's deliberate on Vercel's part (write-only secrets), not a bug.
Verify behavior against the live deployment instead of relying on a local pull.

## Deployment

- Vercel hosts the app and serverless functions (`vercel.json` has a SPA rewrite,
  no cron entry — scheduling moved to GitHub Actions, see above).
- The GitHub Actions workflow triggers the trade cycle; set `CRON_SECRET` as a
  repo secret (`gh secret set CRON_SECRET`) matching the Vercel env var of the
  same name.

## Known limitations

- **One open logging gap:** one historical trade (BTDR, ~$25) closed on the live
  account but its exit was never recorded in the trade log — the money is
  accounted for (reflected in account equity/cash), only that one entry's reason
  and P/L are missing. Not yet root-caused.
- A duplicate-logging bug affected the first 7 closed trades (each was recorded
  twice); fixed at the source and the historical duplicates were removed —
  `state/trade-log.json` now reflects one entry per real trade.
- No correlation/diversification check — the 5-position cap doesn't prevent all
  5 slots from landing in the same sector on a given day.
- Runs only during regular US market hours; a stock trending after-hours won't be
  acted on until the next market-hours cycle.

## Safety notes

- Credentials never touch the client bundle — every Alpaca/Finnhub call happens
  inside a serverless function.
- The cron endpoint verifies a bearer secret, so it can't be triggered by anyone
  else.
- The pause toggle (`state/trading-status.json`) takes effect immediately, no
  redeploy needed, and is checked first thing in every trade cycle.
- A manual trade option exists on every stock's page for acting outside the
  automated strategy, capped at $200.
- A visible, permanent risk disclosure lives in the app itself (Dashboard) —
  unattended execution, "trending" is attention not proof of quality, stop-losses
  can still slip, and this is unproven paper money with no real track record yet.
