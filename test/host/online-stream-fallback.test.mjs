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

  // A dead modern CDN object is repaired through KuGou's legacy play-info endpoint,
  // the same last resort Folia keeps. It must not degrade the requested quality first.
  qualities.length = 0
  globalThis.fetch = async (url) => {
    if (String(url).includes('getSongInfo.php')) {
      return new Response(JSON.stringify({ url: 'https://cdn.test/legacy.mp3' }), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    if (String(url).includes('/high.mp3')) return new Response('', { status: 404 })
    if (String(url).includes('/legacy.mp3')) {
      return new Response(Buffer.from([0x49, 0x44, 0x33, 0x03]), {
        status: 206,
        headers: { 'content-type': 'audio/mpeg', 'content-length': '4', 'content-range': 'bytes 0-3/4' },
      })
    }
    return new Response('', { status: 500 })
  }
  const legacyRes = fakeRes()
  await handler(fakeReq('/music/online/stream?provider=kugouLite&id=legacy-hash&quality=high'), legacyRes)
  assert.equal(legacyRes.status, 206, 'the legacy URL is served when the modern CDN object is gone')
  assert.deepEqual(qualities, ['high'], 'legacy fallback happens before lowering the quality')
  assert.equal(legacyRes.body, '73,68,51,3', 'the legacy response body is the audio')

// The first media Range probe is normally bytes=0-. If the CDN answers 200,
// relay it as a full 206 so Chromium knows the resource is seekable.
{
  const oldStream = omni.stream
  const oldFetch = globalThis.fetch
  omni.stream = async (_provider, _id, _ctx, quality) => ({
    url: 'https://cdn.test/full-range.mp3',
    quality,
    preview: false,
  })
  globalThis.fetch = async () => new Response(Buffer.from('0123456789'), {
    status: 200,
    headers: { 'content-type': 'audio/mpeg', 'content-length': '10' },
  })
  try {
    const res = fakeRes()
    await handler(fakeReq('/music/online/stream?provider=kugouLite&id=full-range&quality=high', 'GET', { range: 'bytes=0-' }), res)
    assert.equal(res.status, 206, 'a 200 answer to bytes=0- becomes a full 206')
    assert.equal(res.headers['content-range'], 'bytes 0-9/10')
    assert.equal(res.body, '48,49,50,51,52,53,54,55,56,57', 'the full body is passed through')
  } finally {
    omni.stream = oldStream
    globalThis.fetch = oldFetch
  }
}

// A media seek asks for a later byte range. Some CDNs answer 200 anyway;
// the Host must turn the slice into a real 206 or Chromium restarts at zero.
{
  const oldStream = omni.stream
  const oldFetch = globalThis.fetch
  omni.stream = async (_provider, _id, _ctx, quality) => ({
    url: 'https://cdn.test/range.mp3',
    quality,
    preview: false,
  })
  globalThis.fetch = async () => new Response(Buffer.from('0123456789'), {
    status: 200,
    headers: { 'content-type': 'audio/mpeg', 'content-length': '10' },
  })
  try {
    const res = fakeRes()
    await handler(fakeReq('/music/online/stream?provider=kugouLite&id=seek-range&quality=high', 'GET', { range: 'bytes=4-' }), res)
    assert.equal(res.status, 206, 'a 200 to a seek is sliced into 206')
    assert.equal(res.headers['content-range'], 'bytes 4-9/10')
    assert.equal(res.headers['content-length'], '6')
    assert.equal(res.body, '456789', 'the body is the requested slice')
  } finally {
    omni.stream = oldStream
    globalThis.fetch = oldFetch
  }
}

} finally {
  omni.stream = originalStream
  globalThis.fetch = originalFetch
  for (const dispose of disposers.reverse()) {
    if (typeof dispose === 'function') dispose()
  }
}

console.log('online-stream-fallback.test.mjs ok')
