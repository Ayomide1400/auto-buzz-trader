function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)]
}

export default function PieChart({ segments }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0)
  if (total <= 0) return <div className="empty-state">No positions to show</div>

  const size = 160
  const r = 70
  const cx = size / 2
  const cy = size / 2
  let cumulative = 0

  const arcs = segments.map((s, i) => {
    const startAngle = (cumulative / total) * 360
    cumulative += s.value
    const endAngle = (cumulative / total) * 360
    const large = endAngle - startAngle > 180 ? 1 : 0
    const [x1, y1] = polarToCartesian(cx, cy, r, startAngle)
    const [x2, y2] = polarToCartesian(cx, cy, r, endAngle)
    const d = `M${cx},${cy} L${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${large} 1 ${x2.toFixed(2)},${y2.toFixed(2)} Z`
    return { d, key: s.label, className: `pie-c${i % 6}` }
  })

  return (
    <div className="pie-wrap">
      <svg viewBox={`0 0 ${size} ${size}`} className="pie-chart">
        {arcs.map((a) => (
          <path key={a.key} d={a.d} className={a.className} />
        ))}
      </svg>
      <ul className="pie-legend">
        {segments.map((s, i) => (
          <li key={s.label}>
            <span className={`legend-swatch pie-c${i % 6}`} />
            {s.label} — {((s.value / total) * 100).toFixed(0)}%
          </li>
        ))}
      </ul>
    </div>
  )
}
