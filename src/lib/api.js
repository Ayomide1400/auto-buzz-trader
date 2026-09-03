export async function fetchJson(url, options) {
  const res = await fetch(url, options)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `${url} failed (${res.status})`)
  return data
}

export function fmtMoney(value) {
  const num = Number(value)
  if (Number.isNaN(num)) return '—'
  return num.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

export function fmtSignedMoney(value) {
  const num = Number(value)
  if (Number.isNaN(num)) return '—'
  const formatted = Math.abs(num).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
  return num >= 0 ? `+${formatted}` : `-${formatted}`
}

export function fmtPct(value) {
  const num = Number(value)
  if (Number.isNaN(num)) return ''
  return `${(num * 100).toFixed(2)}%`
}

export function fmtSignedPct(value) {
  if (value === null || value === undefined) return ''
  const pct = value * 100
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`
}

export function fmtTime(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function fmtDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
