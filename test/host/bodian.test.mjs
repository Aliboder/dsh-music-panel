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
assert.equal(track.durationSec, 269, 'the client reads durationSec')
assert.equal(track.albumId, '1293')
assert.deepEqual(track.sourceRef, { kind: 'online', sourceId: 'bodian', ref: '228908' })
assert.equal(track.provider, 'bodian', 'the row names its provider for the client')

// Fallbacks: a row without `name` uses songName, and no id means "not a track".
assert.equal(toTrack({ id: 1, songName: 'B' }).title, 'B')
assert.equal(toTrack({ id: 2, artists: [{ name: 'X' }, { name: 'Y' }] }).artist, 'X / Y')
assert.equal(toTrack({ name: 'no id' }), null)
assert.equal(toTrack(null), null)

// payInfo.feeType.vip marks membership-only tracks; the row badge follows it.
const vipRow = toTrack({ id: 3, name: '会员歌', payInfo: { feeType: { song: '1', vip: '1' } } })
assert.equal(vipRow.qualityHint, 'VIP')

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

// ── catalogue pages ─────────────────────────────────────────────────────────
//
// Folia's bodianCatalog: album_tracks/album_detail, artist_songs and artist_albums.
// The album and artist pages were failing because the source never declared or
// implemented them.

{
  const source = createBodianSource({
    deviceId: 'a'.repeat(32),
    sessions: createMemorySessions(),
    createApi: () => ({
      request: async (operation) => {
        switch (operation) {
          case 'album_tracks':
            return { ok: true, data: { resultList: [{ id: 11, name: '轨一', artist: 'X', album: '专辑', albumId: 9, duration: 100 }], total: 1 } }
          case 'album_detail':
            return { ok: true, data: { albumInfo: { albumId: 9, name: '专辑', artist: 'X', pic: 'https://img.kuwo.cn/a.jpg' } } }
          case 'artist_songs':
            return { ok: true, data: { resultList: [{ id: 12, name: '歌二', artist: 'X', duration: 120 }], total: 1 } }
          case 'artist_albums':
            return { ok: true, data: { resultList: [{ albumId: 9, name: '专辑', pic: 'https://img.kuwo.cn/a.jpg', songNum: 1 }], total: 1 } }
          case 'artist_detail':
            return { ok: true, data: { artistInfo: { id: 5, name: 'X', pic: 'https://img.kuwo.cn/x.jpg' } } }
          case 'search':
            return { ok: true, data: { resultList: [{ id: 12, name: '歌二', artist: 'X', artistId: 5, artists: [{ id: 5, name: 'X' }], duration: 120 }], total: 1 } }
          default:
            return { ok: true, data: {} }
        }
      },
    }),
  })
  assert.equal(source.capabilities.albums, true, 'the album page is offered')
  assert.equal(source.capabilities.artists, true, 'the artist page is offered')
  const album = await source.albumSongs('9', {}, {})
  assert.equal(album.name, '专辑')
  assert.equal(album.artist, 'X')
  assert.equal(album.cover, 'https://img.kuwo.cn/a.jpg')
  assert.equal(album.songs[0].durationSec, 100)
  const songs = await source.artistSongs('X', { artistId: '5', page: { limit: 10, offset: 0 } })
  assert.equal(songs[0].id, '12')
  assert.equal(songs[0].durationSec, 120)
  // A name-only entry resolves the singer through search (restored queues lack the id).
  const byName = await source.artistSongs('X', {})
  assert.equal(byName[0].id, '12')
  const albums = await source.artistAlbums('5')
  assert.equal(albums.albums[0].id, '9')
  assert.equal(albums.albums[0].name, '专辑')
  assert.equal(albums.albums[0].cover, 'https://img.kuwo.cn/a.jpg', 'album cards read `cover`')
  assert.equal(albums.artist.name, 'X', 'the artist header comes from artist_detail')
  assert.equal(albums.artist.cover, 'https://img.kuwo.cn/x.jpg')
}

// The playback context from the row (`freeSign`) reaches the audio operation, and the
// quality option is honoured; without it Bodian answers "additional rights required".
{
  const calls = []
  const source = createBodianSource({
    deviceId: 'a'.repeat(32),
    sessions: createMemorySessions(),
    createApi: () => ({
      request: async (operation, params) => {
        calls.push([operation, params])
        if (operation === 'audio') return { ok: true, data: { url: 'https://audio.kuwo.cn/a.mp3', quality: params.quality } }
        return { ok: true, data: {} }
      },
    }),
  })
  const playable = toTrack({ id: 77, name: '歌', album: '专辑', albumPic: 'http://img1.kuwo.cn/a.jpg', duration: 10, freeSign: 'sign-1' })
  assert.equal(playable.providerData.freeSign, 'sign-1')
  const stream = await source.getAudioSource('77', {}, 'lossless')
  assert.equal(stream.url, 'https://audio.kuwo.cn/a.mp3')
  const audio = calls.find(([operation]) => operation === 'audio')
  assert.equal(audio[1].freeSign, 'sign-1')
  assert.equal(audio[1].quality, 'lossless')
  assert.equal(playable.coverUrl, 'https://img1.kuwo.cn/a.jpg', 'kuwo http artwork is upgraded to https')
}

// Sign-out is complete: the stored session is cleared, and the route's optional
// `forgetTokens` call has an implementation (a missing one crashed the Host).
{
  const repository = createMemorySessions({ uid: 'u1', token: 't' })
  const source = createBodianSource({
    deviceId: 'a'.repeat(32),
    sessions: repository,
    createApi: () => ({ request: async () => ({ ok: true, data: {} }) }),
  })
  assert.equal(typeof source.forgetTokens, 'function')
  await source.forgetTokens()
  assert.equal(repository.get(), null, 'sign-out drops the session')
}

// `login_status` returns the user itself; a refresh must keep the avatar instead of
// reading only a nested `user` field that the package does not send.
{
  const source = createBodianSource({
    deviceId: 'a'.repeat(32),
    sessions: createMemorySessions({ uid: '1', token: 't', user: { id: '1', nickname: 'N' } }),
    createApi: () => ({
      request: async (operation) => {
        if (operation === 'login_status') {
          return { ok: true, data: { id: 1, nickname: 'N', avatarUrl: 'https://img.example/a.jpg' } }
        }
        return { ok: true, data: {} }
      },
    }),
  })
  const user = await source.auth.readUser()
  assert.equal(user.id, '1')
  assert.equal(user.nickname, 'N')
  assert.equal(user.avatarUrl, 'https://img.example/a.jpg')
}

// ── QR sign-in ──────────────────────────────────────────────────────────────
//
// Bodian's package answers `confirmed` on a successful scan (it has already written the
// session into the repository). Treating that as an unknown status made a scanned code
// look like a refusal, which is what the login window used to show.

{
  const repository = createMemorySessions()
  const api = {
    request: async (operation, params) => {
      switch (operation) {
        case 'login_qr_key':
          return { ok: true, data: { key: 'qr-1' } }
        case 'login_qr_create':
          return { ok: true, data: { imageUrl: 'data:image/png;base64,x' } }
        case 'login_qr_check':
          repository.set({ uid: 'u1', token: 'token', user: { id: 'u1', nickname: '波点用户' } })
          return { ok: true, data: { state: 'confirmed' } }
        case 'login_qr_cancel':
          return { ok: true, data: {} }
        default:
          return { ok: true, data: {} }
      }
    },
  }
  const source = createBodianSource({ deviceId: 'a'.repeat(32), sessions: repository, createApi: () => api })
  const started = await source.auth.startLogin()
  assert.equal(started.key, 'qr-1')
  assert.ok(started.expiresAt > Date.now() + 4 * 60 * 1000, 'the QR lives five minutes, as in the package')
  const result = await source.auth.checkLogin('qr-1')
  assert.equal(result.status, 'success', 'confirmed is the successful scan')
  assert.equal(result.session.uid, 'u1')
  assert.equal(result.session.token, 'token')
  assert.equal(result.user.nickname, '波点用户')
}

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
