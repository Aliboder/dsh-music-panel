/**
 * On-disk media cache for online songs, following Folia's lifecycle.
 *
 * Folia keeps a track's audio and cover only after it was played to its end, under a
 * per-song key, and prunes the store least-recently-played first after every write. This
 * store is the plugin's single disk equivalent: `<DSH_HOME>/music/cache/` with one entry per
 * `provider/id` pair.
 *
 *   cache/version.json                       { v: 2 }
 *   cache/audio/<provider>/<id>.<ext>        the audio bytes
 *   cache/audio/<provider>/<id>.json         { v, quality, mime, ext, size, durationSec, storedAt, usedAt }
 *   cache/cover/<provider>/<id>.<ext>        the cover bytes
 *   cache/cover/<provider>/<id>.json         { v, mime, ext, size, at }
 *
 * The version file also carries the one-time migration: a cache written before this layout
 * (`cache/online/`, stream-time writes, URL-keyed covers, lyric bodies) is removed once, as
 * the plan decided — its files came from a different set of rules and are not trusted.
 *
 * @module dsh-music-panel/media-cache
 */

import { mkdir, readdir, readFile, rename, rm, stat, unlink, utimes, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { writeJsonAtomic } from './json-store.js'

const VERSION = 2
const META_VERSION = 1
/** A file below this is an error page, not audio (Folia's `MIN_CACHEABLE_AUDIO_BYTES`). */
export const MIN_CACHEABLE_AUDIO_BYTES = 16 * 1024

const EXT_BY_TYPE = {
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/flac': 'flac',
  'audio/x-flac': 'flac',
  'audio/ogg': 'ogg',
  'audio/opus': 'opus',
  'audio/mp4': 'm4a',
  'audio/m4a': 'm4a',
  'audio/aac': 'aac',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
}
const KNOWN_EXTS = ['mp3', 'flac', 'ogg', 'opus', 'm4a', 'aac', 'wav', 'audio']

function safeId(value) {
  return String(value ?? '').replace(/[^a-zA-Z0-9_-]/g, '')
}

function extOf(contentType) {
  const type = String(contentType || '').split(';')[0].trim().toLowerCase()
  return EXT_BY_TYPE[type] || 'audio'
}

function typeOfExt(ext) {
  for (const [type, value] of Object.entries(EXT_BY_TYPE)) {
    if (value === ext) return type
  }
  return 'audio/mpeg'
}

function finite(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : fallback
}

/** @param {{ dir: string }} options */
export function createMediaCache(options) {
  const root = join(options.dir, 'cache')
  const audioRoot = join(root, 'audio')
  const coverRoot = join(root, 'cover')
  const versionFile = join(root, 'version.json')
  let preparing = null

  function ensure() {
    if (preparing === null) preparing = prepare()
    return preparing
  }

  async function prepare() {
    await mkdir(audioRoot, { recursive: true })
    await mkdir(coverRoot, { recursive: true })
    let version = 0
    try {
      const saved = JSON.parse(await readFile(versionFile, 'utf8'))
      version = finite(saved?.v)
    } catch {
      version = 0
    }
    if (version < VERSION) {
      // The old layout (cache/online) was written while streaming and keyed covers by URL;
      // neither is what this store keeps, so it starts from an empty cache.
      await rm(join(root, 'online'), { recursive: true, force: true })
      await writeJsonAtomic(versionFile, { v: VERSION, at: Date.now() })
    }
    return true
  }

  function audioBase(provider, id) {
    const safeProvider = safeId(provider)
    const safeTrack = safeId(id)
    return safeProvider === '' || safeTrack === '' ? null : join(audioRoot, safeProvider, safeTrack)
  }

  function coverBase(provider, id) {
    const safeProvider = safeId(provider)
    const safeTrack = safeId(id)
    return safeProvider === '' || safeTrack === '' ? null : join(coverRoot, safeProvider, safeTrack)
  }

  async function readMetaFile(file) {
    try {
      const value = JSON.parse(await readFile(file, 'utf8'))
      return value !== null && typeof value === 'object' && value.v === META_VERSION ? value : null
    } catch {
      return null
    }
  }

  /** One song's cached audio, or null. The file must still match its record. */
  async function lookup(provider, id) {
    await ensure()
    const base = audioBase(provider, id)
    if (base === null) return null
    const meta = await readMetaFile(base + '.json')
    if (meta === null) return null
    const file = base + '.' + (KNOWN_EXTS.includes(meta.ext) ? meta.ext : 'audio')
    let info = null
    try {
      info = await stat(file)
    } catch {
      info = null
    }
    if (info === null || !info.isFile()) {
      await unlink(base + '.json').catch(() => {})
      return null
    }
    if (info.size !== meta.size) return null
    return {
      provider: safeId(provider),
      id: safeId(id),
      file,
      size: info.size,
      mime: typeof meta.mime === 'string' && meta.mime !== '' ? meta.mime : typeOfExt(meta.ext),
      quality: typeof meta.quality === 'string' ? meta.quality : '',
      durationSec: finite(meta.durationSec),
      storedAt: finite(meta.storedAt),
      usedAt: finite(meta.usedAt),
    }
  }

  /** Keep an entry alive without changing what it holds: used by the LRU. */
  async function touch(provider, id) {
    const base = audioBase(provider, id)
    if (base === null) return false
    const metaFile = base + '.json'
    const meta = await readMetaFile(metaFile)
    if (meta === null) return false
    const now = Date.now()
    meta.usedAt = now
    await writeJsonAtomic(metaFile, meta).catch(() => {})
    const file = base + '.' + (KNOWN_EXTS.includes(meta.ext) ? meta.ext : 'audio')
    await utimes(file, now / 1000, now / 1000).catch(() => {})
    return true
  }

  /**
   * Write one song's audio. The caller has already checked the bytes; this only stores and
   * prunes. Returns the entry, or null when the id/bytes are unusable.
   */
  async function store(entry) {
    await ensure()
    const base = audioBase(entry.provider, entry.id)
    if (base === null) return null
    const buffer = entry.buffer
    if (!Buffer.isBuffer(buffer) || buffer.length < MIN_CACHEABLE_AUDIO_BYTES) return null
    const ext = KNOWN_EXTS.includes(entry.ext) ? entry.ext : extOf(entry.mime)
    const dir = join(audioRoot, safeId(entry.provider))
    await mkdir(dir, { recursive: true })
    const file = base + '.' + ext
    const temp = file + '.' + process.pid + '.' + Date.now() + '.tmp'
    await writeFile(temp, buffer)
    await rm(file, { force: true }).catch(() => {})
    await rename(temp, file)
    for (const other of KNOWN_EXTS) {
      if (other !== ext) await unlink(base + '.' + other).catch(() => {})
    }
    const now = Date.now()
    const meta = {
      v: META_VERSION,
      provider: safeId(entry.provider),
      id: safeId(entry.id),
      quality: typeof entry.quality === 'string' ? entry.quality : '',
      mime: typeof entry.mime === 'string' && entry.mime !== '' ? entry.mime : typeOfExt(ext),
      ext,
      size: buffer.length,
      durationSec: finite(entry.durationSec),
      storedAt: now,
      usedAt: now,
    }
    await writeJsonAtomic(base + '.json', meta)
    return { ...meta, file }
  }

  async function remove(provider, id) {
    const base = audioBase(provider, id)
    let removed = 0
    if (base !== null) {
      for (const ext of KNOWN_EXTS) {
        if (await unlink(base + '.' + ext).then(() => true, () => false)) removed += 1
      }
      if (await unlink(base + '.json').then(() => true, () => false)) removed += 1
    }
    const cover = coverBase(provider, id)
    if (cover !== null) {
      for (const ext of ['jpg', 'jpeg', 'png', 'webp', 'gif']) {
        if (await unlink(cover + '.' + ext).then(() => true, () => false)) removed += 1
      }
      if (await unlink(cover + '.json').then(() => true, () => false)) removed += 1
    }
    return removed
  }

  /** Every audio entry under the store, newest meta first (for stats and pruning). */
  async function entries() {
    await ensure()
    const list = []
    let providers
    try {
      providers = await readdir(audioRoot, { withFileTypes: true })
    } catch {
      return list
    }
    for (const provider of providers) {
      if (!provider.isDirectory()) continue
      let names
      try {
        names = await readdir(join(audioRoot, provider.name))
      } catch {
        continue
      }
      for (const name of names) {
        if (!name.endsWith('.json')) continue
        const meta = await readMetaFile(join(audioRoot, provider.name, name))
        if (meta === null) continue
        const file = join(audioRoot, provider.name, name.slice(0, -5) + '.' + (KNOWN_EXTS.includes(meta.ext) ? meta.ext : 'audio'))
        let info = null
        try {
          info = await stat(file)
        } catch {
          info = null
        }
        list.push({
          provider: provider.name,
          id: String(meta.id || name.slice(0, -5)),
          file,
          size: info === null ? 0 : info.size,
          quality: typeof meta.quality === 'string' ? meta.quality : '',
          durationSec: finite(meta.durationSec),
          storedAt: finite(meta.storedAt),
          usedAt: finite(meta.usedAt),
          metaFile: join(audioRoot, provider.name, name),
        })
      }
    }
    return list
  }

  /**
   * Prune least-recently-played entries until the store fits `limitBytes`.
   * 0 (or anything unusable) means no ceiling, as in Folia's setting.
   */
  async function prune(limitBytes) {
    const limit = finite(limitBytes)
    if (limit === 0) return 0
    const list = await entries()
    let total = list.reduce((sum, item) => sum + item.size, 0)
    if (total <= limit) return 0
    list.sort((left, right) => left.usedAt - right.usedAt)
    let removed = 0
    for (const item of list) {
      if (total <= limit) break
      await remove(item.provider, item.id)
      total -= item.size
      removed += 1
    }
    return removed
  }

  async function coverFile(provider, id) {
    await ensure()
    const base = coverBase(provider, id)
    if (base === null) return null
    const meta = await readMetaFile(base + '.json')
    if (meta === null) return null
    const ext = typeof meta.ext === 'string' && meta.ext !== '' ? meta.ext : 'jpg'
    const file = base + '.' + ext
    try {
      const info = await stat(file)
      if (!info.isFile() || info.size !== meta.size) return null
      return { file, mime: meta.mime || 'image/jpeg', size: meta.size }
    } catch {
      return null
    }
  }

  async function writeCover(entry) {
    await ensure()
    const base = coverBase(entry.provider, entry.id)
    if (base === null) return null
    const buffer = entry.buffer
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) return null
    const ext = typeof entry.ext === 'string' && /^(jpg|jpeg|png|webp|gif)$/.test(entry.ext) ? entry.ext : 'jpg'
    const dir = join(coverRoot, safeId(entry.provider))
    await mkdir(dir, { recursive: true })
    const file = base + '.' + ext
    const temp = file + '.' + process.pid + '.' + Date.now() + '.tmp'
    await writeFile(temp, buffer)
    await rm(file, { force: true }).catch(() => {})
    await rename(temp, file)
    for (const other of ['jpg', 'jpeg', 'png', 'webp', 'gif']) {
      if (other !== ext) await unlink(base + '.' + other).catch(() => {})
    }
    const meta = { v: META_VERSION, mime: entry.mime || 'image/jpeg', ext, size: buffer.length, at: Date.now() }
    await writeJsonAtomic(base + '.json', meta)
    return { file, mime: meta.mime, size: meta.size }
  }

  async function hasCover(provider, id) {
    return (await coverFile(provider, id)) !== null
  }

  async function stats() {
    const entryList = await entries()
    let coverFiles = 0
    let coverBytes = 0
    let providers
    try {
      providers = await readdir(coverRoot, { withFileTypes: true })
    } catch {
      providers = []
    }
    for (const provider of providers) {
      if (!provider.isDirectory()) continue
      let names
      try {
        names = await readdir(join(coverRoot, provider.name))
      } catch {
        continue
      }
      for (const name of names) {
        if (name.endsWith('.json')) continue
        if (!/\.(jpg|jpeg|png|webp|gif)$/.test(name)) continue
        const info = await stat(join(coverRoot, provider.name, name)).catch(() => null)
        if (info === null || !info.isFile()) continue
        coverFiles += 1
        coverBytes += info.size
      }
    }
    const audioBytes = entryList.reduce((sum, item) => sum + item.size, 0)
    return {
      songs: entryList.length,
      files: entryList.length + coverFiles,
      bytes: audioBytes + coverBytes,
      categories: {
        audio: { files: entryList.length, bytes: audioBytes },
        cover: { files: coverFiles, bytes: coverBytes },
      },
    }
  }

  /**
   * Empty one category. `audio` (and `all`) also clears the covers of those same songs:
   * they are that play's assets, as in Folia's media category.
   */
  async function clear(category) {
    const which = category === 'cover' ? 'cover' : category === 'audio' ? 'audio' : 'all'
    let removed = 0
    if (which !== 'cover') {
      try {
        removed += (await readdir(audioRoot, { recursive: true })).length
      } catch {
        /* nothing stored */
      }
      await rm(audioRoot, { recursive: true, force: true })
      await mkdir(audioRoot, { recursive: true })
    }
    if (which !== 'audio') {
      try {
        removed += (await readdir(coverRoot, { recursive: true })).length
      } catch {
        /* nothing stored */
      }
      await rm(coverRoot, { recursive: true, force: true })
      await mkdir(coverRoot, { recursive: true })
    }
    return removed
  }

  return {
    ensure,
    lookup,
    touch,
    store,
    remove,
    entries,
    prune,
    coverFile,
    writeCover,
    hasCover,
    stats,
    clear,
    root,
  }
}
