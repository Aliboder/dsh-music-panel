/**
 * Regression: a KuGou CDN URL that 404s at the requested quality must not turn
 * the whole song into a 502. Folia's ladder retries lower; the Host route has the
 * same last-resort step after a successfully resolved URL turns out to be dead.
 */

import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { apply } from '../../index.js'
import { omni } from '../../src/host/providers/sources/index.js'
import { fakeReq, fakeRes } from '../helpers.mjs'

const home = await mkdtemp(join(tmpdir(), 'dsh-music-stream-'))
let handler = null
const disposers = []
const ctx = {
  effect(callback) {
    const dispose = callback()
    if (typeof dispose === 'function') disposers.push(dispose)
    return dispose
  },
  webServer: {
    register(options) {
      handler = options.handler
      return () => { handler = null }
    },
  },
  get: () => undefined,
}
apply(ctx, { dshHome: home, roots: [], depth: 1, extensions: [] })
assert.equal(typeof handler, 'function')

const originalStream = omni.stream
const originalFetch = globalThis.fetch
const qualities = []
omni.stream = async (_provider, _id, _ctx, quality) => {
  qualities.push(quality)
  return { url: 'https://cdn.test/' + quality + '.mp3', quality, preview: false }
}
globalThis.fetch = async (url) => {
  if (String(url).includes('/high.mp3')) {
    return new Response('', { status: 404 })
  }
  return new Response(Buffer.from([0x49, 0x44, 0x33, 0x03]), {
    status: 206,
    headers: { 'content-type': 'audio/mpeg', 'content-length': '4', 'content-range': 'bytes 0-3/4' },
  })
}

try {
  const res = fakeRes()
  await handler(fakeReq('/music/online/stream?provider=kugouLite&id=deadbeef&quality=high'), res)
  assert.equal(res.status, 206, 'the fallback serves the lower quality instead of 502; body=' + res.body)
  assert.deepEqual(qualities, ['high', 'standard'], 'high falls back to standard')
  assert.equal(res.body, '73,68,51,3', 'the response body is the lower-quality audio')
} finally {
  omni.stream = originalStream
  globalThis.fetch = originalFetch
  for (const dispose of disposers.reverse()) {
    if (typeof dispose === 'function') dispose()
  }
}

console.log('online-stream-fallback.test.mjs ok')
