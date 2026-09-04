import { Link } from 'react-router-dom'
import { fmtSignedPct } from '../lib/api'

function bucketFor(changePct) {
  if (changePct === null || changePct === undefined) return 'heat-neutral'
  const magnitude = Math.min(Math.abs(changePct) / 0.08, 1)
  const step = Math.min(4, Math.round(magnitude * 4))
  return changePct >= 0 ? `heat-pos-${step}` : `heat-neg-${step}`
}

export default function Heatmap({ items }) {
  if (!items || items.length === 0) {
    return <div className="empty-state">Nothing to show yet — add a watchlist symbol or hold a position</div>
  }

  return (
    <div className="heatmap-grid">
      {items.map((it) => (
        <Link key={it.symbol} to={`/stock/${it.symbol}`} className={`heat-tile ${bucketFor(it.changePct)}`}>
          <span className="heat-symbol">{it.symbol}</span>
          <span className="heat-pct">{fmtSignedPct(it.changePct)}</span>
        </Link>
      ))}
    </div>
  )
}
