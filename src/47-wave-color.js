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
