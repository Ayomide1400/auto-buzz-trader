import { getAccount, getMarketClock } from './_lib/alpaca.js'

export default async function handler(req, res) {
  try {
    const [account, clock] = await Promise.all([getAccount(), getMarketClock().catch(() => null)])
    res.status(200).json({
      equity: account.equity,
      cash: account.cash,
      buyingPower: account.buying_power,
      portfolioValue: account.portfolio_value,
      status: account.status,
      marketOpen: clock?.is_open ?? null,
      nextOpen: clock?.next_open ?? null,
      nextClose: clock?.next_close ?? null,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
