/**
 * Per-track statistics for dsh-music-panel: when a file first entered the library
 * and how many times it was played.
 *
 * Stored next to the settings in `<DSH_HOME>/music/stats.json`. Pure Node.
 *
 * @module dsh-music-panel/stats
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

/** Bound the file so a long-lived library cannot grow without limit. */
const MAX_ENTRIES = 20_000

function sanitizeEntry(raw) {
  if (raw === null || typeof raw !== 'object') return null
  const addedAt = Number(raw.addedAt)
  const plays = Number(raw.plays)
  return {
    addedAt: Number.isFinite(addedAt) && addedAt > 0 ? addedAt : Date.now(),
    plays: Number.isFinite(plays) && plays >= 0 ? Math.floor(plays) : 0,
  }
}

/**
 * @param {{ dir: string }} options `dir` is `<DSH_HOME>/music`
 */
export function createStats({ dir }) {
  const file = join(dir, 'stats.json')
  let cache = null

  async function load() {
    if (cache !== null) return cache
    let parsed = null
    try {
      parsed = JSON.parse(await readFile(file, 'utf8'))
    } catch {
      parsed = null
    }
    const rows = parsed !== null && parsed.tracks !== null && typeof parsed.tracks === 'object' ? parsed.tracks : {}
    const next = {}
    for (const [path, raw] of Object.entries(rows)) {
      const entry = sanitizeEntry(raw)
      if (entry !== null) next[path] = entry
      if (Object.keys(next).length >= MAX_ENTRIES) break
    }
    cache = next
    return cache
  }

  async function save() {
    await mkdir(dir, { recursive: true })
    await writeFile(file, `${JSON.stringify({ tracks: cache }, null, 2)}\n`, 'utf8')
  }

  return {
    /** Register every path the library scan just saw; returns the map. */
    async ensure(paths) {
      const tracks = await load()
      const now = Date.now()
      let dirty = false
      for (const path of paths) {
        if (tracks[path] === undefined) {
          tracks[path] = { addedAt: now, plays: 0 }
          dirty = true
        }
      }
      if (dirty) await save()
      return tracks
    },

    async get(path) {
      const tracks = await load()
      return tracks[path] ?? null
    },

    async recordPlay(path) {
      const tracks = await load()
      const entry = tracks[path] ?? { addedAt: Date.now(), plays: 0 }
      entry.plays = (Number(entry.plays) || 0) + 1
      tracks[path] = entry
      await save()
      return { ...entry }
    },

    /** In-memory view; the file is read once per process. */
    async snapshot() {
      return { ...(await load()) }
    },

    invalidate() {
      cache = null
    },
  }
}
