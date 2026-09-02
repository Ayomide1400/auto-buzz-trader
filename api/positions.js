import { getPositions } from './_lib/alpaca.js'

export default async function handler(req, res) {
  try {
    const positions = await getPositions()
    res.status(200).json({
      positions: positions.map((p) => ({
        symbol: p.symbol,
        qty: p.qty,
        avgEntryPrice: p.avg_entry_price,
        currentPrice: p.current_price,
        marketValue: p.market_value,
        unrealizedPl: p.unrealized_pl,
        unrealizedPlPct: p.unrealized_plpc,
      })),
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
