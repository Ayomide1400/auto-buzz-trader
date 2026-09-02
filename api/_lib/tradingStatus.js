const STATE_PATH = 'state/trading-status.json'

function apiUrl() {
  return `https://api.github.com/repos/${process.env.GITHUB_REPO}/contents/${STATE_PATH}`
}

function headers(extra = {}) {
  return {
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    'X-GitHub-Api-Version': '2022-11-28',
    ...extra,
  }
}

async function readState() {
  const res = await fetch(apiUrl(), {
    headers: headers({ Accept: 'application/vnd.github.raw+json' }),
  })
  if (!res.ok) throw new Error(`GitHub read failed: ${res.status}`)
  const text = await res.text()
  return JSON.parse(text)
}

async function readStateWithSha() {
  const res = await fetch(apiUrl(), {
    headers: headers({ Accept: 'application/vnd.github+json' }),
  })
  if (!res.ok) throw new Error(`GitHub read failed: ${res.status}`)
  const data = await res.json()
  const content = JSON.parse(Buffer.from(data.content, 'base64').toString('utf-8'))
  return { content, sha: data.sha }
}

export async function isAutoTradingEnabled() {
  try {
    const state = await readState()
    return state.enabled !== false
  } catch {
    return true
  }
}

export async function setAutoTradingEnabled(enabled) {
  const { sha } = await readStateWithSha()
  const body = JSON.stringify({ enabled, updatedAt: new Date().toISOString() }, null, 2)
  const res = await fetch(apiUrl(), {
    method: 'PUT',
    headers: headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      message: `chore: ${enabled ? 'resume' : 'pause'} auto-trading`,
      content: Buffer.from(body).toString('base64'),
      sha,
    }),
  })
  if (!res.ok) {
    const errBody = await res.text().catch(() => '')
    throw new Error(`GitHub write failed: ${res.status} ${errBody}`)
  }
}
