/**
 * Folia audio decisions: curves, balance rules, fade controller.
 *
 * These are the pure parts the bundle reuses verbatim. The test pins the
 * numbers that decide what the listener hears, so a later adapter cannot quietly
 * reintroduce our old crossfade or a different balance target.
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..')
const BUNDLE = join(ROOT, 'src/client/audio/engine.bundle.js')
const sandbox = { console }
vm.runInNewContext(readFileSync(BUNDLE, 'utf8'), sandbox, { filename: BUNDLE })
const audio = sandbox.__mpAudioBundle()
assert.ok(audio !== null, 'audio bundle loads')
const bundleText = readFileSync(BUNDLE, 'utf8')
assert.ok(!/htdemucs|beat_this|modelAvailability|separateStem/.test(bundleText), 'the Stems shim kept the models out of the bundle')

const close = (actual, expected, message, epsilon = 1e-6) => {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${message}: ${actual} != ${expected}`)
}

// --- crossfade curves -------------------------------------------------------

const curves = audio.buildCrossfadeCurves(0.5, 0)
assert.equal(curves.out.length, 64)
assert.equal(curves.in.length, 64)
close(curves.out[0], 1, 'outgoing starts at unity')
close(curves.out[63], 0, 'outgoing ends silent')
close(curves.in[0], 0, 'incoming starts silent')
close(curves.in[63], 1, 'incoming ends at unity')
for (let index = 0; index < 63; index += 1) {
  assert.ok(curves.out[index] >= curves.out[index + 1] - 1e-6, 'outgoing is monotonic')
  assert.ok(curves.in[index] <= curves.in[index + 1] + 1e-6, 'incoming is monotonic')
  assert.ok(curves.out[index] ** 2 + curves.in[index] ** 2 <= 1.000001, 'equal power never exceeds unity')
}

// Folia's 1.5 dB headroom bell only touches the middle; both ends stay exact.
const held = audio.buildCrossfadeCurves(0.5, 0.4)
close(held.out[0], 1, 'held outgoing starts at unity')
close(held.out[63], 0, 'held outgoing ends silent')
close(held.in[0], 0, 'held incoming starts silent')
close(held.in[63], 1, 'held incoming ends at unity')

const bands = audio.buildBandCurves({
  crossover: 0.5,
  swapBass: true,
  sweepOut: true,
  tiltDb: [3, -3],
  points: 16,
})
assert.equal(bands.out.length, 3)
assert.equal(bands.in.length, 3)
for (const band of [...bands.out, ...bands.in]) assert.equal(band.length, 16)

// --- balance rules ----------------------------------------------------------

const file = audio.chooseBalance({ file: { loudness: -20, peak: 0.5 }, typicalDb: -5 })
assert.equal(file.reading, 'file')
close(file.gainDb, 6, 'file reading asks for +6 dB')
close(file.effectiveGainDb, audio.liftWithinPeak(6, 0.5), 'file lift is peak-limited')
assert.equal(file.estimated, false)

const tag = audio.chooseBalance({ tag: { gainDb: -6, peak: 0.9 }, typicalDb: -5 })
assert.equal(tag.reading, 'tag')
close(tag.gainDb, -2, 'ReplayGain 2 tags aim 4 dB under the balance target')
close(tag.effectiveGainDb, -2, 'a tag cut is applied whole')

const live = audio.chooseBalance({ live: -10, typicalDb: -5 })
assert.equal(live.reading, 'live')
close(live.gainDb, -4, 'live reading asks for -4 dB')
close(live.effectiveGainDb, -4, 'an estimate may turn a song down')
assert.equal(live.estimated, true)

const typical = audio.chooseBalance({ typicalDb: -5 })
assert.equal(typical.reading, 'typical')
close(typical.effectiveGainDb, -5, 'typical gain is never a lift')

assert.equal(audio.planBalanceMove({ playSec: 0, moved: false, currentDb: 0, nextDb: -2, blendAudible: false }), 'set')
assert.equal(audio.planBalanceMove({ playSec: 5, moved: true, currentDb: 0, nextDb: -2, blendAudible: false }), null)
const earlyMove = audio.planBalanceMove({ playSec: 5, moved: false, currentDb: 0, nextDb: -2, blendAudible: false })
assert.equal(earlyMove.rampSec, 2)
const lateMove = audio.planBalanceMove({ playSec: 20, moved: false, currentDb: 0, nextDb: -4, blendAudible: false })
assert.equal(lateMove.rampSec, 5)
assert.equal(audio.planBalanceMove({ playSec: 20, moved: false, currentDb: 0, nextDb: -2, blendAudible: false }), null)
assert.equal(audio.planBalanceMove({ playSec: 5, moved: false, currentDb: 0, nextDb: -2, blendAudible: true }), 'hold')

const whole = { loudness: -14, peak: 0.8, heardSec: 180, fromSec: 0, toSec: 179, broken: null }
assert.equal(audio.whyNotWholePlay(whole, { duration: 180 }), null)
assert.equal(audio.whyNotWholePlay({ ...whole, broken: 'seek' }, { duration: 180 }), 'seek')
assert.equal(audio.whyNotWholePlay(whole, { duration: 180, clip: 'half the song' }), 'not the whole song (half the song)')
assert.equal(audio.whyNotWholePlay(whole, { duration: 0 }), 'length unknown')
assert.equal(audio.whyNotWholePlay({ ...whole, fromSec: 5 }, { duration: 180 }), 'started at 5.0s')
assert.equal(audio.whyNotWholePlay({ ...whole, toSec: 170 }, { duration: 180 }), 'stopped at 170.0s')
assert.equal(audio.whyNotWholePlay({ ...whole, loudness: -90 }, { duration: 180 }), 'silence')

// --- playback fade controller ----------------------------------------------

function param(value) {
  return {
    value,
    setValueAtTime(next) {
      this.value = next
    },
    setTargetAtTime(next) {
      this.value = next
    },
    linearRampToValueAtTime(next) {
      this.value = next
    },
    cancelScheduledValues() {},
    cancelAndHoldAtTime() {},
    setValueCurveAtTime(curve) {
      this.value = curve[curve.length - 1]
    },
  }
}

const gain = { gain: param(1) }
const context = { state: 'running', currentTime: 0 }
const timers = []
const fade = audio.createPlaybackFadeController({
  getGraph: () => ({ context, gain }),
  isEnabled: () => true,
  setTimer(callback, ms) {
    const timer = { callback, ms, cancelled: false }
    timers.push(timer)
    return timer
  },
  clearTimer(timer) {
    timer.cancelled = true
  },
})

function runTimer(ms) {
  const timer = timers.find((item) => !item.cancelled && item.ms === ms)
  assert.ok(timer, `timer ${ms}ms exists`)
  timer.cancelled = true
  timer.callback()
}

let pauseReason = null
assert.equal(fade.fadeOutThen((reason) => { pauseReason = reason }), true)
close(gain.gain.value, 0, 'fade-out started at silence')
assert.equal(pauseReason, null, 'the element is not paused before the ramp lands')
runTimer(215)
assert.equal(pauseReason, 'elapsed', 'pause runs after the 200ms ramp + 15ms grace')
runTimer(150)
close(gain.gain.value, 1, 'the fade node returns to unity after the drain')

assert.equal(fade.fadeOutThen(() => {}), true)
assert.equal(fade.cancelPendingPause(), true)
close(gain.gain.value, 1, 'cancelling a pending pause ramps back to unity')

const token = fade.prepareFadeIn()
close(gain.gain.value, 0, 'fade-in starts from silence')
fade.runFadeIn(token)
close(gain.gain.value, 1, 'fade-in reaches unity')

let flushed = null
assert.equal(fade.fadeOutThen((reason) => { flushed = reason }), true)
fade.flush()
assert.equal(flushed, 'flushed', 'flush runs the pending pause before a track change')
runTimer(150)
close(gain.gain.value, 1, 'flush restores unity after the drain')

// --- crossfade scheduling ---------------------------------------------------

const outGain = { gain: param(1) }
const inGain = { gain: param(0) }
assert.equal(audio.scheduleCrossfade(context, outGain, inGain, 2, 0.5), true)
close(outGain.gain.value, 0, 'outgoing curve ends silent')
close(inGain.gain.value, 1, 'incoming curve ends at unity')

console.log('audio-folia.test.mjs ok')
