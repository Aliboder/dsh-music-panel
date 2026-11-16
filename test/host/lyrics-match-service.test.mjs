/**
 * Lyric match service: candidates are scored with the same model as the automatic
 * pick, and the AMLL tab is keyed by the platform's song id.
 */

import assert from 'node:assert/strict'
import { MATCH_SOURCES, createLyricMatchService } from '../../src/host/services/lyrics/lyrics-match-service.js'

assert.deepEqual(
  MATCH_SOURCES.map((source) => source.id),
  ['netease', 'amll', 'qq', 'kugou', 'bodian'],
  'tabs follow Folia order',
)

const target = { title: '晴天', artist: '周杰伦', album: '叶惠美', durationMs: 269000 }
const searched = []

const service = createLyricMatchService({
  providerStore: { cookie: async () => '' },
  omni: {
    searchPage: async (source, query, ctx, page) => {
      searched.push([source, query, page])
      return {
        results: [
          // Wrong artist, same title: capped below the acceptance threshold.
          { id: 'cover', title: '晴天', artist: 'RyaVocal', album: '晴天', durationMs: 271000, cover: 'https://c/1.jpg' },
          // Exact match.
          { id: 'orig', title: '晴天', artist: '周杰伦', album: '叶惠美', durationMs: 269000, cover: 'https://c/2.jpg' },
        ],
      }
    },
    lyric: async (source, id) => ({ lrc: '[00:01.000]词', translation: '译', romaji: 'roma', lines: null, wordLevel: false }),
  },
  fetchImpl: async (url) => {
    if (url.includes('/v1/lyrics/search')) {
      return {
        ok: true,
        json: async () => ({
          data: {
            items: [
              { musicNames: ['晴天'], artistNames: ['周杰伦'], albumNames: ['叶惠美'], ncmMusicIds: ['186016'] },
              { musicNames: ['晴天'], artistNames: ['翻唱'], albumNames: ['同名'], qqMusicIds: ['0039MnYb0qxYhV'] },
              { musicNames: ['无 id'] },
            ],
          },
        }),
      }
    }
    if (url.includes('/v1/lyrics/get')) {
      return {
        ok: true,
        json: async () => ({
          data: {
            lyrics:
              '<tt><body><div><p begin="1s" end="2s"><span begin="1s" end="2s">词</span></p></div></body></tt>',
          },
        }),
      }
    }
    return { ok: false, json: async () => ({}) }
  },
})

// ── platform tab ───────────────────────────────────────────────────────────

const platform = await service.search({ source: 'netease', query: '晴天 周杰伦', target })
assert.equal(platform.error, '')
assert.equal(searched[0][0], 'netease')
assert.equal(searched[0][2], 1, 'search asks page 1')
assert.equal(platform.candidates[0].id, 'orig', 'the exact match sorts first')
assert.equal(platform.candidates[0].score, 100)
assert.equal(platform.candidates[0].titleMatched, true)
assert.ok(platform.candidates[1].score < platform.candidates[0].score)
assert.equal(platform.candidates[0].artists[0], '周杰伦')

// Empty query asks nothing.
assert.deepEqual((await service.search({ source: 'netease', query: '  ', target })).candidates, [])
// Unknown source is reported, not thrown.
assert.equal((await service.search({ source: 'spotify', query: 'x', target })).error, 'unknown source')

// ── AMLL tab ───────────────────────────────────────────────────────────────

const amll = await service.search({ source: 'amll', query: '晴天', target })
assert.equal(amll.candidates.length, 2, 'items without a platform id are skipped')
assert.equal(amll.candidates[0].id, '186016', 'the NetEase id is preferred')
assert.equal(amll.candidates[0].source, 'amll')
assert.ok(amll.candidates[0].score > 0)
assert.equal(amll.candidates[1].id, '0039MnYb0qxYhV', 'QQ id is used when there is no NetEase one')

// ── preview ────────────────────────────────────────────────────────────────

const platformPreview = await service.preview({ source: 'qq', id: 'abc' })
assert.equal(platformPreview.lrc, '[00:01.000]词')
assert.equal(platformPreview.translation, '译')
assert.equal(platformPreview.romaji, 'roma')

const amllPreview = await service.preview({ source: 'amll', id: '186016', platform: 'ncm' })
assert.equal(amllPreview.wordLevel, true)
assert.equal(amllPreview.lines[0].text, '词')

assert.deepEqual(await service.preview({ source: 'qq', id: '' }), {
  lrc: '',
  translation: '',
  romaji: '',
  lines: null,
  wordLevel: false,
})

console.log('lyrics-match-service.test.mjs ok')

