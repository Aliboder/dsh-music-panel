/**
 * 「匹配歌词」的 Folia 算法 bundle：加载、配置、跑一次自动匹配（替身 provider，不连网）。
 */

import assert from 'node:assert/strict'
import {
  autoMatchBestLyric,
  calculateMatchScoreDetails,
  configureLyricsMatch,
  searchLyricsByMatchSource,
  getLyricSourceIds,
} from '../../src/host/vendor/lyrics-folia/match.bundle.mjs'

const calls = []

const songOf = (id, name, extra = {}) => ({
  id,
  name,
  artists: [{ name: '周杰伦' }],
  album: { id: 1, name: '叶惠美' },
  durationMs: 269000,
  ...extra,
})

const wordLyrics = (text) => ({
  lyrics: {
    lines: [{ fullText: text, startTime: 0, endTime: 2, words: [{ text, startTime: 0, endTime: 2 }] }],
    isWordByWord: true,
  },
  isPureMusic: false,
  chorusRanges: [],
})

const provider = {
  search: {
    async searchSongs(query, limit, offset) {
      calls.push(['search', query, limit, offset])
      return { items: [songOf('qq-1', '晴天'), songOf('qq-2', '晴天 (伴奏)')] }
    },
  },
  lyrics: {
    async getLyrics(song) {
      calls.push(['lyrics', song.id])
      return wordLyrics('故事的小黄花')
    },
    prefersOwnWordByWord: false,
  },
}

configureLyricsMatch({ sources: [{ id: 'qq', platform: true, provider }] })
assert.ok(getLyricSourceIds().includes('qq'))
assert.ok(getLyricSourceIds().includes('amll'), 'AMLL 是上游自带的源')

// ── 自动匹配：按上游顺序问 qq，拿到逐字歌词 ─────────────────────────────
{
  const result = await autoMatchBestLyric('晴天', '周杰伦', 269000, { preferredSource: 'qq' })
  assert.ok(result, 'a match is found')
  assert.equal(result.isPureMusic === true, false)
  assert.equal(result.source, 'qq')
  assert.equal(result.lyrics.isWordByWord, true)
  assert.equal(result.lyrics.lines[0].fullText, '故事的小黄花')
  assert.equal(calls.filter(([kind]) => kind === 'search').length >= 1, true)
  assert.equal(calls.filter(([kind]) => kind === 'lyrics').length >= 1, true)
}

// ── 打分：上游的时长分档（≤1s → ×1，≤3s → ×0.95）────────────────────────
{
  const target = { title: '晴天', artist: '周杰伦', durationMs: 269000, album: '叶惠美' }
  const exact = calculateMatchScoreDetails(target, songOf('a', '晴天', { durationMs: 269500 }))
  const near = calculateMatchScoreDetails(target, songOf('b', '晴天', { durationMs: 271000 }))
  assert.equal(exact.durationMatched, true)
  assert.equal(exact.durationMultiplier, 1, 'within 1s is a perfect duration match (the tier our old port was missing)')
  assert.equal(near.durationMultiplier, 0.95)
  assert.equal(exact.score >= 75, true)
}

// ── 手动匹配窗口的搜索：同一套打分、按分排序 ────────────────────────────
{
  const target = { title: '晴天', artist: '周杰伦', durationMs: 269000 }
  const found = await searchLyricsByMatchSource('qq', '晴天', target)
  assert.equal(found.length, 2)
  assert.equal(found[0].name, '晴天', 'the plain take ranks above the backing track')
}

console.log('lyrics-folia-bundle.test ok')
