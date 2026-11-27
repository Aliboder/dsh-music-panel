/**
 * The plugin's own new-version check.
 *
 * Everything happens on the Host: the browser never talks to npm or GitHub. The answer is
 * cached on disk (`<DSH_HOME>/music/update-check.json`), so a restart can show the last
 * known state before any request, and an offline machine keeps working silently.
 *
 * Sources are tried in order (npm → npmmirror → GitHub releases). A failed attempt gets a
 * shorter retry window than a successful one so one flaky request does not hide an update
 * for a whole hour.
 *
 * @module dsh-music-panel/update/checker
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readJsonWithBackup, writeJsonAtomic } from '../../stores/json-store.js'
import { isNewerRelease } from './semver.js'

// <root>/src/host/services/update/checker.js → up five levels is the plugin root.
const PLUGIN_ROOT = dirname(dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url))))))

/** Tried in this order; the first readable answer wins. */
export const UPDATE_SOURCES = Object.freeze([
  {
    id: 'npm',
    url: 'https://registry.npmjs.org/dsh-music-panel/latest',
    pick: (body) => (typeof body?.version === 'string' ? body.version : ''),
  },
  {
    id: 'npmmirror',
    url: 'https://registry.npmmirror.com/dsh-music-panel/latest',
    pick: (body) => (typeof body?.version === 'string' ? body.version : ''),
  },
  {
    id: 'github',
    url: 'https://api.github.com/repos/Aliboder/dsh-music-panel/releases/latest',
    pick: (body) => (typeof body?.tag_name === 'string' ? body.tag_name.replace(/^v/i, '') : ''),
  },
])

export const UPDATE_CACHE_FILE = 'update-check.json'
const CACHE_FORMAT = 1
const FETCH_TIMEOUT_MS = 8_000
const FAILURE_BACKOFF_MS = 30 * 60 * 1000
/** After this long without a successful check the cached `latest` is not trusted any more. */
const LAST_SUCCESS_TTL_MS = 7 * 24 * 60 * 60 * 1000
const DEFAULT_INTERVAL_HOURS = 1
const MIN_INTERVAL_HOURS = 1
const MAX_INTERVAL_HOURS = 168

function intervalMsOf(config) {
  const hours = Number(config?.updateCheckIntervalHours)
  const bounded = Number.isFinite(hours) ? Math.min(MAX_INTERVAL_HOURS, Math.max(MIN_INTERVAL_HOURS, hours)) : DEFAULT_INTERVAL_HOURS
  return bounded * 60 * 60 * 1000
}

function readOwnVersion() {
  try {
    const parsed = JSON.parse(readFileSync(join(PLUGIN_ROOT, 'package.json'), 'utf8'))
    return typeof parsed?.version === 'string' ? parsed.version : ''
  } catch {
    return ''
  }
}

/**
 * @param {{
 *   dir: string,
 *   getConfig: () => Promise<object>,
 *   fetchImpl?: typeof fetch,
 *   now?: () => number,
 *   readVersion?: () => string,
 * }} options
 */
export function createUpdateChecker(options) {
  const dir = options.dir
  const getConfig = options.getConfig
  const fetchImpl = options.fetchImpl ?? (typeof fetch === 'function' ? fetch : null)
  const now = options.now ?? (() => Date.now())
  const readVersion = options.readVersion ?? readOwnVersion
  const file = join(dir, UPDATE_CACHE_FILE)

  let cache = null
  let loaded = false
  let inflight = null

  function emptyCache() {
    return { latest: '', source: '', checkedAt: 0, failed: false, lastSuccessAt: 0, retryAt: 0 }
  }

  function sanitizeCache(raw) {
    const value = raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
    return {
      latest: typeof value.latest === 'string' ? value.latest : '',
      source: typeof value.source === 'string' ? value.source : '',
      checkedAt: Number.isFinite(value.checkedAt) ? value.checkedAt : 0,
      failed: value.failed === true,
      lastSuccessAt: Number.isFinite(value.lastSuccessAt) ? value.lastSuccessAt : 0,
      retryAt: Number.isFinite(value.retryAt) ? value.retryAt : 0,
    }
  }

  async function load() {
    if (loaded) return cache
    loaded = true
    const raw = await readJsonWithBackup(file)
    cache = raw !== null && raw.v === CACHE_FORMAT ? sanitizeCache(raw) : emptyCache()
    return cache
  }

  async function save() {
    try {
      await writeJsonAtomic(file, {
        v: CACHE_FORMAT,
        latest: cache.latest,
        source: cache.source,
        checkedAt: cache.checkedAt,
        failed: cache.failed,
        lastSuccessAt: cache.lastSuccessAt,
        retryAt: cache.retryAt,
      })
    } catch {
      // A cache write is best effort: the answer is still correct for this process.
    }
  }

  async function fetchOne(source) {
    if (fetchImpl === null) return ''
    const response = await fetchImpl(source.url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!response.ok) return ''
    const body = await response.json()
    const value = source.pick(body)
    return typeof value === 'string' ? value.trim() : ''
  }

  async function refresh() {
    if (fetchImpl === null || typeof AbortSignal === 'undefined' || typeof AbortSignal.timeout !== 'function') {
      return
    }
    for (const source of UPDATE_SOURCES) {
      try {
        const latest = await fetchOne(source)
        if (latest === '') continue
        const at = now()
        cache = {
          latest,
          source: source.id,
          checkedAt: at,
          failed: false,
          lastSuccessAt: at,
          retryAt: 0,
        }
        await save()
        return
      } catch {
        // Try the next source.
      }
    }
    const at = now()
    cache = Object.assign({}, cache, {
      checkedAt: at,
      failed: true,
      retryAt: at + FAILURE_BACKOFF_MS,
      latest: cache.lastSuccessAt !== 0 && at - cache.lastSuccessAt < LAST_SUCCESS_TTL_MS ? cache.latest : '',
    })
    await save()
  }

  function shape(config, disabled) {
    const current = readVersion()
    const latest = cache.latest !== '' ? cache.latest : ''
    return {
      current,
      latest,
      updateAvailable: latest !== '' && current !== '' ? isNewerRelease(latest, current) : null,
      checkedAt: cache.checkedAt,
      failed: cache.failed,
      source: cache.source,
      disabled: disabled === true,
      intervalHours: intervalMsOf(config) / (60 * 60 * 1000),
    }
  }

  return {
    /** Read the state, refreshing when stale (or when `force` is set). */
    async read(options = {}) {
      const config = (await getConfig()) ?? {}
      await load()
      if (config.updateCheck === false) return shape(config, true)
      const force = options.force === true
      // A successful answer is reused for the whole interval; a failed one only gets the
      // short backoff, so one flaky request does not hide an update for an hour.
      const fresh = !cache.failed && cache.checkedAt !== 0 && now() - cache.checkedAt < intervalMsOf(config)
      const backingOff = cache.failed && cache.retryAt !== 0 && now() < cache.retryAt
      if (!force && (fresh || backingOff)) return shape(config, false)
      if (inflight === null) {
        inflight = refresh().finally(() => {
          inflight = null
        })
      }
      await inflight
      return shape(config, false)
    },
    /** The cached state without any network work. */
    async cached() {
      const config = (await getConfig()) ?? {}
      await load()
      return shape(config, config.updateCheck === false)
    },
  }
}
