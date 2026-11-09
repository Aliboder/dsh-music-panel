import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const token = execSync('gh auth token', { encoding: 'utf8' }).trim()
const REPO = 'Aliboder/dsh-music-panel'
const TARGETS = [
  'index.js',
  'client.js',
  'package.json',
  'CHANGELOG.md',
  'README.md',
  'lib/routes.js',
  'lib/control.js',
  'lib/provider-store.js',
  'lib/providers/index.js',
  'lib/providers/netease.js',
  'lib/providers/qq.js',
  'lib/providers/kugou.js',
  'lib/providers/qrc.js',
  'lib/providers/krc.js',
  'lib/providers/yrc.js',
  'lib/providers/vendor/qrcode.mjs',
  'lib/providers/README.md',
  'lib/providers/LICENSE',
  'test/control.test.mjs',
]

async function api(path, init = {}) {
  const res = await fetch('https://api.github.com' + path, {
    ...init,
    headers: {
      Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
  const text = await res.text()
  if (!res.ok) {
    const error = new Error(path + ' ' + res.status + ' ' + text.slice(0, 160))
    error.status = res.status
    throw error
  }
  return text ? JSON.parse(text) : null
}

async function withRetry(fn, label) {
  let last = null
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      return await fn()
    } catch (error) {
      last = error
      console.log('retry', label, attempt + 1, error.message.slice(0, 80))
      await new Promise((resolve) => setTimeout(resolve, 5000))
    }
  }
  throw last
}

for (const file of TARGETS) {
  let current = null
  try {
    current = await api(`/repos/${REPO}/contents/${file}?ref=main`)
  } catch (error) {
    if (error.status !== 404) throw error
  }
  const body = {
    message: 'feat: online music providers',
    content: readFileSync(file).toString('base64'),
    branch: 'main',
  }
  if (current !== null && current !== undefined) body.sha = current.sha
  await withRetry(
    () => api(`/repos/${REPO}/contents/${file}`, { method: 'PUT', body: JSON.stringify(body) }),
    'PUT ' + file,
  )
  console.log('updated', file)
}

const ref = await withRetry(() => api(`/repos/${REPO}/git/ref/heads/main`), 'GET ref')
await withRetry(
  () =>
    api(`/repos/${REPO}/git/refs`, {
      method: 'POST',
      body: JSON.stringify({ ref: 'refs/tags/v0.9.0', sha: ref.object.sha }),
    }),
  'tag',
)
console.log('tag v0.9.0', ref.object.sha)
