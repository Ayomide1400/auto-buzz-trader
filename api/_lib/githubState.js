function apiUrl(path) {
  return `https://api.github.com/repos/${process.env.GITHUB_REPO}/contents/${path}`
}

function headers(extra = {}) {
  return {
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    'X-GitHub-Api-Version': '2022-11-28',
    ...extra,
  }
}

export async function readJson(path, fallback) {
  const res = await fetch(apiUrl(path), {
    headers: headers({ Accept: 'application/vnd.github.raw+json' }),
  })
  if (res.status === 404) return fallback
  if (!res.ok) throw new Error(`GitHub read failed for ${path}: ${res.status}`)
  const text = await res.text()
  return text ? JSON.parse(text) : fallback
}

async function getSha(path) {
  const res = await fetch(apiUrl(path), { headers: headers({ Accept: 'application/vnd.github+json' }) })
  if (res.ok) return (await res.json()).sha
  if (res.status === 404) return undefined
  throw new Error(`GitHub read-before-write failed for ${path}: ${res.status}`)
}

function putFile(path, content, message, sha) {
  const body = JSON.stringify(content, null, 2)
  return fetch(apiUrl(path), {
    method: 'PUT',
    headers: headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      message,
      content: Buffer.from(body).toString('base64'),
      ...(sha ? { sha } : {}),
    }),
  })
}

export async function writeJson(path, content, message) {
  const sha = await getSha(path)
  let res = await putFile(path, content, message, sha)

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    // The Contents API can lag briefly right after a very recent create —
    // an existence check moments later can still 404, leading to a PUT
    // with no sha against a file that now exists. Refetch and retry once.
    const looksLikeStaleShaRace = res.status === 409 || (res.status === 422 && errText.includes('sha'))
    if (looksLikeStaleShaRace) {
      const retrySha = await getSha(path)
      res = await putFile(path, content, message, retrySha)
    } else {
      throw new Error(`GitHub write failed for ${path}: ${res.status} ${errText}`)
    }
  }

  if (!res.ok) {
    const errBody = await res.text().catch(() => '')
    throw new Error(`GitHub write failed for ${path}: ${res.status} ${errBody}`)
  }
}
