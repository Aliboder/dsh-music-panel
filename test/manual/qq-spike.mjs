/**
 * One-off QQ upstream probe (manual, not part of npm test).
 * Run: node test/manual/qq-spike.mjs [qr|search|all]
 */

import { createRequire } from 'node:module'
import { createServer } from 'node:net'

const require = createRequire(import.meta.url)
const mode = process.argv[2] ?? 'all'

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer()
    probe.once('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address()
      probe.close(() => resolve(port))
    })
  })
}

const port = await freePort()
process.env.PORT = String(port)

const mod = require('@yakult-green-tea/qq-music-api')
const server = mod.server
await new Promise((resolve, reject) => {
  if (server.listening) return resolve()
  server.once('listening', resolve)
  server.once('error', reject)
  setTimeout(() => reject(new Error('listen timeout')), 20000)
})

const base = `http://127.0.0.1:${port}`
const show = (label, value) => console.log(`\n### ${label}\n${JSON.stringify(value).slice(0, 500)}`)

if (mode === 'qr' || mode === 'all') {
  const key = await (await fetch(`${base}/login/qr/key`)).json()
  show('qr/key', key)
  const unikey = key?.data?.unikey ?? key?.data?.key ?? ''
  if (unikey) {
    const created = await (await fetch(`${base}/login/qr/create?key=${encodeURIComponent(unikey)}&qrimg=true`)).json()
    show('qr/create keys', Object.keys(created))
    show('qr/create data keys', Object.keys(created?.data ?? {}))
    const check = await (await fetch(`${base}/login/qr/check?key=${encodeURIComponent(unikey)}`)).json()
    show('qr/check', check)
  }
}

if (mode === 'search' || mode === 'all') {
  const search = await (await fetch(`${base}/search?keyword=${encodeURIComponent('晴天')}&page=1&limit=1`)).json()
  const item = search.items?.[0] ?? {}
  show('search item keys', Object.keys(item))
  show('search item core', {
    mid: item.mid ?? item.songmid,
    name: item.name,
    singer: (item.singer ?? []).map((s) => s.name),
    albumMid: item.album?.mid,
    albumName: item.album?.name,
    interval: item.interval,
    file: item.file ?? null,
  })
  show('search envelope', { code: search.code, page: search.page, limit: search.limit, total: search.total, more: search.more })
}

await new Promise((resolve) => server.close(resolve))
process.exit(0)
