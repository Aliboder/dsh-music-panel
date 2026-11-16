import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../../src/client/styles/wave-color.js', import.meta.url), 'utf8')
const createBeatTracker = new Function(source + '\nreturn createBeatTracker')()

// Beat tracker: rising sub-bass energy produces a pulse, quieter frames decay.
const tracker = createBeatTracker()
const low = new Uint8Array(128).fill(10)
const high = new Uint8Array(128).fill(220)
assert.equal(tracker.update(low, true), 0, 'first frame cannot produce flux')
const pulse = tracker.update(high, true)
assert.ok(pulse > 0.3, 'rising bass produces a beat')
const decayed = tracker.update(low, true)
assert.ok(decayed < pulse, 'beat decays when energy falls')
const playingPulse = tracker.update(high, true)
const paused = tracker.update(high, false)
assert.ok(paused < playingPulse, 'paused playback lets the beat decay')
assert.ok(tracker.update(null, true) >= 0, 'missing wave is tolerated')

console.log('wave-color.test.mjs ok')


