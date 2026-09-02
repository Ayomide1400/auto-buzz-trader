import {
  getPositions,
  getOrders,
  isBotOrder,
  placeBuy,
  placeSell,
  MAX_OPEN_POSITIONS,
} from '../_lib/alpaca.js'
import { isAutoTradingEnabled } from '../_lib/tradingStatus.js'

function isAuthorized(req) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.authorization === `Bearer ${secret}`
}

async function getBotOwnedSymbols() {
  const orders = await getOrders({ status: 'closed', limit: 200 })
  const filledBuys = new Set(
    orders.filter(isBotOrder).filter((o) => o.side === 'buy' && o.status === 'filled').map((o) => o.symbol)
  )
  return filledBuys
}

export default async function handler(req, res) {
  if (!isAuthorized(req)) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const bought = []
  const sold = []
  const errors = []

  try {
    const enabled = await isAutoTradingEnabled()
    if (!enabled) {
      res.status(200).json({ skipped: true, reason: 'paused', bought, sold, errors })
      return
    }

    const trendingRes = await fetch('https://api.stocktwits.com/api/2/trending/symbols.json')
    if (!trendingRes.ok) throw new Error(`Stocktwits fetch failed: ${trendingRes.status}`)
    const trendingData = await trendingRes.json()
    const trendingSymbols = new Set((trendingData.symbols || []).map((s) => s.symbol))

    const [positions, botOwnedSymbols] = await Promise.all([getPositions(), getBotOwnedSymbols()])
    const heldSymbols = new Set(positions.map((p) => p.symbol))
    let openBotPositions = positions.filter((p) => botOwnedSymbols.has(p.symbol)).length

    // Sell: bot-owned positions that dropped off trending
    for (const position of positions) {
      if (!botOwnedSymbols.has(position.symbol)) continue
      if (trendingSymbols.has(position.symbol)) continue
      try {
        await placeSell(position.symbol, position.qty)
        sold.push(position.symbol)
        openBotPositions -= 1
      } catch (err) {
        errors.push(`sell ${position.symbol}: ${err.message}`)
      }
    }

    // Buy: newly trending symbols not already held, up to the position cap
    for (const symbol of trendingSymbols) {
      if (openBotPositions >= MAX_OPEN_POSITIONS) break
      if (heldSymbols.has(symbol)) continue
      try {
        await placeBuy(symbol)
        bought.push(symbol)
        openBotPositions += 1
      } catch (err) {
        errors.push(`buy ${symbol}: ${err.message}`)
      }
    }

    res.status(200).json({
      skipped: false,
      trendingCount: trendingSymbols.size,
      bought,
      sold,
      errors,
    })
  } catch (err) {
    res.status(500).json({ error: err.message, bought, sold, errors })
  }
}
