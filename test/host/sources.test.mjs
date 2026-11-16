/**
 * Unit tests for the source layer: registry, omni dispatch, adapter guards and
 * the local source mapping. No network, no real platform modules exercised.
 */

import assert from 'node:assert/strict'
import { MusicError } from '../../src/host/services/core/errors.js'
import { createRegistry } from '../../src/host/providers/sources/registry.js'
import { createOmni } from '../../src/host/providers/sources/omni.js'
import { createLocalSource, toTrack } from '../../src/host/providers/sources/local.js'
import { createOnlineAdapter } from '../../src/host/providers/sources/adapter.js'
import { ONLINE_SPECS, omni as builtinOmni, registry as builtinRegistry, registerOnlineSources, resetSources } from '../../src/host/providers/sources/index.js'

// ── registry ────────────────────────────────────────────────────────────────

{
  const registry = createRegistry()
  assert.equal(registry.get('x'), null)
  assert.throws(() => registry.require('x'), (error) => error instanceof MusicError && error.code === 'unavailable')
  assert.throws(() => registry.register({}), /non-empty id/)

  const a = { id: 'a', displayName: 'A', capabilities: { search: true } }
  const b = { id: 'b', displayName: 'B', capabilities: { search: false, lyrics: true } }
  registry.register(a)
  registry.register(b)

  assert.equal(registry.list().length, 2)
  assert.deepEqual(registry.withCapability('search').map((s) => s.id), ['a'])
  assert.deepEqual(registry.withCapability('lyrics').map((s) => s.id), ['b'])
  assert.deepEqual(registry.summaries().map((s) => s.id), ['a', 'b'])
  assert.equal(registry.unregister('a'), true)
  assert.equal(registry.unregister('a'), false)
  assert.equal(registry.version() > 0, true)
}

// ── omni dispatch ───────────────────────────────────────────────────────────

{
  const registry = createRegistry()
  const calls = []
  registry.register({
    id: 'stub',
    displayName: 'Stub',
    capabilities: { search: true, lyrics: false },
    search: async (query, ctx) => {
      calls.push([query, ctx])
      return { songs: [{ id: query }] }
    },
    lyric: async () => ({ lines: [] }),
    explode: async () => {
      throw new Error('fetch failed')
    },
  })
  const omni = createOmni(registry)

  assert.deepEqual(await omni.search('stub', 'abc', { cookie: 'c' }), { songs: [{ id: 'abc' }] })
  assert.deepEqual(calls, [['abc', { cookie: 'c' }]])

  await assert.rejects(
    () => omni.lyric('stub', 'x'),
    (error) => error instanceof MusicError && error.code === 'unavailable',
  )
  await assert.rejects(
    () => omni.search('missing', 'x'),
    (error) => error instanceof MusicError && error.code === 'unavailable',
  )

  assert.equal(omni.requiresVip('missing', 'x'), false)
}

{
  // Errors thrown by a source are tagged with its id and classified.
  const registry = createRegistry()
  registry.register({
    id: 'bad',
    displayName: 'Bad',
    capabilities: { search: true },
    search: async () => {
      throw new Error('fetch failed')
    },
  })
  const omni = createOmni(registry)
  const error = await omni.search('bad', 'x').catch((caught) => caught)
  assert.ok(error instanceof MusicError)
  assert.equal(error.code, 'network')
  assert.equal(error.sourceId, 'bad')
  assert.equal(error.retryable, true)
}

// ── adapter guard ───────────────────────────────────────────────────────────

{
  const adapter = createOnlineAdapter({
    id: 'fake',
    displayName: 'Fake',
    capabilities: { search: true, lyrics: false },
  })
  assert.equal(adapter.id, 'fake')
  assert.equal(adapter.kind, 'online')
  assert.equal(adapter.capabilities.search, true)
  assert.equal(adapter.capabilities.lyrics, false)
  assert.throws(
    () => adapter.lyric('1', {}),
    (error) => error instanceof MusicError && error.code === 'unavailable',
  )
  assert.deepEqual(adapter.availability(), { configured: true })
}

// ── local source ────────────────────────────────────────────────────────────

{
  const scanned = [
    { path: 'C:/m/a.flac', title: 'Alpha', artist: 'A', album: 'One', durationSec: 12.5, folder: 'x', ext: 'flac', size: 1, mtime: 2, hasCover: true },
    { path: 'C:/m/b.mp3', title: 'Beta', artist: 'B', album: 'Two', durationSec: 3 },
  ]
  const local = createLocalSource({ scan: async () => ({ tracks: scanned }) })

  const all = await local.songs({})
  assert.equal(all.total, 2)
  assert.equal(all.songs[0].durationMs, 12500)
  assert.deepEqual(all.songs[0].sourceRef, { kind: 'local', sourceId: 'local', ref: 'C:/m/a.flac' })
  assert.equal(all.songs[0].providerData.hasCover, true)

  const filtered = await local.search('alp', {})
  assert.equal(filtered.total, 1)
  assert.equal(filtered.songs[0].title, 'Alpha')

  const byAlbum = await local.search('one', {})
  assert.equal(byAlbum.total, 1, 'album participates in the match')
  assert.equal(byAlbum.songs[0].title, 'Alpha')

  const byArtist = await local.search('b', {})
  assert.equal(byArtist.total, 1, 'artist participates in the match')
  assert.equal(byArtist.songs[0].title, 'Beta')

  const caseInsensitive = await local.search('BETA', {})
  assert.equal(caseInsensitive.total, 1, 'matching ignores case')

  const none = await local.search('zzz', {})
  assert.equal(none.total, 0)

  assert.deepEqual(toTrack({}).sourceRef, { kind: 'local', sourceId: 'local', ref: '' })

  // Playback goes through the existing guarded stream route.
  const audio = await local.getAudioSource('C:/m/a.flac')
  assert.equal(audio.url, 'music/stream?path=' + encodeURIComponent('C:/m/a.flac'))
  assert.equal(audio.quality, 'original')
  await assert.rejects(() => local.getAudioSource(''), (error) => error.code === 'invalid-response')

  // Paging is explicit; there is no "load more" for a local library.
  const page = await local.songs({}, { offset: 1, limit: 1 })
  assert.equal(page.total, 2)
  assert.equal(page.songs.length, 1)
  assert.equal(page.songs[0].title, 'Beta')
  assert.equal(page.offset, 1)

  // Pinyin keys already computed by the scanner make ASCII queries work.
  const py = createLocalSource({
    scan: async () => ({ tracks: [{ path: 'C:/m/c.mp3', title: '晴天', artist: '周杰伦', album: '', py: 'qingtian', pyf: 'qt' }] }),
  })
  assert.equal((await py.search('qingtian', {})).total, 1)
  assert.equal((await py.search('qt', {})).total, 1)
  assert.equal((await py.search('zzz', {})).total, 0)
}

// ── builtin registration ────────────────────────────────────────────────────

{
  resetSources()
  const registered = registerOnlineSources()
  assert.deepEqual(registered.map((source) => source.id), ['netease', 'qq', 'kugouLite', 'navidrome'])
  assert.equal(builtinRegistry.get('netease').displayName, 'NetEase Cloud Music')
  assert.equal(builtinRegistry.get('navidrome').capabilities.loginPassword, true)
  assert.equal(builtinRegistry.get('navidrome').capabilities.loginQr, false)
  assert.equal(builtinRegistry.get('qq').capabilities.search, true)
  // A declared capability must be executable: KuGou Concept reads likes but
  // cannot write them or add to a cloud playlist yet.
  assert.equal(builtinRegistry.get('kugouLite').capabilities.likes, true)
  assert.equal(builtinRegistry.get('kugouLite').capabilities.likeWrite, false)
  assert.equal(builtinRegistry.get('kugouLite').capabilities.playlistAdd, false)
  assert.equal(builtinRegistry.get('kugouLite').capabilities.mutations, false)
  assert.equal(builtinRegistry.get('netease').capabilities.listeningRank, true)
  assert.equal(builtinRegistry.get('netease').capabilities.playbackReports, true)
  assert.equal(builtinRegistry.get('qq').capabilities.listeningRank, true)
  // Folia-style provider metadata: quality ladder, login methods and the
  // namespaced API view are part of every registered provider.
  assert.deepEqual(builtinRegistry.get('kugouLite').qualityLevels, ['standard', 'high', 'lossless'])
  assert.deepEqual(builtinRegistry.get('netease').qualityLevels, ['standard', 'high', 'lossless', 'hires'])
  assert.deepEqual(builtinRegistry.get('navidrome').qualityLevels, ['original'])
  assert.deepEqual(builtinOmni.loginMethods('netease'), ['qr'])
  assert.deepEqual(builtinOmni.loginMethods('navidrome'), ['password'])
  assert.ok(builtinRegistry.get('netease').api.search)
  assert.ok(builtinRegistry.get('netease').api.playback)
  assert.ok(builtinRegistry.get('netease').api.library)
  assert.deepEqual(builtinOmni.summaries().map((s) => s.id), ONLINE_SPECS.map((s) => s.id))
  const summary = builtinOmni.summaries().find((s) => s.id === 'qq')
  assert.deepEqual(summary.qualityLevels, ['standard', 'high', 'lossless', 'hires'])
  assert.deepEqual(summary.loginMethods, ['qr'])
  resetSources()
  assert.deepEqual(builtinRegistry.summaries(), [])
}

// ── plugin lifecycle ────────────────────────────────────────────────────────

{
  const { apply } = await import('../../index.js')
  resetSources()

  const disposers = []
  const ctx = {
    effect(callback) {
      const dispose = callback()
      if (typeof dispose === 'function') disposers.push(dispose)
      return dispose
    },
    webServer: { register: () => () => {} },
    get: () => undefined,
  }

  apply(ctx, {})
  const ids = builtinRegistry.list().map((source) => source.id).sort()
  // Bodian is optional (its package may be absent) but must never break startup.
  assert.ok(ids.includes('local'))
  for (const id of ['kugouLite', 'navidrome', 'netease', 'qq']) assert.ok(ids.includes(id), `missing ${id}`)
  assert.equal(builtinRegistry.get('local').kind, 'local')

  // Unloading must leave the registry empty.
  for (const dispose of disposers) dispose()
  assert.deepEqual(builtinRegistry.summaries(), [])
}

console.log('sources.test.mjs ok')

// ── local lyrics ────────────────────────────────────────────────────────────

{
  const { toLyricLines } = await import('../../src/host/providers/sources/local.js')
  const lines = toLyricLines({
    lines: [
      { time: 1.5, text: 'one', translation: '一' },
      { time: -1, text: 'untimed', translation: '' },
      { time: 3, text: 'two', translation: '' },
    ],
  })
  assert.deepEqual(lines, [
    { timeMs: 1500, text: 'one', translation: '一' },
    { timeMs: 3000, text: 'two' },
  ])

  const withLyrics = createLocalSource({
    scan: async () => ({ tracks: [] }),
    readLyrics: async () => ({ lines: [{ time: 2, text: 'x', translation: '' }], source: 'sidecar' }),
  })
  const lyric = await withLyrics.lyric('C:/m/a.flac')
  assert.equal(lyric.lines.length, 1)
  assert.equal(lyric.source, 'sidecar')
  assert.equal(lyric.file, 'C:/m/a.flac')

  const withoutReader = createLocalSource({ scan: async () => ({ tracks: [] }) })
  assert.deepEqual((await withoutReader.lyric('x')).lines, [])
}
