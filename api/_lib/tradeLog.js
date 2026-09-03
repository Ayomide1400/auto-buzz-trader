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

export function computeWinLossSizes(events) {
  const sells = events.filter((e) => e.kind === 'sell')
  const wins = sells.filter((e) => Number(e.realizedPl) > 0).map((e) => Number(e.realizedPl))
  const losses = sells.filter((e) => Number(e.realizedPl) < 0).map((e) => Number(e.realizedPl))
  return {
    avgWin: wins.length ? wins.reduce((a, b) => a + b, 0) / wins.length : null,
    avgLoss: losses.length ? losses.reduce((a, b) => a + b, 0) / losses.length : null,
  }
}

// Standard risk-adjusted metrics from a daily equity curve — the same
// numbers any real evaluation of a strategy would ask for, not just raw
// P/L. Needs at least a few days of snapshots to mean anything.
export function computeRiskMetrics(equityHistory) {
  if (equityHistory.length < 3) return { maxDrawdownPct: null, sharpeRatio: null }

  const values = equityHistory.map((s) => s.equity)
  let peak = values[0]
  let maxDrawdown = 0
  for (const v of values) {
    if (v > peak) peak = v
    maxDrawdown = Math.max(maxDrawdown, (peak - v) / peak)
  }

  const dailyReturns = []
  for (let i = 1; i < values.length; i++) {
    dailyReturns.push((values[i] - values[i - 1]) / values[i - 1])
  }
  const mean = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length
  const variance = dailyReturns.reduce((a, b) => a + (b - mean) ** 2, 0) / dailyReturns.length
  const stdev = Math.sqrt(variance)

  return {
    maxDrawdownPct: maxDrawdown,
    sharpeRatio: stdev > 0 ? (mean / stdev) * Math.sqrt(252) : null,
  }
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
