import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchJson, fmtDate, fmtSignedPct } from '../lib/api'
import Heatmap from '../components/Heatmap'

function MoverRow({ m }) {
  const changePct = Number(m.percent_change) / 100
  return (
    <Link className="mover-row" to={`/stock/${m.symbol}`}>
      <span className="symbol">{m.symbol}</span>
      <span className={changePct >= 0 ? 'pl-positive' : 'pl-negative'}>{fmtSignedPct(changePct)}</span>
    </Link>
  )
}

export default function Market() {
  const [movers, setMovers] = useState({ gainers: [], losers: [] })
  const [news, setNews] = useState([])
  const [heatmapItems, setHeatmapItems] = useState([])

  const refresh = useCallback(async () => {
    const [moversData, newsData, tickerData] = await Promise.all([
      fetchJson('/api/trending?movers=1').catch(() => ({ gainers: [], losers: [] })),
      fetchJson('/api/news').catch(() => ({ articles: [] })),
      fetchJson('/api/trending?ticker=1').catch(() => ({ items: [] })),
    ])
    setMovers(moversData)
    setNews(newsData.articles || [])
    setHeatmapItems(tickerData.items || [])
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return (
    <>
      <div className="scope-callout">
        This is market-wide movement and general financial news (via Alpaca's news feed) — a different lens
        from the Dashboard's Stocktwits buzz list. It's not from The Wall Street Journal or a paid provider,
        and it's not analyst predictions — those need a subscription this project doesn't have. This is real,
        free, live market data, just not that specific source.
      </div>

      <div className="panel panel-full">
        <div className="panel-title">
          <h2>Your heatmap</h2>
        </div>
        <p className="panel-note">Indices, your holdings, and your watchlist — colored by today's move.</p>
        <Heatmap items={heatmapItems} />
      </div>

      <div className="grid">
        <div className="panel">
          <div className="panel-title">
            <h2>Today's top gainers</h2>
          </div>
          {movers.gainers.length === 0 ? (
            <div className="empty-state">No data yet</div>
          ) : (
            <div className="mover-list">
              {movers.gainers.map((m) => (
                <MoverRow key={m.symbol} m={m} />
              ))}
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-title">
            <h2>Today's top losers</h2>
          </div>
          {movers.losers.length === 0 ? (
            <div className="empty-state">No data yet</div>
          ) : (
            <div className="mover-list">
              {movers.losers.map((m) => (
                <MoverRow key={m.symbol} m={m} />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="panel panel-full">
        <div className="panel-title">
          <h2>Market news</h2>
        </div>
        {news.length === 0 ? (
          <div className="empty-state">No recent news</div>
        ) : (
          <ul className="news-list">
            {news.map((n) => (
              <li key={n.id}>
                <a href={n.url} target="_blank" rel="noreferrer">
                  {n.headline}
                </a>
                <div className="position-meta">
                  {n.source} · {fmtDate(n.createdAt)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
