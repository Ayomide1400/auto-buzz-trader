const BASE_URL = process.env.ALPACA_BASE_URL || 'https://paper-api.alpaca.markets'
export const ORDER_TAG_PREFIX = 'buzz-'
export const NOTIONAL_PER_TRADE = 35
export const MAX_OPEN_POSITIONS = 5

function headers() {
  return {
    'APCA-API-KEY-ID': process.env.ALPACA_API_KEY_ID,
    'APCA-API-SECRET-KEY': process.env.ALPACA_API_SECRET_KEY,
    'Content-Type': 'application/json',
  }
}

async function alpacaFetch(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers: headers() })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Alpaca ${options.method || 'GET'} ${path} failed: ${res.status} ${body}`)
  }
  if (res.status === 204) return null
  return res.json()
}

export function getAccount() {
  return alpacaFetch('/v2/account')
}

export function getPositions() {
  return alpacaFetch('/v2/positions')
}

export function getOrders({ status = 'all', limit = 100 } = {}) {
  return alpacaFetch(`/v2/orders?status=${status}&limit=${limit}&direction=desc`)
}

export function isBotOrder(order) {
  return typeof order.client_order_id === 'string' && order.client_order_id.startsWith(ORDER_TAG_PREFIX)
}

export function placeBuy(symbol) {
  return alpacaFetch('/v2/orders', {
    method: 'POST',
    body: JSON.stringify({
      symbol,
      notional: String(NOTIONAL_PER_TRADE),
      side: 'buy',
      type: 'market',
      time_in_force: 'day',
      client_order_id: `${ORDER_TAG_PREFIX}${Date.now()}-${symbol}`,
    }),
  })
}

export function placeSell(symbol, qty) {
  return alpacaFetch('/v2/orders', {
    method: 'POST',
    body: JSON.stringify({
      symbol,
      qty,
      side: 'sell',
      type: 'market',
      time_in_force: 'day',
      client_order_id: `${ORDER_TAG_PREFIX}${Date.now()}-${symbol}`,
    }),
  })
}
