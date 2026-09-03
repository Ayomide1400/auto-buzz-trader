import { getBars } from './_lib/alpaca.js'
import { getTradeLog } from './_lib/tradeLog.js'

export default async function handler(req, res) {
  try {
    const events = await getTradeLog()
    const buys = events.filter((e) => e.kind === 'buy').sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    const sells = events
      .filter((e) => e.kind === 'sell')
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))

    if (buys.length === 0) {
      res.status(200).json({ series: [], totalInvested: 0, note: 'No trades yet to benchmark against.' })
      return
    }

    const totalInvested = buys.reduce((sum, b) => sum + (Number(b.notional) || 0), 0)
    const firstBuyDate = buys[0].timestamp.slice(0, 10)
    const today = new Date().toISOString().slice(0, 10)

    const spyBars = await getBars('SPY', { timeframe: '1Day', start: firstBuyDate, end: today, limit: 200 })
    if (spyBars.length === 0) {
      res.status(200).json({ series: [], totalInvested, note: 'No SPY price data available for this range.' })
      return
    }

    const spyShares = totalInvested / spyBars[0].c

    // Walk the same calendar days as the SPY bars, carrying the strategy's
    // realized P/L forward flat until a sell event actually changes it —
    // so both lines share one honest, date-aligned x-axis.
    let sellIndex = 0
    let strategyCumulative = 0
    const series = spyBars.map((bar) => {
      const barDate = bar.t.slice(0, 10)
      while (sellIndex < sells.length && sells[sellIndex].timestamp.slice(0, 10) <= barDate) {
        strategyCumulative += Number(sells[sellIndex].realizedPl) || 0
        sellIndex += 1
      }
      return {
        date: barDate,
        strategyPl: Number(strategyCumulative.toFixed(2)),
        benchmarkPl: Number((spyShares * bar.c - totalInvested).toFixed(2)),
      }
    })

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=120')
    res.status(200).json({ series, totalInvested: Number(totalInvested.toFixed(2)) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
