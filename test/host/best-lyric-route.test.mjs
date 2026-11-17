/**
 * `/online/best-lyric`: the upgrade search behind Folia's `autoUseBestLyric`.
 *
 * The route itself owns no cache any more: with `persist=1` a match is written into the
 * song's lyric record (`matched` + payload), which is what the next play reads; a request
 * without metadata never reaches a source and never writes a record.
 */

import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createOnlineRoutes } from '../../src/host/http/routes/online.js'
import { createLyricState } from '../../src/host/stores/lyric-state.js'
import { fakeReq, fakeRes } from '../helpers.mjs'

const dir = await mkdtemp(join(tmpdir(), 'dsh-music-best-lyric-'))
const lyricState = createLyricState({ dir: join(dir, 'lyric-state') })

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
    persist: '1',
    ...(extra.preferred === undefined ? {} : { preferred: String(extra.preferred) }),
  })
  return { params, url: new URL('http://127.0.0.1/music/online/best-lyric?' + params.toString()) }
}

function routesWith(io, state = lyricState) {
  return createOnlineRoutes({
    settings: { get: () => ({}) },
    profileState: async () => null,
    vipInfoState: async () => ({ vip: null, expiresAt: '' }),
    vipState: async () => null,
    invalidateProviderCaches: () => {},
    providerStore: undefined,
    kugouSessions: undefined,
    lyricState: state,
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

const recordOf = (provider, id) => lyricState.get('online:' + provider + ':' + id)

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

  // The match is written into the song's own record, so the next play reads it from there.
  const record = await recordOf('netease', '186016')
  assert.ok(record && record.matched, 'the match is persisted on the song record')
  assert.equal(record.matched.source, 'qq')
  assert.equal(record.matched.wordLevel, true)
  const payload = await lyricState.readPayload('online:netease:186016')
  assert.equal(payload.text, '[00:01.000]故事')
  assert.equal(payload.raw.formatHint, 'yrc')
}

// ── a miss persists nothing ────────────────────────────────────────────────

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
  // A miss can be a network failure, so it must not be remembered as "instrumental".
  assert.equal(await recordOf('qq', 'neg-miss'), null)
}

// ── no title: nothing is searched, and nothing is recorded ─────────────────

{
  const calls = []
  const routes = routesWith(wordLevelIo(calls))
  const answer = await ask(routes, 'qq', 'no-title', { title: '' })
  assert.equal(answer.status, 200)
  assert.equal(answer.body.match, null)
  assert.deepEqual(calls, [], 'a request without a title never reaches a source')
  // An unsearchable answer says nothing about this track, so no record is written.
  assert.equal(await recordOf('qq', 'no-title'), null)
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
  const answer = await ask(routesWith(lineOnly), 'kugouLite', 'line-only')
  assert.equal(answer.status, 200)
  // The runner hands back a line-level answer as the fallback; the client only replaces
  // the platform's lyric when `wordLevel` is true, so the flag must stay honest here.
  assert.equal(answer.body.match.wordLevel, false)
  assert.equal(answer.body.match.lrc, '[00:01.000]只有整行')
}

// ── the song's own record: an imported lyric, an instrumental verdict ──────

/** One request against the online routes with a JSON body. */
async function send(routes, pathname, method, params, body) {
  const url = new URL('http://127.0.0.1/music' + pathname + '?' + new URLSearchParams(params).toString())
  const res = fakeRes()
  await routes(
    fakeReq(url.pathname + url.search, method, { host: '127.0.0.1:1' }, body === undefined ? '' : JSON.stringify(body)),
    res,
    { url, pathname, method, params: url.searchParams },
  )
  return { status: res.status, body: res.json() }
}

{
  // No io may run: every answer below comes from the record.
  const routes = routesWith(unusedIo())
  const target = { provider: 'qq', id: 'record-1' }

  let answer = await send(routes, '/online/lyric-import', 'POST', {}, {
    ...target,
    text: '[00:01.000]导入的歌词',
    name: 'mine.lrc',
  })
  assert.equal(answer.status, 200)
  assert.equal(answer.body.source, 'imported')

  answer = await send(routes, '/online/lyric', 'GET', target)
  assert.equal(answer.status, 200)
  assert.equal(answer.body.source, 'imported', 'an imported lyric is served without asking the provider')
  assert.equal(answer.body.raw.lrcContent, '[00:01.000]导入的歌词')

  answer = await send(routes, '/online/lyric-state', 'GET', target)
  assert.equal(answer.body.source, 'imported')
  assert.equal(answer.body.imported, 'mine.lrc')

  // The instrumental verdict is an answer too: nothing is fetched, no lyric is shown.
  answer = await send(routes, '/online/lyric-choice', 'POST', {}, { ...target, pureMusic: true })
  assert.equal(answer.status, 200)
  answer = await send(routes, '/online/lyric', 'GET', target)
  assert.equal(answer.body.pureMusic, true)
  assert.equal(answer.body.lrc, '')
  assert.equal(answer.body.lines, null)

  answer = await send(routes, '/online/lyric-state', 'GET', target)
  assert.equal(answer.body.pureMusic, true)

  answer = await send(routes, '/online/lyric-choice', 'POST', {}, { ...target, source: 'bogus' })
  assert.equal(answer.status, 400)
}

// ── AMLL is probed through a NetEase candidate for a non-NetEase track ─────

{
  const calls = []
  const io = {
    search: async (sourceId, query, limit) => {
      calls.push(['search', sourceId, query, limit])
      return [{ id: 'ncm-9', title: track.title, artist: track.artist, album: track.album, durationMs: 269000 }]
    },
    fetchLyric: async (sourceId, id) => {
      calls.push(['lyric', sourceId, id])
      return null
    },
    fetchAmll: async (platform, id) => {
      calls.push(['amll', platform, id])
      return null
    },
  }
  // The listener prefers AMLL, so the pick reaches it before any platform search.
  const answer = await ask(routesWith(io), 'kugouLite', 'kg-1', { preferred: 'amll' })
  assert.equal(answer.status, 200)
  assert.deepEqual(calls[0], ['search', 'netease', '晴天 周杰伦', 10], 'the AMLL ids come from a NetEase search')
  assert.deepEqual(calls[1], ['amll', 'ncm', 'ncm-9'], 'AMLL is asked with the candidate id it can key on')
}

console.log('best-lyric-route.test.mjs ok')

