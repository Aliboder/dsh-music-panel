/**
 * crossfade: decisions only (the two-deck machinery lives in 50-player).
 *
 * The goal is one switch, like a "smart transition": the engine analyses how
 * the current track ends and how the next one begins, then picks both the cut
 * point and the overlap length itself. Loudness is the signal we can measure
 * cheaply and reliably — no beat grid, no segment model.
 */

var CROSSFADE_MAX_SECONDS = 6
var CROSSFADE_MIN_SECONDS = 2.5
/** Start analysing this early; analysis is fast but the fetch is not. */
var CROSSFADE_PREPARE_SECONDS = 14
/** Only a genuinely silent intro is skipped, and never more than this. */
var CROSSFADE_INTRO_SKIP_SECONDS = 2
var CROSSFADE_SKIP_LIMIT_SECONDS = 10
/**
 * How long the incoming track is actually audible. The overlap may be longer
 * when the outgoing track has a quiet tail — the outgoing fade uses that whole
 * tail, but the next track only rises during the last few seconds, so it never
 * "starts singing" long before the hand-over.
 */
var CROSSFADE_INCOMING_SECONDS = 2.5

/** 0 means off. The stored value is the upper bound of the automatic overlap. */
function crossfadeFadeSeconds(prefs) {
  var value = Number(prefs !== null && typeof prefs === 'object' ? prefs.crossfadeSeconds : 0)
  if (!isFinite(value) || value <= 0) return 0
  return Math.min(CROSSFADE_MAX_SECONDS, Math.max(CROSSFADE_MIN_SECONDS, value))
}

/** Same album (and same album artist when both sides have one). */
function crossfadeSameAlbum(current, next) {
  if (!current || !next) return false
  var album = String(current.album || '').trim().toLowerCase()
  var nextAlbum = String(next.album || '').trim().toLowerCase()
  if (album === '' || album !== nextAlbum) return false
  var artist = String(current.albumArtist || current.artist || '').trim().toLowerCase()
  var nextArtist = String(next.albumArtist || next.artist || '').trim().toLowerCase()
  return artist === '' || nextArtist === '' || artist === nextArtist
}

/**
 * Whether the pair may be blended at all. Consecutive tracks from one album
 * keep their original join: albums are authored as continuous works (live
 * records, DJ mixes, concept albums) and blending them smears the artist's
 * transition. This is fixed behaviour, not a setting.
 */
function crossfadeNextAllowed(prefs, current, next) {
  if (!current || !next) return false
  if (String(current.path) === String(next.path)) return false
  if (crossfadeSameAlbum(current, next)) return false
  return true
}

/**
 * Decide the blend from the two measured envelopes.
 *
 * `current.outroQuietSec` is how long the outgoing track has been quiet at its
 * end (0 when it ends loud), `next.introQuietSec` the same at the start of the
 * incoming one. We fade through the quiet tail; if there is none we still
 * overlap a minimum amount instead of hard-cutting. A long silent intro is
 * skipped so the new track is already audible when the old one stops.
 */
function crossfadePlan(current, next, options) {
  var settings = options !== null && typeof options === 'object' ? options : {}
  var limit = crossfadeFadeSeconds(settings.prefs)
  if (limit <= 0) return null
  var remaining = Number(settings.remaining)
  if (!isFinite(remaining) || remaining <= 0) return null
  var max = Math.min(limit, Math.max(CROSSFADE_MIN_SECONDS, remaining))
  var tail = Number(current && current.outroQuietSec)
  var silentIntro = Number(next && next.introSilentSec)
  if (!isFinite(tail) || tail < 0) tail = 0
  if (!isFinite(silentIntro) || silentIntro < 0) silentIntro = 0
  var overlap = tail > 0.4 ? tail : CROSSFADE_MIN_SECONDS
  overlap = Math.max(CROSSFADE_MIN_SECONDS, Math.min(overlap, max))
  // Skipping is reserved for actual silence: a soft musical intro is content,
  // and cutting into it makes the next track start mid-phrase.
  var startInNext =
    silentIntro >= CROSSFADE_INTRO_SKIP_SECONDS
      ? Math.max(0, Math.min(silentIntro - 0.5, CROSSFADE_SKIP_LIMIT_SECONDS))
      : 0
  return {
    overlap: Math.round(overlap * 10) / 10,
    startInNext: Math.round(startInNext * 10) / 10,
  }
}

/**
 * Pure gate used by the player on every timeupdate: are we close enough to the
 * end to start analysing?
 */
function crossfadeShouldStart(input) {
  var s = input !== null && typeof input === 'object' ? input : {}
  if (crossfadeFadeSeconds(s.prefs) <= 0) return false
  if (s.playing !== true) return false
  if (s.hasGraph !== true) return false
  if (s.loop === 'one') return false
  var index = Number(s.index)
  var queueLength = Number(s.queueLength)
  if (!(index >= 0) || !(queueLength > 1)) return false
  if (s.loop === 'none' && index >= queueLength - 1) return false
  var duration = Number(s.duration)
  var time = Number(s.currentTime)
  if (!(duration > 0) || !(time >= 0)) return false
  var remaining = duration - time
  if (remaining > CROSSFADE_PREPARE_SECONDS) return false
  // Too close to the end to build anything that finishes inside the track.
  if (remaining <= 0.5) return false
  return true
}

/** Split an overlap into "outgoing only" + "both audible" segments. */
function crossfadeIncomingWindow(overlap) {
  var total = Math.max(0, Number(overlap) || 0)
  var window = Math.min(total, CROSSFADE_INCOMING_SECONDS)
  return { window: Math.round(window * 10) / 10, delay: Math.round((total - window) * 10) / 10 }
}

/** Equal-power pair for N+1 curve points (cos falls, sin rises). */
function crossfadeEqualPowerCurves(steps) {
  var points = Math.max(2, Math.floor(Number(steps) || 32)) + 1
  var out = new Float32Array(points)
  var incoming = new Float32Array(points)
  for (var index = 0; index < points; index += 1) {
    var ratio = index / (points - 1)
    out[index] = Math.cos((ratio * Math.PI) / 2)
    incoming[index] = Math.sin((ratio * Math.PI) / 2)
  }
  return { out: out, incoming: incoming }
}
