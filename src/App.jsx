import { useCallback, useEffect, useState } from 'react'
import './App.css'

const POLL_MS = 30000

function fmtMoney(value) {
  const num = Number(value)
  if (Number.isNaN(num)) return '—'
  return num.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function fmtSignedMoney(value) {
  const num = Number(value)
  if (Number.isNaN(num)) return '—'
  const formatted = Math.abs(num).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
  return num >= 0 ? `+${formatted}` : `-${formatted}`
}

function fmtPct(value) {
  const num = Number(value)
  if (Number.isNaN(num)) return ''
  return `${(num * 100).toFixed(2)}%`
}

function fmtSignedPct(value) {
  if (value === null || value === undefined) return ''
  const pct = value * 100
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`
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

function PerformanceChart({ series }) {
  if (series.length < 2) {
    return <div className="empty-state">Not enough closed trades yet for a chart</div>
  }

  const width = 600
  const height = 140
  const pad = 10
  const values = series.map((s) => s.cumulative)
  const min = Math.min(0, ...values)
  const max = Math.max(0, ...values)
  const range = max - min || 1

  const points = series.map((s, i) => {
    const x = pad + (i / (series.length - 1)) * (width - pad * 2)
    const y = height - pad - ((s.cumulative - min) / range) * (height - pad * 2)
    return [x, y]
  })
  const zeroY = height - pad - ((0 - min) / range) * (height - pad * 2)
  const linePath = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L${points[points.length - 1][0].toFixed(1)},${zeroY.toFixed(1)} L${points[0][0].toFixed(1)},${zeroY.toFixed(1)} Z`
  const ending = values[values.length - 1]

  return (
    <svg
      className={`pl-chart ${ending >= 0 ? 'positive' : 'negative'}`}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
      <line x1={pad} y1={zeroY} x2={width - pad} y2={zeroY} className="chart-zero-line" />
      <path d={areaPath} className="chart-area" />
      <path d={linePath} className="chart-line" />
    </svg>
  )
}

export default function App() {
  const [account, setAccount] = useState(null)
  const [positions, setPositions] = useState([])
  const [trending, setTrending] = useState([])
  const [tradeLog, setTradeLog] = useState({ events: [], summary: null })
  const [enabled, setEnabled] = useState(null)
  const [toggling, setToggling] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    try {
      const [accountData, positionsData, trendingData, tradeLogData, statusData] = await Promise.all([
        fetchJson('/api/account'),
        fetchJson('/api/positions'),
        fetchJson('/api/trending'),
        fetchJson('/api/trade-log'),
        fetchJson('/api/trading-status'),
      ])
      setAccount(accountData)
      setPositions(positionsData.positions || [])
      setTrending(trendingData.symbols || [])
      setTradeLog(tradeLogData)
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
  const botPositions = positions.filter((p) => p.isBotOwned)
  const externalPositions = positions.filter((p) => !p.isBotOwned)
  const summary = tradeLog.summary

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
          <div className="stat-label">Bot Positions</div>
          <div className="stat-value">{botPositions.length} / 5</div>
          {externalPositions.length > 0 && (
            <div className="stat-footnote">+{externalPositions.length} not managed by this bot</div>
          )}
        </div>
      </div>

      <div className="rule-banner">
        <strong>The rule:</strong> when a symbol newly appears on Stocktwits' trending list, isn't already held,
        and is up on the day (buzz alone isn't enough — it also has to be moving the right direction), buy
        roughly $35 of it with an automatic +10% take-profit and -5% stop-loss. When a held position (opened by
        this bot) drops off the trending list, close it. Skips anything under $5/share or 500k daily volume.
        Max 5 bot-managed positions at a time. Checked once each weekday morning.
      </div>

      <details className="risk-panel">
        <summary>Before you'd trust this with real money — read this</summary>
        <ul>
          <li>
            <strong>This trades without anyone watching.</strong> That's the entire feature, but it also means a
            bad signal or a bug has no human in the moment to catch it before it acts — the stop-loss and
            take-profit exist specifically to be that missing safety net.
          </li>
          <li>
            <strong>"Trending" is attention, not quality.</strong> A stock can trend because something good is
            happening, or because a crowd already piled in and the move is mostly over. The day-direction filter
            reduces obviously bad entries, but it doesn't turn buzz into a proven edge.
          </li>
          <li>
            <strong>Stop-losses limit damage, they don't prevent it.</strong> A stop set at -5% can still fill
            below that price on a fast-moving or illiquid stock (slippage) — the actual loss on a bad trade can
            be worse than the number on the label.
          </li>
          <li>
            <strong>This is paper money and has no track record yet.</strong> Every number on this page is
            simulated. The Performance panel exists so you can watch whether this rule actually works over real
            time, before ever considering it with real capital — not as proof that it already does.
          </li>
        </ul>
      </details>

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
                  <div className="buzz-right">
                    {s.changePct !== null && (
                      <span className={Number(s.changePct) >= 0 ? 'pl-positive' : 'pl-negative'}>
                        {fmtSignedPct(s.changePct)}
                      </span>
                    )}
                    <span className={`pill ${heldSymbols.has(s.symbol) ? 'held' : 'not-held'}`}>
                      {heldSymbols.has(s.symbol) ? 'Held' : 'Not held'}
                    </span>
                  </div>
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
                    <div className="position-symbol">
                      {p.symbol}
                      {!p.isBotOwned && <span className="external-tag">not managed by bot</span>}
                    </div>
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
          <h2>Performance</h2>
        </div>
        <div className="performance-body">
          <div className="performance-stats">
            <div className="stat-card">
              <div className="stat-label">Closed trades</div>
              <div className="stat-value">{summary?.closedCount ?? 0}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Win rate</div>
              <div className="stat-value">{summary?.winRate === null || summary?.winRate === undefined ? '—' : fmtPct(summary.winRate)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total realized P/L</div>
              <div className={`stat-value ${(summary?.totalRealizedPl ?? 0) >= 0 ? 'pl-positive' : 'pl-negative'}`}>
                {summary ? fmtSignedMoney(summary.totalRealizedPl) : '—'}
              </div>
            </div>
          </div>
          <div className="chart-wrap">
            <PerformanceChart series={summary?.series ?? []} />
          </div>
        </div>
      </div>

      <div className="panel panel-full">
        <div className="panel-title">
          <h2>Trade history</h2>
          <span className="count">{tradeLog.events.length}</span>
        </div>
        {tradeLog.events.length === 0 ? (
          <div className="empty-state">No trades placed yet</div>
        ) : (
          <div className="table-wrap">
            <table className="activity">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Side</th>
                  <th>Size</th>
                  <th>Price</th>
                  <th>Realized P/L</th>
                  <th>Why</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {tradeLog.events.map((e) => (
                  <tr key={e.id}>
                    <td>{e.symbol}</td>
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

      <div className="footer">
        Paper trading via Alpaca · Trending data via Stocktwits · Not investment advice
      </div>
    </div>
  )
}
