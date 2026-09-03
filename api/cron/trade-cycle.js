import {
  getAccount,
  getPositions,
  getOrders,
  getBotOwnedSymbols,
  getSnapshots,
  snapshotStats,
  placeBracketBuy,
  closePosition,
  hasOpenSellOrder,
  placeProtectiveOco,
} from '../_lib/alpaca.js'
import { isAutoTradingEnabled } from '../_lib/tradingStatus.js'
import { getStrategyConfig } from '../_lib/strategyConfig.js'
import { getTradeLog, appendTradeEvents, getOpenBuys } from '../_lib/tradeLog.js'
import { appendEquitySnapshot } from '../_lib/equityHistory.js'
import { notify } from '../_lib/notify.js'

function isAuthorized(req) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.authorization === `Bearer ${secret}`
}

function eventId(kind, symbol) {
  return `${kind}-${Date.now()}-${symbol}-${Math.floor(Math.random() * 1e6)}`
}

// Bracket exits (take-profit/stop-loss) and manual closePosition() calls
// both happen without our own client_order_id tag on the resulting sell
// fill, so we can't detect them by tagging — instead, any symbol the trade
// log still considers "open" but that's no longer an actual position must
// have closed on its own since the last run. Reconcile those first.
async function syncClosedPositions(heldSymbols) {
  const events = await getTradeLog()
  const openBuys = getOpenBuys(events)
  const closedSymbols = Object.keys(openBuys).filter((symbol) => !heldSymbols.has(symbol))
  if (closedSymbols.length === 0) return []

  const newEvents = []
  for (const symbol of closedSymbols) {
    const buy = openBuys[symbol]
    const recentOrders = await getOrders({ status: 'closed', limit: 10, symbols: [symbol] })
    const sellFill = recentOrders.find(
      (o) => o.side === 'sell' && o.status === 'filled' && new Date(o.filled_at) > new Date(buy.timestamp),
    )
    if (!sellFill) continue // Fill hasn't settled yet — pick it up next run.

    const exitPrice = Number(sellFill.filled_avg_price)
    const qty = Number(buy.qty)
    const realizedPl = Number(((exitPrice - buy.price) * qty).toFixed(2))
    const reason =
      sellFill.type === 'limit'
        ? 'Take-profit target hit automatically'
        : sellFill.type === 'stop'
          ? 'Stop-loss triggered automatically'
          : 'Position closed'

    const event = {
      id: eventId('sell', symbol),
      kind: 'sell',
      symbol,
      qty,
      price: exitPrice,
      realizedPl,
      reason,
      timestamp: sellFill.filled_at,
      orderId: sellFill.id,
      matchedBuyId: buy.id,
    }
    newEvents.push(event)
    await notify(
      `${realizedPl >= 0 ? '✅' : '🛑'} Sold ${symbol}`,
      `${reason} — ${realizedPl >= 0 ? '+' : ''}$${realizedPl.toFixed(2)}`,
    )
  }
  return newEvents
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
    try {
      const account = await getAccount()
      await appendEquitySnapshot(account.equity)
    } catch (err) {
      errors.push(`equity snapshot: ${err.message}`)
    }

    const enabled = await isAutoTradingEnabled()
    if (!enabled) {
      res.status(200).json({ skipped: true, reason: 'paused', bought, sold, errors })
      return
    }

    const config = await getStrategyConfig()

    const trendingRes = await fetch('https://api.stocktwits.com/api/2/trending/symbols.json')
    if (!trendingRes.ok) throw new Error(`Stocktwits fetch failed: ${trendingRes.status}`)
    const trendingData = await trendingRes.json()
    const trendingSymbols = new Set((trendingData.symbols || []).map((s) => s.symbol))

    const [positions, botOwnedSymbols] = await Promise.all([getPositions(), getBotOwnedSymbols()])
    const heldSymbols = new Set(positions.map((p) => p.symbol))

    const reconciledEvents = await syncClosedPositions(heldSymbols)
    if (reconciledEvents.length) await appendTradeEvents(reconciledEvents)

    // Self-heal: any bot-owned position with no resting exit order (e.g.
    // bought before this protection existed, or a bracket leg that never
    // attached) gets one now, rather than sitting exposed indefinitely.
    for (const position of positions) {
      if (!botOwnedSymbols.has(position.symbol)) continue
      try {
        const protectedAlready = await hasOpenSellOrder(position.symbol)
        if (!protectedAlready) {
          await placeProtectiveOco(
            position.symbol,
            position.qty,
            Number(position.avg_entry_price),
            config.takeProfitPct,
            config.stopLossPct,
          )
          await notify(`🛡️ Protected ${position.symbol}`, 'Added a missing stop-loss/take-profit.')
        }
      } catch (err) {
        errors.push(`protect ${position.symbol}: ${err.message}`)
      }
    }

    let openBotPositions = positions.filter((p) => botOwnedSymbols.has(p.symbol)).length
    const newEvents = []

    // Sell: bot-owned positions that dropped off trending
    for (const position of positions) {
      if (!botOwnedSymbols.has(position.symbol)) continue
      if (trendingSymbols.has(position.symbol)) continue
      try {
        const realizedPl = Number(position.unrealized_pl)
        await closePosition(position.symbol)
        sold.push(position.symbol)
        openBotPositions -= 1
        newEvents.push({
          id: eventId('sell', position.symbol),
          kind: 'sell',
          symbol: position.symbol,
          qty: Number(position.qty),
          price: Number(position.current_price),
          realizedPl,
          reason: 'Dropped off the trending list',
          timestamp: new Date().toISOString(),
        })
        await notify(
          `${realizedPl >= 0 ? '✅' : '🛑'} Sold ${position.symbol}`,
          `Dropped off trending — ${realizedPl >= 0 ? '+' : ''}$${realizedPl.toFixed(2)}`,
        )
      } catch (err) {
        errors.push(`sell ${position.symbol}: ${err.message}`)
      }
    }

    // Buy: newly trending symbols not already held, up to the position cap,
    // filtered to a minimum price/volume so we're not buying illiquid noise.
    const candidateSymbols = [...trendingSymbols].filter((s) => !heldSymbols.has(s))
    const snapshots = candidateSymbols.length ? await getSnapshots(candidateSymbols) : {}

    for (const symbol of candidateSymbols) {
      if (openBotPositions >= config.maxOpenPositions) break

      const stats = snapshotStats(snapshots[symbol])
      if (!stats?.price) {
        errors.push(`buy ${symbol}: no price data available, skipped`)
        continue
      }
      if (stats.price < config.minPrice) continue
      if (stats.volume !== null && stats.volume < config.minVolume) continue
      // Buzz alone isn't a reason to buy — require the stock to actually be
      // up on the day too, so we're not chasing attention on bad news.
      if (config.requirePositiveDay && (stats.changePct === null || stats.changePct <= 0)) continue

      const qty = Math.floor(config.notionalPerTrade / stats.price)
      if (qty < 1) continue

      try {
        const order = await placeBracketBuy(symbol, qty, stats.price, config.takeProfitPct, config.stopLossPct)
        bought.push(symbol)
        openBotPositions += 1
        const buyEvent = {
          id: eventId('buy', symbol),
          kind: 'buy',
          symbol,
          qty,
          price: stats.price,
          notional: Number((qty * stats.price).toFixed(2)),
          reason: 'Newly appeared on the trending list',
          timestamp: new Date().toISOString(),
          orderId: order.id,
        }
        newEvents.push(buyEvent)
        await notify(`📈 Bought ${symbol}`, `${qty} sh @ ~$${stats.price.toFixed(2)} — newly trending`)
      } catch (err) {
        errors.push(`buy ${symbol}: ${err.message}`)
      }
    }

    if (newEvents.length) await appendTradeEvents(newEvents)

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
