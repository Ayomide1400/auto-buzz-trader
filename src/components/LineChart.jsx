export default function LineChart({ series, lines, height = 160 }) {
  if (!series || series.length < 2) {
    return <div className="empty-state">Not enough data yet for a chart</div>
  }

  const width = 600
  const pad = 10
  const allValues = series.flatMap((s) => lines.map((l) => Number(s[l.key]) || 0))
  const min = Math.min(0, ...allValues)
  const max = Math.max(0, ...allValues)
  const range = max - min || 1

  function pointsFor(key) {
    return series.map((s, i) => {
      const x = pad + (i / (series.length - 1)) * (width - pad * 2)
      const y = height - pad - (((Number(s[key]) || 0) - min) / range) * (height - pad * 2)
      return [x, y]
    })
  }
  function pathFor(points) {
    return points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  }

  const zeroY = height - pad - ((0 - min) / range) * (height - pad * 2)
  const primaryPoints = pointsFor(lines[0].key)
  const primaryPath = pathFor(primaryPoints)
  const primaryEnding = Number(series[series.length - 1][lines[0].key]) || 0
  const areaPath =
    lines.length === 1
      ? `${primaryPath} L${primaryPoints[primaryPoints.length - 1][0].toFixed(1)},${zeroY.toFixed(1)} L${primaryPoints[0][0].toFixed(1)},${zeroY.toFixed(1)} Z`
      : null

  return (
    <svg
      className={`line-chart ${primaryEnding >= 0 ? 'positive' : 'negative'}`}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
      <line x1={pad} y1={zeroY} x2={width - pad} y2={zeroY} className="chart-zero-line" />
      {areaPath && <path d={areaPath} className="chart-area" />}
      {lines.map((l, idx) => (
        <path
          key={l.key}
          d={pathFor(pointsFor(l.key))}
          className={idx === 0 ? 'chart-line' : 'chart-line-compare'}
        />
      ))}
    </svg>
  )
}
