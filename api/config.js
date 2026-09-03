import { getStrategyConfig, setStrategyConfig } from './_lib/strategyConfig.js'

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      res.status(200).json(await getStrategyConfig())
      return
    }
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
      res.status(200).json(await setStrategyConfig(body))
      return
    }
    res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
