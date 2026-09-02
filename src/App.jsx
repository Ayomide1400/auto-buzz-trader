import { useCallback, useEffect, useState } from 'react'
import './App.css'

const POLL_MS = 30000

function fmtMoney(value) {
  const num = Number(value)
  if (Number.isNaN(num)) return '—'
  return num.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function fmtPct(value) {
  const num = Number(value)
  if (Number.isNaN(num)) return ''
  return `${(num * 100).toFixed(2)}%`
}

function fmtTime(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

async function fetchJson(url, options) {
  const res = await fetch(url, options)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `${url} failed (${res.status})`)
  return data
}

export default function App() {
  const [account, setAccount] = useState(null)
  const [positions, setPositions] = useState([])
  const [trending, setTrending] = useState([])
  const [orders, setOrders] = useState([])
  const [enabled, setEnabled] = useState(null)
  const [toggling, setToggling] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    try {
      const [accountData, positionsData, trendingData, ordersData, statusData] = await Promise.all([
        fetchJson('/api/account'),
        fetchJson('/api/positions'),
        fetchJson('/api/trending'),
        fetchJson('/api/orders'),
        fetchJson('/api/trading-status'),
      ])
      setAccount(accountData)
      setPositions(positionsData.positions || [])
      setTrending(trendingData.symbols || [])
      setOrders(ordersData.orders || [])
      setEnabled(statusData.enabled)
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }, [])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, POLL_MS)
    return () => clearInterval(id)
  }, [refresh])

  const heldSymbols = new Set(positions.map((p) => p.symbol))

  async function handleToggle() {
    setToggling(true)
    try {
      const next = !enabled
      const data = await fetchJson('/api/trading-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next }),
      })
      setEnabled(data.enabled)
    } catch (err) {
      setError(err.message)
    } finally {
      setToggling(false)
    }
  }

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <div className="brand-mark">AB</div>
          <div>
            <div className="brand-name">Auto Buzz Trader</div>
            <div className="brand-sub">Stocktwits buzz → Alpaca paper trades</div>
          </div>
        </div>
        <div className="header-right">
          <span className="paper-badge">Paper trading only</span>
          <div className="toggle-wrap">
            <span className={`toggle-label ${enabled ? 'active' : 'paused'}`}>
              {enabled === null ? 'Loading…' : enabled ? 'Auto-trading ON' : 'Paused'}
            </span>
            <button
              className={`switch ${enabled ? 'on' : ''}`}
              onClick={handleToggle}
              disabled={enabled === null || toggling}
              aria-label="Toggle auto-trading"
            />
          </div>
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}

      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-label">Equity</div>
          <div className="stat-value">{account ? fmtMoney(account.equity) : '—'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Cash</div>
          <div className="stat-value">{account ? fmtMoney(account.cash) : '—'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Buying Power</div>
          <div className="stat-value">{account ? fmtMoney(account.buyingPower) : '—'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Open Positions</div>
          <div className="stat-value">{positions.length} / 5</div>
        </div>
      </div>

      <div className="rule-banner">
        <strong>The rule:</strong> when a symbol newly appears on Stocktwits' trending list and isn't already
        held, buy $35 of it. When a held position (opened by this bot) drops off the trending list, sell it.
        Max 5 open positions at a time. Checked once each weekday morning.
      </div>

      <div className="grid">
        <div className="panel">
          <div className="panel-title">
            <h2>Trending now</h2>
            <span className="count">{trending.length}</span>
          </div>
          {trending.length === 0 ? (
            <div className="empty-state">No trending data yet</div>
          ) : (
            <div className="buzz-list">
              {trending.map((s) => (
                <div className="buzz-row" key={s.symbol}>
                  <div>
                    <div className="buzz-symbol">{s.symbol}</div>
                    {s.title && <div className="buzz-title">{s.title}</div>}
                  </div>
                  <span className={`pill ${heldSymbols.has(s.symbol) ? 'held' : 'not-held'}`}>
                    {heldSymbols.has(s.symbol) ? 'Held' : 'Not held'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-title">
            <h2>Open positions</h2>
            <span className="count">{positions.length}</span>
          </div>
          {positions.length === 0 ? (
            <div className="empty-state">No open positions</div>
          ) : (
            <div>
              {positions.map((p) => (
                <div className="position-row" key={p.symbol}>
                  <div>
                    <div className="position-symbol">{p.symbol}</div>
                    <div className="position-meta">
                      {p.qty} sh @ {fmtMoney(p.avgEntryPrice)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className={Number(p.unrealizedPl) >= 0 ? 'pl-positive' : 'pl-negative'}>
                      {fmtMoney(p.unrealizedPl)}
                    </div>
                    <div className="position-meta">{fmtPct(p.unrealizedPlPct)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="panel panel-full">
        <div className="panel-title">
          <h2>Activity log</h2>
          <span className="count">{orders.length}</span>
        </div>
        {orders.length === 0 ? (
          <div className="empty-state">No trades placed yet</div>
        ) : (
          <div className="table-wrap">
            <table className="activity">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Side</th>
                  <th>Size</th>
                  <th>Filled price</th>
                  <th>Status</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>{o.symbol}</td>
                    <td className={o.side === 'buy' ? 'side-buy' : 'side-sell'}>{o.side.toUpperCase()}</td>
                    <td>{o.notional ? fmtMoney(o.notional) : `${o.qty} sh`}</td>
                    <td>{o.filledAvgPrice ? fmtMoney(o.filledAvgPrice) : '—'}</td>
                    <td>
                      <span className="status-chip">{o.status}</span>
                    </td>
                    <td>{fmtTime(o.filledAt || o.submittedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="footer">
        Paper trading via Alpaca · Trending data via Stocktwits · Not investment advice
      </div>
    </div>
  )
}
