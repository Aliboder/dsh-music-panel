/**
 * Read and rewrite the editable tag set of one audio file.
 *
 * Supported writers (pure JavaScript, no external binaries):
 *   - FLAC → Vorbis comments via `flac-tagger`
 *   - MP3  → ID3v2 via `node-id3`
 *
 * The rewrite always targets a sibling temp file and only replaces the
 * original after a read-back check, so a failed write cannot truncate or
 * corrupt the audio. Cover art and unedited tags are preserved.
 *
 * @module dsh-music-panel/tags
 */

import { copyFile, rename, unlink } from 'node:fs/promises'
import { extname } from 'node:path'
import NodeID3 from 'node-id3'
import { readFlacTags, writeFlacTags } from 'flac-tagger'

/** Editable fields, in UI order. */
export const TAG_FIELDS = [
  'title',
  'artist',
  'album',
  'year',
  'track',
  'disc',
  'genre',
  'albumArtist',
  'composer',
  'lyricist',
  'comment',
  'lyrics',
]

/** FLAC Vorbis comment key for each editable field. */
export const VORBIS_KEYS = {
  title: 'TITLE',
  artist: 'ARTIST',
  album: 'ALBUM',
  year: 'DATE',
  track: 'TRACKNUMBER',
  disc: 'DISCNUMBER',
  genre: 'GENRE',
  albumArtist: 'ALBUMARTIST',
  composer: 'COMPOSER',
  lyricist: 'LYRICIST',
  comment: 'COMMENT',
  lyrics: 'LYRICS',
}

/** Longest single-value field accepted by the writer. */
export const MAX_FIELD_LENGTH = 20_000
/** Lyrics get their own (larger) cap. */
export const MAX_LYRICS_LENGTH = 500_000

/**
 * @param {string} file
 * @returns {'flac' | 'id3' | null}
 */
export function formatOf(file) {
  const ext = extname(file).toLowerCase()
  if (ext === '.flac') return 'flac'
  if (ext === '.mp3') return 'id3'
  return null
}

function unsupportedError(file) {
  return Object.assign(new Error(`当前格式不支持编辑元数据（仅 FLAC / MP3）：${extname(file) || file}`), {
    code: 'UNSUPPORTED_FORMAT',
  })
}

function textOf(value) {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    return value
      .filter((item) => typeof item === 'string')
      .join(' / ')
  }
  return ''
}

function pick(tagMap, key) {
  const lower = key.toLowerCase()
  for (const name of Object.keys(tagMap)) {
    if (name.toLowerCase() === lower) return tagMap[name]
  }
  return undefined
}

function drop(tagMap, key) {
  const lower = key.toLowerCase()
  for (const name of Object.keys(tagMap)) {
    if (name.toLowerCase() === lower) delete tagMap[name]
  }
}

/**
 * Coerce an untrusted patch object into the editable field set (strings only).
 *
 * @param {unknown} input
 * @returns {Record<string, string>}
 */
export function normalizeTags(input) {
  const out = {}
  for (const field of TAG_FIELDS) {
    const raw = input !== null && typeof input === 'object' ? input[field] : undefined
    out[field] = typeof raw === 'string' ? raw : ''
  }
  return out
}

/**
 * @param {Record<string, string>} tags
 * @returns {string | null} a human error, or null when acceptable
 */
export function validateTags(tags) {
  for (const field of TAG_FIELDS) {
    const value = tags[field]
    if (typeof value !== 'string') return `字段 ${field} 必须是字符串`
    const limit = field === 'lyrics' ? MAX_LYRICS_LENGTH : MAX_FIELD_LENGTH
    if (value.length > limit) return `字段 ${field} 超长（上限 ${limit} 字符）`
  }
  return null
}

/**
 * @param {string} file absolute path already validated against the roots
 * @returns {Promise<{ format: 'flac' | 'id3', tags: Record<string, string> }>}
 */
export async function readTags(file) {
  const format = formatOf(file)
  if (format === null) throw unsupportedError(file)

  if (format === 'flac') {
    const { tagMap } = await readFlacTags(file)
    const tags = {}
    for (const field of TAG_FIELDS) tags[field] = textOf(pick(tagMap, VORBIS_KEYS[field]))
    return { format, tags }
  }

  const id3 = NodeID3.read(file, { exclude: ['APIC'] })
  if (id3 === null || id3 === undefined || typeof id3 !== 'object') {
    throw new Error('读取 ID3 标签失败')
  }
  const comment = id3.comment && typeof id3.comment === 'object' ? id3.comment.text : id3.comment
  const lyrics =
    id3.unsynchronisedLyrics && typeof id3.unsynchronisedLyrics === 'object'
      ? id3.unsynchronisedLyrics.text
      : ''
  return {
    format,
    tags: {
      title: textOf(id3.title),
      artist: textOf(id3.artist),
      album: textOf(id3.album),
      year: textOf(id3.year),
      track: textOf(id3.trackNumber),
      disc: textOf(id3.partOfSet),
      genre: textOf(id3.genre),
      albumArtist: textOf(id3.performerInfo),
      composer: textOf(id3.composer),
      lyricist: textOf(id3.textWriter),
      comment: textOf(comment),
      lyrics: textOf(lyrics),
    },
  }
}

/**
 * Rewrite the editable tags in place (atomic via temp file + read-back check).
 *
 * @param {string} file absolute path already validated against the roots
 * @param {unknown} input
 * @returns {Promise<{ format: 'flac' | 'id3', tags: Record<string, string> }>}
 */
export async function writeTags(file, input) {
  const format = formatOf(file)
  if (format === null) throw unsupportedError(file)
  const next = normalizeTags(input)
  const invalid = validateTags(next)
  if (invalid !== null) throw Object.assign(new Error(invalid), { code: 'INVALID_TAGS' })

  // Keep the real extension on the temp file: the read-back check goes
  // through the same format detection as the original.
  const temp = `${file}.mu-tags.tmp${extname(file)}`
  await copyFile(file, temp)
  try {
    if (format === 'flac') {
      const existing = await readFlacTags(temp)
      const tagMap = { ...existing.tagMap }
      for (const field of TAG_FIELDS) {
        const key = VORBIS_KEYS[field]
        if (next[field] === '') drop(tagMap, key)
        else tagMap[key] = next[field]
      }
      await writeFlacTags({ tagMap, picture: existing.picture }, temp)
    } else {
      const result = NodeID3.update(
        {
          title: next.title,
          artist: next.artist,
          album: next.album,
          year: next.year,
          trackNumber: next.track,
          partOfSet: next.disc,
          genre: next.genre,
          performerInfo: next.albumArtist,
          composer: next.composer,
          textWriter: next.lyricist,
          comment: { language: 'chi', text: next.comment },
          unsynchronisedLyrics: { language: 'chi', text: next.lyrics },
        },
        temp,
      )
      if (result !== true) {
        throw new Error(`ID3 写入失败：${result instanceof Error ? result.message : String(result)}`)
      }
    }

    // Read back the temp file before touching the original. This catches a
    // writer that silently dropped a field or mangled the codec.
    const check = await readTags(temp)
    for (const field of TAG_FIELDS) {
      if (check.tags[field] !== next[field]) {
        throw new Error(`标签写入校验失败（${field}）`)
      }
    }

    await rename(temp, file)
  } catch (error) {
    await unlink(temp).catch(() => {})
    throw error
  }

  return readTags(file)
}
