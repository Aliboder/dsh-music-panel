/**
 * Import user-provided online playlists (M3U / M3U8 / PLS).
 *
 * A playlist URL is one "source" that expands into many tracks: the host
 * fetches and parses it, then the client shows every entry in the library.
 * URLs are resolved against the playlist's own location, and the fetcher
 * refuses private hosts just like the audio proxy does.
 *
 * @module dsh-music-panel/online-playlist
 */

const MAX_PLAYLIST_BYTES = 2 * 1024 * 1024
const MAX_PLAYLIST_TRACKS = 500
const FETCH_TIMEOUT_MS = 20000

function isPrivateHost(host) {
  const name = String(host ?? '').toLowerCase().replace(/^\[|\]$/g, '')
  if (name === '' || name === 'localhost' || name === '0.0.0.0') return true
  if (name === '::1' || name.endsWith('.local') || name.endsWith('.internal')) return true
  if (/^(127\.|10\.|192\.168\.|169\.254\.)/.test(name)) return true
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(name)) return true
  if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(name)) return true
  return false
}

function assertPublicUrl(raw) {
  let parsed
  try {
    parsed = new URL(String(raw ?? '').trim())
  } catch {
    throw new Error('URL 无效')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('仅支持 http/https')
  }
  if (isPrivateHost(parsed.hostname)) {
    throw new Error('不允许访问内网地址')
  }
  return parsed
}

function resolveUrl(line, baseUrl) {
  try {
    return new URL(line, baseUrl).toString()
  } catch {
    return ''
  }
}

function nameFromUrl(url) {
  try {
    const parts = new URL(url).pathname.split('/')
    const last = parts[parts.length - 1] || ''
    return decodeURIComponent(last) || url
  } catch {
    return url
  }
}

function splitTitle(title) {
  const text = String(title ?? '').trim()
  const dash = text.indexOf(' - ')
  if (dash > 0) {
    return { artist: text.slice(0, dash).trim(), name: text.slice(dash + 3).trim() }
  }
  return { artist: '', name: text }
}

/** Whether a URL looks like an M3U/M3U8/PLS playlist (by extension). */
export function isPlaylistUrl(url) {
  try {
    const parsed = new URL(String(url))
    return /\.(m3u8?|pls)$/i.test(parsed.pathname)
  } catch {
    return false
  }
}

/**
 * Parse an M3U/M3U8 document into track entries.
 *
 * @param {string} text
 * @param {string} baseUrl playlist location, for relative entries
 * @returns {{ name: string, artist: string, durationSec: number, url: string }[]}
 */
export function parseM3U(text, baseUrl) {
  const tracks = []
  let pending = null
  for (const rawLine of String(text ?? '').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (line === '') continue
    if (line.startsWith('#')) {
      if (/^#EXTINF:/i.test(line)) {
        const body = line.slice(line.indexOf(':') + 1)
        const comma = body.indexOf(',')
        const meta = comma >= 0 ? body.slice(0, comma) : body
        const rawTitle = comma >= 0 ? body.slice(comma + 1) : ''
        const seconds = Number.parseFloat(meta)
        const parts = splitTitle(rawTitle)
        pending = {
          artist: parts.artist,
          name: parts.name,
          durationSec: Number.isFinite(seconds) ? Math.max(0, Math.round(seconds)) : 0,
        }
      }
      continue
    }
    const url = resolveUrl(line, baseUrl)
    if (url === '') continue
    const fallback = nameFromUrl(url)
    tracks.push({
      name: pending?.name || fallback,
      artist: pending?.artist || '',
      durationSec: pending?.durationSec || 0,
      url,
    })
    pending = null
    if (tracks.length >= MAX_PLAYLIST_TRACKS) break
  }
  return tracks
}

/**
 * Parse a PLS document (`FileN=` / `TitleN=` / `LengthN=`).
 *
 * @param {string} text
 * @param {string} baseUrl playlist location, for relative entries
 * @returns {{ name: string, artist: string, durationSec: number, url: string }[]}
 */
export function parsePLS(text, baseUrl) {
  const entries = new Map()
  for (const rawLine of String(text ?? '').split(/\r?\n/)) {
    const line = rawLine.trim()
    const match = /^([A-Za-z]+)(\d+)\s*=\s*(.*)$/.exec(line)
    if (match === null) continue
    const key = match[1].toLowerCase()
    const index = Number(match[2])
    const value = match[3].trim()
    if (!Number.isFinite(index)) continue
    const entry = entries.get(index) ?? {}
    if (key === 'file') entry.url = value
    else if (key === 'title') entry.title = value
    else if (key === 'length') entry.length = Number(value)
    entries.set(index, entry)
  }
  const tracks = []
  const ordered = [...entries.keys()].sort((left, right) => left - right)
  for (const index of ordered) {
    const entry = entries.get(index)
    if (entry === undefined || typeof entry.url !== 'string') continue
    const url = resolveUrl(entry.url, baseUrl)
    if (url === '') continue
    const parts = splitTitle(entry.title || nameFromUrl(url))
    tracks.push({
      name: parts.name,
      artist: parts.artist,
      durationSec: Number.isFinite(entry.length) ? Math.max(0, Math.round(entry.length)) : 0,
      url,
    })
    if (tracks.length >= MAX_PLAYLIST_TRACKS) break
  }
  return tracks
}

/**
 * Fetch and parse a remote playlist. Follows at most 3 redirects, refusing
 * private hosts at every hop, and caps both response size and track count.
 *
 * @param {string} rawUrl
 * @returns {Promise<{ title: string, tracks: ReturnType<typeof parseM3U> }>}
 */
export async function fetchPlaylist(rawUrl) {
  let current = assertPublicUrl(rawUrl)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    let response = null
    for (let hop = 0; hop < 4; hop += 1) {
      response = await fetch(current, {
        redirect: 'manual',
        signal: controller.signal,
        headers: { 'user-agent': 'dsh-music-panel/1.0' },
      })
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location')
        if (location === null) throw new Error('上游重定向缺少 location')
        current = assertPublicUrl(new URL(location, current).toString())
        continue
      }
      break
    }
    if (response === null || !response.ok) {
      throw new Error('歌单返回 ' + (response === null ? 'unknown' : response.status))
    }
    const text = await response.text()
    if (text.length > MAX_PLAYLIST_BYTES) throw new Error('歌单过大')
    const isPls = /\.pls$/i.test(current.pathname) || /^\s*\[playlist\]/i.test(text)
    const tracks = isPls ? parsePLS(text, current.toString()) : parseM3U(text, current.toString())
    if (tracks.length === 0) throw new Error('歌单里没有可播放的曲目')
    const last = current.pathname.split('/').pop() || 'playlist'
    return { title: decodeURIComponent(last), tracks }
  } finally {
    clearTimeout(timer)
  }
}
