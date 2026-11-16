/**
 * `/online/best-lyric`: the upgrade search behind Folia's `autoUseBestLyric`.
 *
 * The route itself owns the cache, so this drives the real handler with the network
 * callbacks injected (`deps.lyricMatchIo`) instead of reaching a platform: what is being
 * tested is the search order, the shape handed to the client, and the rule that both a
 * hit and a miss are cached (a miss for 24 hours, a match until the lyric cache is
 * cleared). Without that rule a replay searches up to four sources for every line-level
 * lyric.
 */

import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createOnlineCache } from '../src/host/services/media/online-cache.js'
import { createOnlineRoutes } from '../src/host/http/routes/online.js'
import { fakeReq, fakeRes } from './helpers.mjs'

const dir = await mkdtemp(join(tmpdir(), 'dsh-music-best-lyric-'))
const onlineCache = createOnlineCache({ dir })

/** The one track every query below is about; the runner scores candidates against it. */
const track = { title: '晴天', artist: '周杰伦', album: '叶惠美', duration: 269 }

function queryOf(provider, id, extra = {}) {
  const params = new URLSearchParams({
    provider,
    id,
    title: extra.title ?? track.title,
    artist: extra.artist ?? track.artist,
    album: extra.album ?? track.album,
    duration: String(extra.duration ?? track.duration),
  })
  return { params, url: new URL('http://127.0.0.1/music/online/best-lyric?' + params.toString()) }
}

function routesWith(io) {
  return createOnlineRoutes({
    settings: { get: () => ({}) },
    profileState: async () => null,
    vipInfoState: async () => ({ vip: null, expiresAt: '' }),
    vipState: async () => null,
    invalidateProviderCaches: () => {},
    providerStore: undefined,
    onlineCache,
    kugouSessions: undefined,
    lyricMatchIo: io,
  })
}

async function ask(routes, provider, id, extra) {
  const { params, url } = queryOf(provider, id, extra)
  const res = fakeRes()
  await routes(fakeReq(url.pathname + url.search, 'GET', { host: '127.0.0.1:1' }), res, {
    url,
    pathname: '/online/best-lyric',
    method: 'GET',
    params,
  })
  return { status: res.status, body: res.json() }
}

/** The cache write is fire-and-forget, so wait for it instead of sleeping blindly. */
async function waitForCache(provider, id, accept = (value) => value !== null, timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const value = await onlineCache.readMeta(provider, id, 'best-lyric')
    if (accept(value)) return value
    if (Date.now() > deadline) return value
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

function wordLevelIo(calls) {
  return {
    search: async (sourceId, query, limit) => {
      calls.push(['search', sourceId, query, limit])
      return [{ id: sourceId + '-1', title: track.title, artist: track.artist, album: track.album, durationMs: 269000 }]
    },
    fetchLyric: async (sourceId, id) => {
      calls.push(['lyric', sourceId, id])
      return {
        lines: [{ t: 1, end: 2, text: '故事', words: [{ t: 1, end: 2, text: '故事' }] }],
        lrc: '[00:01.000]故事',
        translation: '',
        romaji: '',
        raw: { type: 'local', lrcContent: '[1000,2000](1000,500,0)故事', formatHint: 'yrc' },
      }
    },
    fetchAmll: async (platform, id) => {
      calls.push(['amll', platform, id])
      return null
    },
  }
}

const silentIo = () => ({
  search: async () => [],
  fetchLyric: async () => null,
  fetchAmll: async () => null,
})

/** An io that must not be reached: the answer has to come from the cache. */
function unusedIo() {
  const io = {}
  for (const name of ['search', 'fetchLyric', 'fetchAmll']) {
    io[name] = async () => {
      throw new Error(`lyricMatchIo.${name} must not run: the cache should have answered`)
    }
  }
  return io
}

// ── a word-level match from another source ─────────────────────────────────

{
  const calls = []
  const routes = routesWith(wordLevelIo(calls))
  const first = await ask(routes, 'netease', '186016')
  assert.equal(first.status, 200)
  assert.equal(first.body.ok, true)
  assert.equal(first.body.cached, undefined, 'a fresh search is not marked cached')
  const match = first.body.match
  assert.equal(match.source, 'qq', 'the first word-level answer wins')
  assert.equal(match.id, 'qq-1')
  assert.equal(match.wordLevel, true)
  assert.equal(match.score, 100)
  // The client needs the lender's own document to parse it with Folia's pipeline.
  assert.equal(match.raw.formatHint, 'yrc')
  assert.equal(match.lrc, '[00:01.000]故事', 'line text without a raw document still comes back as LRC')
  assert.equal(match.translation, '')
  assert.equal(match.lines.length, 1)
  assert.deepEqual(calls[0], ['amll', 'ncm', '186016'], 'AMLL is asked first for a NetEase track')
  assert.ok(calls.some(([kind]) => kind === 'lyric'), 'the matching source was actually fetched')

  // Cached hit: the answer comes back, and no source is asked again.
  const cached = await waitForCache('netease', '186016')
  assert.equal(cached.v, 2, 'the cache entry carries its shape version')
  assert.equal(cached.match.source, 'qq')
  const second = await ask(routesWith(unusedIo()), 'netease', '186016')
  assert.equal(second.status, 200)
  assert.equal(second.body.cached, true)
  assert.deepEqual(second.body.match, match)

  // A stored match never expires: it is replaced only when the lyric cache is cleared.
  await onlineCache.writeMeta('netease', '186016', 'best-lyric', {
    v: 2,
    match,
    at: Date.now() - 40 * 24 * 60 * 60 * 1000,
  })
  const old = await ask(routesWith(unusedIo()), 'netease', '186016')
  assert.equal(old.body.cached, true, 'a 40-day-old match is still served')
  assert.deepEqual(old.body.match, match)
}

// ── a miss is cached for 24 hours ──────────────────────────────────────────

{
  const calls = []
  const io = silentIo()
  const counting = {
    search: async (...args) => {
      calls.push(args[0])
      return io.search(...args)
    },
    fetchLyric: io.fetchLyric,
    fetchAmll: io.fetchAmll,
  }
  const routes = routesWith(counting)
  const missed = await ask(routes, 'qq', 'neg-miss')
  assert.equal(missed.status, 200)
  assert.equal(missed.body.match, null)
  assert.ok(calls.length > 0, 'a miss walks the sources')
  assert.equal(calls.includes('qq'), false, 'the track\'s own platform is not asked')

  const stored = await waitForCache('qq', 'neg-miss')
  assert.equal(stored.v, 2)
  assert.equal(stored.match, null)

  // Within the day: answered from the cache, no search.
  const cachedMiss = await ask(routesWith(unusedIo()), 'qq', 'neg-miss')
  assert.equal(cachedMiss.body.cached, true)
  assert.equal(cachedMiss.body.match, null)

  // After the day: searched again, and a match replaces the miss.
  await onlineCache.writeMeta('qq', 'neg-miss', 'best-lyric', {
    v: 2,
    match: null,
    at: Date.now() - 25 * 60 * 60 * 1000,
  })
  const retriedCalls = []
  const retried = await ask(routesWith(wordLevelIo(retriedCalls)), 'qq', 'neg-miss')
  assert.equal(retried.body.cached, undefined, 'an expired miss is searched again')
  assert.equal(retried.body.match.wordLevel, true)
  assert.ok(retriedCalls.length > 0)
  const replaced = await waitForCache('qq', 'neg-miss', (value) => value !== null && value.match !== null)
  assert.notEqual(replaced.match, null, 'the found match replaces the stale miss')
}

// ── no title: nothing is searched, and nothing is cached ───────────────────

{
  const calls = []
  const routes = routesWith(wordLevelIo(calls))
  const answer = await ask(routes, 'qq', 'no-title', { title: '' })
  assert.equal(answer.status, 200)
  assert.equal(answer.body.match, null)
  assert.deepEqual(calls, [], 'a request without a title never reaches a source')
  // An unsearchable answer says nothing about this track: caching it would hide the real
  // answer for a day once the client sent the metadata.
  await new Promise((resolve) => setTimeout(resolve, 100))
  assert.equal(await onlineCache.readMeta('qq', 'no-title', 'best-lyric'), null)
}

// ── an entry from a previous shape is searched again ───────────────────────

{
  await onlineCache.writeMeta('kugou', 'old-shape', { v: 1, match: null, at: Date.now() })
  const calls = []
  const answer = await ask(routesWith(wordLevelIo(calls)), 'kugou', 'old-shape')
  assert.equal(answer.body.cached, undefined, 'v1 entries are ignored')
  assert.ok(calls.length > 0)
}

// ── the answer never claims word-level without it ──────────────────────────

{
  const lineOnly = {
    search: async (sourceId) => [
      { id: sourceId + '-line', title: track.title, artist: track.artist, album: track.album, durationMs: 269000 },
    ],
    fetchLyric: async () => ({ lines: [{ t: 1, end: 2, text: '只有整行' }], lrc: '[00:01.000]只有整行' }),
    fetchAmll: async () => null,
  }
  const answer = await ask(routesWith(lineOnly), 'kugou', 'line-only')
  assert.equal(answer.status, 200)
  // The runner hands back a line-level answer as the fallback; the client only replaces
  // the platform's lyric when `wordLevel` is true, so the flag must stay honest here.
  assert.equal(answer.body.match.wordLevel, false)
  assert.equal(answer.body.match.lrc, '[00:01.000]只有整行')
}

console.log('best-lyric-route.test.mjs ok')

