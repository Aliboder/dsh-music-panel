/**
 * Folia lyric styles: registry contract.
 *
 * The style renderers are Folia's files; the plugin owns the explicit registry, the
 * mode/label metadata and the host adapter. This test loads client.js with the mock
 * React used by the smoke tests and checks that every compiled entry is registered and
 * that monet is the default/fallback style.
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

console.log('folia-styles.test.mjs ok')






