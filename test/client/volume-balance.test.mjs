/**
 * 音量平衡规则 — the parts Folia documents as constants and a choice order.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// The two modules are plain browser fragments; strip their guards and evaluate.
const source = readFileSync(new URL('../../src/client/services/player/effects/volume-balance.js', import.meta.url), 'utf8')
const sandbox = { exports: {} }
const factory = new Function(
  'createStore',
  `${source}\nreturn { chooseBalance, liftWithinPeak, typicalGainDb, planBalanceMove, VOLUME_BALANCE_TARGET_DB, VOLUME_BALANCE_MAX_BOOST_DB }`,
)
const { chooseBalance, liftWithinPeak, typicalGainDb, planBalanceMove, VOLUME_BALANCE_TARGET_DB } = factory(() => ({
  set() {},
}))

assert.equal(VOLUME_BALANCE_TARGET_DB, -14)

// A whole-track reading wins and lifts within the caps.
const file = chooseBalance({ file: { loudness: -20, peak: 0.9 } })
assert.equal(file.reading, 'file')
assert.equal(file.gainDb, 6)
// peak 0.9 is near full scale: the ceiling leaves no headroom, so the lift is 0.
assert.equal(file.effectiveGainDb, 0)
// peak 0.5 leaves -1.5 - 20log10(0.5) ≈ 4.52 dB, under the +6 cap.
assert.ok(
  chooseBalance({ file: { loudness: -20, peak: 0.5 } }).effectiveGainDb < 4.53 &&
    chooseBalance({ file: { loudness: -20, peak: 0.5 } }).effectiveGainDb > 4.51,
)

// A quiet file with a low peak may take the full cap.
assert.equal(chooseBalance({ file: { loudness: -20, peak: 0.1 } }).effectiveGainDb, 6)

// A whole play beats a tag.
assert.equal(chooseBalance({ played: { loudness: -20 }, tag: { gainDb: -3 } }).reading, 'played')

// A tag adds the 4 dB offset that ReplayGain 2 tags are short by.
assert.equal(chooseBalance({ tag: { gainDb: -6 } }).gainDb, -2)

// Estimates only turn down.
assert.equal(chooseBalance({ live: -20 }).effectiveGainDb, 0)
assert.equal(chooseBalance({ live: -9 }).effectiveGainDb, -5)
assert.equal(chooseBalance({}).effectiveGainDb, -5)

// Typical gain is a median, never a lift.
assert.equal(typicalGainDb([]), -5)
assert.equal(typicalGainDb([-8, -6, -4]), -6)
assert.equal(typicalGainDb([2, 4]), 0)

// A lift is capped and read-only-returned by the peak rule.
assert.equal(liftWithinPeak(6, null), 0)
assert.equal(liftWithinPeak(-3, 5), -3)

// Moves: before sound it is a set; early in a play it eases in; later only a 3 dB cut.
assert.equal(planBalanceMove({ playSec: 0, moved: false, currentDb: 0, nextDb: -4 }), 'set')
assert.equal(planBalanceMove({ playSec: 5, moved: false, currentDb: 0, nextDb: -4 }), 2)
assert.equal(planBalanceMove({ playSec: 20, moved: false, currentDb: 0, nextDb: -4 }), 5)
assert.equal(planBalanceMove({ playSec: 20, moved: false, currentDb: 0, nextDb: -1 }), null)
assert.equal(planBalanceMove({ playSec: 5, moved: true, currentDb: 0, nextDb: -4 }), null)
assert.equal(planBalanceMove({ playSec: 5, moved: false, currentDb: -4, nextDb: -4 }), null)

console.log('volume-balance.test.mjs ok')


