import { readJson, writeJson } from './githubState.js'
import { NOTIONAL_PER_TRADE, MAX_OPEN_POSITIONS, TAKE_PROFIT_PCT, STOP_LOSS_PCT, MIN_PRICE, MIN_VOLUME } from './alpaca.js'

const STATE_PATH = 'state/strategy-config.json'

export const DEFAULTS = {
  notionalPerTrade: NOTIONAL_PER_TRADE,
  maxOpenPositions: MAX_OPEN_POSITIONS,
  takeProfitPct: TAKE_PROFIT_PCT,
  stopLossPct: STOP_LOSS_PCT,
  minPrice: MIN_PRICE,
  minVolume: MIN_VOLUME,
  // A flat ">0%" pass was a rubber stamp, not real momentum confirmation —
  // 2% is a genuine (if still simple) threshold a trader would recognize
  // as an actual condition rather than a technicality.
  minDayChangePct: 0.02,
}

const BOUNDS = {
  notionalPerTrade: [5, 500],
  maxOpenPositions: [1, 15],
  takeProfitPct: [0.01, 0.5],
  stopLossPct: [0.01, 0.3],
  minPrice: [1, 100],
  minVolume: [0, 10_000_000],
  minDayChangePct: [0, 0.15],
}

export async function getStrategyConfig() {
  const stored = await readJson(STATE_PATH, {})
  return { ...DEFAULTS, ...stored }
}

export async function setStrategyConfig(partial) {
  const current = await getStrategyConfig()
  const next = { ...current }

  for (const [key, [min, max]] of Object.entries(BOUNDS)) {
    if (partial[key] === undefined) continue
    const num = Number(partial[key])
    if (!Number.isFinite(num)) continue
    next[key] = Math.min(max, Math.max(min, num))
  }

  await writeJson(STATE_PATH, next, 'chore: update strategy settings')
  return next
}
