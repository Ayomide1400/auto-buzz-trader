import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { fetchJson } from '../lib/api'
import Ticker from './Ticker'

export default function Layout() {
  const [enabled, setEnabled] = useState(null)
  const [toggling, setToggling] = useState(false)
  const [query, setQuery] = useState('')
  const [marketOpen, setMarketOpen] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    fetchJson('/api/trading-status').then((d) => setEnabled(d.enabled))
    fetchJson('/api/account')
      .then((d) => setMarketOpen(d.marketOpen))
      .catch(() => setMarketOpen(null))
  }, [])

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
    } finally {
      setToggling(false)
    }
  }

  function handleSearch(e) {
    e.preventDefault()
    const symbol = query.trim().toUpperCase()
    if (!symbol) return
    setQuery('')
    navigate(`/stock/${symbol}`)
  }

  return (
    <div className="app">
      <Ticker />

      <header className="header">
        <div className="brand">
          <div className="brand-mark">AB</div>
          <div>
            <div className="brand-name">Auto Buzz Trader</div>
            <div className="brand-sub">Stocktwits buzz → Alpaca paper trades</div>
          </div>
        </div>

        <form className="search-form" onSubmit={handleSearch}>
          <input
            type="text"
            placeholder="Search a symbol…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </form>

        <div className="header-right">
          {marketOpen !== null && (
            <span className={`market-badge ${marketOpen ? 'open' : 'closed'}`}>
              Market {marketOpen ? 'Open' : 'Closed'}
            </span>
          )}
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

      <nav className="main-nav">
        <NavLink to="/" end>
          Dashboard
        </NavLink>
        <NavLink to="/watchlist">Watchlist</NavLink>
        <NavLink to="/market">Market</NavLink>
        <NavLink to="/history">History</NavLink>
        <NavLink to="/settings">Settings</NavLink>
      </nav>

      <Outlet />

      <div className="footer">
        Paper trading via Alpaca · Trending data via Stocktwits · Not investment advice
      </div>
    </div>
  )
}
