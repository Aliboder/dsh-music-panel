/**
 * Route-level integration tests for the online provider endpoints.
 *
 * These exist because the provider unit tests and the source-shape guards did
 * not catch two real regressions: `music_control`'s source whitelist and a
 * shared album route that started demanding an id from every platform. Both are
 * visible only when the HTTP layer is exercised.
 *
 * `fetch` is stubbed per test; nothing here touches a real server.
 */

import assert from 'node:assert/strict'
import { createRoutes } from '../lib/routes.js'
import { fakeReq, fakeRes } from './helpers.mjs'

const settings = {
  read: async () => ({ roots: [], depth: 2, extensions: ['wav'] }),
  write: async (patch) => ({ roots: [], depth: 4, extensions: ['wav'], ...patch }),
  home: 'C:/dsh-home',
  file: 'C:/dsh-home/music/settings.json',
}
const library = {
  scan: async () => ({ tracks: [], roots: [], warnings: [], truncated: false, empty: true, scannedAt: 0 }),
}

/** Minimal provider store: a signed-in Navidrome session, nothing else. */
function makeStore() {
  const sessions = {
    navidrome: { server: 'https://nd.example.com', username: 'alice', salt: 's', token: 't', password: '', nativeSongs: false },
  }
  return {
    cleared: [],
    async cookie() {
      return ''
    },
    async session(provider) {
      return sessions[provider] || {}
    },
    async summary() {
      return {}
    },
    async setLogin() {},
    async clear(provider) {
      this.cleared.push(provider)
    },
  }
}

/** In-memory stand-in for the on-disk online cache. */
function makeCache() {
  const meta = new Map()
  return {
    meta,
    async readMeta(provider, id, kind) {
      return meta.get(`${provider}:${id}:${kind}`) ?? null
    },
    async writeMeta(provider, id, kind, value) {
      meta.set(`${provider}:${id}:${kind}`, value)
    },
    async lookup() {
      return null
    },
  }
}

const store = makeStore()
const cache = makeCache()
// The lyric route needs a cache to exercise its version check, so routes are
// built per test group rather than once.
const handleWithCache = createRoutes({ settings, library, providerStore: store, onlineCache: cache })
const handle = handleWithCache

/** Build a Subsonic JSON envelope. */
function subsonic(payload) {
  return { 'subsonic-response': { status: 'ok', version: '1.16.1', ...payload } }
}

async function withFetch(handler, fn) {
  const original = globalThis.fetch
  globalThis.fetch = handler
  try {
    return await fn()
  } finally {
    globalThis.fetch = original
  }
}

async function get(url) {
  const res = fakeRes()
  await handle(fakeReq(url), res)
  return { status: res.status, body: res.json() }
}

const tests = []
const test = (name, fn) => tests.push({ name, fn })

// ── /online/album: the id guard must apply to navidrome only ─────────────

test('album accepts an empty id plus a name for the Chinese platforms', async () => {
  // Previously the shared route started returning 400 for every provider as
  // soon as `id` was empty, which broke the name-based fallback that 0.28.2
  // added for tracks whose album id is missing from search data.
  const { status, body } = await get('/music/online/album?provider=netease&album=Some%20Album&artist=Someone')
  assert.notEqual(status, 400, 'an empty id must not be rejected for a Chinese platform')
  assert.notEqual(body?.error?.code, 'BAD_PROVIDER')
})

test('album rejects an empty id for navidrome', async () => {
  const { status, body } = await get('/music/online/album?provider=navidrome')
  assert.equal(status, 400)
  assert.equal(body.error.code, 'BAD_REQUEST')
})

test('album resolves a navidrome album by id', async () => {
  await withFetch(
    async () =>
      new Response(
        JSON.stringify(
          subsonic({
            album: { id: 'al1', name: 'Album One', artist: 'A', songCount: 2, song: [{ id: 's1', title: 'T1' }] },
          }),
        ),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    async () => {
      const { status, body } = await get('/music/online/album?provider=navidrome&id=al1')
      assert.equal(status, 200)
      assert.equal(body.name, 'Album One')
      assert.equal(body.songs.length, 1)
    },
  )
})

// ── /online/search: the provider needs the session, not just the cookie ──

test('search reaches a navidrome server (session is passed through)', async () => {
  // Navidrome keeps its server + token in the session. Without that parameter
  // the provider resolves an empty server and every search 502s.
  await withFetch(
    async (url) => {
      assert.match(String(url), /nd\.example\.com/, 'the stubbed server should be queried')
      return new Response(
        JSON.stringify(
          subsonic({
            searchResult3: { song: [{ id: 's1', title: 'Hit', album: 'Al', albumId: 'al1', artist: 'A' }] },
          }),
        ),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    },
    async () => {
      const { status, body } = await get('/music/online/search?provider=navidrome&q=hit')
      assert.equal(status, 200)
      assert.equal(body.results.length, 1)
      assert.equal(body.results[0].albumId, 'al1')
    },
  )
})

// ── /online/info: cached-track metadata for a self-hosted provider ───────

test('info accepts navidrome as a provider', async () => {
  // Before the whitelist was fixed this returned 400, so the player retried on
  // every open for cached Navidrome tracks.
  const { status, body } = await get('/music/online/info?provider=navidrome&id=s1')
  assert.equal(status, 200)
  assert.equal(body.ok, true)
})

// ── /online/lyric: the cache version bump is navidrome-only ─────────────

test('a cached v2 lyric is still served for the Chinese platforms', async () => {
  // Their lyrics were always correct, so an upgrade must not invalidate them —
  // otherwise every existing install refetches its whole lyric cache.
  await cache.writeMeta('netease', 'n1', 'lyric', { lrc: '[00:01.00]kept', translation: '', v: 2 })
  const { status, body } = await get('/music/online/lyric?provider=netease&id=n1')
  assert.equal(status, 200)
  assert.equal(body.cached, true, 'a v2 entry must still hit for netease')
  assert.equal(body.lrc, '[00:01.00]kept')
})

test('a cached v2 navidrome lyric is refetched and rewritten as v3', async () => {
  // A pre-fix build formatted OpenSubsonic's millisecond offsets as seconds, so
  // those entries are wrong and must not be served.
  await cache.writeMeta('navidrome', 's1', 'lyric', { lrc: '[358:50.00]wrong', translation: '', v: 2 })
  await withFetch(
    async () =>
      new Response(
        JSON.stringify(
          subsonic({
            lyricsList: { structuredLyrics: [{ line: [{ start: 12500, value: 'right' }] }] },
          }),
        ),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    async () => {
      const { status, body } = await get('/music/online/lyric?provider=navidrome&id=s1')
      assert.equal(status, 200)
      assert.equal(body.cached, undefined, 'a stale v2 entry must not be served for navidrome')
      assert.equal(body.lrc, '[00:12.50]right', 'the millisecond offset is formatted as seconds')
    },
  )
  const rewritten = await cache.readMeta('navidrome', 's1', 'lyric')
  assert.equal(rewritten.v, 3, 'the refetched lyric is stored under the new version')
})

// ── /online/logout: clears the stored session ────────────────────────────

test('logout accepts navidrome and clears the provider', async () => {
  const res = fakeRes()
  await handle(fakeReq('/music/online/logout', 'POST', { 'content-type': 'application/json' }, '{"provider":"navidrome"}'), res)
  assert.equal(res.status, 200)
  assert.ok(store.cleared.includes('navidrome'), 'the stored session must be cleared')
})

// ── runner ───────────────────────────────────────────────────────────────

let failed = 0
for (const { name, fn } of tests) {
  try {
    await fn()
    console.log('  ok  ' + name)
  } catch (error) {
    failed += 1
    console.error('  FAIL ' + name)
    console.error('       ' + (error && error.message))
  }
}

console.log('')
if (failed > 0) {
  console.error(`navidrome-routes.test.mjs: ${failed} failed`)
  process.exit(1)
}
console.log(`navidrome-routes.test.mjs ok (${tests.length} tests)`)
