/**
 * Unified online-music provider facade.
 *
 * Only two providers still speak through this module:
 *
 * - **Navidrome** (`./navidrome.js`), ported from the MIT-licensed
 *   `kendu76/dsh-music-player` project (see `README.md` in this directory). It
 *   keeps a server URL plus token in the session object instead of a cookie.
 * - **KuGou**, which no longer lives here at all: every `kugou` / `kugouLite`
 *   call is one line of delegation to the ported Folia source
 *   (`./sources/kugou-folia/`) through `kugouFacade`.
 *
 * NetEase Cloud Music and QQ Music are registered as Folia sources of their own
 * (`./sources/netease-folia/`, `./sources/qq-folia/`); they never reach this
 * module on the request path, so their old protocol implementations were retired.
 *
 * @module dsh-music-panel/providers
 */

import * as ND from './navidrome.js'
import { kugouFacade } from './sources/kugou-folia/dispatch.js'

/**
 * Navidrome keeps a server URL + token in the session object instead of a
 * cookie, and there is no QR login. Build the module's config from the stored
 * session so the call sites stay uniform.
 */
function navidromeConfig(session) {
  const s = session !== null && typeof session === 'object' ? session : {}
  return {
    server: String(s.server ?? ''),
    username: String(s.username ?? ''),
    salt: String(s.salt ?? ''),
    token: String(s.token ?? ''),
    // Only present when the user opted into the native complete-library list.
    password: String(s.password ?? ''),
    nativeSongs: s.nativeSongs === true,
  }
}

/**
 * A queue row with the full entity surface the client reads. Navidrome songs
 * already carry these fields; the row is rebuilt so the shape does not depend on
 * which platform produced it.
 */
function shape(provider, song) {
  const durationSec = Number(song.durationSec) || Number(song.interval) || 0
  return {
    provider,
    id: String(song.id ?? ''),
    title: song.title || song.name || '',
    artist: Array.isArray(song.artists) ? song.artists.join(' / ') : String(song.artist || ''),
    album: song.album || '',
    albumId: String(song.albumId || song.album_id || ''),
    durationSec,
    coverUrl: song.cover || song.coverUrl || '',
    qualityHint: '',

    // ── Full entity, so no provider field is silently dropped ────────────
    durationMs: Number(song.durationMs) || durationSec * 1000,
    fee: 0,
    artistsDetail: null,
    albumDetail: null,
    aliases: [],
    translatedNames: [],
    publishTime: 0,
    popularity: 0,
    songType: 0,
    mvId: '',
    isVideo: false,
    copyright: 0,
    resourceState: null,
    noCopyright: null,
    privilegeDetail: null,
    availableQualities: [],
    variant: null,
    fileId: 0,
  }
}

/**
 * @param {'navidrome'|'kugou'|'kugouLite'} provider
 * @param {string} query
 * @param {string} [cookie]
 */
export async function search(provider, query, cookie = '', session = {}) {
  if (provider === 'kugou' || provider === 'kugouLite') return kugouFacade('search', arguments)
  const text = String(query ?? '').trim()
  if (text === '') return []
  if (provider === 'navidrome') return await ND.search(navidromeConfig(session), text)
  throw new Error('未知平台：' + provider)
}

/**
 * Paged search. Navidrome answers one bounded list: there is no next page to
 * ask for, so the UI must not offer one. KuGou pages through its source.
 */
export async function searchPage(provider, query, cookie = '', session = {}, page = 1) {
  if (provider === 'kugou' || provider === 'kugouLite') return kugouFacade('searchPage', arguments)
  const target = Math.max(1, Number(page) || 1)
  if (provider === 'navidrome') {
    const results = await search(provider, query, cookie, session)
    return { results, total: results.length, page: target, hasMore: false }
  }
  throw new Error('未知平台：' + provider)
}

/** Daily recommendations (KuGou only; Navidrome has no recommendation endpoint). */
export async function dailySongs(provider, cookie = '', session = {}) {
  if (provider === 'kugou' || provider === 'kugouLite') return kugouFacade('dailySongs', arguments)
  throw new Error('该平台没有每日推荐')
}

/** Recommended collections (KuGou only). */
export async function recommendedCollections(provider, cookie = '', session = {}, limit = 30) {
  if (provider === 'kugou' || provider === 'kugouLite') return kugouFacade('recommendedCollections', arguments)
  throw new Error('该平台没有推荐歌单')
}

/** Personal FM (KuGou only). */
export async function personalFm(provider, cookie = '', session = {}) {
  if (provider === 'kugou' || provider === 'kugouLite') return kugouFacade('personalFm', arguments)
  throw new Error('该平台没有私人 FM')
}

/** Cloud-drive tracks (KuGou only). */
export async function cloudSongs(provider, cookie = '', session = {}, page = 1) {
  if (provider === 'kugou' || provider === 'kugouLite') return kugouFacade('cloudSongs', arguments)
  throw new Error('该平台没有云盘')
}

/** Daily-history dates (KuGou only). */
export async function historyDates(provider, cookie = '') {
  if (provider === 'kugou' || provider === 'kugouLite') return kugouFacade('historyDates', arguments)
  throw new Error('该平台没有日推历史')
}

/** Daily-history songs for one date (KuGou only). */
export async function historySongs(provider, cookie = '', date = '') {
  if (provider === 'kugou' || provider === 'kugouLite') return kugouFacade('historySongs', arguments)
  throw new Error('该平台没有日推历史')
}

/**
 * Album search for the providers that have a search endpoint for it. Navidrome
 * uses Subsonic search3; KuGou answers through its ported source.
 */
export async function searchAlbums(provider, query, cookie = '', session = {}, page = 1) {
  if (provider === 'kugou' || provider === 'kugouLite') return kugouFacade('searchAlbums', arguments)
  const text = String(query ?? '').trim()
  const target = Math.max(1, Number(page) || 1)
  if (text === '') return { items: [], total: 0, page: target }
  if (provider === 'navidrome') {
    const data = await ND.searchAlbums(navidromeConfig(session), text, {
      count: 30,
      offset: (target - 1) * 30,
    })
    return {
      items: (data.items || []).map((album) => Object.assign(album, { type: 'album' })),
      total: Number(data.total) || 0,
      page: target,
    }
  }
  throw new Error('该平台没有专辑搜索')
}

/** Playlist search (KuGou only; Navidrome has no public playlist search). */
export async function searchPlaylists(provider, query, cookie = '', session = {}, page = 1) {
  if (provider === 'kugou' || provider === 'kugouLite') return kugouFacade('searchPlaylists', arguments)
  throw new Error('该平台没有歌单搜索')
}

/** True when a provider result belongs to the clicked artist. */
function artistMatches(track, artist) {
  const wanted = String(artist ?? '').trim().toLowerCase()
  const actual = String(track && track.artist ? track.artist : '').trim().toLowerCase()
  if (wanted === '' || actual === '') return false
  if (actual === wanted || actual.includes(wanted)) return true
  const actualParts = actual.split(/\s*[\/,&、]\s*/)
  return wanted.split(/\s*[\/,&、]\s*/).some((part) => part !== '' && actualParts.includes(part))
}

/**
 * A page cut out of an already-collected list (a Subsonic search).
 *
 * The caller gets only its own window and learns the real total, so the artist
 * page keeps Folia's page contract.
 */
function artistPageOfSlice(songs, offset, limit) {
  const list = Array.isArray(songs) ? songs : []
  const page = list.slice(offset, offset + limit)
  return {
    songs: page,
    total: list.length,
    hasMore: offset + page.length < list.length,
    nextOffset: offset + page.length,
  }
}

/**
 * One page of an artist's songs, in Folia's page shape.
 *
 * @returns {Promise<{ songs: object[], total: number, hasMore: boolean, nextOffset: number }>}
 */
export async function artistSongs(provider, artist, cookie = '', session = {}, artistId = '', page = {}) {
  if (provider === 'kugou' || provider === 'kugouLite') return kugouFacade('artistSongs', arguments)
  const name = String(artist ?? '').trim()
  const offset = Math.max(0, Number(page.offset) || 0)
  if (name === '') return { songs: [], total: 0, hasMore: false, nextOffset: 0 }
  if (provider === 'navidrome') {
    const songs = await ND.search(navidromeConfig(session), name, { count: 500 })
    return artistPageOfSlice(songs.filter((song) => artistMatches(song, name)), offset, Math.max(1, Number(page.limit) || 200))
  }
  throw new Error('该平台没有歌手页')
}

/**
 * Album songs for one provider. Navidrome addresses an album by id and has no
 * "unknown album" case, so it resolves directly and returns the same shape.
 */
export async function albumSongs(provider, id, cookie = '', session = {}, hint = {}) {
  if (provider === 'kugou' || provider === 'kugouLite') return kugouFacade('albumSongs', arguments)
  if (provider === 'navidrome') {
    const result = await ND.albumSongs(navidromeConfig(session), id)
    return {
      id: String(id || ''),
      name: (result.album && result.album.name) || hint.album || '',
      cover: '',
      coverArtId: (result.album && result.album.coverArtId) || '',
      artist: (result.album && result.album.artist) || hint.artist || '',
      songs: result.songs,
    }
  }
  throw new Error('该平台没有专辑详情')
}

/**
 * Whether a cached search/playlist row is marked as a paid/VIP track.
 *
 * The old NetEase/QQ branches read the raw rows this facade kept for them; those
 * rows are gone with the old implementations (the ported sources normalise their
 * own data and declare `vip` through their own source objects), so only the
 * KuGou delegation still answers from a raw row.
 */
export function requiresVip(provider, id) {
  if (provider === 'kugou' || provider === 'kugouLite') return kugouFacade('requiresVip', arguments)
  return null
}

/**
 * Another name this platform lists the song under (Folia's `getSearchAlias`).
 *
 * Kept as a compatibility shim for the lyric-matching route, which asks
 * `omni.lyricSearchAlias` and reaches this through the KuGou/Navidrome adapter.
 * Neither platform speaks an alias through this module: NetEase and QQ answer
 * from their ported Folia sources' own `lyrics@1` definitions instead.
 *
 * @returns {{ title: string, artist?: string, album?: string } | null}
 */
export function lyricSearchAlias(provider, id) {
  return null
}

/**
 * Another spelling of the artist this platform knows (Folia's
 * `getAlternateArtistName`), same compatibility shim as above.
 *
 * @returns {string | null}
 */
export function alternateArtistName(provider, id) {
  return null
}

/**
 * Resolve a playable URL for one song id (cookies unlock higher quality).
 * @returns {Promise<{ url: string, quality: string }>}
 */
export async function resolveStream(provider, id, cookie = '', session = {}, quality = 'high') {
  if (provider === 'kugou' || provider === 'kugouLite') return kugouFacade('resolveStream', arguments)
  if (provider === 'navidrome') return ND.resolveStream(navidromeConfig(session), id, quality)
  throw new Error('未知平台：' + provider)
}

/**
 * KuGou's legacy play-info fallback, for when the current /song/url answer points
 * at a CDN object that has disappeared (HTTP 404). The ported source keeps it;
 * every other platform has no such fallback and answers null.
 */
export async function resolveLegacyStream(provider, id) {
  if (provider === 'kugou' || provider === 'kugouLite') return kugouFacade('resolveLegacyStream', arguments)
  return null
}

/** Stable KuGou device identity (generated once, then persisted by the caller). */
export function createKugouDevice() {
  return kugouFacade('createKugouDevice', arguments)
}

/**
 * Start a QR login for the platforms that have one.
 * @param {'kugou'|'kugouLite'|'navidrome'} provider
 */
export async function loginStart(provider, session = {}, mode = 'qq') {
  if (provider === 'kugou' || provider === 'kugouLite') return kugouFacade('loginStart', arguments)
  if (provider === 'navidrome') {
    // Navidrome has no QR flow: the user enters a server URL and credentials,
    // which the host stores via POST /online/navidrome/login.
    throw new Error('Navidrome 不支持扫码登录，请填写服务器地址与账号')
  }
  throw new Error('未知平台：' + provider)
}

/** Poll one QR login. On success the caller persists the answer. */
export async function loginStatus(provider, key, mode = 'qq') {
  if (provider === 'kugou' || provider === 'kugouLite') return kugouFacade('loginStatus', arguments)
  if (provider === 'navidrome') {
    throw new Error('Navidrome 不支持扫码登录，请填写服务器地址与账号')
  }
  throw new Error('未知平台：' + provider)
}

/**
 * Chorus window for platforms that expose one. A platform without a chorus
 * endpoint is not an error: the client simply has no hook to offer.
 */
export async function chorus(provider, id, cookie = '') {
  if (provider === 'kugou' || provider === 'kugouLite') return kugouFacade('chorus', arguments)
  return null
}

/**
 * Online lyric. Navidrome reads a sidecar; KuGou answers through its source.
 * Anything else returns an empty lyric rather than throwing, so the player just
 * shows "no lyrics".
 *
 * @returns {Promise<{ lrc: string, translation: string }>}
 */
export async function lyric(provider, id, cookie = '', session = {}) {
  if (provider === 'kugou' || provider === 'kugouLite') return kugouFacade('lyric', arguments)
  try {
    if (provider === 'navidrome') {
      return await ND.lyric(navidromeConfig(session), id)
    }
  } catch {
    return { lrc: '', translation: '' }
  }
  return { lrc: '', translation: '' }
}

/**
 * A browseable song list for one provider.
 *
 * Only Navidrome implements this: the Chinese platforms are search-driven, so
 * they return [] rather than inventing a listing.
 *
 * @returns {Promise<object[]>}
 */
export async function songs(provider, cookie = '', session = {}, size = 200) {
  if (provider === 'kugou' || provider === 'kugouLite') return kugouFacade('songs', arguments)
  if (provider === 'navidrome') return await ND.songs(navidromeConfig(session), size)
  return []
}

/**
 * One page of the complete library via Navidrome's native API.
 *
 * Only used when the user opted in and a password is on file; callers must
 * check `session.nativeSongs` first. Returns { songs, total, offset }.
 */
export async function nativeSongs(provider, session = {}, options = {}) {
  if (provider === 'kugou' || provider === 'kugouLite') return kugouFacade('nativeSongs', arguments)
  if (provider !== 'navidrome') return { songs: [], total: 0, offset: 0 }
  return await ND.nativeSongs(navidromeConfig(session), options)
}

/**
 * Drop cached provider tokens for a logout.
 *
 * Only Navidrome keeps one (the native-API JWT); the others are stateless once
 * their cookie is cleared.
 */
export function forgetProviderTokens(provider) {
  if (provider === 'kugou' || provider === 'kugouLite') return kugouFacade('forgetProviderTokens', arguments)
  if (provider === 'navidrome') ND.forgetAllNativeTokens()
}

/** Every artist. Navidrome only; other providers answer with []. */
export async function artists(provider, cookie = '', session = {}) {
  if (provider === 'kugou' || provider === 'kugouLite') return kugouFacade('artists', arguments)
  if (provider === 'navidrome') return ND.artists(navidromeConfig(session))
  return []
}

/** Albums by name. Navidrome only; other providers answer with []. */
export async function albums(provider, cookie = '', session = {}, size = 200) {
  if (provider === 'kugou' || provider === 'kugouLite') return kugouFacade('albums', arguments)
  if (provider === 'navidrome') return ND.albums(navidromeConfig(session), size)
  return []
}

/** One artist's albums, for expanding an artist card. Navidrome only here. */
export async function artistAlbums(provider, id, cookie = '', session = {}) {
  if (provider === 'kugou' || provider === 'kugouLite') return kugouFacade('artistAlbums', arguments)
  if (provider === 'navidrome') {
    return ND.artistAlbums(navidromeConfig(session), id)
  }
  return { artist: null, albums: [] }
}

function shapePlaylist(item) {
  return {
    provider: item.source || '',
    id: String(item.id || ''),
    name: item.name || '',
    cover: item.cover || '',
    trackCount: Number(item.trackCount) || 0,
    creator: item.creator || '',
    kind: item.kind || 'own',
    isOwned: item.isOwned === true || (item.kind || 'own') !== 'collect',
    isLike: item.isLike === true,
    isDefault: item.isDefault === true || item.isLike === true,
    // Whether「加入歌单」may offer this row: each platform decides with its own
    // mutation rules (Folia's mutations.canAddToPlaylist), so the picker never lists a
    // target the write would refuse. Undefined means the platform declared no rule.
    ...(item.addable === undefined ? {} : { addable: item.addable === true }),
  }
}

/**
 * The signed-in account's playlists (requires a login cookie / session).
 * @returns {Promise<{ provider: string, id: string, name: string, cover: string, trackCount: number, creator: string, kind: string, isDefault: boolean }[]>}
 */
export async function myPlaylists(provider, cookie = '', session = {}) {
  if (provider === 'kugou' || provider === 'kugouLite') return kugouFacade('myPlaylists', arguments)
  if (provider === 'navidrome') {
    return (await ND.myPlaylists(navidromeConfig(session))).map(shapePlaylist)
  }
  throw new Error('未知平台：' + provider)
}

/**
 * One playlist's songs, normalised like search results.
 * @returns {Promise<{ name: string, cover: string, trackCount: number, songs: object[] }>}
 */
export async function playlistSongs(provider, id, cookie = '', session = {}) {
  if (provider === 'kugou' || provider === 'kugouLite') return kugouFacade('playlistSongs', arguments)
  if (provider === 'navidrome') {
    const songs = await ND.playlistSongs(navidromeConfig(session), id)
    return { name: '', cover: '', trackCount: songs.length, songs }
  }
  throw new Error('未知平台：' + provider)
}

function pageBounds(page) {
  return {
    limit: Math.max(1, Math.min(200, parseInt(page?.limit, 10) || 100)),
    offset: Math.max(0, parseInt(page?.offset, 10) || 0),
  }
}

/** One queue song: normalise once so every row has the same shape. */
function shapeQueueSong(provider, song) {
  return shape(provider, song)
}

function shapePlaylistSongs(provider, rows) {
  return (Array.isArray(rows) ? rows : []).map((song) => shapeQueueSong(provider, song))
}

/**
 * One page of a playlist. Folia's catalogue contract is page-shaped; providers
 * with a native paged read return it directly, the rest are adapted from the
 * legacy full read.
 */
export async function playlistSongsPage(provider, id, cookie = '', session = {}, page = {}) {
  if (provider === 'kugou' || provider === 'kugouLite') return kugouFacade('playlistSongsPage', arguments)
  const { limit, offset } = pageBounds(page)
  if (provider === 'navidrome') {
    const result = await ND.playlistSongsPage(navidromeConfig(session), id, limit, offset)
    return {
      name: result.name || '',
      cover: result.cover || '',
      trackCount: Number(result.trackCount) || 0,
      songs: shapePlaylistSongs(provider, result.songs),
      hasMore: result.hasMore === true,
      nextOffset: Number(result.nextOffset) || offset,
    }
  }
  const full = await playlistSongs(provider, id, cookie, session)
  const songs = full.songs.slice(offset, offset + limit)
  return {
    name: full.name || '',
    cover: full.cover || '',
    trackCount: full.trackCount || full.songs.length,
    songs,
    hasMore: offset + songs.length < full.songs.length,
    nextOffset: offset + songs.length,
  }
}

// =====================================================================
// Cloud writes: like one song / add it to one of the account's playlists.
// These reuse the provider modules' verified write endpoints, so the Host
// routes only pass provider + id.
// =====================================================================

export async function onlineLiked(provider, id, cookie = '', session = {}) {
  if (provider === 'kugou' || provider === 'kugouLite') return kugouFacade('onlineLiked', arguments)
  const target = String(id || '')
  if (target === '') return false
  if (provider === 'navidrome') {
    // Subsonic has no per-song status call; the starred list is the source of
    // truth. The player bar asks once per track, so one extra request is fine.
    const starred = await ND.starredIds(navidromeConfig(session))
    return starred.includes(target)
  }
  return false
}

export async function setOnlineLiked(provider, song, on, cookie = '', session = {}) {
  if (provider === 'kugou' || provider === 'kugouLite') return kugouFacade('setOnlineLiked', arguments)
  const id = String((song && song.id) || '')
  if (id === '') throw new Error('缺少歌曲 id')
  if (provider === 'navidrome') return ND.setStarred(navidromeConfig(session), id, on === true)
  throw new Error('该平台不支持喜欢写入')
}

export async function addOnlineSongToPlaylist(provider, song, playlistId, cookie = '', session = {}) {
  if (provider === 'kugou' || provider === 'kugouLite') return kugouFacade('addOnlineSongToPlaylist', arguments)
  const id = String((song && song.id) || '')
  if (id === '') throw new Error('缺少歌曲 id')
  if (provider === 'navidrome') return ND.addSongToPlaylist(navidromeConfig(session), playlistId, id)
  throw new Error('该平台不支持加入歌单')
}

/** All liked track keys for one provider, shaped like client track.path. */
export async function onlineLikedIds(provider, cookie = '', session = {}) {
  if (provider === 'kugou' || provider === 'kugouLite') return kugouFacade('onlineLikedIds', arguments)
  // Navidrome has no "liked" playlist: favorites are the starred set itself.
  if (provider === 'navidrome') {
    const starred = await ND.starredIds(navidromeConfig(session))
    return starred.map((songId) => 'online:navidrome:' + songId)
  }
  return []
}

/**
 * One account's listening ranking, newest first (KuGou only through this facade;
 * NetEase and QQ answer from their ported sources).
 *
 * @param {'kugou'|'kugouLite'} provider
 * @param {'week'|'all'} range
 * @returns {Promise<object[]>}
 */
export async function listeningRank(provider, range, cookie = '', session = {}) {
  if (provider === 'kugou' || provider === 'kugouLite') return kugouFacade('listeningRank', arguments)
  throw new Error('该平台没有听歌排行')
}

/** Remove one song from an owned playlist; each platform has its own write route. */
export async function removeOnlineSongFromPlaylist(provider, song, playlistId, cookie = '', session = {}) {
  if (provider === 'kugou' || provider === 'kugouLite') return kugouFacade('removeOnlineSongFromPlaylist', arguments)
  throw new Error('该平台不支持从歌单移除歌曲')
}

/** Folia's collection subscription status (KuGou through this facade). */
export async function subscriptionStatus(provider, type, id, cookie = '') {
  if (provider === 'kugou' || provider === 'kugouLite') return kugouFacade('subscriptionStatus', arguments)
  return false
}

/** Subscribe/unsubscribe an album or playlist. */
export async function subscribeCollection(provider, type, id, subscribed, cookie = '') {
  if (provider === 'kugou' || provider === 'kugouLite') return kugouFacade('subscribeCollection', arguments)
  throw new Error('该平台不支持订阅')
}

export async function providerVip(provider, cookie = '', session = {}) {
  if (provider === 'kugou' || provider === 'kugouLite') return kugouFacade('providerVip', arguments)
  if (provider === 'navidrome') {
    // A self-hosted library has no paid tier: everything the account can see
    // is playable, so there is nothing to gate.
    return false
  }
  return null
}

/** VIP flag plus the best available expiry string ('' when the platform does not expose it). */
export async function providerVipInfo(provider, cookie = '', session = {}) {
  if (provider === 'kugou' || provider === 'kugouLite') return kugouFacade('providerVipInfo', arguments)
  return { vip: false, expiresAt: '' }
}

/** Public account profile for settings (nickname + avatar URL; never cookies). */
export async function providerProfile(provider, cookie = '', session = {}) {
  if (provider === 'kugou' || provider === 'kugouLite') return kugouFacade('providerProfile', arguments)
  if (provider === 'navidrome') {
    const cfg = navidromeConfig(session)
    return cfg.username === '' ? null : { nickname: cfg.username, avatarUrl: '' }
  }
  return null
}
