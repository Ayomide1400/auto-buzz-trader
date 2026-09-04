import { useEffect, useState } from 'react'
import { fetchJson, fmtSignedPct } from '../lib/api'

const POLL_MS = 60000

export default function Ticker() {
  const [items, setItems] = useState([])

  useEffect(() => {
    let active = true
    async function load() {
      const data = await fetchJson('/api/trending?ticker=1').catch(() => ({ items: [] }))
      if (active) setItems(data.items || [])
    }
    load()
    const id = setInterval(load, POLL_MS)
    return () => {
      active = false
      clearInterval(id)
    }
  }, [])

  if (items.length === 0) return null

  const loopItems = [...items, ...items]

  return (
    <div className="ticker-wrap">
      <div className="ticker-track">
        {loopItems.map((it, i) => (
          <span key={`${it.symbol}-${i}`} className="ticker-item">
            <span className="ticker-symbol">{it.symbol}</span>
            <span>{it.price.toFixed(2)}</span>
            <span className={Number(it.changePct) >= 0 ? 'pl-positive' : 'pl-negative'}>
              {fmtSignedPct(it.changePct)}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}
