import { get } from '@vercel/edge-config'

const KEY = 'autoTradingEnabled'

export async function isAutoTradingEnabled() {
  try {
    const value = await get(KEY)
    return value !== false
  } catch {
    return true
  }
}

export async function setAutoTradingEnabled(enabled) {
  const edgeConfigId = process.env.VERCEL_EDGE_CONFIG_ID
  const token = process.env.VERCEL_API_TOKEN
  if (!edgeConfigId || !token) {
    throw new Error('Missing VERCEL_EDGE_CONFIG_ID or VERCEL_API_TOKEN')
  }

  const res = await fetch(`https://api.vercel.com/v1/edge-config/${edgeConfigId}/items`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      items: [{ operation: 'upsert', key: KEY, value: enabled }],
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Edge Config update failed: ${res.status} ${body}`)
  }
}
