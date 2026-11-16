/**
 * Lyric match scoring: a port of Folia's model, so the two pick the same
 * candidate. These assertions pin the exact numbers Folia guarantees.
 */

import assert from 'node:assert/strict'
import {
  AUTO_MATCH_COMPONENT_MISS_SCORE_CAP,
  AUTO_MATCH_MIN_SCORE,
  SCORE_WEIGHTS,
  calculateDurationScore,
  calculateMatchScore,
  calculateMatchScoreDetails,
  normalizeLyricMatchText,
  normalizeTitleForMatch,
  pickBestLyricCandidate,
} from '../../src/host/services/lyrics/lyrics-match.js'

// ── weights match Folia's table ─────────────────────────────────────────────

assert.deepEqual(SCORE_WEIGHTS, { title: 45, artist: 25, album: 30 })
assert.equal(AUTO_MATCH_MIN_SCORE, 75)
assert.equal(AUTO_MATCH_COMPONENT_MISS_SCORE_CAP, 74)

// ── normalisation: OpenCC + wanakana + punctuation ──────────────────────────

assert.equal(normalizeLyricMatchText('周傑倫'), '周杰伦', 'traditional → simplified')
assert.equal(normalizeLyricMatchText('ヨルニカケル'), 'yorunikakeru', 'kana → romaji')
assert.equal(normalizeLyricMatchText('晴天！'), '晴天')
assert.equal(normalizeLyricMatchText('  A   B  '), 'a b')

// Version markers are part of a song's identity, so they survive title
// normalisation; ordinary brackets and feat. credits do not.
assert.equal(normalizeTitleForMatch('晴天 (Live)'), '晴天 live')
assert.equal(normalizeTitleForMatch('晴天 (Instrumental)'), '晴天 instrumental')
assert.equal(normalizeTitleForMatch('晴天 (feat. 五月天)'), '晴天')
assert.equal(normalizeTitleForMatch('晴天（周杰伦）'), '晴天')

// ── scoring ────────────────────────────────────────────────────────────────

const track = { title: '晴天', artist: '周杰伦', album: '叶惠美', durationMs: 269000 }

const exact = calculateMatchScoreDetails(track, {
  title: '晴天',
  artist: '周杰伦',
  album: '叶惠美',
  durationMs: 269000,
})
assert.equal(exact.score, 100)
assert.equal(exact.titleSimilarity, 1)
assert.equal(exact.artistSimilarity, 1)
assert.equal(exact.albumSimilarity, 1)
assert.equal(exact.durationMultiplier, 1)

// Title only, wrong artist: the identity is incomplete, so the score is capped
// one point below the threshold and the candidate is rejected.
const cover = calculateMatchScoreDetails(track, {
  title: '晴天',
  artist: 'RyaVocal',
  album: '晴天',
  durationMs: 271000,
})
assert.equal(cover.artistMatched, false)
assert.ok(cover.score <= AUTO_MATCH_COMPONENT_MISS_SCORE_CAP, `cover scored ${cover.score}`)
assert.ok(cover.score < AUTO_MATCH_MIN_SCORE)

// A different title never passes, whatever else matches.
assert.ok(calculateMatchScore(track, { title: '七里香', artist: '周杰伦', album: '叶惠美', durationMs: 269000 }) < AUTO_MATCH_MIN_SCORE)

// Album corroborates an artist we could not match exactly.
const albumCorroborated = calculateMatchScoreDetails(
  { title: '晴天', artist: '周杰伦 & 五月天', durationMs: 269000 },
  { title: '晴天', artist: '周杰伦 / 五月天', durationMs: 269000 },
)
assert.ok(albumCorroborated.score >= AUTO_MATCH_MIN_SCORE)

// Unknown album on both sides scores the album weight in full (Folia's rule).
const noAlbum = calculateMatchScoreDetails(
  { title: '晴天', artist: '周杰伦', durationMs: 269000 },
  { title: '晴天', artist: '周杰伦', album: 'Unknown Album', durationMs: 269000 },
)
assert.equal(noAlbum.score, 100)

// ── duration is a multiplier, not an addend ────────────────────────────────

assert.equal(calculateDurationScore(0, 0).multiplier, 0.9, 'unknown duration costs 10%')
assert.equal(calculateDurationScore(269000, 269500).multiplier, 1)
assert.equal(calculateDurationScore(269000, 271000).multiplier, 0.95)
assert.equal(calculateDurationScore(269000, 273000).multiplier, 0.75)
assert.equal(calculateDurationScore(269000, 278000).multiplier, 0.35)
assert.equal(calculateDurationScore(269000, 300000).multiplier, 0.1)

const drifted = calculateMatchScoreDetails(track, {
  title: '晴天',
  artist: '周杰伦',
  album: '叶惠美',
  durationMs: 300000,
})
assert.equal(drifted.score, 10, 'a long version keeps 10% of a perfect identity')

// ── selection ──────────────────────────────────────────────────────────────

const candidates = [
  { id: 'cover', title: '晴天', artist: 'RyaVocal', durationMs: 271000 },
  { id: 'original', title: '晴天', artist: '周杰伦', album: '叶惠美', durationMs: 269000 },
  { id: 'other', title: '七里香', artist: '周杰伦', durationMs: 299000 },
]
const best = pickBestLyricCandidate(track, candidates)
assert.equal(best.candidate.id, 'original')
assert.equal(best.score, 100)

assert.equal(pickBestLyricCandidate(track, [{ id: 'x', title: '七里香', artist: '周杰伦' }]), null)
assert.equal(pickBestLyricCandidate(track, []), null)
assert.equal(pickBestLyricCandidate(track, null), null)

console.log('lyrics-match.test.mjs ok')

