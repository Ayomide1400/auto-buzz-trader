import { isAutoTradingEnabled, setAutoTradingEnabled } from './_lib/tradingStatus.js'

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const enabled = await isAutoTradingEnabled()
      res.status(200).json({ enabled })
      return
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
      const enabled = Boolean(body.enabled)
      await setAutoTradingEnabled(enabled)
      res.status(200).json({ enabled })
      return
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
