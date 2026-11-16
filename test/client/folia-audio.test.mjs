/**
 * Folia audio bands: upstream contract.
 *
 * The bands feed every Folia surface (lyric style, pendolo, shell background) and
 * must match Folia's own write path, not merely look similar: 0–255 after a power
 * curve (its backgrounds map 10..200 through useTransform), five fixed Hz ranges on
 * a 21.5 Hz bin grid, and the raw spectrum as a copy of the analyser frame.
 */

import assert from 'node:assert/strict'

global.window = {
  __ModuleLoader__: {
    load(definition) {
      globalThis.__dshMusicDef = definition
    },
  },
  localStorage: { getItem: () => null, setItem() {} },
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent() {},
  setTimeout: (callback) => setTimeout(callback, 0),
  clearTimeout: (id) => clearTimeout(id),
}

global.document = {
  head: { appendChild() {} },
  createElement() {
    return { dataset: {}, textContent: '', remove() {} }
  },
  documentElement: { getAttribute: () => 'zh-CN' },
  visibilityState: 'visible',
  addEventListener() {},
  removeEventListener() {},
}

if (typeof global.navigator === 'undefined') {
  global.navigator = { language: 'zh-CN' }
}

const React = {
  createElement: (type, props, ...children) => ({ type, props, children }),
  useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
  useEffect() {},
  useRef: (initial) => ({ current: initial }),
  useMemo: (factory) => factory(),
  useCallback: (factory) => factory,
  Component: class Component {
    constructor(props) {
      this.props = props
      this.state = {}
    }

    setState() {}
  },
}

await import('../../client.js')

const definition = globalThis.__dshMusicDef
const api = definition.factory((name) => {
  assert.equal(name, 'react')
  return React
})

api.apply({
  effect(factory) {
    return factory()
  },
  slots: {
    inject(name, callback) {
      callback()
      return () => {}
    },
    register() {
      return () => {}
    },
  },
})

const internals = api.__internals
const bandsFromWave = internals.foliaAudioBandsFromWave
const readBands = internals.foliaAudioBands
assert.equal(typeof bandsFromWave, 'function', 'folia-audio.js is part of the client')
assert.equal(typeof readBands, 'function')

// Folia's bin grid: fftSize 2048 at 44.1 kHz, ~21.5 Hz per bin. Bass lives in the
// first bins; the same wave must leave treble near zero.
const wave = new Uint8Array(1024)
for (let bin = 0; bin <= 6; bin += 1) wave[bin] = 255
const bassOnly = bandsFromWave(wave)
assert.ok(bassOnly.bass > 200, `bass follows the low bins (${bassOnly.bass})`)
assert.ok(bassOnly.mid < 1, `mid stays empty (${bassOnly.mid})`)
assert.ok(bassOnly.treble < 1, `treble stays empty (${bassOnly.treble})`)
assert.equal(bassOnly.spectrum.length, wave.length, 'the whole analyser frame is carried')
assert.equal(bassOnly.spectrum[3], 255, 'the spectrum is the raw bins, not the bands')

// Folia's values are 0..255 after the power curve: a full-scale wave saturates.
const full = bandsFromWave(new Uint8Array(1024).fill(255))
for (const key of ['bass', 'lowMid', 'mid', 'vocal', 'treble', 'power']) {
  assert.ok(full[key] > 254.9 && full[key] <= 255, `${key} is 0..255 (${full[key]})`)
}

// The curve is Folia's: process(mean, boost) = (mean/255)^boost * 255, with the
// per-band boosts and power = process((bass + lowMid) / 2, 3).
const halfWave = new Uint8Array(1024).fill(128)
const half = bandsFromWave(halfWave)
const process = (value, boost) => Math.pow(value / 255, boost) * 255
assert.ok(Math.abs(half.bass - process(128, 1.8)) < 1e-9, 'bass uses boost 1.8')
assert.ok(Math.abs(half.lowMid - process(128, 2)) < 1e-9, 'lowMid uses boost 2')
assert.ok(Math.abs(half.mid - process(128, 2)) < 1e-9, 'mid uses boost 2')
assert.ok(Math.abs(half.vocal - process(128, 1.5)) < 1e-9, 'vocal uses boost 1.5')
assert.ok(Math.abs(half.treble - process(128, 2)) < 1e-9, 'treble uses boost 2')
assert.ok(Math.abs(half.power - process(128, 3)) < 1e-9, 'power uses boost 3')

// The analyser buffer is reused every frame: the spectrum must be a copy.
assert.equal(half.spectrum[0], 128)
const original = half.spectrum[0]
halfWave[0] = 1
assert.equal(half.spectrum[0], original, 'later analyser frames cannot mutate a taken spectrum')

// Paused frames are not written at all (the page keeps the last one); playing frames
// read the analyser, with Folia's breath standing in while it is not built yet.
const player = internals.player
const originalGetWave = player.getWave
try {
  player.getWave = () => null
  assert.equal(readBands(false), null, 'paused frames are skipped')
  const idle = readBands(true)
  assert.ok(idle !== null && idle.spectrum.length === 0, 'no analyser data → the breath frame')
  assert.ok(idle.bass >= 0 && idle.bass <= 40, 'the breath is Folia\'s slow 0..40')
} finally {
  player.getWave = originalGetWave
}

console.log('folia-audio.test.mjs ok')

