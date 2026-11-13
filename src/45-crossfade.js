/**
 * crossfade: decisions only (the two-deck machinery lives in 50-player).
 *
 * Phase one of the "smart transition" idea: no beat grid, no segment model —
 * the overlap happens near the end of a track and the length comes from the
 * user's setting. The cut points are still chosen by loudness: preparation
 * starts early, and the fade is clamped to what is actually left, so a track
 * never fades out over its own quiet tail.
 */

var CROSSFADE_MAX_SECONDS = 12
/** How far a new fade can be scheduled ahead (values the settings offer). */
var CROSSFADE_OPTIONS = [0, 3, 4, 5, 6, 8, 10, 12]
/** Start preparing this long before the fade would begin. */
var CROSSFADE_LEAD_SECONDS = 3

/** 0 means off. Anything out of range is clamped, never trusted. */
function crossfadeFadeSeconds(prefs) {
  var value = Number(prefs !== null && typeof prefs === 'object' ? prefs.crossfadeSeconds : 0)
  if (!isFinite(value) || value <= 0) return 0
  return Math.min(CROSSFADE_MAX_SECONDS, Math.max(1, value))
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
 * keep their original join unless the user asks for album crossfades too —
 * a live album or a DJ mix must not be smeared.
 */
function crossfadeNextAllowed(prefs, current, next) {
  if (!current || !next) return false
  if (String(current.path) === String(next.path)) return false
  var blendAlbums = prefs !== null && typeof prefs === 'object' && prefs.crossfadeAlbums === true
  if (!blendAlbums && crossfadeSameAlbum(current, next)) return false
  return true
}

/**
 * Pure gate used by the player on every timeupdate. `state` is a plain snapshot
 * so the rules can be tested without an audio element.
 */
function crossfadeShouldStart(input) {
  var s = input !== null && typeof input === 'object' ? input : {}
  var seconds = crossfadeFadeSeconds(s.prefs)
  if (seconds <= 0) return false
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
  if (remaining > seconds + CROSSFADE_LEAD_SECONDS) return false
  // Too close to the end to build a fade that finishes inside the track.
  if (remaining <= 0.6) return false
  return true
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
