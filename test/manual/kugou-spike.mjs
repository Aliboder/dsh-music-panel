/**
 * One-off KuGou upstream probe (manual, not part of npm test).
 * Run: node test/manual/kugou-spike.mjs
 */

import { createRequire } from 'node:module'
import { createServer } from 'node:net'

const require = createRequire(import.meta.url)

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
process.env.HOST = '127.0.0.1'
process.env.platform = 'lite'

const mod = require('kugoumusicapi')
const app = await mod.startService()
const server = app.service
await new Promise((resolve, reject) => {
  if (server.listening) return resolve()
  server.once('listening', resolve)
  server.once('error', reject)
  setTimeout(() => reject(new Error('listen timeout')), 20000)
})

const base = `http://127.0.0.1:${port}`
const show = (label, value) => console.log(`\n### ${label}\n${JSON.stringify(value).slice(0, 420)}`)

async function probe(path) {
  try {
    const response = await fetch(base + path, { headers: { 'KUGOU_API_PLATFORM': 'lite' } })
    const text = await response.text()
    return { status: response.status, text }
  } catch (error) {
    return { status: 0, text: String(error.message) }
  }
}

for (const path of ['/search?keywords=%E6%99%B4%E5%A4%A9&page=1&pagesize=1', '/search/complex?keywords=%E6%99%B4%E5%A4%A9', '/login/qr/key']) {
  const result = await probe(path)
  console.log(`\n### ${path} -> ${result.status}\n${result.text.slice(0, 500)}`)
}

await new Promise((resolve) => server.close(resolve))
process.exit(0)
