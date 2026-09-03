import { readJson, writeJson } from './githubState.js'

const STATE_PATH = 'state/trade-log.json'

export async function getTradeLog() {
  const state = await readJson(STATE_PATH, { events: [] })
  return state.events || []
}

export async function appendTradeEvents(newEvents) {
  if (newEvents.length === 0) return
  const events = await getTradeLog()
  const merged = [...events, ...newEvents]
  await writeJson(
    STATE_PATH,
    { events: merged },
    `chore: log ${newEvents.length} trade event(s)`,
  )
}

// The most recent still-open buy per symbol — a buy counts as "open" until
// a later sell event references it via matchedBuyId. This strategy only
// ever holds one lot per symbol, so "most recent" is unambiguous.
export function getOpenBuys(events) {
  const matchedBuyIds = new Set(events.filter((e) => e.kind === 'sell').map((e) => e.matchedBuyId))
  const openBuysBySymbol = {}
  for (const e of events) {
    if (e.kind !== 'buy' || matchedBuyIds.has(e.id)) continue
    if (!openBuysBySymbol[e.symbol] || new Date(e.timestamp) > new Date(openBuysBySymbol[e.symbol].timestamp)) {
      openBuysBySymbol[e.symbol] = e
    }
  }
  return openBuysBySymbol
}

export function summarize(events) {
  const closed = events.filter((e) => e.kind === 'sell')
  const wins = closed.filter((e) => Number(e.realizedPl) > 0).length
  let cumulative = 0
  const series = closed
    .slice()
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    .map((e) => {
      cumulative += Number(e.realizedPl) || 0
      return { timestamp: e.timestamp, symbol: e.symbol, realizedPl: Number(e.realizedPl) || 0, cumulative }
    })

  return {
    closedCount: closed.length,
    winCount: wins,
    winRate: closed.length ? wins / closed.length : null,
    totalRealizedPl: cumulative,
    series,
  }
}
