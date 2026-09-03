import {
  getPositions,
  getBotOwnedSymbols,
  getOrders,
  isBotOrder,
  hasOpenSellOrder,
  placeProtectiveOco,
} from '../_lib/alpaca.js'
import { getTradeLog, appendTradeEvents } from '../_lib/tradeLog.js'

function isAuthorized(req) {
  const secret = process.env.ADMIN_BACKFILL_SECRET
  if (!secret) return false
  return req.headers.authorization === `Bearer ${secret}`
}

// One-time maintenance endpoint: protects any bot-owned position that
// predates stop-loss/take-profit, and backfills the trade log with real
// buy fills from Alpaca's own order history. Remove this file once run.
export default async function handler(req, res) {
  if (!isAuthorized(req)) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const positions = await getPositions()
    const botOwned = await getBotOwnedSymbols()
    const existingLog = await getTradeLog()
    const loggedOrderIds = new Set(existingLog.map((e) => e.orderId).filter(Boolean))
    const newEvents = []
    const actions = []

    for (const p of positions) {
      if (!botOwned.has(p.symbol)) {
        actions.push(`${p.symbol}: skipped, not bot-owned`)
        continue
      }

      const orders = await getOrders({ status: 'closed', limit: 20, symbols: [p.symbol] })
      const buyFill = orders.filter(isBotOrder).find((o) => o.side === 'buy' && o.status === 'filled')
      if (buyFill && !loggedOrderIds.has(buyFill.id)) {
        newEvents.push({
          id: `buy-backfill-${buyFill.id}`,
          kind: 'buy',
          symbol: p.symbol,
          qty: Number(buyFill.filled_qty),
          price: Number(buyFill.filled_avg_price),
          notional: Number(buyFill.filled_qty) * Number(buyFill.filled_avg_price),
          reason: 'Newly appeared on the trending list (backfilled from real order history)',
          timestamp: buyFill.filled_at,
          orderId: buyFill.id,
        })
        actions.push(`${p.symbol}: backfilled buy @ $${buyFill.filled_avg_price}`)
      }

      const protectedAlready = await hasOpenSellOrder(p.symbol)
      if (!protectedAlready) {
        const order = await placeProtectiveOco(p.symbol, p.qty, Number(p.avg_entry_price))
        actions.push(`${p.symbol}: added protective OCO order ${order.id}`)
      } else {
        actions.push(`${p.symbol}: already protected`)
      }
    }

    if (newEvents.length) await appendTradeEvents(newEvents)
    res.status(200).json({ ok: true, actions, backfilled: newEvents.length })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
