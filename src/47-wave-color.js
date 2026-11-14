/**
 * Waveform palette derived from the cover's signature colour.
 *
 * The progress waveform used to pick colours straight from the raw colour
 * clusters of the artwork, so a small saturated area (green foliage, a logo)
 * could own the bars even when the cover reads as pink or red. Stay on the
 * signature hue and only vary saturation/lightness plus a small hue offset,
 * which keeps the bars visually tied to the cover on every track.
 *
 * @param {{ h?: number, s?: number, l?: number } | null | undefined} accent
 * @returns {Array<{ h: number, s: number, l: number }>}
 */
function wavePalette(accent) {
  var base = accent !== null && typeof accent === 'object' ? accent : {}
  var hue = Number(base.h)
  if (!isFinite(hue)) hue = 40
  var sat = Number(base.s)
  if (!isFinite(sat) || sat < 0) sat = 30
  var light = Number(base.l)
  if (!isFinite(light) || light < 0) light = 60
  // The extractor reports 0-100, but tolerate 0-1 inputs from older callers.
  if (sat > 0 && sat <= 1) sat *= 100
  if (light > 0 && light <= 1) light *= 100
  sat = Math.min(92, Math.max(38, sat))
  light = Math.min(78, Math.max(52, light))
  function tone(hueShift, satScale, lightShift) {
    return {
      h: (hue + hueShift + 360) % 360,
      s: Math.min(92, Math.max(38, sat * satScale)),
      l: Math.min(80, Math.max(48, light + lightShift)),
    }
  }
  return [tone(-14, 0.92, -6), tone(0, 1.04, 4), tone(16, 0.88, -1)]
}

/**
 * Shared beat envelope for the smoke shader and the progress waveform.
 *
 * Uses half-wave rectified spectral flux over the sub-bass bins with an
 * adaptive threshold and a fast-attack / slow-release envelope, so kicks and
 * bass notes produce a short pulse instead of a slow loudness drift.
 */
function createBeatTracker() {
  var previous = null
  var average = 0
  var level = 0
  return {
    update: function (wave, playing, sensitivity) {
      var feel = Number(sensitivity)
      if (!isFinite(feel)) feel = 0.6
      feel = Math.max(0, Math.min(2, feel))
      if (playing !== true || wave === null || wave === undefined || wave.length === 0) {
        level *= 0.82
        previous = null
        return level
      }
      var bands = Math.max(3, Math.min(10, Math.floor(wave.length * 0.08)))
      var flux = 0
      if (previous !== null && previous.length === bands) {
        for (var i = 0; i < bands; i += 1) {
          var delta = wave[i] - previous[i]
          if (delta > 0) flux += delta
        }
        flux = flux / (bands * 255)
      }
      if (previous === null || previous.length !== bands) previous = new Array(bands)
      for (var j = 0; j < bands; j += 1) previous[j] = wave[j]
      average = average * 0.9 + flux * 0.1
      var threshold = Math.max(0.003, average * 1.25 * (1.9 - 1.5 * feel))
      var hit = flux > threshold ? Math.min(1, (flux - threshold) * (5 + 5 * feel) + 0.3) : 0
      hit *= feel
      level = Math.max(hit, level * 0.82)
      return level
    },
  }
}
