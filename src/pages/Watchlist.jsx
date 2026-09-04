import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchJson, fmtMoney, fmtSignedPct } from '../lib/api'

export default function Watchlist() {
  const [symbols, setSymbols] = useState([])
  const [input, setInput] = useState('')
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    const data = await fetchJson('/api/watchlist').catch(() => ({ symbols: [] }))
    setSymbols(data.symbols || [])
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function handleAdd(e) {
    e.preventDefault()
    const text = input.trim()
    if (!text) return
    setError('')
    try {
      // Resolve company names ("Nvidia") to a real ticker first — falls
      // back to the raw text (uppercased) if resolution fails, so a
      // literal ticker still works even if this lookup has a problem.
      let symbol = text.toUpperCase()
      try {
        const resolved = await fetchJson(`/api/trending?resolve=${encodeURIComponent(text)}`)
        symbol = resolved.symbol
      } catch {
        // fall through with the raw uppercased text
      }
      await fetchJson('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol }),
      })
      setInput('')
      refresh()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleRemove(symbol) {
    await fetchJson('/api/watchlist', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol }),
    })
    refresh()
  }

  return (
    <div className="panel panel-full">
      <div className="panel-title">
        <h2>Your watchlist</h2>
        <span className="count">{symbols.length}</span>
      </div>
      <p className="panel-note">
        Separate from the algorithmic trending list — symbols you personally want to keep an eye on.
      </p>

      <form className="watchlist-form" onSubmit={handleAdd}>
        <input
          type="text"
          placeholder="Add a symbol, e.g. AAPL"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button type="submit">Add</button>
      </form>
      {error && <p className="trade-message">{error}</p>}

      {symbols.length === 0 ? (
        <div className="empty-state">Your watchlist is empty</div>
      ) : (
        <ul className="watchlist-list">
          {symbols.map((s) => (
            <li key={s.symbol}>
              <Link to={`/stock/${s.symbol}`} className="symbol">
                {s.symbol}
              </Link>
              {s.price !== null && <span>{fmtMoney(s.price)}</span>}
              {s.changePct !== null && (
                <span className={Number(s.changePct) >= 0 ? 'pl-positive' : 'pl-negative'}>
                  {fmtSignedPct(s.changePct)}
                </span>
              )}
              <button type="button" className="remove-btn" onClick={() => handleRemove(s.symbol)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
