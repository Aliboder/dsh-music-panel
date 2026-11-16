/**
 * Bodian source tests: pure mapping + gated live verification.
 * Live block: DSH_MUSIC_UPSTREAM=1
 */

import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRegistry } from '../../src/host/providers/sources/registry.js'
import { createOmni } from '../../src/host/providers/sources/omni.js'
import { createBodianSource, createMemorySessions, toTrack } from '../../src/host/providers/sources/bodian/index.js'
import { ensureDeviceId } from '../../src/host/providers/sources/bodian/device.js'
import { mergeTranslation, parseLrc } from '../../src/host/providers/sources/lrc.js'

const require = createRequire(import.meta.url)

// ── pure ────────────────────────────────────────────────────────────────────

const track = toTrack({
  id: 228908,
  name: '晴天',
  artist: '周杰伦',
  album: '叶惠美',
  albumPic: 'https://img/cover.jpg',
  duration: 269,
  albumId: 1293,
  artistId: 336,
})
assert.equal(track.id, '228908')
assert.equal(track.title, '晴天')
assert.equal(track.artist, '周杰伦')
assert.equal(track.album, '叶惠美')
assert.equal(track.durationMs, 269000)
assert.deepEqual(track.sourceRef, { kind: 'online', sourceId: 'bodian', ref: '228908' })

// Fallbacks: a row without `name` uses songName, and no id means "not a track".
assert.equal(toTrack({ id: 1, songName: 'B' }).title, 'B')
assert.equal(toTrack({ id: 2, artists: [{ name: 'X' }, { name: 'Y' }] }).artist, 'X / Y')
assert.equal(toTrack({ name: 'no id' }), null)
assert.equal(toTrack(null), null)

const lrc = parseLrc('[ti:x]\n[00:01.50]hello\n[00:02.500][00:03]twice')
assert.deepEqual(lrc, [
  { timeMs: 1500, text: 'hello' },
  { timeMs: 2500, text: 'twice' },
  { timeMs: 3000, text: 'twice' },
])
assert.deepEqual(mergeTranslation(lrc, [{ timeMs: 1500, text: '你好' }]), [
  { timeMs: 1500, text: 'hello', translation: '你好' },
  { timeMs: 2500, text: 'twice' },
  { timeMs: 3000, text: 'twice' },
])

// The session repository is just get/set/clear.
const sessions = createMemorySessions()
assert.equal(sessions.get(), null)
sessions.set({ token: 't' })
assert.deepEqual(sessions.get(), { token: 't' })
sessions.clear()
assert.equal(sessions.get(), null)

// A failing upstream result becomes a MusicError, and the adapter declares its
// capabilities rather than being probed at runtime.
const failing = createBodianSource({
  deviceId: 'a'.repeat(32),
  sessions: createMemorySessions(),
  createApi: () => ({
    request: async () => ({ ok: false, error: { code: 'network', message: 'down' } }),
  }),
})
assert.equal(failing.id, 'bodian')
assert.equal(failing.capabilities.search, true)
assert.equal(failing.capabilities.loginQr, true, 'sign-in is advertised once its session persists')
await assert.rejects(() => failing.search('x', 1, {}), (error) => error.code === 'network' && error.sourceId === 'bodian')

// Empty query is answered locally, without a request.
let called = 0
const lazy = createBodianSource({
  deviceId: 'a'.repeat(32),
  sessions: createMemorySessions(),
  createApi: () => ({ request: async () => { called += 1; return { ok: true, data: {} } } }),
})
assert.deepEqual(await lazy.search('   ', 1, {}), { songs: [], total: 0, page: 1 })
assert.equal(called, 0)

// The account profile is read from the injected session, not from a second store.
{
  const profiled = createBodianSource({
    deviceId: 'a'.repeat(32),
    sessions: createMemorySessions(),
    createApi: () => ({ request: async () => ({ ok: true, data: { user: { id: 'u1', nickname: 'Bodian User', avatarUrl: 'https://a' } } }) }),
  })
  assert.deepEqual(await profiled.profile(), { id: 'u1', nickname: 'Bodian User', avatarUrl: 'https://a' })
}

// Registry + omni route to it like any other source.
{
  const registry = createRegistry()
  const source = createBodianSource({
    deviceId: 'a'.repeat(32),
    sessions: createMemorySessions(),
    createApi: () => ({ request: async () => ({ ok: true, data: { resultList: [{ id: 7, name: 'X' }] } }) }),
  })
  registry.register(source)
  const omni = createOmni(registry)
  const result = await omni.search('bodian', 'x', {})
  assert.equal(result.songs[0].id, '7')
  assert.equal(omni.requiresVip('bodian', '7'), false)
}

// Device ids persist and stay stable.
{
  const dir = await mkdtemp(join(tmpdir(), 'dsh-music-bodian-'))
  const first = ensureDeviceId(dir)
  const second = ensureDeviceId(dir)
  assert.match(first, /^[a-f0-9]{32}$/)
  assert.equal(second, first, 'the device id must survive a restart')
}

// ── live (opt-in) ───────────────────────────────────────────────────────────

if (process.env.DSH_MUSIC_UPSTREAM === '1') {
  const { createBodianApi } = require('bodian-music-api')
  const dir = await mkdtemp(join(tmpdir(), 'dsh-music-bodian-live-'))
  const source = createBodianSource({
    createApi: createBodianApi,
    deviceId: ensureDeviceId(dir),
    sessions: createMemorySessions(),
  })

  const found = await source.search('晴天', 1, {})
  assert.ok(found.songs.length > 0, 'search must return at least one track')
  const first = found.songs[0]
  assert.ok(first.id !== '')

  const lyrics = await source.getLyrics(first.id, {})
  assert.ok(lyrics.lines.length > 0, 'lyrics must parse into timed lines')

  const audio = await source.getAudioSource(first.id, {}, 'high')
  assert.ok(typeof audio.url === 'string' && audio.url.startsWith('http'), 'audio must be an absolute URL')
  assert.equal(typeof audio.preview, 'boolean')

  console.log('bodian.test.mjs ok (live)')
} else {
  console.log('bodian.test.mjs ok (pure only)')
}

// ── session persistence ─────────────────────────────────────────────────────

{
  const { createBodianSessions } = await import('../../src/host/providers/sources/bodian/sessions.js')

  const saved = []
  const cleared = []
  const store = {
    get: async () => ({ credentials: { token: 'stored' } }),
    save: async (id, value) => saved.push([id, value]),
    clear: async (id) => cleared.push(id),
  }

  const sessions = createBodianSessions({ store })
  assert.equal(sessions.get(), null, 'nothing is loaded before hydrate')

  assert.deepEqual(await sessions.hydrate(), { token: 'stored' })
  assert.deepEqual(sessions.get(), { token: 'stored' })

  sessions.set({ token: 'new' })
  assert.deepEqual(sessions.get(), { token: 'new' }, 'writes are visible immediately')
  await sessions.flush()
  assert.deepEqual(saved, [['bodian', { token: 'new' }]])

  sessions.clear()
  assert.equal(sessions.get(), null)
  await sessions.flush()
  assert.deepEqual(cleared, ['bodian'])

  // Without a store it still works in memory and never throws.
  const memoryOnly = createBodianSessions()
  memoryOnly.set({ token: 'x' })
  assert.deepEqual(memoryOnly.get(), { token: 'x' })
  await memoryOnly.flush()

  // A failing store must not break the caller.
  const broken = createBodianSessions({
    store: { get: async () => { throw new Error('bad') }, save: async () => { throw new Error('bad') }, clear: async () => {} },
  })
  assert.equal(await broken.hydrate(), null)
  broken.set({ token: 'y' })
  await broken.flush()
  assert.deepEqual(broken.get(), { token: 'y' })
}
