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

// CDNs commonly answer application/octet-stream even for MP3. The Host must
// expose a real audio MIME or MediaSource refuses the stream.
{
  const oldStream = omni.stream
  const oldFetch = globalThis.fetch
  omni.stream = async (_provider, _id, _ctx, quality) => ({
    url: 'https://cdn.test/octet.mp3',
    quality,
    preview: false,
  })
  globalThis.fetch = async () => new Response(Buffer.from([0x49, 0x44, 0x33, 0x04]), {
    status: 200,
    headers: { 'content-type': 'application/octet-stream', 'content-length': '4' },
  })
  try {
    const res = fakeRes()
    await handler(fakeReq('/music/online/stream?provider=kugouLite&id=octet-mime&quality=high'), res)
    assert.equal(res.status, 200)
    assert.equal(res.headers['content-type'], 'audio/mpeg', 'octet-stream is normalized for MSE')
  } finally {
    omni.stream = oldStream
    globalThis.fetch = oldFetch
  }
}

// Issue #28: NetEase's lossless CDN labels a real FLAC file as audio/mpeg. Sniffing the
// first bytes must win, or the media element tries to demux it as MP3 and fails.
{
  const oldStream = omni.stream
  const oldFetch = globalThis.fetch
  omni.stream = async (_provider, _id, _ctx, quality) => ({
    url: 'https://cdn.test/lossless',
    quality,
    preview: false,
  })
  const flac = Buffer.concat([Buffer.from('fLaC', 'latin1'), Buffer.alloc(12)])
  globalThis.fetch = async () => new Response(flac, {
    status: 200,
    headers: { 'content-type': 'audio/mpeg', 'content-length': String(flac.length) },
  })
  try {
    const res = fakeRes()
    await handler(fakeReq('/music/online/stream?provider=netease&id=flac-mime&quality=lossless'), res)
    assert.equal(res.status, 200)
    assert.equal(res.headers['content-type'], 'audio/flac', 'the bytes beat the CDN\'s audio/mpeg label')
    assert.equal(res.body, Array.from(flac).join(','), 'the sniffed first chunk is still written')
    assert.equal(res.headers['content-length'], String(flac.length), 'length is unchanged')
  } finally {
    omni.stream = oldStream
    globalThis.fetch = oldFetch
  }
}

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

// Issue #26: the platform signs the address for ONE CDN node, and that node can refuse this
// client while the same file is served fine elsewhere. Ask for a fresh address once at the same
// quality (a new signature, usually another node) before telling the listener anything.
{
  const oldStream = omni.stream
  const oldFetch = globalThis.fetch
  const asked = []
  let calls = 0
  omni.stream = async (_provider, _id, _ctx, quality) => {
    asked.push(quality)
    return { url: 'https://cdn.test/node-' + asked.length + '-' + quality + '.mp3', quality, preview: false }
  }
  globalThis.fetch = async () => {
    calls += 1
    if (calls === 1) return new Response('', { status: 403 })
    return new Response(Buffer.from([0x49, 0x44, 0x33, 0x04]), {
      status: 206,
      headers: { 'content-type': 'audio/mpeg', 'content-length': '4', 'content-range': 'bytes 0-3/4' },
    })
  }
  try {
    const res = fakeRes()
    await handler(fakeReq('/music/online/stream?provider=netease&id=node-refusal-once&quality=high'), res)
    assert.equal(res.status, 206, 'a node refusal is retried with a fresh address instead of reported')
    assert.deepEqual(asked, ['high', 'high'], 'the first retry keeps the requested quality')
  } finally {
    omni.stream = oldStream
    globalThis.fetch = oldFetch
  }
}

// A node that keeps refusing ends the song, and the answer carries a reason a person can read:
// the status alone used to reach Chromium and come back as a demuxer error.
{
  const oldStream = omni.stream
  const oldFetch = globalThis.fetch
  const asked = []
  omni.stream = async (_provider, _id, _ctx, quality) => {
    asked.push(quality)
    return { url: 'https://cdn.test/always-' + asked.length + '-' + quality + '.mp3', quality, preview: false }
  }
  globalThis.fetch = async () => new Response('', { status: 403 })
  try {
    const res = fakeRes()
    await handler(fakeReq('/music/online/stream?provider=netease&id=node-refusal-always&quality=high'), res)
    assert.equal(res.status, 502, 'a node that keeps refusing ends as an error, not as silence')
    assert.deepEqual(asked, ['high', 'high', 'standard'], 'same quality once more, then one level down')
    const body = res.json()
    assert.equal(body.ok, false)
    assert.equal(body.error.code, 'UPSTREAM_FAILED')
    assert.equal(body.error.upstreamStatus, 403, 'the CDN status travels so the client can classify it')
    assert.match(body.error.message, /403/, 'the message quotes what the CDN answered')
    assert.match(body.error.message, /CDN 节点/, 'a 403 is reported as a node refusal, not as a generic failure')
  } finally {
    omni.stream = oldStream
    globalThis.fetch = oldFetch
  }
}

// The direct element may probe without Range first; the client marks it direct=1 so
// the Host still refuses to change quality underneath a resource it is already using.
{
  const oldStream = omni.stream
  const oldFetch = globalThis.fetch
  const asked = []
  omni.stream = async (_provider, _id, _ctx, quality) => {
    asked.push(quality)
    return { url: 'https://cdn.test/direct-' + asked.length + '.mp3', quality, preview: false }
  }
  globalThis.fetch = async () => new Response('', { status: 403 })
  try {
    const res = fakeRes()
    await handler(fakeReq('/music/online/stream?provider=netease&id=direct-pin&quality=hires&direct=1'), res)
    assert.equal(res.status, 502)
    assert.deepEqual(asked, ['hires', 'hires', 'hires'], 'a direct stream never downgrades')
  } finally {
    omni.stream = oldStream
    globalThis.fetch = oldFetch
  }
}
// Issue #31: a media element asks for Range, and each answer must stay the same file.
// A 403 may mint a fresh address at the SAME quality; it must not downgrade mid-resource.
{
  const oldStream = omni.stream
  const oldFetch = globalThis.fetch
  const asked = []
  const ranges = []
  let calls = 0
  omni.stream = async (_provider, _id, _ctx, quality) => {
    asked.push(quality)
    return { url: 'https://cdn.test/range-node-' + asked.length + '.mp3', quality, preview: false }
  }
  globalThis.fetch = async (_url, options) => {
    ranges.push(options && options.headers ? options.headers.Range : undefined)
    calls += 1
    if (calls === 1) return new Response('', { status: 403 })
    return new Response(Buffer.from([0x49, 0x44, 0x33, 0x04]), {
      status: 206,
      headers: { 'content-type': 'audio/mpeg', 'content-length': '4', 'content-range': 'bytes 0-3/4' },
    })
  }
  try {
    const res = fakeRes()
    await handler(fakeReq('/music/online/stream?provider=netease&id=range-node&quality=hires', 'GET', { range: 'bytes=0-' }), res)
    assert.equal(res.status, 206, 'a Range request is retried and served')
    assert.deepEqual(asked, ['hires', 'hires'], 'the retry keeps the requested quality')
    assert.ok(ranges.every((value) => value === 'bytes=0-'), 'the Range header is forwarded on both attempts')
  } finally {
    omni.stream = oldStream
    globalThis.fetch = oldFetch
  }
}

// If the node keeps refusing a Range request, stop rather than mixing a lower quality
// into a resource whose byte offsets already belong to the requested quality.
{
  const oldStream = omni.stream
  const oldFetch = globalThis.fetch
  const asked = []
  omni.stream = async (_provider, _id, _ctx, quality) => {
    asked.push(quality)
    return { url: 'https://cdn.test/range-refused-' + asked.length + '.mp3', quality, preview: false }
  }
  globalThis.fetch = async () => new Response('', { status: 403 })
  try {
    const res = fakeRes()
    await handler(fakeReq('/music/online/stream?provider=netease&id=range-refused&quality=hires', 'GET', { range: 'bytes=0-' }), res)
    assert.equal(res.status, 502)
    assert.deepEqual(asked, ['hires', 'hires', 'hires'], 'Range retries never lower the quality')
    assert.match(res.json().error.message, /403/)
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
