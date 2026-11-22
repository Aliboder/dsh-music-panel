/**
 * Crossfade decisions (src/client/services/player/effects/crossfade.js is a fragment, evaluated here with
 * no browser so the rules stay testable).
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('../..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const source = readFileSync(join(root, 'src/client/services/player/effects/crossfade.js'), 'utf8')

const factory = new Function(
  `${source}
  return {
    CROSSFADE_MAX_SECONDS, CROSSFADE_MIN_SECONDS, CROSSFADE_PREPARE_SECONDS,
    CROSSFADE_INTRO_SKIP_SECONDS, crossfadeFadeSeconds, crossfadeSameAlbum,
    crossfadeNextAllowed, crossfadePlan, crossfadeShouldStart,
    crossfadeEqualPowerCurves, crossfadeIncomingWindow,
    crossfadeKeyRelation, crossfadeKeyLengthScale,
  }`,
)
const fx = factory()

// ── on/off and the overlap cap ────────────────────────────────────────────
assert.equal(fx.crossfadeFadeSeconds({}), 0, 'missing means off')
assert.equal(fx.crossfadeFadeSeconds({ crossfadeSeconds: 0 }), 0)
assert.equal(fx.crossfadeFadeSeconds({ crossfadeEnabled: true, crossfadeSeconds: 0 }), 0)
assert.equal(fx.crossfadeFadeSeconds({ crossfadeEnabled: true, crossfadeSeconds: -4 }), 0)
assert.equal(fx.crossfadeFadeSeconds({ crossfadeEnabled: true, crossfadeSeconds: 6 }), 6)
assert.equal(fx.crossfadeFadeSeconds({ crossfadeEnabled: true, crossfadeSeconds: 99 }), fx.CROSSFADE_MAX_SECONDS)
assert.equal(fx.crossfadeFadeSeconds({ crossfadeEnabled: true, crossfadeSeconds: 0.2 }), fx.CROSSFADE_MIN_SECONDS)
assert.equal(fx.crossfadeFadeSeconds({ crossfadeSeconds: 6 }), 0, 'the length alone does not switch it on')
assert.equal(fx.CROSSFADE_MAX_SECONDS, 25, 'Folia slider ceiling')
assert.equal(fx.CROSSFADE_MIN_SECONDS, 1, 'Folia slider floor')
assert.equal(fx.crossfadeFadeSeconds({ crossfadeEnabled: true, crossfadeSeconds: 'abc' }), 0)

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

// ── key relation ──────────────────────────────────────────────────────────
const profileOf = (key, major, confidence = 0.8) => ({ key, major, keyConfidence: confidence })
assert.equal(fx.crossfadeKeyRelation(profileOf(0, true), profileOf(0, true)), 'compatible')
assert.equal(fx.crossfadeKeyRelation(profileOf(0, true), profileOf(7, true)), 'compatible')
assert.equal(fx.crossfadeKeyRelation(profileOf(0, true), profileOf(2, true)), 'adjacent')
assert.equal(fx.crossfadeKeyRelation(profileOf(0, true), profileOf(1, true)), 'clashing')
assert.equal(fx.crossfadeKeyRelation(profileOf(0, true), profileOf(6, true)), 'clashing')
assert.equal(fx.crossfadeKeyRelation(profileOf(0, true), profileOf(3, true)), 'neutral')
assert.equal(fx.crossfadeKeyRelation({}, {}), 'unknown')
assert.equal(fx.crossfadeKeyLengthScale('clashing'), 0.4)
assert.equal(fx.crossfadeKeyLengthScale('unknown'), 1)

// ── the automatic plan ────────────────────────────────────────────────────
const prefs = { crossfadeEnabled: true, crossfadeSeconds: 10 }
const plan = (current, next, remaining) => fx.crossfadePlan(current, next, { prefs, remaining })

// Folia's crossfade is blind: the requested ceiling is used while the pair has room.
assert.deepEqual(plan({ duration: 180, outroQuietSec: 6 }, { durationSec: 180 }, 30), { overlap: 10, startInNext: 0 })
assert.deepEqual(plan({ duration: 180, outroQuietSec: 0 }, { durationSec: 180 }, 30), { overlap: 10, startInNext: 0 })
// Never exceed the cap.
assert.equal(plan({ duration: 300, outroQuietSec: 0 }, { durationSec: 300 }, 60).overlap, 10)
// Never exceed what is left of the track.
assert.equal(plan({ duration: 180, outroQuietSec: 0 }, { durationSec: 180 }, 5).overlap, 5)
// Never exceed the incoming track, or a quarter of the outgoing one.
assert.equal(plan({ duration: 180, outroQuietSec: 0 }, { durationSec: 6 }, 30).overlap, 6)
assert.equal(plan({ duration: 8, outroQuietSec: 0 }, { durationSec: 180 }, 6).overlap, 2)
// The incoming track starts after its leading silence, minus Folia's entry margin.
assert.equal(plan({ duration: 180, outroQuietSec: 4 }, { durationSec: 180, introSilentSec: 8 }, 30).startInNext, 7.9)
assert.equal(plan({ duration: 180, outroQuietSec: 4 }, { durationSec: 180, introSilentSec: 0.8 }, 30).startInNext, 0.7)
assert.equal(plan({ duration: 180, outroQuietSec: 4 }, { durationSec: 180 }, 30).startInNext, 0)
// Disabled or no remaining time means no plan at all.
assert.equal(fx.crossfadePlan({}, {}, { prefs: { crossfadeSeconds: 0 }, remaining: 30 }), null)
assert.equal(fx.crossfadePlan({}, {}, { prefs: { crossfadeEnabled: false, crossfadeSeconds: 10 }, remaining: 30 }), null, 'switch off wins over the saved length')
assert.equal(fx.crossfadePlan({}, {}, { prefs, remaining: 0 }), null)

// ── preparation gate ──────────────────────────────────────────────────────
const base = {
  prefs: { crossfadeEnabled: true, crossfadeSeconds: 10 },
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
const settings = readFileSync(join(root, 'src/client/components/ui/settings.js'), 'utf8')
assert.match(settings, /crossfadeSeconds/, 'the settings sheet writes the preference')
assert.doesNotMatch(settings, /crossfadeOff/, 'there is no duration dropdown to translate any more')
assert.doesNotMatch(settings, /crossfadeAlbums/, 'the album rule is not a setting')
assert.match(settings, /crossfadeEnabled/, 'the switch is its own preference, so it cannot wipe the cap')
assert.match(settings, /CROSSFADE_MAX_SECONDS/, 'the slider still uses the cap')

const player = readFileSync(join(root, 'src/client/services/player/player.js'), 'utf8')
assert.match(player, /getDeckChain\('B'\)/, 'the spare deck comes from Folia graph')
assert.match(player, /crossfadeTo\(incomingDeck/, 'the fade is scheduled by the Folia transport')
assert.match(player, /setActive: false/, 'the player adopts the incoming deck explicitly')
assert.match(player, /function swapDecks\(\)/, 'promotion swaps deck roles instead of reloading the track')
assert.match(player, /adoptIncoming\(token\)/, 'the UI switches to the next track when the fade starts')
assert.match(player, /function finishCrossfade\(token\)/, 'the ghost deck is released when the curve lands')
assert.match(player, /maybePrefetchNext\(\)/, 'the next track is warmed while the current one plays')
assert.match(player, /prefetchedNext\.path === item\.path/, 'the prepare step reuses the prefetched bytes')
assert.match(player, /analyzeTransitionBuffer/, 'the engine measures the envelopes before deciding')
assert.match(player, /crossfadePlan\(/, 'the overlap comes from the measurement, not a fixed number')
assert.match(player, /planBlendShape\(/, 'the crossover comes from Folia signal analysis')
assert.match(player, /crossover: prepared\.crossover/, 'the planned crossover reaches the transport')
const loudness = readFileSync(join(root, 'src/client/services/player/effects/loudness.js'), 'utf8')
assert.match(loudness, /LOUDNESS_TARGET = -14/, 'crossfade uses the same balance target as normal play')

// The control sits inside the volume view of the audio-effects panel.
const panel = readFileSync(join(root, 'src/client/components/ui/eq-panel.js'), 'utf8')
assert.match(panel, /settings\.crossfade/, 'the switch is rendered in the effects panel')
assert.match(panel, /crossfadeEnabled/, 'it writes the same switch as settings')
assert.doesNotMatch(panel, /id: 'transition'/, 'no separate transition view')
assert.doesNotMatch(panel, /mp-xf-chip/, 'no duration chips: the engine decides')

console.log('crossfade.test.mjs ok')


