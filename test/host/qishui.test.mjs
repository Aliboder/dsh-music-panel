/**
 * Qishui source tests: pure mapping and the protocol adapter, with a fake
 * qishui-music-api. No network, no real account.
 */

import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createQishuiSource, toCollection, toTrack } from '../../src/host/providers/sources/qishui/index.js'
import { registerQishuiSource, resetSources } from '../../src/host/providers/sources/index.js'

const rawSong = {
  base_info: { id: '123', name: '晴天', duration_ms: 269000 },
  related_info: {
    album_link: { id: 'a1', name: '叶惠美' },
    artist_links: [{ id: 'ar1', name: '周杰伦' }],
  },
  display_info: { cover_url: 'https://img.example/cover.jpg' },
}

const track = toTrack(rawSong)
assert.equal(track.id, '123')
assert.equal(track.title, '晴天')
assert.equal(track.artist, '周杰伦')
assert.equal(track.album, '叶惠美')
assert.equal(track.albumId, 'a1')
assert.equal(track.durationMs, 269000)
assert.equal(track.durationSec, 269, 'the client reads durationSec, not the millisecond field')
assert.equal(track.qualityHint, '')
assert.equal(track.coverUrl, 'https://img.example/cover.jpg')
assert.deepEqual(track.sourceRef, { kind: 'online', sourceId: 'qishui', ref: '123' })
assert.equal(track.provider, 'qishui', 'the row names its provider for the client')
assert.equal(toTrack({ base_info: { id: 'bad' } }), null)

// The car payload marks membership songs with a commerce icon/condition.
const vip = toTrack({
  base_info: { id: '456', name: '会员歌', duration_ms: 200000 },
  commerce_info: { icon_info: { type: 'svip' }, playable_condition: "membership_type == 'svip'" },
})
assert.equal(vip.qualityHint, 'VIP')
assert.equal(vip.durationSec, 200)

const collection = toCollection({
  base_info: { id: 'p1', title: '我的歌单' },
  display_info: { url_cover: 'https://img.example/p.jpg' },
  resource_cnt: { track_cnt: 12 },
  relation_info: { owner: { id: 'u1', nickname: '我' } },
})
assert.equal(collection.id, 'p1')
assert.equal(collection.name, '我的歌单')
assert.equal(collection.trackCount, 12)
assert.equal(collection.creator.nickname, '我')

// ── protocol adapter ───────────────────────────────────────────────────────

let current = {
  deviceId: 'device',
  userId: 'u1',
  user: { id: 'u1', nickname: '汽水用户', avatar: 'https://img.example/a.jpg' },
  ticket: 'ticket',
}
let cancelled = 0
let loggedOut = 0
const sessions = {
  deviceId: 'device',
  get revision() {
    return 0
  },
  get: () => current,
  whenReady: async () => {},
  set: (next) => {
    current = next
  },
  clear: () => {
    current = null
  },
}

const api = {
  async request(operation, params) {
    switch (operation) {
      case 'login_qr_key':
        return { ok: true, data: { key: 'qr-key' } }
      case 'login_qr_create':
        return { ok: true, data: { imageUrl: 'data:image/png;base64,x' } }
      case 'login_qr_check':
        if (params.key === 'refused-key') {
          return { ok: true, data: { state: 'error', failure: { case: 'refused' } } }
        }
        return { ok: true, data: { state: 'confirmed' } }
      case 'login_qr_cancel':
        cancelled += 1
        return { ok: true, data: {} }
      case 'logout':
        loggedOut += 1
        return { ok: true, data: {} }
      case 'search':
        return { ok: true, data: { items: [rawSong], hasMore: false, total: 1 } }
      case 'artist_songs':
        return { ok: true, data: { items: [rawSong], total: 1, hasMore: false } }
      case 'audio':
        return { ok: true, data: { url: 'https://audio.example/a.mp3', quality: 'standard', preview: false } }
      case 'lyrics':
        return {
          ok: true,
          data: {
            lyric_entity: { type: 'lrc', content: '[00:01.00]hello\n[00:02.00]world' },
            lang_translations: { 'zh-CN': { type: 'lrc', content: '[00:01.00]你好\n[00:02.00]世界' } },
          },
        }
      case 'liked_songs':
        return { ok: true, data: { ids: ['123'], whole: true } }
      case 'user_playlists':
        return {
          ok: true,
          data: { items: [{ base_info: { id: 'p1', title: '我的歌单' }, resource_cnt: { track_cnt: 1 } }], hasMore: false },
        }
      case 'playlist_tracks':
        return { ok: true, data: { items: [rawSong], hasMore: false } }
      default:
        return { ok: true, data: {} }
    }
  },
}

const source = createQishuiSource({
  createApi: () => api,
  deviceId: 'device',
  sessions,
})

const started = await source.loginStart()
assert.equal(started.key, 'qr-key')
assert.equal(started.imageDataUrl, 'data:image/png;base64,x')
assert.ok(started.expiresAt > Date.now())

const confirmed = await source.loginStatus('qr-key')
assert.equal(confirmed.status, 'success')
assert.equal(confirmed.user.nickname, '汽水用户')

// A refused scan carries the platform's case, so the window can say why.
const refused = await source.loginStatus('refused-key')
assert.equal(refused.status, 'failed')
assert.equal(refused.case, 'refused')
assert.deepEqual(await source.profile(), { id: 'u1', nickname: '汽水用户', avatarUrl: 'https://img.example/a.jpg' })

const page = await source.searchPage('晴天', {}, 1)
assert.equal(page.results[0].id, '123')

const artistSongs = await source.artistSongs('周杰伦', { artistId: 'ar1', page: { limit: 10, offset: 0 } })
assert.equal(artistSongs[0].id, '123', 'the artist page passes the id through ctx.artistId')

// Rows restored from history may carry only the singer's name; resolve it by search.
const byName = await source.artistSongs('周杰伦', {})
assert.equal(byName[0].id, '123', 'a missing artistId is resolved through the provider search')
assert.equal(page.hasMore, false)

const audio = await source.stream('123')
assert.equal(audio.url, 'https://audio.example/a.mp3')
assert.equal(audio.preview, false)

const lyric = await source.lyric('123')
assert.ok(lyric.lrc.includes('[00:01.00]hello'))
assert.ok(lyric.translation.includes('你好'))
assert.equal(lyric.wordLevel, false)

const playlists = await source.myPlaylists()
assert.equal(playlists[0].id, 'p1')
const songs = await source.playlistSongs('p1')
assert.equal(songs.songs[0].id, '123')
assert.deepEqual(await source.likedIds(), ['online:qishui:123'])
assert.equal(await source.liked('123'), true)
assert.equal(await source.setLiked({ id: '123' }, true), true)

await source.cancelLogin('qr-key')
assert.equal(cancelled, 1)
await source.logout()
assert.equal(loggedOut, 1)
assert.equal(current, null)

// The optional package is present in this repo; registration must not throw and
// must expose the platform like any other source.
{
  const dir = await mkdtemp(join(tmpdir(), 'dsh-music-qishui-'))
  const saved = []
  const registered = registerQishuiSource({
    dir,
    store: {
      get: async () => null,
      save: async (id, credentials, user) => saved.push([id, credentials, user]),
      clear: async () => {},
    },
  })
  assert.ok(registered !== null)
  assert.equal(registered.id, 'qishui')
  assert.equal(registered.capabilities.loginQr, true)
  assert.equal(registered.capabilities.playback, true)
  resetSources()
}

console.log('qishui.test.mjs ok')
