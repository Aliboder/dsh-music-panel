import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../../src/client/services/player/effects/profile.js', import.meta.url), 'utf8')
const storage = new Map()
const window = {
  localStorage: {
    getItem: (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => storage.set(key, String(value)),
  },
}
const factory = new Function('window', source + '\nreturn { profileFor, noteProfile }')
const api = factory(window)
assert.equal(api.profileFor('a'), null)
api.noteProfile('a', { programLoudness: -17.2, peak: 0.83, leadIn: 1.2, partial: false })
assert.deepEqual(api.profileFor('a'), {
  programLoudness: -17.2,
  peak: 0.83,
  leadIn: 1.2,
  partial: false,
  at: api.profileFor('a').at,
})
api.noteProfile('b', { programLoudness: -90, peak: 0, leadIn: 0, partial: true })
assert.equal(api.profileFor('b'), null, 'silence is not a profile')
api.noteProfile('c', { programLoudness: -18, peak: 0.7, leadIn: 0.2, tempo: 120, sections: [1, 2] })
assert.equal(api.profileFor('c').tempo, 120, 'the full profile is preserved')
assert.deepEqual(api.profileFor('c').sections, [1, 2])
console.log('profile.test.mjs ok')
