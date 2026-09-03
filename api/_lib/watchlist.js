import { readJson, writeJson } from './githubState.js'

const STATE_PATH = 'state/watchlist.json'

export async function getWatchlist() {
  const state = await readJson(STATE_PATH, { symbols: [] })
  return state.symbols || []
}

export async function addToWatchlist(symbol) {
  const symbols = await getWatchlist()
  if (!symbols.includes(symbol)) symbols.push(symbol)
  await writeJson(STATE_PATH, { symbols }, `chore: add ${symbol} to watchlist`)
  return symbols
}

export async function removeFromWatchlist(symbol) {
  const symbols = (await getWatchlist()).filter((s) => s !== symbol)
  await writeJson(STATE_PATH, { symbols }, `chore: remove ${symbol} from watchlist`)
  return symbols
}
