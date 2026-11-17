/**
 * Lyric records + the local lyric pick: the store, Folia's source-selection rule,
 * the automatic match and the routes that expose them.
 */

import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { createRoutes } from '../../src/host/http/routes.js'
import { createLyricState, payloadNameFor } from '../../src/host/stores/lyric-state.js'
import {
  EMPTY_LOCAL_LYRICS,
  needsAutoMatch,
  resolveLocalLyrics,
  selectLocalLyricSource,
} from '../../src/host/services/lyrics/local-lyrics.js'
import {
  createLocalLyricMatcher,
  payloadFromMatch,
  resolveLocalMatchTarget,
} from '../../src/host/services/lyrics/local-match.js'
import { fakeReq, fakeRes, tempWav } from '../helpers.mjs'

// ── the record store ───────────────────────────────────────────────────────

const dataDir = await mkdtemp(join(tmpdir(), 'dsh-music-lyrics-'))
const store = createLyricState({ dir: dataDir })
const key = 'D:/music/song.mp3'

assert.equal(payloadNameFor(key), payloadNameFor(key))
assert.notEqual(payloadNameFor(key), payloadNameFor('D:/music/other.mp3'))

assert.equal(await store.get(key), null, 'nothing is remembered before anything happens')

const written = await store.patch(key, { source: 'online' })
assert.equal(written.source, 'online')

const payload = await store.writePayload(key, {
  text: '[00:01.000]hello',
  formatHint: '',
  translation: '[00:01.000]你好',
})
assert.equal(payload.translation, '[00:01.000]你好')
assert.deepEqual(
  { ...(await store.readPayload(key)) },
  {
    text: '[00:01.000]hello',
    formatHint: '',
    translation: '[00:01.000]你好',
    romaji: '',
    lines: null,
    wordLevel: false,
    raw: null,
  },
)

// A second store over the same directory reads the index back from disk.
const reopened = createLyricState({ dir: dataDir })
assert.equal((await reopened.get(key)).source, 'online')

// Unknown values are dropped: a record of nothing is no record.
assert.equal(await store.patch(key, { source: 'bogus' }), null)
assert.equal(await store.get(key), null)

// Removing a record deletes its lyric text too.
await store.patch(key, { source: 'online' })
await store.writePayload(key, { text: '[00:01.000]hello' })
await store.remove(key)
assert.equal(await store.get(key), null)
assert.equal(await store.readPayload(key), null)

// The lyric text lives beside the index, not inside it.
const indexRaw = await readFile(join(dataDir, 'lyric-states.json'), 'utf8')
assert.ok(indexRaw.includes('"version": 1'))
assert.ok(!indexRaw.includes('hello'), 'the lyric text is not stored in the index')

// ── Folia's source selection ───────────────────────────────────────────────

const base = { hasSidecar: false, hasEmbedded: false, priority: 'local' }
assert.equal(selectLocalLyricSource({ ...base, state: null }), null)

const matchedState = { source: null, matched: { source: 'qq', id: '1' } }
assert.equal(selectLocalLyricSource({ ...base, state: matchedState }), 'online', 'a stored match is shown')

assert.equal(
  selectLocalLyricSource({ ...base, hasSidecar: true, hasEmbedded: true, state: null }),
  'local',
  'the sidecar outranks the embedded lyric',
)
assert.equal(
  selectLocalLyricSource({ ...base, hasEmbedded: true, state: null }),
  'embedded',
)
assert.equal(
  selectLocalLyricSource({ ...base, hasSidecar: true, state: matchedState, priority: 'online' }),
  'online',
  'online priority puts the match first',
)
assert.equal(
  selectLocalLyricSource({ ...base, hasSidecar: true, state: { source: 'local' } }),
  'local',
  'an explicit choice wins over the priority',
)
assert.equal(
  selectLocalLyricSource({ ...base, hasSidecar: true, state: { source: 'embedded' } }),
  null,
  'an explicit source that is not there is no lyric, not a fallback',
)
assert.equal(
  selectLocalLyricSource({ ...base, hasSidecar: true, state: { source: null, markedPureMusic: true } }),
  'online',
  'the instrumental mark wins over the sidecar',
)
assert.equal(
  selectLocalLyricSource({ ...base, hasEmbedded: true, state: { source: null, matched: null, pureMusic: true } }),
  'embedded',
  "a matched verdict does not outrank the file's own lyric under local priority",
)
assert.equal(
  selectLocalLyricSource({
    ...base,
    state: { source: null, matched: null, pureMusic: true },
    priority: 'online',
  }),
  null,
  'online priority only shows a match that exists',
)
assert.equal(
  selectLocalLyricSource({ ...base, state: { source: null, matched: { source: 'qq', id: '1' }, pureMusic: true } }),
  'online',
  'a matched pure-music verdict is a real answer when there is no local lyric',
)

// ── when to search ─────────────────────────────────────────────────────────

assert.equal(needsAutoMatch({ ...base, state: null }), true, 'no local lyric asks for a match')
assert.equal(needsAutoMatch({ ...base, hasSidecar: true, state: null }), false)
assert.equal(needsAutoMatch({ ...base, hasSidecar: true, state: null, priority: 'online' }), true)
assert.equal(
  needsAutoMatch({ ...base, state: { source: null, matched: { source: 'qq', id: '1' } } }),
  false,
  'an existing match is not searched again',
)
assert.equal(
  needsAutoMatch({ ...base, state: { source: null, noAutoMatch: true } }),
  false,
  'noAutoMatch is the listener saying no',
)
assert.equal(
  needsAutoMatch({ ...base, hasSidecar: true, state: { source: 'local' } }),
  false,
  'an explicit local choice does not search',
)

// ── resolution over a real file ────────────────────────────────────────────

const audio = await tempWav('song.wav', 1)
const empty = await resolveLocalLyrics(audio, { lyricState: store, priority: 'local' })
assert.deepEqual(empty.lines, [])
assert.equal(empty.source, null)
assert.deepEqual(empty.available, { sidecar: false, embedded: false })

await writeFile(join(dirname(audio), 'song.lrc'), '[00:01.00]hello\n')
const sidecarPick = await resolveLocalLyrics(audio, { lyricState: store, priority: 'local' })
assert.equal(sidecarPick.source, 'local')
assert.equal(sidecarPick.raw, '[00:01.00]hello\n')

await store.patch(audio, { matched: { source: 'qq', id: '9', title: 't', score: 90, at: 1 } })
await store.writePayload(audio, { text: '[00:02.000]matched', formatHint: '' })
const defaultPick = await resolveLocalLyrics(audio, { lyricState: store, priority: 'local' })
assert.equal(defaultPick.source, 'local', 'the sidecar still wins while the priority is local')

const onlinePick = await resolveLocalLyrics(audio, { lyricState: store, priority: 'online' })
assert.equal(onlinePick.source, 'online')
assert.equal(onlinePick.raw, '[00:02.000]matched')
assert.equal(onlinePick.matched.source, 'qq')

await store.patch(audio, { markedPureMusic: true })
const markedPick = await resolveLocalLyrics(audio, { lyricState: store, priority: 'online' })
assert.equal(markedPick.pureMusic, true)
assert.deepEqual(markedPick.lines, [])

// ── the automatic match ────────────────────────────────────────────────────

const target = resolveLocalMatchTarget('/music/No Tags.flac', {})
assert.equal(target.title, 'No Tags', 'the file name is the last resort for the title')

const lineLyricText = '[00:01.000]只有整行'
assert.equal(
  payloadFromMatch({
    source: 'qq',
    lrc: lineLyricText,
    lyrics: [{ t: 1, text: '只有整行' }],
  }).text,
  lineLyricText,
)
const qrcPayload = payloadFromMatch({
  source: 'qq',
  raw: { type: 'qrc', qrcContent: '<QRC>', translationContent: '[00:01.000]x' },
  lyrics: [{ t: 1, text: 'a' }],
})
assert.equal(qrcPayload.formatHint, 'qrc')
assert.equal(qrcPayload.translation, '[00:01.000]x')

const matchDir = await mkdtemp(join(tmpdir(), 'dsh-music-lyrics-match-'))
const matchAudio = join(matchDir, 'Track.wav')
await writeFile(matchAudio, 'not really audio')
const matchStore = createLyricState({ dir: matchDir })
const searched = []
const omni = {
  async searchPage(sourceId, query, _ctx, page) {
    searched.push([sourceId, query, page])
    // Echo the searched title so the candidate scores as the same song.
    const title = String(query).split(' ')[0]
    return {
      results: [{ id: sourceId + '-1', title, artist: 'Artist', album: 'Album', durationSec: 200, coverUrl: 'http://c/1.jpg' }],
      total: 1,
      page: 1,
      hasMore: false,
    }
  },
  async lyric(sourceId, id) {
    return {
      lrc: '[00:01.000]word level',
      lines: [{ t: 1, end: 2, text: 'word level', words: [{ t: 1, end: 2, text: 'word' }] }],
      translation: '',
      romaji: '',
      raw: { type: 'local', lrcContent: '[1000,2000](1000,900,0)word level', formatHint: 'yrc' },
    }
  },
}
const matcher = createLocalLyricMatcher({ lyricState: matchStore, omni, amllClient: null })
const matched = await matcher.match(matchAudio, { preferred: 'qq' })
assert.equal(matched.matched.source, 'qq')
assert.equal(matched.matched.wordLevel, true)
assert.equal(searched[0][0], 'qq', 'the preferred source is asked first')
const stored = await matchStore.get(matchAudio)
assert.equal(stored.matched.source, 'qq')
assert.equal(stored.matched.title, 'Track')
assert.equal((await matchStore.readPayload(matchAudio)).formatHint, 'yrc')

// The record is not searched again, and an instrumental mark stops the search.
await matchStore.patch(matchAudio, { noAutoMatch: true })
const skipped = await matcher.match(matchAudio, {})
assert.equal(skipped.skipped, true)

// ── the routes ─────────────────────────────────────────────────────────────

const routeFile = join(matchDir, 'Routed.wav')
await writeFile(routeFile, 'not really audio')
const routeRoot = matchDir
const settings = {
  read: async () => ({ roots: [routeRoot], depth: 2, extensions: ['wav'] }),
  write: async (patch) => ({ roots: [], depth: 4, extensions: ['wav'], ...patch }),
  home: 'C:/dsh-home',
  file: 'C:/dsh-home/music/settings.json',
}
const stats = { get: async () => ({ lyricOffsetMs: 250 }) }

async function call(method, path, body) {
  const res = fakeRes()
  await handle(fakeReq(path, method, {}, body === undefined ? '' : JSON.stringify(body)), res)
  return { status: res.status, body: res.json() }
}

let handle = createRoutes({ settings, library: { scan: async () => ({ tracks: [] }) }, stats, lyricState: matchStore, lyricOmni: omni })

let answer = await call('GET', '/music/lyrics?path=' + encodeURIComponent(routeFile))
assert.equal(answer.status, 200)
assert.equal(answer.body.source, null)
assert.equal(answer.body.needsAutoMatch, true)
assert.equal(answer.body.offsetMs, 250)

answer = await call('POST', '/music/lyrics/import', {
  path: routeFile,
  text: '[00:03.000]imported',
  name: 'picked.qrc',
})
assert.equal(answer.status, 200)
assert.equal(answer.body.source, 'local')
assert.equal(answer.body.raw, '[00:03.000]imported')
assert.equal(answer.body.formatHint, 'qrc')

const sources = (await call('GET', '/music/lyrics/sources?path=' + encodeURIComponent(routeFile))).body
assert.equal(sources.local, true)
assert.equal(sources.online, false)
assert.equal(sources.active, 'local')

answer = await call('POST', '/music/lyrics/pure-music', { path: routeFile, marked: true })
assert.equal(answer.body.pureMusic, true)
assert.equal(answer.body.source, 'online')
assert.deepEqual(answer.body.lines, [])

answer = await call('POST', '/music/lyrics/no-auto-match', { path: routeFile, on: true })
assert.equal(answer.body.noAutoMatch, true)
assert.equal(answer.body.needsAutoMatch, false)

// The auto route remembers a match and the next resolution shows it once chosen.
// (The instrumental mark and the no-search switch are both cleared first: each of them
// is the listener saying "do not search".)
answer = await call('POST', '/music/lyrics/pure-music', { path: routeFile, marked: false })
assert.equal(answer.body.pureMusic, false)
answer = await call('POST', '/music/lyrics/no-auto-match', { path: routeFile, on: false })
assert.equal(answer.body.needsAutoMatch, true)

answer = await call('GET', '/music/lyrics/auto?path=' + encodeURIComponent(routeFile) + '&preferred=qq')
assert.equal(answer.status, 200)
assert.equal(answer.body.matched.source, 'qq')

answer = await call('POST', '/music/lyrics/choice', { path: routeFile, source: 'online' })
assert.equal(answer.status, 200)
assert.equal(answer.body.source, 'online')
assert.equal(answer.body.explicitSource, 'online')
assert.equal(answer.body.raw, '[1000,2000](1000,900,0)word level')

answer = await call('POST', '/music/lyrics/choice', { path: routeFile, source: 'nope' })
assert.equal(answer.status, 400)

// The manual match puts the pick on the record; metadata/cover go to the file's tags and
// a container the tag writer cannot touch still keeps the lyric.
answer = await call('POST', '/music/lyrics/match-apply', {
  path: routeFile,
  provider: 'qq',
  id: 'm1',
  title: 'Picked',
  artist: 'Someone',
  album: 'Album',
  coverUrl: '',
  lrc: '[00:04.000]手动匹配',
  applyLyrics: true,
  applyMetadata: true,
  applyCover: false,
})
assert.equal(answer.status, 200)
assert.equal(answer.body.lyricsApplied, true)
assert.equal(answer.body.metadataApplied, false)
assert.ok(String(answer.body.warning || '') !== '', 'a wav cannot take tags, and says so')
answer = await call('POST', '/music/lyrics/choice', { path: routeFile, source: 'online' })
assert.equal(answer.body.raw, '[00:04.000]手动匹配')
assert.equal(answer.body.matched.source, 'qq')
assert.equal(answer.body.matched.title, 'Picked')

// "Stop matching this song" is a real answer on the record.
answer = await call('POST', '/music/lyrics/match-apply', { path: routeFile, noAutoMatch: true })
assert.equal(answer.status, 200)
assert.equal(answer.body.noAutoMatch, true)
assert.equal((await call('POST', '/music/lyrics/no-auto-match', { path: routeFile, on: false })).body.noAutoMatch, false)

// An online song has no file: the pick lands on its online lyric record and never on tags.
answer = await call('POST', '/music/lyrics/match-apply', {
  path: 'online:qishui:123',
  provider: 'qq',
  id: 'm2',
  lrc: '[00:02.000]online match',
  applyLyrics: true,
  applyMetadata: true,
  applyCover: true,
  online: true,
})
assert.equal(answer.status, 200)
assert.equal(answer.body.lyricsApplied, true)
assert.equal(answer.body.metadataApplied, false)
assert.equal(answer.body.coverApplied, false)
const onlineRecord = await matchStore.get('online:qishui:123')
assert.equal(onlineRecord.matched.source, 'qq')
assert.equal(onlineRecord.source, 'online')
assert.equal((await matchStore.readPayload('online:qishui:123')).text, '[00:02.000]online match')

// A file outside the roots is never touched.
answer = await call('GET', '/music/lyrics?path=' + encodeURIComponent(join(tmpdir(), 'outside.mp3')))
assert.equal(answer.status, 404)

// Without a store the routes still answer, they just remember nothing.
handle = createRoutes({ settings, library: { scan: async () => ({ tracks: [] }) }, stats })
answer = await call('GET', '/music/lyrics?path=' + encodeURIComponent(routeFile))
assert.equal(answer.status, 200)
assert.equal(answer.body.source, null)
assert.equal(answer.body.needsAutoMatch, true)

console.log('lyric-state.test.mjs ok')
