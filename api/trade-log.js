import { getTradeLog, summarize, computeWinLossSizes, computeRiskMetrics } from './_lib/tradeLog.js'
import { getEquityHistory } from './_lib/equityHistory.js'

export default async function handler(req, res) {
  try {
    const events = await getTradeLog()
    const sorted = events.slice().sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    const equityHistory = await getEquityHistory().catch(() => [])

    const summary = {
      ...summarize(events),
      ...computeWinLossSizes(events),
      ...computeRiskMetrics(equityHistory),
    }

    res.status(200).json({ events: sorted, summary })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
