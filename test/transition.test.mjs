/**
 * Transition envelope analysis: how long a track is quiet at its edges.
 * `src/46-transition.js` is a fragment, so it is evaluated with plain typed
 * arrays here instead of an AudioBuffer.
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const source = readFileSync(join(root, 'src/46-transition.js'), 'utf8')
const factory = new Function(
  `${source}
  return { analyzeTransitionEnvelope, TRANSITION_WINDOW, TRANSITION_HOP }`,
)
const transition = factory()

const RATE = 8000

/** `blocks` is [[seconds, amplitude], ...] appended in order. */
function build(blocks, rate = RATE) {
  const total = blocks.reduce((sum, [seconds]) => sum + seconds, 0)
  const data = new Float32Array(Math.round(total * rate))
  let offset = 0
  for (const [seconds, amplitude] of blocks) {
    const frames = Math.round(seconds * rate)
    for (let index = 0; index < frames; index += 1) {
      const at = offset + index
      if (at >= data.length) break
      data[at] = amplitude === 0 ? 0 : amplitude * Math.sin((2 * Math.PI * 440 * index) / rate)
    }
    offset += frames
  }
  return data
}

// 2 s quiet, 4 s loud, 4 s quiet.
const mixed = transition.analyzeTransitionEnvelope([build([[2, 0], [4, 0.3], [4, 0]])], RATE)
assert.ok(mixed, 'analysis returns a result')
assert.ok(Math.abs(mixed.introQuietSec - 2) <= 0.15, `intro quiet should be ~2 s, got ${mixed.introQuietSec}`)
assert.ok(
  Math.abs(mixed.introSilentSec - 2) <= 0.15,
  `intro silent should be ~2 s, got ${mixed.introSilentSec}`,
)
assert.ok(Math.abs(mixed.outroQuietSec - 4) <= 0.15, `outro quiet should be ~4 s, got ${mixed.outroQuietSec}`)
assert.ok(mixed.loudnessDb < 0 && mixed.loudnessDb > -40, 'loudness is a plausible dB value')
assert.ok(Math.abs(mixed.duration - 10) <= 0.05, 'duration is reported')

// Loud from start to end: nowhere to blend, the plan falls back to the minimum.
const loud = transition.analyzeTransitionEnvelope([build([[5, 0.4]])], RATE)
assert.equal(loud.introQuietSec, 0)
assert.equal(loud.outroQuietSec, 0)

// A soft musical intro is quiet relative to the track but is NOT silence, so
// it must never be skipped — this is what made the next track start mid-vocal.
const softIntro = transition.analyzeTransitionEnvelope([build([[3, 0.03], [4, 0.4]])], RATE)
assert.ok(softIntro.introQuietSec >= 2.5, `soft intro counts as quiet, got ${softIntro.introQuietSec}`)
assert.equal(softIntro.introSilentSec, 0, 'a soft intro is not silent')

// Completely silent track: both edges count as quiet, bounded by the windows.
const silent = transition.analyzeTransitionEnvelope([build([[5, 0]])], RATE)
assert.equal(silent.introQuietSec, 5)
assert.equal(silent.outroQuietSec, 5)

// Stereo input uses both channels; a loud right channel keeps the edges loud.
const stereo = transition.analyzeTransitionEnvelope(
  [build([[1, 0], [3, 0], [1, 0]]), build([[1, 0], [3, 0.5], [1, 0]])],
  RATE,
)
assert.ok(stereo.introQuietSec <= 1.2, `stereo intro quiet, got ${stereo.introQuietSec}`)
assert.ok(stereo.outroQuietSec <= 1.2, `stereo outro quiet, got ${stereo.outroQuietSec}`)

// A very short file must not crash or produce NaN.
const short = transition.analyzeTransitionEnvelope([new Float32Array(1600)], RATE)
assert.ok(short && Number.isFinite(short.introQuietSec) && Number.isFinite(short.outroQuietSec))

// Degenerate input is rejected rather than guessed.
assert.equal(transition.analyzeTransitionEnvelope([], RATE), null)
assert.equal(transition.analyzeTransitionEnvelope([new Float32Array(0)], RATE), null)
assert.equal(transition.analyzeTransitionEnvelope(null, RATE), null)
assert.equal(transition.analyzeTransitionEnvelope([new Float32Array(10)], 0), null)

// Windowing constants stay small enough for a real-time analysis.
assert.ok(transition.TRANSITION_WINDOW <= 0.2 && transition.TRANSITION_HOP <= transition.TRANSITION_WINDOW)

console.log('transition.test.mjs ok')
