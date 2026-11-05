/**
 * Last playback state for dsh-music-panel.
 *
 * Mirrors the resume behaviour of mainstream players (NetEase "remember the
 * last playback position on start", Spotify/YouTube Music restoring the queue):
 * the queue, the current index, the position and loop/order are written while
 * playing and read once when the plugin starts again.
 *
 * Stored as `<DSH_HOME>/music/playback.json`. Pure Node.
 *
 * @module dsh-music-panel/playback
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const MAX_QUEUE = 500
const LOOPS = new Set(['all', 'one', 'none'])
const ORDERS = new Set(['list', 'random'])

function finiteOr(value, fallback) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

/**
 * Coerce an arbitrary payload into a state the client can trust, or null.
 *
 * @param {unknown} raw
 * @returns {{queue: string[], index: number, positionSec: number, durationSec: number, loop: string, order: string, updatedAt: number} | null}
 */
export function sanitizePlayback(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null
  const queue = Array.isArray(raw.queue)
    ? raw.queue.filter((path) => typeof path === 'string' && path !== '').slice(0, MAX_QUEUE)
    : []
  const durationSec = Math.max(0, finiteOr(raw.durationSec, 0))
  const positionSec = clamp(Math.max(0, finiteOr(raw.positionSec, 0)), 0, durationSec > 0 ? durationSec : Number.MAX_SAFE_INTEGER)
  const index = queue.length === 0
    ? -1
    : clamp(Math.floor(finiteOr(raw.index, 0)), 0, queue.length - 1)
  const loop = LOOPS.has(raw.loop) ? raw.loop : 'all'
  const order = ORDERS.has(raw.order) ? raw.order : 'list'
  return {
    queue,
    index,
    positionSec: Math.round(positionSec * 10) / 10,
    durationSec,
    loop,
    order,
    updatedAt: Math.max(0, Math.round(finiteOr(raw.updatedAt, 0))),
  }
}

/**
 * @param {{ dir: string }} options `dir` is `<DSH_HOME>/music`
 */
export function createPlayback({ dir }) {
  const file = join(dir, 'playback.json')
  /** `undefined` = not read yet, `null` = no usable file. */
  let cache

  async function read() {
    if (cache !== undefined) return cache
    let parsed = null
    try {
      parsed = JSON.parse(await readFile(file, 'utf8'))
    } catch {
      parsed = null
    }
    cache = sanitizePlayback(parsed)
    return cache
  }

  async function write(raw) {
    const next = sanitizePlayback(raw)
    if (next === null) return null
    next.updatedAt = Date.now()
    await mkdir(dir, { recursive: true })
    await writeFile(file, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
    cache = next
    return next
  }

  return {
    file,
    read,
    write,
    invalidate() {
      cache = undefined
    },
  }
}
