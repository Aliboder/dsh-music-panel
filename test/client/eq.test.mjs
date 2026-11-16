/**
 * Equalizer data + math.
 *
 * `src/client/services/player/effects/eq.js` is a fragment rather than a module (it ships inside client.js),
 * so it is evaluated in isolation here with `clamp`/`LANG` supplied. That keeps
 * the curves and the preset table under test without a browser.
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('../..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const source = readFileSync(join(root, 'src/client/services/player/effects/eq.js'), 'utf8')

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
    eqBandsMatchPreset, eqBandsEqual, eqSavedPresetId,
    eqPeakingCoefficients, eqSectionDb, eqCurveSamples,
    EQ_EFFECT_CONTROLS, EQ_EFFECT_DEFAULT, normalizeEqEffects,
    EQ_CUSTOM_SLOT_IDS, normalizeEqSlots,
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
assert.equal(empty.effects.highpass, 20)
assert.equal(empty.effects.width, 1)
assert.equal(eq.EQ_EFFECT_CONTROLS.length, 9, 'Folia exposes nine effect sliders')
assert.equal(eq.EQ_CUSTOM_SLOT_IDS.length, 2, 'Folia exposes two custom slots')
const slots = eq.normalizeEqSlots([
  { bands: [1, 2, 3], effects: { drive: 0.5 } },
  { bands: [4, 5, 6], effects: { width: 2 } },
])
assert.equal(slots.length, 2)
assert.deepEqual(slots[0].bands, [1, 2, 3, 0, 0, 0, 0, 0, 0, 0])
assert.equal(slots[0].effects.drive, 0.5)
assert.equal(slots[1].effects.width, 2)

const junk = eq.normalizeEqPrefs({
  eqBands: [3, 'x', 99, null],
  eqPreamp: 99,
  eqEnabled: 'yes',
  eqLayout: 'iso10',
  eqEffects: { drive: 99, width: -1, noise: 'x' },
})
assert.deepEqual(junk.bands, [3, 0, 12, 0, 0, 0, 0, 0, 0, 0], 'junk bands are clamped/padded')
assert.equal(junk.effects.drive, 1, 'effect values are clamped')
assert.equal(junk.effects.width, 0, 'width is clamped')
assert.equal(junk.effects.noise, 0, 'junk effect values fall back to neutral')
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

const sound = eq.normalizeEqPrefs({
  eqEnabled: true,
  eqPreset: 'lofi',
  eqBands: [-4, -2, 0, 2, 3, 2, 0, -3, -7, -10],
  eqLayout: 'iso10',
})
assert.equal(sound.preset, 'lofi', 'Folia sound preset ids survive normalization')
assert.deepEqual(sound.bands, [-4, -2, 0, 2, 3, 2, 0, -3, -7, -10])

const badPreset = eq.normalizeEqPrefs({ eqPreset: 'nope', eqBands: rock, eqLayout: 'iso10' })
assert.equal(badPreset.preset, 'flat', 'unknown presets fall back to flat')

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
// The chain is just the ten filters now: a +6 dB band peaks near +6 dB.
assert.ok(at1k.db > 5 && at1k.db < 7, `1 kHz should sit near the +6 dB band, got ${at1k.db}`)

// The first and last bands are shelves, matching Folia's graph shape.
const shelfCurve = eq.eqCurveSamples([6, 0, 0, 0, 0, 0, 0, 0, 0, -6], 0, 96, 44100)
const near = (freq) => shelfCurve.reduce((best, point) =>
  Math.abs(point.freq - freq) < Math.abs(best.freq - freq) ? point : best,
)
assert.ok(near(20).db > 5, 'the low shelf lifts the sub-bass')
assert.ok(Math.abs(near(1000).db) < 1, 'the low shelf is gone by 1 kHz')
assert.ok(near(20000).db < -5, 'the high shelf cuts the top')
assert.ok(Math.abs(near(1000).db) < 1, 'the high shelf is gone by 1 kHz')

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

// ── saved presets: equality + which row is active ────────────────────────
const customList = [
  { id: 'u1', name: '我的耳机', bands: [5, 3, 1, 0, -1, 0, 2, 4, 6, 7] },
  { id: 'u2', name: '音箱', bands: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2] },
]
assert.equal(eq.eqBandsEqual(customList[0].bands, [5, 3, 1, 0, -1, 0, 2, 4, 6, 7]), true)
assert.equal(eq.eqBandsEqual(customList[0].bands, [5, 3, 1, 0, -1, 0, 2, 4, 6, 8]), false)
assert.equal(eq.eqBandsEqual([0, 0], [0, 0, 0]), true, 'bands are normalized (padded) before comparing')
assert.equal(eq.eqBandsEqual([1], [0, 0, 0]), false, 'a padded band still differs')
assert.equal(
  eq.eqSavedPresetId(customList, 'custom', [5, 3, 1, 0, -1, 0, 2, 4, 6, 7]),
  'u1',
  'the applied saved preset is found',
)
assert.equal(eq.eqSavedPresetId(customList, 'custom', [1, 8, 0, 0, 0, 0, 0, 0, 0, 0]), '', 'unknown curve has no row')
assert.equal(eq.eqSavedPresetId(customList, 'rock', customList[0].bands), '', 'factory presets never mark a saved row')
assert.equal(eq.eqSavedPresetId(null, 'custom', customList[0].bands), '')

console.log('eq.test.mjs ok')


