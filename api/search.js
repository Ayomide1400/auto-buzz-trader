import { getSnapshots, snapshotStats } from './_lib/alpaca.js'

export default async function handler(req, res) {
  const symbol = String(req.query.symbol || '')
    .toUpperCase()
    .trim()
  if (!/^[A-Z.]{1,10}$/.test(symbol)) {
    res.status(400).json({ error: 'Invalid symbol' })
    return
  }

  try {
    const snapshots = await getSnapshots([symbol])
    const stats = snapshotStats(snapshots[symbol])
    if (!stats?.price) {
      res.status(404).json({ error: `No data found for ${symbol}` })
      return
    }
    res.status(200).json({ symbol, ...stats })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
