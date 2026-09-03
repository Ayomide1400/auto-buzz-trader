import { getWatchlist, addToWatchlist, removeFromWatchlist } from './_lib/watchlist.js'
import { getSnapshots, snapshotStats } from './_lib/alpaca.js'

const SYMBOL_PATTERN = /^[A-Z.]{1,10}$/

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const symbols = await getWatchlist()
      const snapshots = symbols.length ? await getSnapshots(symbols) : {}
      res.status(200).json({
        symbols: symbols.map((symbol) => {
          const stats = snapshotStats(snapshots[symbol])
          return { symbol, price: stats?.price ?? null, changePct: stats?.changePct ?? null }
        }),
      })
      return
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
    const symbol = String(body.symbol || '').toUpperCase()
    if (!SYMBOL_PATTERN.test(symbol)) {
      res.status(400).json({ error: 'Invalid symbol' })
      return
    }

    if (req.method === 'POST') {
      const symbols = await addToWatchlist(symbol)
      res.status(200).json({ symbols })
      return
    }
    if (req.method === 'DELETE') {
      const symbols = await removeFromWatchlist(symbol)
      res.status(200).json({ symbols })
      return
    }
    res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
