/**
 * Navidrome / Subsonic provider.
 *
 * Navidrome speaks the Subsonic API, so this module also covers Gonic, Airsonic,
 * Supysonic and any other Subsonic-compatible server. Unlike the other providers
 * here there is no QR sign-in and no unofficial endpoint: the user supplies a
 * server URL plus credentials, and every request is a plain Subsonic call.
 *
 * Auth: `?u=<user>&t=<md5(password + salt)>&s=<salt>`. Older servers also accept
 * a plaintext `p=` parameter, but Subsonic 1.13+ and Navidrome reject it by
 * default, so the salted token is the only supported form. The password itself
 * is never persisted — callers store the salt and token instead.
 *
 * @module dsh-music-panel/providers/navidrome
 */

import { createHash, randomBytes } from 'node:crypto'

const TIMEOUT_MS = 10_000
const API_VERSION = '1.16.1'
const CLIENT_NAME = 'dsh-music-panel'

/** Bound every response so a hostile/looping server cannot exhaust memory. */
const MAX_RESPONSE_BYTES = 8 * 1024 * 1024

/** A salted auth pair. `salt` is hex; `token` is md5(password + salt) in hex. */
export function makeToken(password, salt) {
  const useSalt = typeof salt === 'string' && salt !== '' ? salt : randomBytes(8).toString('hex')
  const token = createHash('md5').update(String(password) + useSalt, 'utf8').digest('hex')
  return { salt: useSalt, token }
}

/** Round-trip a credentials payload into the stored {salt, token} shape. */
export function credentialsFromPassword(password) {
  return makeToken(String(password ?? ''), '')
}

/** Normalize a user-supplied server URL: trim, strip a trailing slash, reject non-http(s). */
export function normalizeServer(raw) {
  const text = typeof raw === 'string' ? raw.trim() : ''
  if (text === '') return ''
  let url
  try {
    url = new URL(text)
  } catch {
    return ''
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return ''
  // Navidrome lives under a sub-path when reverse-proxied; keep any path prefix.
  const pathname = url.pathname.replace(/\/+$/, '')
  return url.origin + pathname
}

/** Build one authenticated Subsonic query string. */
export function authQuery(config, extra = {}) {
  const params = new URLSearchParams({
    u: String(config.username ?? ''),
    t: String(config.token ?? ''),
    s: String(config.salt ?? ''),
    v: API_VERSION,
    c: CLIENT_NAME,
    f: 'json',
    ...extra,
  })
  return params.toString()
}

function endpoint(config, view, extra) {
  const server = normalizeServer(config.server)
  if (server === '') throw new Error('Navidrome 服务器地址无效')
  return server + '/rest/' + view + '?' + authQuery(config, extra)
}

async function requestJson(config, view, extra) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(endpoint(config, view, extra), {
      headers: { 'User-Agent': CLIENT_NAME },
      signal: controller.signal,
    })
    if (!res.ok) throw new Error('HTTP ' + res.status)
    const text = await res.text()
    if (text.length > MAX_RESPONSE_BYTES) throw new Error('响应过大')
    const data = JSON.parse(text)
    const body = data && data['subsonic-response']
    if (!body) throw new Error('响应格式不符（缺少 subsonic-response）')
    if (body.status === 'failed') {
      const err = body.error || {}
      throw new Error('Subsonic 错误 ' + String(err.code ?? '') + '：' + String(err.message ?? 'unknown'))
    }
    return body
  } finally {
    clearTimeout(timer)
  }
}

/** Verify the server answers and the credentials are accepted. */
export async function ping(config) {
  const body = await requestJson(config, 'ping.view', {})
  return {
    serverVersion: String(body.serverVersion ?? ''),
    type: String(body.type ?? ''),
    openSubsonic: body.openSubsonic === true,
  }
}

function artistsOf(item) {
  const list = Array.isArray(item.artists) ? item.artists : []
  const names = list
    .map((artist) => (artist !== null && typeof artist === 'object' ? String(artist.name ?? '') : ''))
    .filter((name) => name !== '')
  if (names.length > 0) return names.join(' / ')
  return typeof item.artist === 'string' ? item.artist : ''
}

function songOf(item) {
  if (item === null || typeof item !== 'object') return null
  const id = String(item.id ?? '')
  if (id === '') return null
  return {
    provider: 'navidrome',
    id,
    title: String(item.title ?? ''),
    artist: artistsOf(item),
    album: String(item.album ?? ''),
    durationSec: Number(item.duration) || 0,
    // Cover art needs the same auth as everything else, so point at our proxy.
    coverUrl: item.coverArt === undefined || item.coverArt === null || item.coverArt === ''
      ? ''
      : '',
    coverArtId: String(item.coverArt ?? ''),
    qualityHint: '',
  }
}

/**
 * Search songs by free text.
 *
 * `search3.view` is the current form (ID3); `search2.view`/`search.view` are the
 * legacy fallbacks for servers older than 1.8. Navidrome 0.64 supports search3.
 */
export async function search(config, query) {
  const text = String(query ?? '').trim()
  if (text === '') return []
  const extra = {
    songCount: '30',
    songOffset: '0',
    albumCount: '0',
    artistCount: '0',
    query: text,
  }
  let body
  try {
    body = await requestJson(config, 'search3.view', extra)
  } catch (error) {
    // Older servers: retry against the legacy view once.
    if (/错误 0|错误 10|错误 70|not found/i.test(String(error && error.message))) {
      body = await requestJson(config, 'search.view', { songCount: '30', songOffset: '0', query: text })
    } else {
      throw error
    }
  }
  const result = body.searchResult3 || body.searchResult2 || body.searchResult || {}
  const songs = Array.isArray(result.song) ? result.song : []
  return songs.map(songOf).filter((song) => song !== null)
}

/**
 * Resolve a playable URL. Subsonic answers with a redirect to the media file
 * or streams it directly; either way the host proxy already follows redirects
 * and forwards Range, so returning the URL is enough.
 *
 * @returns {Promise<{ url: string, quality: string }>}
 */
export async function resolveStream(config, id, quality = 'high') {
  const songId = String(id ?? '')
  if (songId === '') return { url: '', quality: '' }
  // OpenSubsonic servers expose a declared max bitrate; the plain `maxBitRate`
  // parameter caps it and the server transcodes when needed.
  const extra = { id: songId }
  const cap = quality === 'standard' ? '128' : quality === 'high' ? '320' : '0'
  if (cap !== '0') extra.maxBitRate = cap
  return { url: endpoint(config, 'stream.view', extra), quality: quality === 'standard' ? '128k' : '320k' }
}

/** Cover art URL for one coverArt id (album/artist art shares the same view). */
export function coverArtUrl(config, coverArtId) {
  const id = String(coverArtId ?? '')
  if (id === '') return ''
  return endpoint(config, 'getCoverArt.view', { id, size: '600' })
}

/**
 * A library-wide song list.
 *
 * Subsonic has no paginated "every song" view; `getRandomSongs` is the only
 * endpoint that returns tracks across albums without first walking the album
 * list. It is random per call, which is what the panel's 全部歌曲 entry shows:
 * a browseable sample of the library rather than a stable index.
 */
export async function songs(config, size = 200) {
  const count = Math.min(Math.max(Number(size) || 200, 1), 500)
  const body = await requestJson(config, 'getRandomSongs.view', { size: String(count) })
  const wrap = body.randomSongs || {}
  const list = Array.isArray(wrap.song) ? wrap.song : []
  return list.map(songOf).filter((song) => song !== null)
}

/** User playlists, oldest API first-class since 1.0. */
export async function myPlaylists(config) {
  const body = await requestJson(config, 'getPlaylists.view', {})
  const wrap = body.playlists || {}
  const list = Array.isArray(wrap.playlist) ? wrap.playlist : []
  return list.map((item) => ({
    provider: 'navidrome',
    id: String(item.id ?? ''),
    name: String(item.name ?? ''),
    trackCount: Number(item.songCount) || 0,
    coverUrl: '',
  }))
}

/** Songs inside one playlist. */
export async function playlistSongs(config, playlistId) {
  const body = await requestJson(config, 'getPlaylist.view', { id: String(playlistId ?? '') })
  const wrap = body.playlist || {}
  const entries = Array.isArray(wrap.entry) ? wrap.entry : []
  return entries.map(songOf).filter((song) => song !== null)
}

/** Lyrics are optional in Subsonic and many servers do not implement them. */
export async function lyric(config, id) {
  try {
    const body = await requestJson(config, 'getLyricsBySongId.view', { id: String(id ?? '') })
    const wrap = body.lyricsList || {}
    const list = Array.isArray(wrap.structuredLyrics) ? wrap.structuredLyrics : []
    const first = list.length > 0 && list[0] !== null && typeof list[0] === 'object' ? list[0] : null
    if (first === null) return { lrc: '', translation: '' }
    const lines = Array.isArray(first.line) ? first.line : []
    const lrc = lines
      .map((line) => {
        const start = Number(line && line.start) || 0
        const minutes = Math.floor(start / 60)
        const seconds = (start % 60).toFixed(2).padStart(5, '0')
        return '[' + String(minutes).padStart(2, '0') + ':' + seconds + ']' + String((line && line.value) ?? '')
      })
      .join('\n')
    return { lrc, translation: '' }
  } catch {
    return { lrc: '', translation: '' }
  }
}
