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

export async function writeJson(path, content, message) {
  let sha
  const existing = await fetch(apiUrl(path), {
    headers: headers({ Accept: 'application/vnd.github+json' }),
  })
  if (existing.ok) {
    sha = (await existing.json()).sha
  } else if (existing.status !== 404) {
    throw new Error(`GitHub read-before-write failed for ${path}: ${existing.status}`)
  }

  const body = JSON.stringify(content, null, 2)
  const res = await fetch(apiUrl(path), {
    method: 'PUT',
    headers: headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      message,
      content: Buffer.from(body).toString('base64'),
      ...(sha ? { sha } : {}),
    }),
  })
  if (!res.ok) {
    const errBody = await res.text().catch(() => '')
    throw new Error(`GitHub write failed for ${path}: ${res.status} ${errBody}`)
  }
}
