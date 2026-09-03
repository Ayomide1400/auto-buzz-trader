import { getBars } from './_lib/alpaca.js'

export default async function handler(req, res) {
  const symbol = String(req.query.symbol || '').toUpperCase()
  if (!/^[A-Z.]{1,10}$/.test(symbol)) {
    res.status(400).json({ error: 'Invalid symbol' })
    return
  }

  try {
    const end = new Date()
    const start = new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000)
    const bars = await getBars(symbol, {
      timeframe: '1Day',
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    })
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=120')
    res.status(200).json({
      symbol,
      bars: bars.map((b) => ({ t: b.t, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v })),
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
