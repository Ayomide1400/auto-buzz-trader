export default async function handler(req, res) {
  try {
    const upstream = await fetch('https://api.stocktwits.com/api/2/trending/symbols.json')
    if (!upstream.ok) {
      res.status(upstream.status).json({ error: 'Stocktwits request failed' })
      return
    }
    const data = await upstream.json()
    const symbols = (data.symbols || []).map((s) => ({
      symbol: s.symbol,
      title: s.title,
    }))
    res.status(200).json({ symbols })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
