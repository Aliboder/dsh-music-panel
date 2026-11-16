/**
 * Folia shell backgrounds: boundary contract.
 *
 * The six background renderers are Folia's files; what this plugin owns is the config
 * the host builds (mode, URL list, defaults) and the registry the picker reads. The test
 * loads client.js with the same React mock as the smoke test and checks both.
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

global.window = {
  __ModuleLoader__: {
    load(definition) {
      globalThis.__dshMusicDef = definition
    },
  },
  localStorage: {
    getItem() {
      return null
    },
    setItem() {},
  },
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent() {},
  setTimeout(callback) {
    return setTimeout(callback, 0)
  },
  clearTimeout(id) {
    clearTimeout(id)
  },
  matchMedia() {
    return { matches: false, addEventListener() {}, removeEventListener() {} }
  },
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
assert.ok(internals, 'client exposes its internals to tests')

const bg = internals.FOLIA_BG
assert.ok(bg, 'the compiled Folia backgrounds bundle must load')
assert.equal(typeof bg.VisualizerBackgroundRenderer, 'function')
assert.deepEqual(
  [...bg.VISUALIZER_BACKGROUND_MODE_IDS].sort(),
  ['common', 'latent', 'monet', 'nomand', 'sora', 'url'],
)
assert.equal(bg.DEFAULT_VISUALIZER_BACKGROUND_MODE, 'latent')
assert.ok(bg.DEFAULT_LATENT_BACKGROUND_TUNING)
assert.ok(bg.DEFAULT_MONET_BACKGROUND_TUNING)
assert.ok(bg.DEFAULT_NOMAND_BACKGROUND_TUNING)
assert.ok(bg.DEFAULT_SORA_BACKGROUND_TUNING)

// Every registry entry is Folia's and carries a renderer.
assert.equal(bg.VISUALIZER_BACKGROUND_REGISTRY.length, 6)
for (const entry of bg.VISUALIZER_BACKGROUND_REGISTRY) {
  assert.equal(typeof entry.mode, 'string')
  assert.equal(typeof entry.render, 'function')
  assert.ok(entry.labelFallback)
}

const config = internals.foliaBackgroundConfig('latent', '', false)
assert.equal(config.mode, 'latent')
assert.equal(config.transparent, false)
assert.equal(config.latent.tuning.displayMode, bg.DEFAULT_LATENT_BACKGROUND_TUNING.displayMode)
assert.deepEqual(config.url.items, [])

const urlConfig = internals.foliaBackgroundConfig('url', 'https://example.com', false)
assert.equal(urlConfig.mode, 'url')
assert.equal(urlConfig.url.items.length, 1)
assert.equal(urlConfig.url.selectedId, 'custom')

const none = internals.foliaBackgroundConfig('none', '', false)
assert.equal(none.transparent, true)
assert.equal(none.mode, 'latent', 'none falls back to Folia default but draws nothing')

const transparent = internals.foliaBackgroundConfig('sora', '', true)
assert.equal(transparent.transparent, true)

// React 18 host: Folia runs React 19, where a function component receives `ref` as a
// normal prop. Under React 18 the vendored paper-shaders wrappers would drop it, so
// latent's paperShaderMount stays null and the per-frame speed/distortion (the audio
// response and the pause slowdown) never run. The committed bundle must carry the
// forwardRef wrappers; see docs/folia-porting.md.
const backgroundsSource = readFileSync(
  new URL('../../src/folia/backgrounds.bundle.js', import.meta.url),
  'utf8',
)
assert.match(
  backgroundsSource,
  /forwardRef\(function DitheringImpl\(/,
  'the paper-shaders Dithering wrapper forwards its ref under React 18',
)
assert.match(
  backgroundsSource,
  /forwardRef\(function MeshGradientImpl\(/,
  'the paper-shaders MeshGradient wrapper forwards its ref under React 18',
)
assert.match(
  backgroundsSource,
  /forwardRef\(function FlutedGlassImpl\(/,
  'the paper image shaders used by nomand forward their refs under React 18',
)

console.log('folia-backgrounds.test.mjs ok')

