import { getOrders, isBotOrder } from './_lib/alpaca.js'

export default async function handler(req, res) {
  try {
    const orders = await getOrders({ status: 'all', limit: 100 })
    const botOrders = orders.filter(isBotOrder).map((o) => ({
      id: o.id,
      symbol: o.symbol,
      side: o.side,
      qty: o.qty,
      notional: o.notional,
      filledQty: o.filled_qty,
      filledAvgPrice: o.filled_avg_price,
      status: o.status,
      submittedAt: o.submitted_at,
      filledAt: o.filled_at,
    }))
    res.status(200).json({ orders: botOrders })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
