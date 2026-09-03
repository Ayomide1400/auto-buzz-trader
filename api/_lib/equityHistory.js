import { readJson, writeJson } from './githubState.js'

const STATE_PATH = 'state/equity-history.json'

export async function getEquityHistory() {
  const state = await readJson(STATE_PATH, { snapshots: [] })
  return state.snapshots || []
}

// One snapshot per calendar day — the cron runs once daily anyway, so this
// naturally builds a daily equity curve for drawdown/Sharpe calculations
// without needing a second cron or a database.
export async function appendEquitySnapshot(equity) {
  const snapshots = await getEquityHistory()
  const today = new Date().toISOString().slice(0, 10)
  if (snapshots.length && snapshots[snapshots.length - 1].date === today) return
  snapshots.push({ date: today, equity: Number(equity) })
  await writeJson(STATE_PATH, { snapshots }, `chore: log equity snapshot for ${today}`)
}
