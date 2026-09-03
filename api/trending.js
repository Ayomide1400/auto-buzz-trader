import { getSnapshots, snapshotStats } from './_lib/alpaca.js'

// A rough 0-100 read on "how strong does this look right now" — momentum,
// liquidity, and buzz volume combined into one number so the list is
// scannable at a glance instead of just a bare name.
function confidenceScore({ changePct, volume, watchlistCount }) {
  const momentum = changePct === null ? 0 : Math.max(0, Math.min(changePct * 500, 40))
  const liquidity = volume === null ? 0 : Math.min(volume / 2_000_000, 1) * 30
  const buzz = watchlistCount === null ? 0 : Math.min(watchlistCount / 50_000, 1) * 30
  return Math.round(momentum + liquidity + buzz)
}

export default async function handler(req, res) {
  try {
    const upstream = await fetch('https://api.stocktwits.com/api/2/trending/symbols.json')
    if (!upstream.ok) {
      res.status(upstream.status).json({ error: 'Stocktwits request failed' })
      return
    }
    const data = await upstream.json()
    const rawSymbols = (data.symbols || []).map((s) => ({
      symbol: s.symbol,
      title: s.title,
      watchlistCount: s.watchlist_count ?? null,
    }))

    let snapshots = {}
    try {
      snapshots = await getSnapshots(rawSymbols.map((s) => s.symbol))
    } catch {
      // Price data is a nice-to-have on this list — don't fail the whole
      // request just because the market data call had a problem.
    }

    const symbols = rawSymbols.map((s) => {
      const stats = snapshotStats(snapshots[s.symbol]) || { price: null, volume: null, changePct: null }
      return {
        ...s,
        price: stats.price,
        changePct: stats.changePct,
        confidence: confidenceScore({ ...stats, watchlistCount: s.watchlistCount }),
      }
    })

    res.setHeader('Cache-Control', 's-maxage=55, stale-while-revalidate=30')
    res.status(200).json({ symbols })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
