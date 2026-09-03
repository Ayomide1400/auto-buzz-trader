import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { fetchJson, fmtDate, fmtMoney, fmtSignedMoney, fmtSignedPct, fmtTime } from '../lib/api'
import LineChart from '../components/LineChart'

export default function StockDetail() {
  const { symbol } = useParams()
  const [bars, setBars] = useState([])
  const [quote, setQuote] = useState(null)
  const [news, setNews] = useState([])
  const [position, setPosition] = useState(null)
  const [trades, setTrades] = useState([])
  const [amount, setAmount] = useState(25)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')

  const refresh = useCallback(async () => {
    const [barsData, quoteData, newsData, positionsData, tradeLogData] = await Promise.all([
      fetchJson(`/api/bars?symbol=${symbol}`).catch(() => ({ bars: [] })),
      fetchJson(`/api/trending?symbol=${symbol}`).catch(() => null),
      fetchJson(`/api/news?symbol=${symbol}`).catch(() => ({ articles: [] })),
      fetchJson('/api/positions').catch(() => ({ positions: [] })),
      fetchJson('/api/trade-log').catch(() => ({ events: [] })),
    ])
    setBars(barsData.bars || [])
    setQuote(quoteData)
    setNews(newsData.articles || [])
    setPosition((positionsData.positions || []).find((p) => p.symbol === symbol) || null)
    setTrades((tradeLogData.events || []).filter((e) => e.symbol === symbol))
  }, [symbol])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function handleTrade(side) {
    setPending(true)
    setMessage('')
    try {
      const res = await fetchJson('/api/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, side, notional: amount }),
      })
      setMessage(`${side === 'buy' ? 'Bought' : 'Sold'} $${amount} of ${symbol} — ${res.status}`)
      refresh()
    } catch (err) {
      setMessage(`Failed: ${err.message}`)
    } finally {
      setPending(false)
    }
  }

  const chartSeries = bars.map((b) => ({ close: b.c }))

  return (
    <>
      <div className="stock-header">
        <h1>{symbol}</h1>
        {quote?.price && (
          <div className={Number(quote.changePct) >= 0 ? 'pl-positive' : 'pl-negative'}>
            {fmtMoney(quote.price)} <span>{fmtSignedPct(quote.changePct)}</span>
          </div>
        )}
      </div>

      <div className="panel panel-full">
        <div className="panel-title">
          <h2>Price, last 90 days</h2>
        </div>
        <LineChart series={chartSeries} lines={[{ key: 'close' }]} height={200} />
      </div>

      <div className="grid">
        <div className="panel">
          <div className="panel-title">
            <h2>Manual trade</h2>
          </div>
          <p className="panel-note">
            This bypasses the automated strategy entirely — a plain market order, capped at $200, for when you
            want to act yourself instead of waiting on the daily cycle.
          </p>
          <div className="trade-form">
            <span className="dollar-input">
              $
              <input
                type="number"
                min="1"
                max="200"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </span>
            <button className="buy" disabled={pending} onClick={() => handleTrade('buy')}>
              Buy
            </button>
            <button className="sell" disabled={pending} onClick={() => handleTrade('sell')}>
              Sell
            </button>
          </div>
          {message && <p className="trade-message">{message}</p>}

          {position ? (
            <div className="position-summary">
              <div className="position-meta">
                Holding {position.qty} sh @ {fmtMoney(position.avgEntryPrice)}
                {!position.isBotOwned && <span className="external-tag">not managed by bot</span>}
              </div>
              <div className={Number(position.unrealizedPl) >= 0 ? 'pl-positive' : 'pl-negative'}>
                {fmtMoney(position.unrealizedPl)}
              </div>
            </div>
          ) : (
            <p className="empty-state">No open position in {symbol}</p>
          )}
        </div>

        <div className="panel">
          <div className="panel-title">
            <h2>News</h2>
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
      </div>

      <div className="panel panel-full">
        <div className="panel-title">
          <h2>Trade history for {symbol}</h2>
        </div>
        {trades.length === 0 ? (
          <div className="empty-state">No bot trades for this symbol yet</div>
        ) : (
          <div className="table-wrap">
            <table className="activity">
              <thead>
                <tr>
                  <th>Side</th>
                  <th>Size</th>
                  <th>Price</th>
                  <th>Realized P/L</th>
                  <th>Why</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((e) => (
                  <tr key={e.id}>
                    <td className={e.kind === 'buy' ? 'side-buy' : 'side-sell'}>{e.kind.toUpperCase()}</td>
                    <td>{e.qty} sh</td>
                    <td>{fmtMoney(e.price)}</td>
                    <td>
                      {e.kind === 'sell' ? (
                        <span className={Number(e.realizedPl) >= 0 ? 'pl-positive' : 'pl-negative'}>
                          {fmtSignedMoney(e.realizedPl)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="reason-cell">{e.reason}</td>
                    <td>{fmtTime(e.timestamp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
