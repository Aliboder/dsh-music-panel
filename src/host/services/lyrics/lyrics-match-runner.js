/**
 * Lyric match runner: asks the sources in Folia's order and returns the first
 * word-level lyric, keeping a line-level answer as the fallback.
 *
 * All I/O is injected (`search`, `fetchLyric`, `fetchAmll`) so this module never
 * touches the network and stays testable; the caller owns what each callback talks
 * to. Limits and timeouts are Folia's own numbers.
 *
 * @module dsh-music-panel/lyrics-match-runner
 */

import { AUTO_MATCH_MIN_SCORE } from './lyrics-match.js'
import { findBestLyricsViaFolia } from './lyrics-folia.js'

/** Folia: `AUTO_MATCH_SEARCH_LIMIT`. */
export const AUTO_MATCH_SEARCH_LIMIT = 10
/** Folia: `PROVIDER_SEARCH_TIMEOUT_MS`. */
export const SEARCH_TIMEOUT_MS = 3500
/** Folia: `PROVIDER_LYRIC_TIMEOUT_MS`. */
export const LYRIC_TIMEOUT_MS = 5000

/** Reject with a labelled error once `ms` passes. */
export function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const error = new Error(`${label} timed out after ${ms}ms`)
      error.code = 'timeout'
      reject(error)
    }, ms)
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

/** A lyric answer worth returning: at least one line with text (Folia checks `fullText` too). */
export function hasRenderableLyrics(lyrics) {
  if (lyrics === null || typeof lyrics !== 'object') return false
  const lines = Array.isArray(lyrics.lines) ? lyrics.lines : []
  return lines.some(
    (line) => String(line?.text ?? line?.fullText ?? '').trim() !== ''
      || String(line?.translation ?? '').trim() !== '',
  )
}

function isWordLevel(lyrics) {
  const lines = Array.isArray(lyrics?.lines) ? lyrics.lines : []
  return lines.some((line) => Array.isArray(line?.words) && line.words.length > 0)
}

/**
 * Turn an LRC string into the runner's line shape.
 *
 * Platform providers answer `{ lrc }` (text); AMLL and `/lyric/new` answer parsed
 * lines. Both must land in `{ t, end, text }` before the runner can compare them.
 */
export function linesFromLrc(text) {
  const lines = []
  for (const raw of String(text ?? '').split(/\r?\n/)) {
    const match = /^\[(\d{1,2}):(\d{1,2}(?:\.\d+)?)\](.*)$/.exec(raw.trim())
    if (match === null) continue
    const at = Number(match[1]) * 60 + Number(match[2])
    if (!Number.isFinite(at)) continue
    lines.push({ t: at, end: at, text: String(match[3] ?? '').trim() })
  }
  lines.sort((left, right) => left.t - right.t)
  return lines
}

/**
 * `[mm:ss.xxx]` stamp for a line captured in seconds (the inverse of linesFromLrc).
 * Rounded in milliseconds, so 59.9996 becomes `[01:00.000]` rather than `[00:60.000]`.
 */
export function lrcTime(seconds) {
  const millis = Math.round(Math.max(0, Number(seconds) || 0) * 1000)
  const minutes = Math.floor(millis / 60000)
  const rest = millis - minutes * 60000
  const secs = Math.floor(rest / 1000)
  return '[' + String(minutes).padStart(2, '0') + ':' + String(secs).padStart(2, '0') + '.' + String(rest - secs * 1000).padStart(3, '0') + ']'
}

const LYRIC_QUERY_ALBUM_MAX = 48

function normalizeLyricIdentity(value) {
  return String(value ?? '').normalize('NFKC').toLowerCase().replace(/\s+/g, '')
}

function lyricTitle(track) {
  const title = String(track?.title ?? '').trim()
  const artist = String(track?.artist ?? '').trim()
  if (title === '' || artist === '') return title
  const match = /^(.+?)\s+-\s+(.+)$/u.exec(title)
  if (match === null) return title
  return normalizeLyricIdentity(match[1]) === normalizeLyricIdentity(artist) ? match[2].trim() : title
}

function lyricAlbum(track) {
  const album = String(track?.album ?? '').trim()
  if (album === '') return null
  if (album.length <= LYRIC_QUERY_ALBUM_MAX) return album
  const compact = album
    .replace(/\s*※.*$/u, '')
    .replace(/\s*(歌|歌唱|アーティスト|Artist)\s*[:：]?\s*.+$/iu, '')
    .trim()
  return compact.slice(0, LYRIC_QUERY_ALBUM_MAX).trim() || null
}

/** Folia's query: title - artist - album, with the title prefix and long albums normalised. */
export function buildLyricSearchQuery(track) {
  if (String(track?.title ?? '').trim() === '') return ''
  return [lyricTitle(track), String(track?.artist ?? '').trim(), lyricAlbum(track)]
    .filter((part) => typeof part === 'string' && part !== '')
    .join(' - ')
}

/** KuGou's lyric search works best with the title alone (Folia's own query), not the full structured string. */
export function buildKugouLyricSearchQuery(track) {
  const full = buildLyricSearchQuery(track)
  return full.split(/\s+-\s+/u)[0]?.trim() || full
}

/**
 * Try the AMLL DB first (it is the highest quality source when it has the song),
 * then each platform in order.
 *
 * @param {{ title: string, artist?: string, album?: string, durationMs?: number }} track
 * @param {{
 *   order?: string[],
 *   neteaseId?: string|number,
 *   qqId?: string|number,
 *   resolveAmllIds?: () => Promise<{ neteaseId?: string|number, qqId?: string|number }>,
 *   search: (sourceId: string, query: string, limit: number) => Promise<Array<object>>,
 *   fetchLyric: (sourceId: string, id: string, candidate: object) => Promise<object|null>,
 *   fetchAmll?: (platform: 'ncm'|'qq', id: string) => Promise<{ lines: Array<object>, text?: string }|null>,
 *   log?: (message: string) => void,
 * }} io
 */
// Folia 的自动匹配（autoMatchBestLyric）在镜像里：本节只把调用方注入的 io 换成它的宿主面，
// 再把它交回的 LyricData 换成本插件路由认的行形状。算法、顺序、阈值、超时、两次重试都在那边。

export async function findBestLyrics(track, io) {
  return await findBestLyricsViaFolia(track, io)
}
export { AUTO_MATCH_MIN_SCORE }