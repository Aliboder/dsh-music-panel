/**
 * Volume-balance records: file/played readings, typical dedupe and migration.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../../src/client/services/player/effects/balance-meter.js', import.meta.url), 'utf8')
const rules = readFileSync(new URL('../../src/client/services/player/effects/volume-balance.js', import.meta.url), 'utf8')
const storage = new Map()
const window = {
  localStorage: {
    getItem: (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => storage.set(key, String(value)),
  },
  AudioContext: function () {},
}
const factory = new Function(
  'window',
  'createStore',
  'VOLUME_BALANCE_TYPICAL_SIZE',
  'VOLUME_BALANCE_TARGET_DB',
  'whyNotWholePlay',
  rules + '\n' + source + '\nreturn { balanceRecordFor, balanceTypicalGains, noteBalanceMeasurement }',
)
const api = factory(window, () => ({ set() {} }), 20, -14, () => null)
assert.equal(api.balanceRecordFor('a'), null)
api.noteBalanceMeasurement('a', 'file', { loudness: -20, peak: 0.5 })
assert.equal(api.balanceRecordFor('a').file.loudness, -20)
api.noteBalanceMeasurement('a', 'played', { loudness: -21, peak: 0.4 })
assert.deepEqual(api.balanceRecordFor('a').played, { loudness: -21, peak: 0.4 })
assert.equal(api.balanceTypicalGains().length, 1, 'one song contributes one typical entry')
api.noteBalanceMeasurement('a', 'file', { loudness: -19, peak: 0.5 })
assert.equal(api.balanceTypicalGains().length, 1, 'a re-read replaces the same song')
assert.equal(api.balanceTypicalGains()[0], 5)
api.noteBalanceMeasurement('b', 'file', { loudness: -10, peak: 0.2 })
assert.equal(api.balanceTypicalGains().length, 2)
assert.equal(api.balanceRecordFor('a').file.loudness, -19)
console.log('volume-balance-records.test.mjs ok')
