const BASE_URL = 'https://finnhub.io/api/v1'

async function finnhubFetch(path) {
  const separator = path.includes('?') ? '&' : '?'
  const res = await fetch(`${BASE_URL}${path}${separator}token=${process.env.FINNHUB_API_KEY}`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Finnhub ${path} failed: ${res.status} ${body}`)
  }
  return res.json()
}

// Real-world news (not just company press releases) — confirmed free tier.
export function getGeneralNews() {
  return finnhubFetch('/news?category=general')
}

// Confirmed free tier. The economic/macro calendar (Fed meetings, CPI) is
// a separate paid product on Finnhub — this is company earnings only.
export async function getEarningsCalendar(from, to) {
  const data = await finnhubFetch(`/calendar/earnings?from=${from}&to=${to}`)
  return data.earningsCalendar || []
}
