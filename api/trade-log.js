import { getTradeLog, summarize } from './_lib/tradeLog.js'

export default async function handler(req, res) {
  try {
    const events = await getTradeLog()
    const sorted = events.slice().sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    res.status(200).json({ events: sorted, summary: summarize(events) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
