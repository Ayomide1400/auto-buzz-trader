import { getNews } from './_lib/alpaca.js'

export default async function handler(req, res) {
  const symbol = req.query.symbol ? String(req.query.symbol).toUpperCase() : undefined
  if (symbol && !/^[A-Z.]{1,10}$/.test(symbol)) {
    res.status(400).json({ error: 'Invalid symbol' })
    return
  }

  try {
    const news = await getNews(symbol, 8)
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=120')
    res.status(200).json({
      articles: news.map((n) => ({
        id: n.id,
        headline: n.headline,
        source: n.source,
        url: n.url,
        createdAt: n.created_at,
      })),
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
