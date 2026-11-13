/**
 * AutoEQ preset library: the generated data file plus the search that the
 * `/music/eq/presets` route exposes.
 */

import assert from 'node:assert/strict'
import { eqPresetId, eqPresetRow, loadEqPresets, searchEqPresets } from '../lib/eq-presets.js'

const payload = await loadEqPresets()

assert.ok(payload.presets.length > 5000, `the library should hold thousands of profiles, got ${payload.presets.length}`)
assert.deepEqual(payload.bands, [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000], 'bands match the equalizer')

const sample = payload.presets[0]
assert.equal(typeof sample.n, 'string')
assert.equal(typeof sample.s, 'string')
assert.equal(sample.g.length, 10, 'every profile has ten gains')
for (const gain of sample.g) assert.ok(Number.isFinite(gain) && Math.abs(gain) <= 24, 'gains are finite')

// Every entry must shape into a client row with a stable id.
const row = eqPresetRow(sample)
assert.equal(row.id, eqPresetId(sample))
assert.equal(row.bands.length, 10)
assert.ok(row.name.length > 0 && row.source.length > 0)

// Sources are aggregated with counts, biggest first.
assert.ok(payload.sources.length > 3, 'several measurement sources exist')
assert.equal(
  payload.sources.reduce((sum, item) => sum + item.count, 0),
  payload.presets.length,
  'source counts add up to the library size',
)
for (let index = 1; index < payload.sources.length; index += 1) {
  assert.ok(payload.sources[index - 1].count >= payload.sources[index].count, 'sources are sorted by count')
}

// ── search ────────────────────────────────────────────────────────────────
const airpods = searchEqPresets(payload, 'airpods pro', { limit: 10 })
assert.ok(airpods.length > 0, 'known models are found')
assert.ok(airpods.length <= 10, 'limit is respected')
assert.ok(
  airpods.every((entry) => /airpods/i.test(entry.n)),
  'every hit matches the query',
)

const sony = searchEqPresets(payload, 'wh-1000xm4', { limit: 5 })
assert.ok(sony.length > 0, 'punctuation inside model names is searchable')
assert.ok(sony.every((entry) => /wh-1000xm4/i.test(entry.n)))

const ranked = searchEqPresets(payload, 'sennheiser hd 600', { limit: 5 })
assert.ok(ranked.length > 0)
assert.match(ranked[0].n.toLowerCase(), /^sennheiser hd 600/i, 'an exact prefix ranks first')

// Naming differences between apps must not hide a profile.
const plus = searchEqPresets(payload, 'galaxy buds+', { limit: 10 })
assert.ok(
  plus.some((entry) => /galaxy buds plus/i.test(entry.n)),
  'a "+" query matches AutoEQ\'s "Plus" spelling',
)
const pixel = searchEqPresets(payload, 'pixel buds 2', { limit: 10 })
assert.ok(
  pixel.some((entry) => /pixel buds \(2020\)/i.test(entry.n)),
  'a model year in parentheses does not block the match',
)
const akg = searchEqPresets(payload, 'eo-ig955', { limit: 10 })
assert.ok(akg.some((entry) => /eo-ig955/i.test(entry.n)), 'AKG-branded Samsung buds are found')

const none = searchEqPresets(payload, 'zzzz-not-a-headphone', { limit: 5 })
assert.equal(none.length, 0, 'no matches means no rows')

const empty = searchEqPresets(payload, '', { limit: 3 })
assert.equal(empty.length, 3, 'an empty query returns the head of the list')

const bySource = searchEqPresets(payload, '', { limit: 200, source: payload.sources[0].id })
assert.ok(bySource.length > 0)
assert.ok(
  bySource.every((entry) => entry.s === payload.sources[0].id),
  'the source filter is exclusive',
)

console.log('eq-presets.test.mjs ok')
