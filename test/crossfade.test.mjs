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
    CROSSFADE_OPTIONS, CROSSFADE_MAX_SECONDS, CROSSFADE_LEAD_SECONDS,
    crossfadeFadeSeconds, crossfadeSameAlbum, crossfadeNextAllowed,
    crossfadeShouldStart, crossfadeEqualPowerCurves,
  }`,
)
const fx = factory()

// ── duration setting ──────────────────────────────────────────────────────
assert.deepEqual(fx.CROSSFADE_OPTIONS, [0, 3, 4, 5, 6, 8, 10, 12])
assert.equal(fx.crossfadeFadeSeconds({}), 0, 'missing means off')
assert.equal(fx.crossfadeFadeSeconds({ crossfadeSeconds: 0 }), 0)
assert.equal(fx.crossfadeFadeSeconds({ crossfadeSeconds: -4 }), 0)
assert.equal(fx.crossfadeFadeSeconds({ crossfadeSeconds: 5 }), 5)
assert.equal(fx.crossfadeFadeSeconds({ crossfadeSeconds: '4' }), 4)
assert.equal(fx.crossfadeFadeSeconds({ crossfadeSeconds: 99 }), fx.CROSSFADE_MAX_SECONDS)
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

assert.equal(fx.crossfadeNextAllowed({}, albumA, albumB), true, 'different albums blend by default')
assert.equal(fx.crossfadeNextAllowed({}, albumA, albumA2), false, 'album tracks stay joined by default')
assert.equal(fx.crossfadeNextAllowed({ crossfadeAlbums: true }, albumA, albumA2), true, 'opt-in blends albums')
assert.equal(fx.crossfadeNextAllowed({ crossfadeAlbums: true }, albumA, { ...albumA }), false, 'never blend a track with itself')
assert.equal(fx.crossfadeNextAllowed({}, null, albumB), false)

// ── start gate ────────────────────────────────────────────────────────────
const base = {
  prefs: { crossfadeSeconds: 6 },
  playing: true,
  hasGraph: true,
  loop: 'none',
  index: 2,
  queueLength: 10,
  duration: 180,
  currentTime: 180 - 7,
}
assert.equal(fx.crossfadeShouldStart(base), true, 'inside the window starts a fade')
assert.equal(fx.crossfadeShouldStart({ ...base, prefs: { crossfadeSeconds: 0 } }), false, 'off means no fade')
assert.equal(fx.crossfadeShouldStart({ ...base, playing: false }), false, 'paused never fades')
assert.equal(fx.crossfadeShouldStart({ ...base, hasGraph: false }), false, 'needs the Web Audio graph')
assert.equal(fx.crossfadeShouldStart({ ...base, loop: 'one' }), false, 'single-track loop never fades')
assert.equal(fx.crossfadeShouldStart({ ...base, index: 9 }), false, 'last track of a list does not fade')
assert.equal(fx.crossfadeShouldStart({ ...base, loop: 'all', index: 9 }), true, 'a looping list does fade')
assert.equal(fx.crossfadeShouldStart({ ...base, currentTime: 100 }), false, 'too early: no preparation yet')
assert.equal(fx.crossfadeShouldStart({ ...base, currentTime: 179.8 }), false, 'too late to finish a fade')
assert.equal(fx.crossfadeShouldStart({ ...base, duration: 0 }), false, 'unknown duration waits')
assert.equal(fx.crossfadeShouldStart({ ...base, queueLength: 1 }), false, 'nothing to fade into')
assert.equal(fx.crossfadeShouldStart(null), false)

// Lead time is what makes preparation possible: a fade may start up to
// `seconds + lead` before the end.
const lead = fx.CROSSFADE_LEAD_SECONDS
assert.equal(fx.crossfadeShouldStart({ ...base, currentTime: 180 - (6 + lead) - 0.2 }), false)
assert.equal(fx.crossfadeShouldStart({ ...base, currentTime: 180 - (6 + lead) + 0.2 }), true)

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

// Wiring: the settings sheet drives the pref, the player owns the two decks.
const settings = readFileSync(join(root, 'src/ui/06-settings.js'), 'utf8')
assert.match(settings, /CROSSFADE_OPTIONS/, 'the settings dropdown lists the supported durations')
assert.match(settings, /crossfadeSeconds/, 'the settings sheet writes the duration preference')
assert.match(settings, /crossfadeAlbums/, 'the album switch is wired')

const player = readFileSync(join(root, 'src/50-player.js'), 'utf8')
assert.match(player, /createMediaElementSource\(audioB\)/, 'the spare deck gets its own source node')
assert.match(player, /setValueCurveAtTime/, 'the fade is scheduled as a curve, not a setInterval ramp')
assert.match(player, /function swapDecks\(\)/, 'promotion swaps deck roles instead of reloading the track')
assert.match(player, /abortCrossfade\(\)/, 'cancellation is wired into the player')

console.log('crossfade.test.mjs ok')
