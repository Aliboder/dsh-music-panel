/**
 * Crossfade decisions (src/45-crossfade.js is a fragment, evaluated here with
 * no browser so the rules stay testable).
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const source = readFileSync(join(root, 'src/45-crossfade.js'), 'utf8')

const factory = new Function(
  `${source}
  return {
    CROSSFADE_MAX_SECONDS, CROSSFADE_MIN_SECONDS, CROSSFADE_PREPARE_SECONDS,
    CROSSFADE_INTRO_SKIP_SECONDS, crossfadeFadeSeconds, crossfadeSameAlbum,
    crossfadeNextAllowed, crossfadePlan, crossfadeShouldStart,
    crossfadeEqualPowerCurves, crossfadeIncomingWindow,
  }`,
)
const fx = factory()

// ── on/off and the overlap cap ────────────────────────────────────────────
assert.equal(fx.crossfadeFadeSeconds({}), 0, 'missing means off')
assert.equal(fx.crossfadeFadeSeconds({ crossfadeSeconds: 0 }), 0)
assert.equal(fx.crossfadeFadeSeconds({ crossfadeSeconds: -4 }), 0)
assert.equal(fx.crossfadeFadeSeconds({ crossfadeSeconds: 6 }), 6)
assert.equal(fx.crossfadeFadeSeconds({ crossfadeSeconds: 99 }), fx.CROSSFADE_MAX_SECONDS)
assert.equal(fx.crossfadeFadeSeconds({ crossfadeSeconds: 1 }), fx.CROSSFADE_MIN_SECONDS)
assert.equal(fx.crossfadeFadeSeconds({ crossfadeSeconds: 'abc' }), 0)

// ── album continuity ──────────────────────────────────────────────────────
const albumA = { path: 'a', album: 'Thriller', artist: 'Michael Jackson' }
const albumA2 = { path: 'b', album: 'thriller ', artist: 'michael jackson' }
const albumB = { path: 'c', album: 'Bad', artist: 'Michael Jackson' }
const liveA = { path: 'd', album: 'Thriller', albumArtist: 'Cover Band', artist: 'Cover Band' }

assert.equal(fx.crossfadeSameAlbum(albumA, albumA2), true, 'album matching ignores case and space')
assert.equal(fx.crossfadeSameAlbum(albumA, albumB), false)
assert.equal(fx.crossfadeSameAlbum(albumA, liveA), false, 'different album artist breaks continuity')
assert.equal(fx.crossfadeSameAlbum({ path: 'x', album: '' }, { path: 'y', album: '' }), false)

assert.equal(fx.crossfadeNextAllowed({}, albumA, albumB), true, 'different albums blend')
assert.equal(fx.crossfadeNextAllowed({}, albumA, albumA2), false, 'album tracks always stay joined')
assert.equal(
  fx.crossfadeNextAllowed({ crossfadeAlbums: true }, albumA, albumA2),
  false,
  'there is no opt-in: the album rule is fixed',
)
assert.equal(fx.crossfadeNextAllowed({}, albumA, { ...albumA }), false, 'never blend a track with itself')
assert.equal(fx.crossfadeNextAllowed({}, null, albumB), false)

// ── the automatic plan ────────────────────────────────────────────────────
const prefs = { crossfadeSeconds: 10 }
const plan = (current, next, remaining) => fx.crossfadePlan(current, next, { prefs, remaining })

// A long quiet outro is exactly the region to fade through.
assert.deepEqual(plan({ outroQuietSec: 6 }, { introQuietSec: 0 }, 30), { overlap: 6, startInNext: 0 })
// No quiet tail: still overlap the minimum instead of hard cutting.
assert.deepEqual(plan({ outroQuietSec: 0 }, { introQuietSec: 0 }, 30), {
  overlap: fx.CROSSFADE_MIN_SECONDS,
  startInNext: 0,
})
// Never exceed the cap.
assert.equal(plan({ outroQuietSec: 25 }, {}, 60).overlap, fx.CROSSFADE_MAX_SECONDS)
// Never exceed what is left of the track.
assert.equal(plan({ outroQuietSec: 12 }, {}, 5).overlap, 5)
// Only a genuinely silent intro is skipped; a soft musical intro is content.
assert.equal(plan({ outroQuietSec: 4 }, { introSilentSec: 8 }, 30).startInNext, 7.5)
assert.equal(plan({ outroQuietSec: 4 }, { introSilentSec: 0.8 }, 30).startInNext, 0)
assert.equal(plan({ outroQuietSec: 4 }, {}, 30).startInNext, 0)
// Skipping is bounded so a mostly-silent track cannot jump far ahead.
assert.equal(plan({ outroQuietSec: 4 }, { introSilentSec: 40 }, 30).startInNext, 10)
// Disabled or no remaining time means no plan at all.
assert.equal(fx.crossfadePlan({}, {}, { prefs: { crossfadeSeconds: 0 }, remaining: 30 }), null)
assert.equal(fx.crossfadePlan({}, {}, { prefs, remaining: 0 }), null)

// ── preparation gate ──────────────────────────────────────────────────────
const base = {
  prefs: { crossfadeSeconds: 10 },
  playing: true,
  hasGraph: true,
  loop: 'none',
  index: 2,
  queueLength: 10,
  duration: 180,
  currentTime: 180 - 10,
}
assert.equal(fx.crossfadeShouldStart(base), true, 'inside the preparation window')
assert.equal(fx.crossfadeShouldStart({ ...base, prefs: { crossfadeSeconds: 0 } }), false, 'off means no analysis')
assert.equal(fx.crossfadeShouldStart({ ...base, playing: false }), false, 'paused never analyses')
assert.equal(fx.crossfadeShouldStart({ ...base, hasGraph: false }), false, 'needs the Web Audio graph')
assert.equal(fx.crossfadeShouldStart({ ...base, loop: 'one' }), false, 'single-track loop never fades')
assert.equal(fx.crossfadeShouldStart({ ...base, index: 9 }), false, 'last track of a list does not fade')
assert.equal(fx.crossfadeShouldStart({ ...base, loop: 'all', index: 9 }), true, 'a looping list does fade')
assert.equal(fx.crossfadeShouldStart({ ...base, currentTime: 100 }), false, 'too early')
assert.equal(fx.crossfadeShouldStart({ ...base, currentTime: 179.8 }), false, 'too late')
assert.equal(fx.crossfadeShouldStart({ ...base, duration: 0 }), false, 'unknown duration waits')
assert.equal(fx.crossfadeShouldStart({ ...base, queueLength: 1 }), false, 'nothing to fade into')
assert.equal(fx.crossfadeShouldStart(null), false)

// The window is exactly the preparation constant.
const lead = fx.CROSSFADE_PREPARE_SECONDS
assert.equal(fx.crossfadeShouldStart({ ...base, currentTime: 180 - lead - 0.2 }), false)
assert.equal(fx.crossfadeShouldStart({ ...base, currentTime: 180 - lead + 0.2 }), true)

// The incoming track must not be audible for the whole overlap: it only rises
// during the last few seconds, so it is not "already singing" at hand-over.
assert.deepEqual(fx.crossfadeIncomingWindow(6), { window: 2.5, delay: 3.5 })
assert.deepEqual(fx.crossfadeIncomingWindow(2.5), { window: 2.5, delay: 0 })
assert.deepEqual(fx.crossfadeIncomingWindow(1), { window: 1, delay: 0 })
assert.deepEqual(fx.crossfadeIncomingWindow(0), { window: 0, delay: 0 })

// ── equal-power curves ────────────────────────────────────────────────────
const curves = fx.crossfadeEqualPowerCurves(32)
assert.equal(curves.out.length, 33)
assert.equal(curves.incoming.length, 33)
assert.ok(Math.abs(curves.out[0] - 1) < 1e-6, 'outgoing starts at unity')
assert.ok(Math.abs(curves.incoming[0]) < 1e-6, 'incoming starts silent')
assert.ok(Math.abs(curves.out[32]) < 1e-6, 'outgoing ends silent')
assert.ok(Math.abs(curves.incoming[32] - 1) < 1e-6, 'incoming ends at unity')
for (let index = 0; index <= 32; index += 1) {
  const power = curves.out[index] ** 2 + curves.incoming[index] ** 2
  assert.ok(Math.abs(power - 1) < 1e-6, 'the pair keeps constant power')
}

// Wiring: the switch drives the pref, the player owns the two decks.
const settings = readFileSync(join(root, 'src/ui/06-settings.js'), 'utf8')
assert.match(settings, /crossfadeSeconds/, 'the settings sheet writes the preference')
assert.doesNotMatch(settings, /crossfadeOff/, 'there is no duration dropdown to translate any more')
assert.doesNotMatch(settings, /crossfadeAlbums/, 'the album rule is not a setting')
assert.match(settings, /CROSSFADE_MAX_SECONDS/, 'turning it on stores the automatic cap')

const player = readFileSync(join(root, 'src/50-player.js'), 'utf8')
assert.match(player, /createMediaElementSource\(audioB\)/, 'the spare deck gets its own source node')
assert.match(player, /setValueCurveAtTime/, 'the fade is scheduled as a curve, not a setInterval ramp')
assert.match(player, /function swapDecks\(\)/, 'promotion swaps deck roles instead of reloading the track')
assert.match(player, /adoptIncoming\(token\)/, 'the UI switches to the next track when the fade starts')
assert.match(player, /function finishCrossfade\(token\)/, 'the ghost deck is released when the curve lands')
assert.match(player, /maybePrefetchNext\(\)/, 'the next track is warmed while the current one plays')
assert.match(player, /prefetchedNext\.path === item\.path/, 'the prepare step reuses the prefetched bytes')
assert.match(player, /analyzeTransitionBuffer/, 'the engine measures the envelopes before deciding')
assert.match(player, /crossfadePlan\(/, 'the overlap comes from the measurement, not a fixed number')

// The control sits inside the volume view of the audio-effects panel.
const panel = readFileSync(join(root, 'src/ui/04-eq-panel.js'), 'utf8')
assert.match(panel, /settings\.crossfade/, 'the switch is rendered in the effects panel')
assert.match(panel, /crossfadeSeconds/, 'it writes the same preference as settings')
assert.doesNotMatch(panel, /id: 'transition'/, 'no separate transition view')
assert.doesNotMatch(panel, /mp-xf-chip/, 'no duration chips: the engine decides')

console.log('crossfade.test.mjs ok')
