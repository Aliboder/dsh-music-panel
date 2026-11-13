/**
 * Equalizer data + math.
 *
 * `src/40-eq.js` is a fragment rather than a module (it ships inside client.js),
 * so it is evaluated in isolation here with `clamp`/`LANG` supplied. That keeps
 * the curves and the preset table under test without a browser.
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const source = readFileSync(join(root, 'src/40-eq.js'), 'utf8')

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

const factory = new Function(
  'clamp',
  'LANG',
  `${source}
  return {
    EQ_FREQS, EQ_PRESETS, EQ_MAX_DB, EQ_CUSTOM_LIMIT,
    eqFaderToDb, eqBandsForPreset, zeroEqBands, normalizeEqBands,
    normalizeEqPrefs, eqPresetById, eqPresetName, eqPresetForBands,
    eqBandsMatchPreset, eqHeadroomDb, eqTotalPreampDb, eqDbToLinear,
    eqPeakingCoefficients, eqSectionDb, eqCurveSamples,
  }`,
)

const eq = factory(clamp, 'zh')

// ── preset table ──────────────────────────────────────────────────────────
assert.equal(eq.EQ_FREQS.length, 10, 'ten bands')
assert.ok(eq.EQ_PRESETS.length >= 18, 'the Winamp factory set is present')
const ids = new Set()
for (const preset of eq.EQ_PRESETS) {
  assert.ok(!ids.has(preset.id), `duplicate preset id: ${preset.id}`)
  ids.add(preset.id)
  assert.equal(preset.values.length, 10, `${preset.id} needs ten fader values`)
  for (const value of preset.values) {
    assert.ok(Number.isInteger(value) && value >= 0 && value <= 64, `${preset.id} fader out of range`)
  }
}

// Fader scale: 0 → −12 dB, 33 → 0 dB, 64 → +12 dB (asymmetric around centre).
assert.equal(eq.eqFaderToDb(0), -12)
assert.equal(eq.eqFaderToDb(33), 0)
assert.equal(eq.eqFaderToDb(64), 12)
assert.equal(eq.eqFaderToDb(99), 12)
assert.equal(eq.eqFaderToDb('x'), 0)

// Flat is a real bypass; the Winamp presets are re-derived on the new grid.
assert.deepEqual(eq.eqBandsForPreset('flat'), [0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
const rock = eq.eqBandsForPreset('rock')
assert.ok(rock[0] > 0, 'rock still lifts the bass on the ISO grid')
assert.ok(rock[3] < rock[2], 'rock scoops the low mids')
const bass = eq.eqBandsForPreset('fullBass')
// Winamp's lowest fader is 70 Hz, so on the 31 Hz grid only the filter tail
// survives — the character stays, the sub-bass number is naturally small.
assert.ok(bass[0] > 0 && bass[9] < -3, 'full bass lifts lows and cuts highs')
const treble = eq.eqBandsForPreset('fullTreble')
assert.ok(treble[8] > 5 && treble[0] < 0, 'full treble keeps its shape')

// ── persisted prefs ───────────────────────────────────────────────────────
const empty = eq.normalizeEqPrefs({})
assert.equal(empty.enabled, false, 'an upgrade must not switch the EQ on')
assert.equal(empty.preset, 'flat')
assert.deepEqual(empty.bands, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0])

const junk = eq.normalizeEqPrefs({
  eqBands: [3, 'x', 99, null],
  eqPreamp: 99,
  eqEnabled: 'yes',
  eqLayout: 'iso10',
})
assert.deepEqual(junk.bands, [3, 0, 12, 0, 0, 0, 0, 0, 0, 0], 'junk bands are clamped/padded')
assert.equal(junk.preamp, 12, 'preamp is clamped')
assert.equal(junk.enabled, false, 'only a real boolean enables the EQ')

const saved = eq.normalizeEqPrefs({
  eqEnabled: true,
  eqPreset: 'rock',
  eqBands: rock,
  eqLayout: 'iso10',
})
assert.equal(saved.preset, 'rock')
assert.deepEqual(saved.bands, rock)

// Bands written by a build with a different grid must not be misread.
const staleGrid = eq.normalizeEqPrefs({ eqEnabled: true, eqPreset: 'rock', eqBands: [5, 3, -4, -5, -3, 2, 5, 7, 7, 7] })
assert.deepEqual(staleGrid.bands, eq.eqBandsForPreset('rock'), 'old grid bands are re-derived from the preset')
assert.notDeepEqual(staleGrid.bands, [5, 3, -4, -5, -3, 2, 5, 7, 7, 7])

// Device presets carry their own id and are not validated against the factory list.
const device = eq.normalizeEqPrefs({
  eqEnabled: true,
  eqPreset: 'device',
  eqDevice: 'oratory1990::over-ear::Sennheiser HD 600',
  eqBands: [6.9, 3.3, -1.1, -1.6, 0.6, -0.8, 0.1, -1, 3.9, -6.5],
  eqLayout: 'iso10',
})
assert.equal(device.preset, 'device')
assert.equal(device.device, 'oratory1990::over-ear::Sennheiser HD 600')
assert.deepEqual(device.bands, [6.9, 3.3, -1.1, -1.6, 0.6, -0.8, 0.1, -1, 3.9, -6.5], 'tenths survive')

const badPreset = eq.normalizeEqPrefs({ eqPreset: 'nope', eqBands: rock, eqLayout: 'iso10' })
assert.equal(badPreset.preset, 'flat', 'unknown presets fall back to flat')

// ── headroom ──────────────────────────────────────────────────────────────
assert.equal(eq.eqHeadroomDb([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), 0)
assert.ok(
  Math.abs(eq.eqHeadroomDb([6, 0, 0, 0, 0, 0, 0, 0, 0, 0]) + 6) < 0.4,
  'one +6 dB band trims about 6 dB',
)
assert.equal(eq.eqHeadroomDb([-3, -1, 0, 0, 0, 0, 0, 0, 0, 0]), 0, 'cuts need no trim')
assert.ok(
  Math.abs(eq.eqTotalPreampDb(0, [6, 0, 0, 0, 0, 0, 0, 0, 0, 0]) + 6) < 0.4,
  'the total preamp carries the trim',
)
assert.ok(
  Math.abs(eq.eqTotalPreampDb(3, [6, 0, 0, 0, 0, 0, 0, 0, 0, 0]) + 3) < 0.4,
  'user preamp stacks on top of the headroom',
)
assert.ok(
  eq.eqHeadroomDb([7, 7, 7, 7, 0, 0, 0, 0, 0, 0]) >= -6,
  'the automatic trim is capped at 6 dB',
)
assert.ok(
  eq.eqHeadroomDb([7, 7, 7, 7, 0, 0, 0, 0, 0, 0]) < -3,
  'overlapping boosts still trim more than one band',
)
assert.equal(eq.eqDbToLinear(0), 1)
assert.ok(Math.abs(eq.eqDbToLinear(6) - 1.9953) < 0.001)

// ── response curve ────────────────────────────────────────────────────────
assert.ok(Math.abs(eq.eqSectionDb(eq.eqPeakingCoefficients(1000, 1.1, 0, 44100), 1000, 44100)) < 0.01)

const flatCurve = eq.eqCurveSamples([0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 0, 32, 44100)
assert.equal(flatCurve.length, 32)
for (const point of flatCurve) assert.ok(Math.abs(point.db) < 0.01, 'flat is 0 dB everywhere')

const boosted = [0, 0, 0, 0, 0, 6, 0, 0, 0, 0]
const boostedCurve = eq.eqCurveSamples(boosted, 0, 64, 44100)
const at1k = boostedCurve.reduce((best, point) =>
  Math.abs(point.freq - 1000) < Math.abs(best.freq - 1000) ? point : best,
)
// The chain adds the -6 dB headroom trim, so a +6 dB band peaks near 0 dB total.
assert.ok(at1k.db > -1 && at1k.db < 1, `1 kHz should sit near the headroom-trimmed peak, got ${at1k.db}`)

const cutCurve = eq.eqCurveSamples([0, 0, 0, 0, 0, 0, 0, 0, 0, 0], -6, 24, 44100)
for (const point of cutCurve) assert.ok(Math.abs(point.db + 6) < 0.01, 'preamp applies flat')

const narrow = eq.eqCurveSamples([12, 12, 12, 12, 12, 12, 12, 12, 12, 12], 0, 16, 22050)
for (const point of narrow) {
  assert.ok(Number.isFinite(point.db), 'no NaN when a band reaches Nyquist')
  assert.ok(point.freq <= 11025, 'points stay below Nyquist')
}

// ── preset matching / labels ──────────────────────────────────────────────
assert.equal(eq.eqPresetForBands(eq.eqBandsForPreset('fullBass')), 'fullBass')
assert.equal(eq.eqPresetForBands([1, 0, 0, 0, 0, 0, 0, 0, 0, 0]), 'custom')
assert.equal(eq.eqBandsMatchPreset([0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 'flat'), true)
assert.equal(eq.eqPresetById('nope'), null)
assert.equal(eq.eqPresetName(eq.eqPresetById('fullBass')), '重低音', 'zh label')
assert.equal(factory(clamp, 'en').eqPresetName(eq.eqPresetById('fullBass')), 'Full bass', 'en label')

console.log('eq.test.mjs ok')
