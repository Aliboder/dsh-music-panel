/**
 * HTTP-level integration: boot the real plugin (`apply`) against a temporary DSH
 * home and drive its routes with fake requests.
 *
 * This is the closest thing to a runtime check that runs without the app: it
 * proves the route table, the source registry, the provider merge and the
 * adapters agree. Live network calls are gated behind DSH_MUSIC_UPSTREAM=1.
 */

import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { apply } from '../../index.js'
import { fakeReq, fakeRes } from '../helpers.mjs'
import { resetUpstreamOverride, setUpstreamOverride } from '../../src/host/services/netease-api.js'
import { registry } from '../../src/host/providers/sources/index.js'

// The route factory fails loudly when a dependency is missing, so a wiring
// mistake cannot degrade into a silent 502 at request time.
{
  const { createOnlineRoutes } = await import('../../src/host/http/routes/online.js')
  assert.throws(() => createOnlineRoutes({}), /missing dependency: settings/)
}

const home = await mkdtemp(join(tmpdir(), 'dsh-music-runtime-'))

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
      return () => {
        handler = null
      }
    },
  },
  get: () => undefined,
}

apply(ctx, { dshHome: home, roots: [], depth: 1, extensions: [] })
assert.equal(typeof handler, 'function', 'apply must register the /music route')

async function get(path) {
  const res = fakeRes()
  await handler(fakeReq(path, 'GET', { host: '127.0.0.1:1' }), res)
  const headers = res.headers ?? {}
  const isJson = String(headers['content-type'] ?? '').includes('json')
  // Binary responses (the cover proxy) must not be parsed as JSON.
  const body = isJson && res.body !== '' ? JSON.parse(res.body) : null
  return { status: res.status, headers, body }
}

/** HEAD lets us check the stream route without buffering audio into the fake response. */
async function head(path) {
  const res = fakeRes()
  await handler(fakeReq(path, 'HEAD', { host: '127.0.0.1:1' }), res)
  const headers = res.headers ?? {}
  const isJson = String(headers['content-type'] ?? '').includes('json')
  // Binary responses (the cover proxy) must not be parsed as JSON.
  const body = isJson && res.body !== '' ? JSON.parse(res.body) : null
  return { status: res.status, headers, body }
}

async function post(path, payload) {
  const res = fakeRes()
  await handler(fakeReq(path, 'POST', { host: '127.0.0.1:1', 'content-type': 'application/json' }, JSON.stringify(payload)), res)
  const headers = res.headers ?? {}
  const isJson = String(headers['content-type'] ?? '').includes('json')
  // Binary responses (the cover proxy) must not be parsed as JSON.
  const body = isJson && res.body !== '' ? JSON.parse(res.body) : null
  return { status: res.status, headers, body }
}

// ── lyric style thumbnails ──────────────────────────────────────────────────
{
  const thumb = await get('/music/assets/lyric-style-thumbs/monet.webp')
  assert.equal(thumb.status, 200)
  assert.equal(thumb.headers['content-type'], 'image/webp')
  assert.ok(Number(thumb.headers['content-length']) > 0, 'the thumbnail has bytes')
  const missing = await get('/music/assets/lyric-style-thumbs/unknown.webp')
  assert.equal(missing.status, 404)
}

// ── audio focus ─────────────────────────────────────────────────────────────
{
  const status = await get('/music/audio-focus/status')
  assert.equal(status.status, 200)
  assert.equal(status.body.ok, true)
  assert.equal(typeof status.body.supported, 'boolean')

  const configured = await post('/music/audio-focus/config', { voiceInputPause: false })
  assert.equal(configured.status, 200)
  assert.equal(configured.body.voiceInputPause, false)

  const ducked = await post('/music/audio-focus/duck', {
    reason: 'tts',
    active: true,
    level: 0.2,
    fadeMs: 120,
    ttlMs: 5000,
  })
  assert.equal(ducked.status, 200)
  assert.equal(ducked.body.duck.active, true)
  assert.equal(ducked.body.duck.level, 0.2)
  assert.deepEqual(ducked.body.duck.reasons, ['tts'])

  const released = await post('/music/audio-focus/duck', { reason: 'tts', active: false })
  assert.equal(released.status, 200)
  assert.equal(released.body.duck.active, false)
}

// ── provider catalogue ──────────────────────────────────────────────────────

const providers = await get('/music/online/providers')
assert.equal(providers.status, 200)
const map = providers.body.providers

for (const id of ['netease', 'qq', 'kugouLite', 'navidrome']) {
  assert.ok(map[id], `legacy platform missing from /online/providers: ${id}`)
}
assert.equal(map.kugou, undefined, 'the standard KuGou platform is gone')
assert.equal(map.local, undefined, 'the local library is not an online provider')
assert.ok(map.netease.capabilities, 'capabilities must be exposed to the client')
assert.equal(map.netease.capabilities.loginQr, true)
assert.equal(map.navidrome.capabilities.loginQr, false)
assert.equal(map.navidrome.capabilities.loginPassword, true)

// Bodian is registered outside the legacy factory and must still appear.
assert.ok(map.bodian, 'the native source must be listed')
assert.equal(map.bodian.displayName, 'Bodian Music')
assert.equal(map.bodian.capabilities.search, true)

// Qishui is also registered outside the legacy factory, from its Node package.
assert.ok(map.qishui, 'the Qishui source must be listed')
assert.equal(map.qishui.displayName, 'Qishui Music')
assert.equal(map.qishui.capabilities.loginQr, true)


// ── guards ──────────────────────────────────────────────────────────────────

const badProvider = await get('/music/online/search?provider=nope&query=x')
assert.equal(badProvider.status, 400, 'unknown providers are rejected')

const missingId = await get('/music/online/album?provider=navidrome')
assert.equal(missingId.status, 400, 'navidrome needs an album id')

// Folia's Lyric 自动换源 is a route of its own: it is asked after the platform's lyric is
// on screen, so it must exist and guard its input even with no network.
const bestLyricBad = await get('/music/online/best-lyric?provider=nope&id=1')
assert.equal(bestLyricBad.status, 400, 'best-lyric rejects unknown providers')
const bestLyricNoId = await get('/music/online/best-lyric?provider=netease')
assert.equal(bestLyricNoId.status, 400, 'best-lyric needs the track id')

// ── paged playlist route ────────────────────────────────────────────────────
// The route must pass limit/offset through and answer with the Folia page shape,
// not the old full list. 网易云现在是移植源（会走真网络），所以这里在注册表上换成一个替身：
// 路由层照样被验，且全程离线。
{
  const calls = []
  const previous = registry.get('netease')
  registry.register({
    id: 'netease',
    kind: 'online',
    displayName: 'NetEase Cloud Music',
    capabilities: { search: true, playlistSongs: true },
    async playlistSongsPage(id, ctx, page = {}) {
      const offset = Number(page.offset) || 0
      const limit = Number(page.limit) || 100
      calls.push({ offset, limit })
      const count = Math.max(0, Math.min(limit, 250 - offset))
      const songs = Array.from({ length: count }, (_, index) => ({
        provider: 'netease',
        id: String(900000 + offset + index),
        title: 'P' + (offset + index),
        artist: 'A',
        album: 'Al',
        durationSec: 1,
      }))
      return { name: 'Paged', cover: '', trackCount: 250, songs, hasMore: offset + count < 250, nextOffset: offset + count }
    },
  })
  try {
    const first = await get('/music/online/playlist-songs?provider=netease&id=77&limit=100&offset=0')
    assert.equal(first.status, 200)
    assert.equal(first.body.songs.length, 100)
    assert.equal(first.body.trackCount, 250)
    assert.equal(first.body.hasMore, true)
    assert.equal(first.body.nextOffset, 100)
    const second = await get('/music/online/playlist-songs?provider=netease&id=77&limit=100&offset=100')
    assert.equal(second.status, 200)
    assert.equal(second.body.songs[0].id, '900100')
    assert.deepEqual(calls.map((call) => call.offset), [0, 100])
  } finally {
    if (previous) registry.register(previous)
    resetUpstreamOverride()
  }
}

// ── sign-in surface stays compatible ────────────────────────────────────────

const badLogin = await post('/music/online/login/start', { provider: 'spotify' })
assert.equal(badLogin.status, 400)
assert.equal(badLogin.body.error.code, 'BAD_PROVIDER')

const loggedOut = await post('/music/online/logout', { provider: 'netcafe' })
assert.equal(loggedOut.status, 400)

const logout = await post('/music/online/logout', { provider: 'netease' })
assert.equal(logout.status, 200)
assert.equal(logout.body.ok, true)

// ── live (opt-in) ───────────────────────────────────────────────────────────

if (process.env.DSH_MUSIC_UPSTREAM === '1') {
  const searched = await get(`/music/online/search?provider=bodian&q=${encodeURIComponent('晴天')}`)
  assert.equal(searched.status, 200)
  assert.ok(searched.body.results.length > 0, 'bodian search returns songs through the route')
  assert.ok(searched.body.total > 0)
  assert.equal(typeof searched.body.results[0].id, 'string')

  const netease = await get(`/music/online/search?provider=netease&q=${encodeURIComponent('晴天')}`)
  assert.equal(netease.status, 200)
  assert.ok(netease.body.results.length > 0, 'netease search works through the local upstream service')

  // Playback and lyrics must reach the source's own implementation, not fall over
  // on a method-name mismatch ("does not support stream").
  for (const provider of ['netease', 'bodian']) {
    const found = provider === 'netease' ? netease : searched
    const song = found.body.results[0]

    const lyric = await get(`/music/online/lyric?provider=${provider}&id=${encodeURIComponent(song.id)}`)
    assert.equal(lyric.status, 200, `${provider} lyric must answer 200`)
    assert.ok(String(lyric.body.lrc ?? '').length > 0, `${provider} lyric must carry LRC text`)
    // The route always names the source it answered from, and flags a borrowed
    // answer instead of pretending the platform had lyrics of its own.
    assert.equal(lyric.body.source, provider)
    assert.equal(lyric.body.borrowedFrom, '')

    // The chorus window is a separate Folia endpoint; the route must exist even
    // when a given track has no hook (then `chorus` is null).
    const chorus = await get(`/music/online/chorus?provider=${provider}&id=${encodeURIComponent(song.id)}`)
    assert.equal(chorus.status, 200, `${provider} chorus route must answer`)
    assert.equal(chorus.body.ok, true)

    const quality = await get(`/music/online/quality?provider=${provider}&id=${encodeURIComponent(song.id)}`)
    assert.equal(quality.status, 200)
    assert.equal(quality.body.ok, true, `${provider} quality must not fail on a missing dependency`)

    const stream = await head(`/music/online/stream?provider=${provider}&id=${encodeURIComponent(song.id)}`)
    assert.notEqual(stream.status, 502, `${provider} stream must not 502: ${JSON.stringify(stream.body).slice(0, 160)}`)

    if (song.coverUrl) {
      const cover = await get(`/music/online/cover?url=${encodeURIComponent(song.coverUrl)}`)
      assert.equal(cover.status, 200, `${provider} cover must proxy: ${JSON.stringify(cover.body).slice(0, 160)}`)
      assert.match(String(cover.headers['content-type'] ?? ''), /^image\//, `${provider} cover keeps its type`)
    }
  }

  console.log('runtime.test.mjs ok (live)')
} else {
  console.log('runtime.test.mjs ok (offline routes only)')
}

// Unloading must release both service workers and the refresh timer.
for (const dispose of disposers) dispose()

