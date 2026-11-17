/**
 * Folia lyric styles: registry contract.
 *
 * The style renderers are Folia's files; the plugin owns the explicit registry, the
 * mode/label metadata and the host adapter. This test loads client.js with the mock
 * React used by the smoke tests and checks that every compiled entry is registered and
 * that monet is the default/fallback style.
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

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
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  requestAnimationFrame: (callback) => setTimeout(callback, 16),
  cancelAnimationFrame: (id) => clearTimeout(id),
}

global.document = {
  head: { appendChild() {} },
  createElement() {
    return { dataset: {}, textContent: '', style: {}, remove() {}, appendChild() {} }
  },
  documentElement: { getAttribute: () => 'zh-CN' },
  visibilityState: 'visible',
  addEventListener() {},
  removeEventListener() {},
  querySelector: () => null,
}

if (typeof global.navigator === 'undefined') {
  global.navigator = { language: 'zh-CN' }
}

const React = {
  createElement: (type, props, ...children) => ({ type, props, children }),
  useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
  useEffect() {},
  useLayoutEffect() {},
  useRef: (initial) => ({ current: initial }),
  useMemo: (factory) => factory(),
  useCallback: (factory) => factory,
  useContext: () => null,
  createContext: (value) => ({ Provider: (props) => props.children, Consumer: () => null, _currentValue: value }),
  lazy: () => () => null,
  Suspense: (props) => (props && props.children) || null,
  memo: (component) => component,
  forwardRef: (render) => render,
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
const styles = internals.FOLIA_STYLES
assert.ok(styles, 'the compiled Folia styles bundle must load')
const entries = styles.FOLIA_STYLE_ENTRIES
assert.ok(entries, 'styles bundle exports FOLIA_STYLE_ENTRIES')

const expected = [
  'still',
  'tilt',
  'partita',
  'claddagh',
  'cadenza',
  'fume',
  'monet',
  'lumiere',
  'sonnet',
  'tempera',
  'hanabi',
  'nebbia',
  'diorama',
]
assert.deepEqual(Object.keys(entries).sort(), [...expected].sort())
for (const mode of expected) {
  assert.equal(entries[mode].mode, mode)
  assert.equal(typeof entries[mode].render, 'function')
}

assert.ok(Array.isArray(internals.FOLIA_STYLE_META))
assert.deepEqual(
  internals.FOLIA_STYLE_META.map((item) => item.id).sort(),
  [...expected].sort(),
)

// The plugin's own classic style must stay untouched, and the machi engine registers
// alongside the styles bundle.
const catalog = internals.mpStyleCatalog()
for (const id of ['monet', 'pendolo', ...expected]) {
  assert.ok(
    catalog.some((style) => style.id === id),
    `style ${id} is registered`,
  )
}
assert.equal(internals.mpStyleOf('monet').id, 'monet')

// ── the boundary helpers the renderers rely on ───────────────────────────────
// Folia's compiled Tailwind sheet is written against its theme variables; the plugin has to
// define them or every utility that uses one (spacing, blur, radii, text sizes) is dropped
// by the browser — the subtitle glow then paints as a hard box.
const foliaCss = readFileSync(join(ROOT, 'src/folia/folia-css.js'), 'utf8')
assert.match(foliaCss, /--spacing:\.25rem/, 'the Tailwind spacing scale is defined')
assert.match(foliaCss, /--blur-2xl:40px/, 'the blur scale the subtitle glow uses is defined')
assert.match(foliaCss, /--radius-2xl:1rem/, 'the radius scale is defined')
assert.match(foliaCss, /--text-sm:/, 'the text scale is defined')

// The style host passes Folia's subtitle-background setting through.
const stylesHost = readFileSync(join(ROOT, 'src/client/render/styles/folia-styles.js'), 'utf8')
assert.match(stylesHost, /subtitleOverlayBackground/, 'the subtitle background setting reaches the styles')
assert.match(stylesHost, /prefs\.subtitleOverlayBackground !== false/, 'it is on unless the listener turns it off')
const pendoloHost = readFileSync(join(ROOT, 'src/client/render/styles/folia-pendolo.js'), 'utf8')
assert.match(pendoloHost, /subtitleOverlayBackground/, 'pendolo gets the same setting')

// Folia leaves `ui.waitingForMusic` empty; the renderers must not print the raw key.
const i18nShim = readFileSync(join(ROOT, 'src/folia/shims/i18n.ts'), 'utf8')
assert.match(i18nShim, /MP_FOLIA_T/, 'the ported styles translate through the plugin dictionary')
assert.doesNotMatch(i18nShim, /t: \(key: string\) => key/, 'the identity translation is gone')
const i18nSource = readFileSync(join(ROOT, 'src/client/i18n/i18n.js'), 'utf8')
assert.equal(
  (i18nSource.match(/'ui\.waitingForMusic': ''/g) || []).length,
  2,
  'both dictionaries define it as empty, as Folia does',
)
assert.match(i18nSource, /globalThis\.MP_FOLIA_T = t/, 'the dictionary is exposed to the styles bundle')

console.log('folia-styles.test.mjs ok')






