import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/47-wave-color.js', import.meta.url), 'utf8')
const wavePalette = new Function(source + '\nreturn wavePalette')()

function hueGap(a, b) {
  const raw = Math.abs(a - b) % 360
  return raw > 180 ? 360 - raw : raw
}

// Three tones, all anchored to the signature hue.
const red = wavePalette({ h: 350, s: 60, l: 55 })
assert.equal(red.length, 3)
for (const tone of red) {
  assert.ok(hueGap(tone.h, 350) <= 20, 'tone hue stays near the signature')
  assert.ok(tone.s >= 38 && tone.s <= 92, 'saturation stays in range')
  assert.ok(tone.l >= 48 && tone.l <= 80, 'lightness stays in range')
}

// Hue wrap-around stays on the short side of the circle.
assert.ok(red.some((tone) => Math.abs(tone.h - 6) < 0.001), 'hue wraps through 360')

// A signature colour with a clashing raw cluster must still own the palette.
const conflicting = wavePalette({
  h: 12,
  s: 55,
  l: 58,
  palette: [
    { h: 140, s: 70, l: 55 },
    { h: 12, s: 55, l: 58 },
  ],
})
for (const tone of conflicting) {
  assert.ok(hueGap(tone.h, 12) <= 20, 'green foliage cluster is ignored')
}

// Neutral artwork gets a subtle tint instead of grey or wild hues.
const neutral = wavePalette({ h: 200, s: 4, l: 82 })
assert.ok(neutral.every((tone) => tone.s >= 38 && tone.s <= 92))
assert.ok(neutral.every((tone) => tone.l <= 80))

// Degenerate input never throws.
const fallback = wavePalette(null)
assert.equal(fallback.length, 3)
assert.ok(fallback.every((tone) => Number.isFinite(tone.h) && tone.s >= 38))

console.log('wave-color.test.mjs ok')
