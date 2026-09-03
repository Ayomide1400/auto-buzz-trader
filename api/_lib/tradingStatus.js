import { readJson, writeJson } from './githubState.js'

const STATE_PATH = 'state/trading-status.json'

export async function isAutoTradingEnabled() {
  try {
    const state = await readJson(STATE_PATH, { enabled: true })
    return state.enabled !== false
  } catch {
    return true
  }
}

export async function setAutoTradingEnabled(enabled) {
  await writeJson(
    STATE_PATH,
    { enabled, updatedAt: new Date().toISOString() },
    `chore: ${enabled ? 'resume' : 'pause'} auto-trading`,
  )
}
