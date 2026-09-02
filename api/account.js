import { getAccount } from './_lib/alpaca.js'

export default async function handler(req, res) {
  try {
    const account = await getAccount()
    res.status(200).json({
      equity: account.equity,
      cash: account.cash,
      buyingPower: account.buying_power,
      portfolioValue: account.portfolio_value,
      status: account.status,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
