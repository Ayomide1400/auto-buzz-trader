import { getNews, getPositions } from './_lib/alpaca.js'
import { getWatchlist } from './_lib/watchlist.js'
import { getGeneralNews, getEarningsCalendar } from './_lib/finnhub.js'

// Earnings dates for whatever you're actually holding or watching, not a
// firehose of every company reporting in the next few weeks.
async function handleCalendar(req, res) {
  try {
    const [positions, watchlist] = await Promise.all([
      getPositions().catch(() => []),
      getWatchlist().catch(() => []),
    ])
    const mySymbols = new Set([...positions.map((p) => p.symbol), ...watchlist])

    const today = new Date()
    const in21Days = new Date(today.getTime() + 21 * 24 * 60 * 60 * 1000)
    const earnings = await getEarningsCalendar(
      today.toISOString().slice(0, 10),
      in21Days.toISOString().slice(0, 10),
    )

    const mine = earnings
      .filter((e) => mySymbols.has(e.symbol))
      .map((e) => ({ symbol: e.symbol, date: e.date, epsEstimate: e.epsEstimate, quarter: e.quarter, year: e.year }))
      .sort((a, b) => new Date(a.date) - new Date(b.date))

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=1800')
    res.status(200).json({ earnings: mine, trackedSymbolCount: mySymbols.size })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

export default async function handler(req, res) {
  if (req.query.calendar) {
    await handleCalendar(req, res)
    return
  }

  const symbol = req.query.symbol ? String(req.query.symbol).toUpperCase() : undefined
  if (symbol && !/^[A-Z.]{1,10}$/.test(symbol)) {
    res.status(400).json({ error: 'Invalid symbol' })
    return
  }

  try {
    // Company-specific stays Alpaca (it can filter by symbol). General
    // market news combines both sources for a genuinely wider range,
    // including real-world stories, not just company press releases.
    const [alpacaNews, finnhubNews] = await Promise.all([
      getNews(symbol, 8).catch(() => []),
      symbol ? Promise.resolve([]) : getGeneralNews().catch(() => []),
    ])

    const combined = [
      ...alpacaNews.map((n) => ({
        id: `a-${n.id}`,
        headline: n.headline,
        source: n.source,
        url: n.url,
        createdAt: n.created_at,
      })),
      ...finnhubNews.slice(0, 15).map((n) => ({
        id: `f-${n.id}`,
        headline: n.headline,
        source: n.source,
        url: n.url,
        createdAt: new Date(n.datetime * 1000).toISOString(),
      })),
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=120')
    res.status(200).json({ articles: combined })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
