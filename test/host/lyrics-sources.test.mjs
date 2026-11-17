/**
 * Lyric sources + AMLL + runner: registry order, TTML parsing and the fallback
 * rules that let one platform borrow another's lyrics.
 */

import assert from 'node:assert/strict'
import { parseTtml, parseTtmlTime, buildLyricsUrl, createAmllClient } from '../../src/host/services/lyrics/amll.js'
import {
  LYRIC_SOURCE_IDS,
  buildLyricSourceOrder,
  getPlatformLyricSource,
  offeredSources,
} from '../../src/host/services/lyrics/lyrics-sources.js'
import {
  AUTO_MATCH_SEARCH_LIMIT,
  buildLyricSearchQuery,
  findBestLyrics,
  hasRenderableLyrics,
  linesFromLrc,
  lrcTime,
  withTimeout,
} from '../../src/host/services/lyrics/lyrics-match-runner.js'

// ── registry ───────────────────────────────────────────────────────────────

assert.deepEqual(LYRIC_SOURCE_IDS, ['netease', 'amll', 'qq', 'kugouLite', 'qishui'])
assert.equal(getPlatformLyricSource('netease').id, 'netease')
assert.equal(getPlatformLyricSource('kugouLite').id, 'kugouLite', 'source ids are the provider ids')
assert.equal(getPlatformLyricSource('amll'), undefined, 'AMLL is not a platform')
assert.equal(getPlatformLyricSource('bodian'), undefined, 'Bodian is not a lyric source (Folia keeps it out too)')
assert.deepEqual(
  buildLyricSourceOrder('qq').map((source) => source.id),
  ['qq', 'netease', 'amll', 'kugouLite', 'qishui'],
  'the preferred source goes first, the rest keep registry order',
)
// Capability filtering is exercised through the order builder, since none of our
// sources needs configuration.
assert.deepEqual(
  buildLyricSourceOrder('netease', (source) => source.id !== 'kugouLite').map((source) => source.id),
  ['netease', 'amll', 'qq', 'qishui'],
  'a source that is not offered is skipped',
)
assert.deepEqual(
  offeredSources({ platform: 'netease', hasAccount: false }).sort(),
  ['amll', 'kugouLite', 'netease', 'qishui', 'qq'],
)

// ── TTML ───────────────────────────────────────────────────────────────────

assert.equal(parseTtmlTime('1234ms'), 1.234)
assert.equal(parseTtmlTime('1.5s'), 1.5)
assert.equal(parseTtmlTime('00:01.500'), 1.5)
assert.equal(parseTtmlTime('00:00:02.250'), 2.25)
assert.equal(parseTtmlTime(''), null)

const ttml = `<?xml version="1.0"?>
<tt xmlns="http://www.w3.org/ns/ttml">
  <body><div>
    <p begin="1.0s" end="3.0s"><span begin="1.0s" end="1.5s">故</span><span begin="1.5s" end="3.0s">事</span></p>
    <p begin="4.0s" end="6.0s">整行没有逐字</p>
  </div></body>
</tt>`

const parsed = parseTtml(ttml)
assert.equal(parsed.length, 2)
assert.equal(parsed[0].text, '故事')
assert.equal(parsed[0].wordLevel, true)
assert.equal(parsed[0].words.length, 2)
assert.equal(parsed[0].words[0].t, 1)
assert.equal(parsed[1].text, '整行没有逐字')
assert.equal(parsed[1].words, undefined)
assert.equal(parseTtml('<html></html>'), null, 'non-TTML answers are rejected')
assert.equal(parseTtml(''), null)

// ── AMLL client ────────────────────────────────────────────────────────────

assert.ok(buildLyricsUrl('ncm', 123).includes('ncmMusicId=123'))
assert.ok(buildLyricsUrl('qq', 'abc').includes('qqMusicId=abc'))

const requested = []
const amll = createAmllClient({
  baseUrl: 'https://example.test',
  fetchImpl: async (url) => {
    requested.push(url)
    return {
      ok: true,
      json: async () => ({ data: { lyrics: ttml } }),
    }
  },
})
const fetched = await amll.fetchLyrics('ncm', 123)
assert.equal(fetched.source, 'amll')
assert.equal(fetched.lines.length, 2)
assert.ok(requested[0].startsWith('https://example.test/v1/lyrics/get'))

const emptyAmll = createAmllClient({ fetchImpl: async () => ({ ok: false, json: async () => ({}) }) })
assert.equal(await emptyAmll.fetchLyrics('qq', 'x'), null)

// ── runner ─────────────────────────────────────────────────────────────────

const track = { title: '晴天', artist: '周杰伦', album: '叶惠美', durationMs: 269000 }
assert.equal(buildLyricSearchQuery(track), '晴天 周杰伦')
assert.equal(AUTO_MATCH_SEARCH_LIMIT, 10)
assert.equal(hasRenderableLyrics({ lines: [] }), false)
assert.equal(hasRenderableLyrics({ lines: [{ text: '' }] }), false)
assert.equal(hasRenderableLyrics({ lines: [{ text: 'x' }] }), true)

await assert.rejects(() => withTimeout(new Promise(() => {}), 20, 'slow'), /timed out/)

const sawSources = []
const wordLyric = { lines: [{ t: 1, end: 2, text: '故事', words: [{ t: 1, end: 2, text: '故事' }] }] }
const lineLyric = { lines: [{ t: 1, end: 2, text: '只有整行' }] }

const result = await findBestLyrics(track, {
  order: ['netease', 'qq'],
  search: async (sourceId, query, limit) => {
    sawSources.push([sourceId, query, limit])
    return [{ id: sourceId + '-1', title: '晴天', artist: '周杰伦', album: '叶惠美', durationMs: 269000 }]
  },
  fetchLyric: async (sourceId) => (sourceId === 'qq' ? wordLyric : lineLyric),
})
assert.equal(result.source, 'qq', 'word-level lyrics win over an earlier line-level answer')
assert.equal(result.wordLevel, true)
assert.equal(sawSources.length, 2)
assert.equal(sawSources[0][2], 10, 'the search limit is passed through')

const fallbackOnly = await findBestLyrics(track, {
  order: ['netease', 'qq'],
  search: async (sourceId) => [{ id: sourceId + '-1', title: '晴天', artist: '周杰伦', album: '叶惠美', durationMs: 269000 }],
  fetchLyric: async () => lineLyric,
})
assert.equal(fallbackOnly.source, 'netease', 'the first line-level answer is the fallback')
assert.equal(fallbackOnly.wordLevel, false)

// AMLL is asked first when ids are supplied.
const amllFirst = await findBestLyrics(track, {
  order: ['netease', 'amll'],
  neteaseId: '186016',
  search: async () => {
    throw new Error('platform search must not run when AMLL answered word-level')
  },
  fetchLyric: async () => lineLyric,
  fetchAmll: async (platform, id) => ({ lines: wordLyric.lines }),
})
assert.equal(amllFirst.source, 'amll')
assert.equal(amllFirst.id, '186016')

// One failing source does not stop the next one (timeouts are asserted separately).
const survived = await findBestLyrics(track, {
  order: ['netease', 'qq'],
  log: () => {},
  search: async (sourceId) => {
    if (sourceId === 'netease') throw new Error('net down')
    return [{ id: 'qq-1', title: '晴天', artist: '周杰伦', album: '叶惠美', durationMs: 269000 }]
  },
  fetchLyric: async () => lineLyric,
})
assert.equal(survived.source, 'qq', 'a failing source falls through to the next')

// The runner carries the source's own document, translation and romanization through:
// the client parses the document with Folia's pipeline, the runner only compares lines.
const withRaw = await findBestLyrics(track, {
  order: ['netease'],
  search: async () => [{ id: 'n1', title: '晴天', artist: '周杰伦', album: '叶惠美', durationMs: 269000 }],
  fetchLyric: async () => ({
    ...wordLyric,
    translation: '[00:01.000]story',
    romaji: '[00:01.000]monogatari',
    raw: { type: 'local', lrcContent: '[1000,2000](1000,500,0)故事', formatHint: 'yrc' },
  }),
})
assert.equal(withRaw.raw.formatHint, 'yrc')
assert.equal(withRaw.translation, '[00:01.000]story')
assert.equal(withRaw.romaji, '[00:01.000]monogatari')

// AMLL's TTML travels with its lines, so the client parses it the same way.
const amllRaw = await findBestLyrics(track, {
  order: ['amll'],
  neteaseId: '186016',
  fetchLyric: async () => lineLyric,
  fetchAmll: async () => ({ lines: wordLyric.lines, text: '<tt xmlns="http://www.w3.org/ns/ttml"></tt>' }),
})
assert.equal(amllRaw.source, 'amll')
assert.equal(amllRaw.raw.formatHint, 'ttml')
assert.match(amllRaw.raw.lrcContent, /<tt/)

// AMLL's candidate ids are resolved lazily: a word-level answer from an earlier source
// never pays for the extra search (Folia asks for the id only at the AMLL step).
let amllIdsAsked = 0
const lazyIds = await findBestLyrics(track, {
  order: ['netease', 'amll', 'qq'],
  search: async (sourceId) => [{ id: sourceId + '-1', title: '晴天', artist: '周杰伦', album: '叶惠美', durationMs: 269000 }],
  fetchLyric: async (sourceId) => (sourceId === 'qq' ? wordLyric : lineLyric),
  resolveAmllIds: async () => {
    amllIdsAsked += 1
    return { neteaseId: '186016' }
  },
  fetchAmll: async () => null,
})
assert.equal(lazyIds.source, 'qq', 'the word-level answer still wins')
assert.equal(amllIdsAsked, 1, 'the candidate search ran once, at the AMLL step')

// A line-level AMLL answer is the fallback: a word-level lyric from a later source still wins.
const amllRunsFirst = await findBestLyrics(track, {
  order: ['amll', 'qq'],
  resolveAmllIds: async () => ({ neteaseId: '186016' }),
  search: async (sourceId) => [{ id: sourceId + '-1', title: '晴天', artist: '周杰伦', album: '叶惠美', durationMs: 269000 }],
  fetchLyric: async () => wordLyric,
  fetchAmll: async () => ({ lines: lineLyric.lines }),
})
assert.equal(amllRunsFirst.source, 'qq', 'word-level outranks the earlier line-level answer')
assert.equal(amllRunsFirst.wordLevel, true)

// When every source is line-level, the first one asked is the answer.
const amllOnlyLineLevel = await findBestLyrics(track, {
  order: ['amll', 'qq'],
  resolveAmllIds: async () => ({ neteaseId: '186016' }),
  search: async (sourceId) => [{ id: sourceId + '-1', title: '晴天', artist: '周杰伦', album: '叶惠美', durationMs: 269000 }],
  fetchLyric: async () => lineLyric,
  fetchAmll: async () => ({ lines: lineLyric.lines }),
})
assert.equal(amllOnlyLineLevel.source, 'amll')
assert.equal(amllOnlyLineLevel.wordLevel, false)

// ── the alias retries (Folia's lyric aliases) ──────────────────────────────

{
  // A line-level first pass is retried under the platform's other name.
  const aliasQueries = []
  const aliasResult = await findBestLyrics(track, {
    order: ['qq'],
    search: async (sourceId, query) => {
      aliasQueries.push(query)
      const title = String(query).split(' ')[0]
      return [{ id: sourceId + '-1', title, artist: '周杰伦', album: '叶惠美', durationMs: 269000 }]
    },
    fetchLyric: async (sourceId, id, candidate) => (candidate.title === 'Original' ? wordLyric : lineLyric),
    searchAlias: async () => ({ title: 'Original' }),
  })
  assert.equal(aliasResult.source, 'qq')
  assert.equal(aliasResult.wordLevel, true, 'the alias pass found the word-level lyric')
  assert.deepEqual(aliasQueries, ['晴天 周杰伦', 'Original 周杰伦'], 'the retry searches the other title')

  // Nothing matched: another spelling of the artist is tried once.
  const artistQueries = []
  const alternateResult = await findBestLyrics(track, {
    order: ['qq'],
    search: async (sourceId, query) => {
      artistQueries.push(query)
      if (!String(query).includes('周董')) return []
      return [{ id: 'qq-9', title: '晴天', artist: '周董', album: '叶惠美', durationMs: 269000 }]
    },
    fetchLyric: async () => lineLyric,
    alternateArtist: async () => '周董',
  })
  assert.equal(alternateResult.source, 'qq')
  assert.deepEqual(artistQueries, ['晴天 周杰伦', '晴天 周董'])

  // A word-level answer on the first pass never pays for either retry.
  let aliasAsked = 0
  let artistAsked = 0
  await findBestLyrics(track, {
    order: ['qq'],
    search: async (sourceId) => [{ id: sourceId + '-1', title: '晴天', artist: '周杰伦', album: '叶惠美', durationMs: 269000 }],
    fetchLyric: async () => wordLyric,
    searchAlias: async () => {
      aliasAsked += 1
      return { title: 'x' }
    },
    alternateArtist: async () => {
      artistAsked += 1
      return 'y'
    },
  })
  assert.equal(aliasAsked, 0)
  assert.equal(artistAsked, 0)
}

// lrcTime is the inverse of linesFromLrc (a line-level match is handed back as LRC).
assert.equal(lrcTime(1.5), '[00:01.500]')
assert.equal(lrcTime(61.25), '[01:01.250]')
assert.equal(linesFromLrc(lrcTime(61.25) + '行')[0].t, 61.25)

// A candidate below the threshold is never fetched.
let fetchedForBadCandidate = false
const rejected = await findBestLyrics(track, {
  order: ['qq'],
  search: async () => [{ id: 'x', title: '七里香', artist: '周杰伦' }],
  fetchLyric: async () => {
    fetchedForBadCandidate = true
    return lineLyric
  },
})
assert.equal(rejected, null)
assert.equal(fetchedForBadCandidate, false)

console.log('lyrics-sources.test.mjs ok')

// ── LRC adapter ────────────────────────────────────────────────────────────

const fromLrc = linesFromLrc('[00:01.500]第一行\n[00:03.000]第二行')
assert.equal(fromLrc.length, 2)
assert.equal(fromLrc[0].t, 1.5)
assert.equal(fromLrc[0].text, '第一行')
assert.deepEqual(linesFromLrc(''), [])
assert.deepEqual(linesFromLrc('not lrc'), [])
