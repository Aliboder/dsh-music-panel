/**
 * Lyrics for dsh-music-panel.
 *
 * Sources, in order:
 *   1. synced lyric frames embedded in the audio file (ID3 SYLT, FLAC
 *      SYNCEDLYRICS, …) — exact millisecond timeline, what desktop players
 *      like Salt Player read;
 *   2. the file's plain lyrics tag when it carries LRC timestamps;
 *   3. a sidecar `.lrc` with the same base name.
 *
 * Untimed plain lyrics are returned with `timed: false` and never scroll.
 *
 * @module dsh-music-panel/lyrics
 */

import { readdir, readFile } from 'node:fs/promises'
import { basename, dirname, extname, join } from 'node:path'
import { parseFile } from 'music-metadata'

const TIME_TAG = /\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g
const META_TAG = /^\[(ar|al|ti|by|offset|re|ve|length)\s*:[^\]]*\]$/i
const CREDIT_TAG = /^(作词|作曲|编曲|制作|监制|出品|发行|录音|混音|母带|和声|吉他|贝斯|鼓|键盘|弦乐|词|曲)\s*[:：]/i
const CREDIT_EN = /^(lyrics?|composed|composer|arranged|arranger|producer|produced|mixed|mastered|written|music|words)\b[^:：]{0,24}[:：]/i

/** Timed credit lines must never be folded as a translation. */
function isCreditText(text) {
  const value = String(text || '').trim()
  return value !== '' && (CREDIT_TAG.test(value) || CREDIT_EN.test(value))
}

/** Two lines within this many seconds are treated as one translated pair. */
const PAIR_WINDOW_SEC = 0.25

/** Synced frames land on exact millisecond stamps; allow a small jitter. */
const SYNC_PAIR_WINDOW_SEC = 0.05

/** ID3 timestamp format 1 is MPEG frames, which cannot be converted here. */
const TIMESTAMP_FORMAT_FRAMES = 1

function secondsOf(match) {
  const minutes = Number(match[1])
  const seconds = Number(match[2])
  const fraction = match[3] === undefined ? 0 : Number(`0.${match[3].padEnd(3, '0')}`)
  return minutes * 60 + seconds + fraction
}

/**
 * Parse LRC text into ordered lines with an optional translation.
 *
 * @param {unknown} raw
 * @returns {Array<{ time: number, text: string, translation: string }>}
 */
export function parseLrc(raw) {
  if (typeof raw !== 'string' || raw === '') return []

  const rows = []
  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (line === '' || META_TAG.test(line)) continue

    TIME_TAG.lastIndex = 0
    const times = []
    let match
    while ((match = TIME_TAG.exec(line)) !== null) times.push(secondsOf(match))
    if (times.length === 0) continue

    const body = line.replace(/\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g, '').trim()
    for (const time of times) rows.push({ time, text: body })
  }

  // Stable sort by time only: lines sharing a stamp keep their file order.
  rows.sort((left, right) => left.time - right.time)

  // Fold same-timestamp follow-up lines (translation, romanization, …) into
  // the lead line, one per line so multi-language lyrics survive.
  const merged = []
  for (const row of rows) {
    const last = merged[merged.length - 1]
    const credit = isCreditText(row.text)
    const lastCredit = last !== undefined && isCreditText(last.text)
    if (
      !credit &&
      !lastCredit &&
      last !== undefined &&
      row.text !== '' &&
      last.text !== row.text &&
      !last.translation.split('\n').includes(row.text) &&
      row.time - last.time <= PAIR_WINDOW_SEC
    ) {
      last.translation = last.translation === '' ? row.text : `${last.translation}\n${row.text}`
      continue
    }
    merged.push({ time: row.time, text: row.text, translation: '' })
  }
  return merged.filter((row) => row.text !== '' || row.translation !== '')
}

/**
 * Convert synced lyric frames into timed lines.
 *
 * @param {unknown} syncText
 * @param {number | undefined} timeStampFormat
 * @returns {{ lines: Array<{ time: number, text: string, translation: string }>, timed: true, source: 'embedded' } | null}
 */
export function parseSyncText(syncText, timeStampFormat) {
  if (!Array.isArray(syncText) || syncText.length === 0) return null
  if (timeStampFormat === TIMESTAMP_FORMAT_FRAMES) return null

  const entries = syncText
    .filter((entry) => entry !== null && typeof entry === 'object' && typeof entry.text === 'string')
    .map((entry) => ({ time: Number(entry.timestamp) / 1000, text: entry.text.trim() }))
    .filter((entry) => entry.text !== '' && Number.isFinite(entry.time))
  if (entries.length === 0) return null

  entries.sort((left, right) => left.time - right.time)

  // Same-frame follow-ups (translation / romanization) fold into the lead line.
  const lines = []
  for (const entry of entries) {
    const last = lines[lines.length - 1]
    const credit = isCreditText(entry.text)
    const lastCredit = last !== undefined && isCreditText(last.text)
    if (
      !credit &&
      !lastCredit &&
      last !== undefined &&
      last.text !== entry.text &&
      !last.translation.split('\n').includes(entry.text) &&
      entry.time - last.time <= SYNC_PAIR_WINDOW_SEC
    ) {
      last.translation = last.translation === '' ? entry.text : `${last.translation}\n${entry.text}`
      continue
    }
    lines.push({ time: entry.time, text: entry.text, translation: '' })
  }

  return { lines, timed: true, source: 'embedded', raw: '' }
}

/**
 * Turn one lyrics payload (embedded tag or sidecar text) into the wire shape.
 *
 * @param {string} text
 * @param {'embedded' | 'sidecar'} source
 */
export function parseLyricsText(text, source) {
  const parsed = parseLrc(text)
  if (parsed.length > 0) return { lines: parsed, timed: true, source }

  const plain = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '')
  return {
    lines: plain.map((line) => ({ time: -1, text: line, translation: '' })),
    timed: false,
    source,
  }
}

/**
 * Read embedded lyrics from the audio file itself, if any.
 *
 * @param {string} audioFile
 */
async function embeddedLyrics(audioFile) {
  try {
    const meta = await parseFile(audioFile, { duration: false })
    const tags = meta.common.lyrics
    if (!Array.isArray(tags) || tags.length === 0) return null

    // 1. Synced frames: exact timeline.
    for (const tag of tags) {
      const synced = parseSyncText(tag && tag.syncText, tag && tag.timeStampFormat)
      if (synced !== null) return synced
    }

    // 2. Plain lyrics text that may itself be LRC.
    const text = tags
      .map((tag) => (tag && typeof tag.text === 'string' ? tag.text : ''))
      .filter((chunk) => chunk.trim() !== '')
      .join('\n')
    if (text.trim() === '') return null
    const parsed = parseLyricsText(text, 'embedded')
    return parsed.lines.length > 0 ? { ...parsed, raw: text } : null
  } catch {
    return null
  }
}

/**
 * Read the sidecar `.lrc` next to the audio file, if present.
 *
 * @param {string} audioFile
 */
async function sidecarLyrics(audioFile) {
  const dir = dirname(audioFile)
  const stem = basename(audioFile, extname(audioFile)).toLowerCase()

  let entries
  try {
    entries = await readdir(dir)
  } catch {
    return null
  }
  const hit = entries.find((name) => name.toLowerCase() === `${stem}.lrc`)
  if (hit === undefined) return null

  const file = join(dir, hit)
  try {
    const raw = await readFile(file, 'utf8')
    const parsed = parseLyricsText(raw, 'sidecar')
    return { lines: parsed.lines, timed: parsed.timed, source: 'sidecar', file, raw }
  } catch {
    return null
  }
}

/**
 * Lyrics for one track, trying the requested sources in order.
 *
 * @param {string} audioFile
 * @param {string[]} [order] subset of ['embedded', 'lrc']
 * @returns {Promise<{ lines: Array<{ time: number, text: string, translation: string }>, timed: boolean, source: 'embedded' | 'sidecar' | null, file: string | null }>}
 */
export async function readLyricsFor(audioFile, order) {
  const sequence = Array.isArray(order) && order.length > 0 ? order : ['embedded', 'lrc']

  for (const source of sequence) {
    if (source === 'embedded') {
      const embedded = await embeddedLyrics(audioFile)
      if (embedded !== null) {
        return { lines: embedded.lines, timed: embedded.timed, source: 'embedded', file: null, raw: embedded.raw ?? '' }
      }
    } else if (source === 'lrc') {
      const sidecar = await sidecarLyrics(audioFile)
      if (sidecar !== null) return sidecar
    }
  }

  return { lines: [], timed: false, source: null, file: null, raw: '' }
}
