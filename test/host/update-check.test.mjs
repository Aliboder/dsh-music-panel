/**
 * New-version check: semver ordering and the checker's cache/fallback/backoff rules.
 * Everything is injected — no network, no real registry.
 */

import assert from 'node:assert/strict'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { compareVersions, isNewerRelease, parseVersion } from '../../src/host/services/update/semver.js'
import { createUpdateChecker, UPDATE_CACHE_FILE, UPDATE_SOURCES } from '../../src/host/services/update/checker.js'

// ── semver ────────────────────────────────────────────────────────────────
assert.equal(compareVersions('0.47.1', '0.47.0'), 1)
assert.equal(compareVersions('0.48.0', '0.47.9'), 1)
assert.equal(compareVersions('v0.47.1', '0.47.1'), 0)
assert.equal(compareVersions('0.47.1', 'junk'), 0, 'an unknown version never claims an order')
assert.equal(isNewerRelease('0.48.0', '0.47.1'), true)
assert.equal(isNewerRelease('0.47.1', '0.47.1'), false)
assert.equal(isNewerRelease('0.47.0', '0.47.1'), false)
assert.equal(isNewerRelease('0.48.0-beta.1', '0.48.0'), false, 'a preview is older than its release')
assert.equal(isNewerRelease('0.48.0', '0.48.0-rc.2'), true)
assert.equal(isNewerRelease('0.48.0-rc.2', '0.48.0-rc.1'), true)
assert.deepEqual(parseVersion('v1.2.3'), { major: 1, minor: 2, patch: 3, rank: 4, serial: 0 })
assert.equal(parseVersion('1.2'), null)
assert.equal(parseVersion(''), null)

// ── helpers ───────────────────────────────────────────────────────────────
const json = (body) => ({ ok: true, json: async () => body })
const missing = { ok: false, json: async () => ({}) }

function fetcher(routes) {
  const calls = []
  const fetchImpl = async (url) => {
    calls.push(url)
    const handler = routes[url]
    if (handler === undefined) throw new Error('unexpected URL ' + url)
    if (typeof handler === 'function') return handler()
    return handler
  }
  return { fetchImpl, calls }
}

async function makeChecker(options = {}) {
  const dir = options.dir ?? (await mkdtemp(join(tmpdir(), 'dsh-music-update-')))
  const config = options.config ?? { updateCheck: true, updateCheckIntervalHours: 1 }
  const checker = createUpdateChecker({
    dir,
    getConfig: async () => config,
    fetchImpl: options.fetchImpl,
    now: options.now ?? (() => Date.now()),
    readVersion: options.readVersion ?? (() => '0.47.1'),
  })
  return { checker, dir, config }
}

const NPM = UPDATE_SOURCES[0].url
const MIRROR = UPDATE_SOURCES[1].url
const GITHUB = UPDATE_SOURCES[2].url

// ── npm answers first ─────────────────────────────────────────────────────
{
  let clock = 1_000_000
  const { fetchImpl, calls } = fetcher({ [NPM]: json({ version: '0.48.0' }) })
  const { checker, dir } = await makeChecker({ fetchImpl, now: () => clock })
  const first = await checker.read()
  assert.equal(first.current, '0.47.1')
  assert.equal(first.latest, '0.48.0')
  assert.equal(first.updateAvailable, true)
  assert.equal(first.failed, false)
  assert.equal(first.source, 'npm')
  assert.equal(first.checkedAt, clock)
  assert.equal(first.disabled, false)
  assert.equal(first.intervalHours, 1)
  assert.equal(calls.length, 1)
  // Fresh answer: no second request inside the interval.
  clock += 30 * 60 * 1000
  assert.equal((await checker.read()).latest, '0.48.0')
  assert.equal(calls.length, 1, 'the interval keeps the cached answer')
  // Force bypasses the interval.
  const forced = await checker.read({ force: true })
  assert.equal(forced.latest, '0.48.0')
  assert.equal(calls.length, 2, 'force asks again')
  // The cache file carries the answer across processes.
  const saved = JSON.parse(await readFile(join(dir, UPDATE_CACHE_FILE), 'utf8'))
  assert.equal(saved.latest, '0.48.0')
  assert.equal(saved.source, 'npm')
  assert.equal(saved.failed, false)
  // A new process reads the cache without a request.
  const { fetchImpl: silent, calls: silentCalls } = fetcher({})
  const { checker: second } = await makeChecker({ dir, fetchImpl: silent, now: () => clock })
  assert.equal((await second.read()).latest, '0.48.0')
  assert.equal(silentCalls.length, 0, 'a fresh disk cache needs no request')
}

// ── fallbacks: npm → npmmirror → GitHub ──────────────────────────────────
{
  const { fetchImpl, calls } = fetcher({
    [NPM]: () => { throw new Error('offline') },
    [MIRROR]: json({ version: '0.49.0' }),
  })
  const { checker } = await makeChecker({ fetchImpl })
  const read = await checker.read()
  assert.equal(read.latest, '0.49.0')
  assert.equal(read.source, 'npmmirror')
  assert.equal(calls.length, 2)
}
{
  const { fetchImpl, calls } = fetcher({
    [NPM]: missing,
    [MIRROR]: missing,
    [GITHUB]: json({ tag_name: 'v0.50.0' }),
  })
  const { checker } = await makeChecker({ fetchImpl })
  const read = await checker.read()
  assert.equal(read.latest, '0.50.0')
  assert.equal(read.source, 'github', 'the release tag is the last fallback')
  assert.equal(calls.length, 3)
}

// ── all sources fail: silent, backed off, empty latest ───────────────────
{
  let clock = 2_000_000
  const { fetchImpl, calls } = fetcher({
    [NPM]: () => { throw new Error('offline') },
    [MIRROR]: () => { throw new Error('offline') },
    [GITHUB]: () => { throw new Error('offline') },
  })
  const { checker, dir } = await makeChecker({ fetchImpl, now: () => clock })
  const failed = await checker.read()
  assert.equal(failed.failed, true)
  assert.equal(failed.latest, '')
  assert.equal(failed.updateAvailable, null)
  assert.equal(calls.length, 3)
  // Backoff: no request inside 30 minutes.
  clock += 10 * 60 * 1000
  await checker.read()
  assert.equal(calls.length, 3, 'a failed check retries after the backoff, not immediately')
  // After the backoff it tries again.
  clock += 21 * 60 * 1000
  await checker.read()
  assert.equal(calls.length, 6)
  const saved = JSON.parse(await readFile(join(dir, UPDATE_CACHE_FILE), 'utf8'))
  assert.equal(saved.failed, true)
}

// ── a failed check keeps the last good latest ────────────────────────────
{
  let clock = 3_000_000
  const { fetchImpl, calls } = fetcher({
    [NPM]: json({ version: '0.48.0' }),
    [MIRROR]: () => { throw new Error('offline') },
    [GITHUB]: () => { throw new Error('offline') },
  })
  const { checker } = await makeChecker({ fetchImpl, now: () => clock })
  await checker.read()
  assert.equal(calls.length, 1)
  clock += 61 * 60 * 1000
  // Start from a saved success in the same dir, then let the next check fail.
  const savedDir = (await mkdtemp(join(tmpdir(), 'dsh-music-update-')))
  const warm = createUpdateChecker({
    dir: savedDir,
    getConfig: async () => ({ updateCheck: true, updateCheckIntervalHours: 1 }),
    fetchImpl: fetcher({ [NPM]: json({ version: '0.48.0' }) }).fetchImpl,
    now: () => clock - 2 * 60 * 60 * 1000,
    readVersion: () => '0.47.1',
  })
  await warm.read()
  const cold = createUpdateChecker({
    dir: savedDir,
    getConfig: async () => ({ updateCheck: true, updateCheckIntervalHours: 1 }),
    fetchImpl: fetcher({
      [NPM]: () => { throw new Error('offline') },
      [MIRROR]: () => { throw new Error('offline') },
      [GITHUB]: () => { throw new Error('offline') },
    }).fetchImpl,
    now: () => clock,
    readVersion: () => '0.47.1',
  })
  const stale = await cold.read()
  assert.equal(stale.failed, true)
  assert.equal(stale.latest, '0.48.0', 'the last good answer stays visible after a failed refresh')
  assert.equal(stale.updateAvailable, true)
}

// ── disabled by config: no request at all ────────────────────────────────
{
  const { fetchImpl, calls } = fetcher({})
  const { checker } = await makeChecker({
    fetchImpl,
    config: { updateCheck: false, updateCheckIntervalHours: 1 },
  })
  const read = await checker.read()
  assert.equal(read.disabled, true)
  assert.equal(read.latest, '')
  assert.equal(calls.length, 0)
}

// ── the default current version comes from the installed package.json ────
{
  const pkg = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8'))
  const dir = await mkdtemp(join(tmpdir(), 'dsh-music-update-'))
  const { fetchImpl } = fetcher({ [NPM]: json({ version: '0.0.1' }) })
  const checker = createUpdateChecker({
    dir,
    getConfig: async () => ({ updateCheck: true, updateCheckIntervalHours: 1 }),
    fetchImpl,
  })
  const read = await checker.read()
  assert.equal(read.current, pkg.version, 'the installed package version is the current one')
  assert.equal(read.updateAvailable, false)
}

// ── an equal version is not an update ────────────────────────────────────
{
  const { fetchImpl } = fetcher({ [NPM]: json({ version: '0.47.1' }) })
  const { checker } = await makeChecker({ fetchImpl, readVersion: () => '0.47.1' })
  const read = await checker.read()
  assert.equal(read.updateAvailable, false)
}

console.log('update-check.test.mjs ok')
