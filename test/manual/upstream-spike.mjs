/**
 * One-off feasibility spike for the upstream platform packages.
 *
 * Not part of `npm test`: it starts real local servers and talks to the network.
 * Run: node test/manual/upstream-spike.mjs [netease|qq|kugou]
 *
 * Finding it encodes: neither upstream accepts an OS-assigned port.
 *   - NetEase: `options.port || process.env.PORT || '3000'` turns `0` into 3000.
 *   - QQ: its Zod config schema rejects `port <= 0`.
 * So the adapter must allocate a free port itself and pass it in.
 */

import { createServer } from 'node:net'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const line = (label, value) => console.log(`${label.padEnd(10)} ${value}`)

/** Reserve a free TCP port, then release it so the server can bind it. */
async function freePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer()
    probe.once('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address()
      probe.close(() => resolve(port))
    })
  })
}

async function waitForListening(server, label) {
  await new Promise((resolve, reject) => {
    if (server.listening) return resolve()
    const timer = setTimeout(() => reject(new Error(`${label}: listen() timed out`)), 20000)
    server.once('listening', () => {
      clearTimeout(timer)
      resolve()
    })
    server.once('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
  })
  return server.address().port
}

async function spikeNetease() {
  const port = await freePort()
  const { serveNcmApi } = require('@neteasecloudmusicapienhanced/api/server.js')
  const app = await serveNcmApi({ port, host: '127.0.0.1', checkVersion: false })
  const bound = await waitForListening(app.server, 'netease')
  line('netease', `requested ${port}, bound ${bound}`)
  const response = await fetch(`http://127.0.0.1:${bound}/cloudsearch?keywords=spike&type=1&limit=1`)
  const body = await response.json()
  line('netease', `HTTP ${response.status} code=${body.code} songs=${body.result?.songs?.length ?? 0}`)
  await new Promise((resolve) => app.server.close(resolve))
}

async function spikeQq() {
  const port = await freePort()
  process.env.PORT = String(port)
  const mod = require('@yakult-green-tea/qq-music-api')
  const server = mod.server
  if (!server || typeof server.address !== 'function') {
    line('qq', `no exports.server; exports=${Object.keys(mod).join(',')}`)
    return
  }
  const bound = await waitForListening(server, 'qq')
  line('qq', `requested ${port}, bound ${bound}`)
  for (const route of ['/getHotKey', '/search?keyword=spike']) {
    try {
      const response = await fetch(`http://127.0.0.1:${bound}${route}`)
      const text = await response.text()
      line('qq', `${route} -> HTTP ${response.status} ${text.slice(0, 140).replace(/\s+/g, ' ')}`)
    } catch (error) {
      line('qq', `${route} -> ${error.message}`)
    }
  }
  await new Promise((resolve) => server.close(resolve))
}

async function spikeKugou() {
  process.env.platform = 'lite'
  const mod = require('kugoumusicapi')
  const keys = Object.keys(mod)
  line('kugou', `${keys.length} exports`)
  const searchFn = keys.find((k) => /search/i.test(k)) ?? keys.find((k) => /song/i.test(k))
  line('kugou', `candidate: ${searchFn ?? '(none)'}; sample: ${keys.slice(0, 10).join(',')}`)
  if (!searchFn) return
  const result = await mod[searchFn]({ keywords: 'spike', page: 1, pagesize: 1 })
  line('kugou', `${searchFn} -> ${JSON.stringify(result).slice(0, 200)}`)
}

const only = process.argv[2]
const jobs = [
  ['netease', spikeNetease],
  ['qq', spikeQq],
  ['kugou', spikeKugou],
].filter(([name]) => !only || name === only)

for (const [name, run] of jobs) {
  try {
    await run()
    line(name, 'ok')
  } catch (error) {
    line(name, `FAILED: ${error.message}`)
  }
}
process.exit(0)
