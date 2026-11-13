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

const store = makeStore()
const handle = createRoutes({ settings, library, providerStore: store })

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
