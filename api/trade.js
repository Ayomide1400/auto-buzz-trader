import { placeSimpleOrder } from './_lib/alpaca.js'

const MAX_NOTIONAL = 200
const SYMBOL_PATTERN = /^[A-Z.]{1,10}$/

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
  const symbol = String(body.symbol || '').toUpperCase()
  const side = body.side
  const notional = Number(body.notional)

  if (!SYMBOL_PATTERN.test(symbol)) {
    res.status(400).json({ error: 'Invalid symbol' })
    return
  }
  if (side !== 'buy' && side !== 'sell') {
    res.status(400).json({ error: 'Side must be buy or sell' })
    return
  }
  if (!Number.isFinite(notional) || notional <= 0 || notional > MAX_NOTIONAL) {
    res.status(400).json({ error: `Amount must be between $1 and $${MAX_NOTIONAL}` })
    return
  }

  try {
    const order = await placeSimpleOrder(symbol, side, notional.toFixed(2))
    res.status(200).json({ id: order.id, symbol: order.symbol, side: order.side, status: order.status })
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
}
