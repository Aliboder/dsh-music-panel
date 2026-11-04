import assert from 'node:assert/strict'
import { readTrackMeta } from '../lib/meta.js'
import { tempWav } from './helpers.mjs'

const file = await tempWav('meta-one.wav', 1)
const meta = await readTrackMeta(file)

assert.equal(meta.hasCover, false, 'a raw WAV has no cover')
assert.equal(meta.sampleRate, 44100)
assert.ok(meta.durationSec > 0.9 && meta.durationSec < 1.1, `duration ${meta.durationSec} should be ~1s`)
assert.equal(typeof meta.title, 'string')

// A missing file degrades to the empty shape instead of throwing.
const missing = await readTrackMeta('Z:/definitely/not/here.wav')
assert.equal(missing.title, '')
assert.equal(missing.durationSec, 0)
assert.equal(missing.hasCover, false)

console.log('meta.test.mjs ok')
