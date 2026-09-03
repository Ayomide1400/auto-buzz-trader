import { getSnapshots, snapshotStats } from './_lib/alpaca.js'

export default async function handler(req, res) {
  try {
    const upstream = await fetch('https://api.stocktwits.com/api/2/trending/symbols.json')
    if (!upstream.ok) {
      res.status(upstream.status).json({ error: 'Stocktwits request failed' })
      return
    }
    const data = await upstream.json()
    const rawSymbols = (data.symbols || []).map((s) => ({ symbol: s.symbol, title: s.title }))

    let snapshots = {}
    try {
      snapshots = await getSnapshots(rawSymbols.map((s) => s.symbol))
    } catch {
      // Price data is a nice-to-have on this list — don't fail the whole
      // request just because the market data call had a problem.
    }

    const symbols = rawSymbols.map((s) => {
      const stats = snapshotStats(snapshots[s.symbol])
      return { ...s, price: stats?.price ?? null, changePct: stats?.changePct ?? null }
    })

    res.setHeader('Cache-Control', 's-maxage=55, stale-while-revalidate=30')
    res.status(200).json({ symbols })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
