const BASE_URL = process.env.ALPACA_BASE_URL || 'https://paper-api.alpaca.markets'
const DATA_BASE_URL = 'https://data.alpaca.markets'

export const ORDER_TAG_PREFIX = 'buzz-'
export const NOTIONAL_PER_TRADE = 35
export const MAX_OPEN_POSITIONS = 5
export const TAKE_PROFIT_PCT = 0.1
export const STOP_LOSS_PCT = 0.05
export const MIN_PRICE = 5
export const MIN_VOLUME = 500_000

function headers() {
  return {
    'APCA-API-KEY-ID': process.env.ALPACA_API_KEY_ID,
    'APCA-API-SECRET-KEY': process.env.ALPACA_API_SECRET_KEY,
    'Content-Type': 'application/json',
  }
}

async function alpacaFetch(base, path, options = {}) {
  const res = await fetch(`${base}${path}`, { ...options, headers: headers() })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Alpaca ${options.method || 'GET'} ${path} failed: ${res.status} ${body}`)
  }
  if (res.status === 204) return null
  return res.json()
}

export function getAccount() {
  return alpacaFetch(BASE_URL, '/v2/account')
}

export function getPositions() {
  return alpacaFetch(BASE_URL, '/v2/positions')
}

export function getOrders({ status = 'all', limit = 100, symbols } = {}) {
  const symbolsParam = symbols?.length ? `&symbols=${encodeURIComponent(symbols.join(','))}` : ''
  return alpacaFetch(BASE_URL, `/v2/orders?status=${status}&limit=${limit}&direction=desc${symbolsParam}`)
}

export function isBotOrder(order) {
  return typeof order.client_order_id === 'string' && order.client_order_id.startsWith(ORDER_TAG_PREFIX)
}

export async function getBotOwnedSymbols() {
  const orders = await getOrders({ status: 'closed', limit: 200 })
  return new Set(
    orders.filter(isBotOrder).filter((o) => o.side === 'buy' && o.status === 'filled').map((o) => o.symbol),
  )
}

// One request for many symbols — a single call regardless of how large the
// trending list is, and reused for price, volume, and % change together.
export async function getSnapshots(symbols) {
  if (symbols.length === 0) return {}
  const res = await alpacaFetch(
    DATA_BASE_URL,
    `/v2/stocks/snapshots?symbols=${encodeURIComponent(symbols.join(','))}`,
  )
  return res.snapshots || res || {}
}

export function snapshotStats(snapshot) {
  if (!snapshot) return null
  const price = snapshot.latestTrade?.p ?? snapshot.dailyBar?.c ?? null
  const volume = snapshot.dailyBar?.v ?? null
  const prevClose = snapshot.prevDailyBar?.c ?? null
  const changePct = price && prevClose ? (price - prevClose) / prevClose : null
  return { price, volume, changePct }
}

function orderTag(symbol) {
  return `${ORDER_TAG_PREFIX}${Date.now()}-${symbol}`
}

export function placeBracketBuy(symbol, qty, price) {
  const takeProfit = Number((price * (1 + TAKE_PROFIT_PCT)).toFixed(2))
  const stopLoss = Number((price * (1 - STOP_LOSS_PCT)).toFixed(2))
  return alpacaFetch(BASE_URL, '/v2/orders', {
    method: 'POST',
    body: JSON.stringify({
      symbol,
      qty,
      side: 'buy',
      type: 'market',
      time_in_force: 'day',
      order_class: 'bracket',
      take_profit: { limit_price: takeProfit },
      stop_loss: { stop_price: stopLoss },
      client_order_id: orderTag(symbol),
    }),
  })
}

// Liquidates the whole position AND cancels its resting bracket legs —
// the correct way to exit a bracket-protected position manually (a plain
// sell order would conflict with shares already committed to the legs).
export function closePosition(symbol) {
  return alpacaFetch(BASE_URL, `/v2/positions/${symbol}`, { method: 'DELETE' })
}

export async function hasOpenSellOrder(symbol) {
  const orders = await alpacaFetch(BASE_URL, `/v2/orders?status=open&symbols=${encodeURIComponent(symbol)}`)
  return orders.some((o) => o.side === 'sell')
}

// Attaches take-profit/stop-loss to a position that doesn't already have
// resting exit orders — used both to self-heal positions bought before
// this protection existed, and as a safety net if a bracket leg ever
// fails to attach on entry.
export function placeProtectiveOco(symbol, qty, entryPrice) {
  const takeProfit = Number((entryPrice * (1 + TAKE_PROFIT_PCT)).toFixed(2))
  const stopLoss = Number((entryPrice * (1 - STOP_LOSS_PCT)).toFixed(2))
  return alpacaFetch(BASE_URL, '/v2/orders', {
    method: 'POST',
    body: JSON.stringify({
      symbol,
      qty,
      side: 'sell',
      type: 'limit',
      // Fractional-share orders (which is what these positions are, since
      // the original buys were notional/dollar-amount) must be DAY orders
      // on Alpaca — this expires unfilled at end of day, but the cron's
      // self-heal check re-adds it every run, so coverage stays continuous.
      time_in_force: 'day',
      order_class: 'oco',
      take_profit: { limit_price: takeProfit },
      stop_loss: { stop_price: stopLoss },
      client_order_id: orderTag(symbol),
    }),
  })
}
