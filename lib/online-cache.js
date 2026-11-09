/**
 * On-disk cache for online audio streams.
 *
 * Listening to an online track once stores the bytes under
 * `<DSH_HOME>/music/cache/online/<provider>/<id>.audio`; later plays are served
 * from disk (including seeking) without touching the provider CDN again.
 *
 * The cache is bounded: after each store the least-recently-used files are
 * pruned back under `maxBytes` (default 2 GiB).
 *
 * @module dsh-music-panel/online-cache
 */

import { createReadStream } from 'node:fs'
import { mkdir, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const DEFAULT_MAX_BYTES = 2 * 1024 * 1024 * 1024

const EXT_BY_TYPE = {
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/flac': 'flac',
  'audio/x-flac': 'flac',
  'audio/ogg': 'ogg',
  'audio/opus': 'opus',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/wav': 'wav',
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

/**
 * @param {{ dir: string, maxBytes?: number }} options
 */
export function createOnlineCache(options) {
  const root = join(options.dir, 'cache', 'online')
  const maxBytes = Number(options.maxBytes) > 0 ? Number(options.maxBytes) : DEFAULT_MAX_BYTES

  function entryPath(provider, id, ext = 'audio') {
    const safeProvider = safeId(provider)
    const safeTrackId = safeId(id)
    if (safeProvider === '' || safeTrackId === '') return null
    return join(root, safeProvider, safeTrackId + '.' + ext)
  }

  async function lookup(provider, id) {
    for (const ext of KNOWN_EXTS) {
      const file = entryPath(provider, id, ext)
      if (file === null) return null
      try {
        const info = await stat(file)
        if (!info.isFile() || info.size < 1024) continue
        return { file, size: info.size, mtimeMs: info.mtimeMs, contentType: typeOfExt(ext) }
      } catch {
        /* try next extension */
      }
    }
    return null
  }

  async function store(provider, id, buffer, contentType = 'audio/mpeg') {
    if (!Buffer.isBuffer(buffer) || buffer.length < 1024) return null
    const ext = extOf(contentType)
    const file = entryPath(provider, id, ext)
    if (file === null) return null
    try {
      await mkdir(join(root, safeId(provider)), { recursive: true })
      const temp = file + '.' + process.pid + '.' + Date.now() + '.tmp'
      await writeFile(temp, buffer)
      await rename(temp, file)
      await prune()
      return { file, size: buffer.length, contentType }
    } catch {
      return null
    }
  }

  async function listFiles() {
    const files = []
    let providers
    try {
      providers = await readdir(root, { withFileTypes: true })
    } catch {
      return files
    }
    for (const provider of providers) {
      if (!provider.isDirectory()) continue
      let names
      try {
        names = await readdir(join(root, provider.name), { withFileTypes: true })
      } catch {
        continue
      }
      for (const name of names) {
        if (!name.isFile()) continue
        const ext = name.name.includes('.') ? name.name.split('.').pop().toLowerCase() : ''
        if (!KNOWN_EXTS.includes(ext)) continue
        const file = join(root, provider.name, name.name)
        try {
          const info = await stat(file)
          files.push({ file, size: info.size, mtimeMs: info.mtimeMs })
        } catch {
          /* file vanished */
        }
      }
    }
    return files
  }

  async function stats() {
    const files = await listFiles()
    return {
      files: files.length,
      bytes: files.reduce((total, item) => total + item.size, 0),
      maxBytes,
    }
  }

  async function prune() {
    const files = await listFiles()
    let total = files.reduce((sum, item) => sum + item.size, 0)
    if (total <= maxBytes) return
    files.sort((left, right) => left.mtimeMs - right.mtimeMs)
    for (const item of files) {
      if (total <= maxBytes * 0.9) break
      try {
        await unlink(item.file)
        total -= item.size
      } catch {
        /* ignore */
      }
    }
  }

  async function clear() {
    const files = await listFiles()
    for (const item of files) {
      try {
        await unlink(item.file)
      } catch {
        /* ignore */
      }
    }
    return files.length
  }

  /** Open one cached entry as a read stream (Range handled by the caller). */
  function open(cached, options = {}) {
    return createReadStream(cached.file, options)
  }

  return { root, entryPath, lookup, store, stats, prune, clear, open }
}
