/**
 * Style syntax guard.
 *
 * The plugin injects one large CSS string. A single unclosed rule (or an
 * unbalanced `var(...)`) makes the browser drop that rule *and* every rule
 * after it, which looks like "the whole plugin UI broke". This test extracts
 * the injected text with the same mocks as the smoke test and validates the
 * bracket stack, so a CSS typo fails in CI instead of in the GUI.
 */

import assert from 'node:assert/strict'

const styleNodes = []

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
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  setTimeout: (callback) => setTimeout(callback, 0),
  clearTimeout: (id) => clearTimeout(id),
}
global.document = {
  head: { appendChild: (node) => styleNodes.push(node) },
  createElement: () => ({ dataset: {}, textContent: '', remove() {} }),
  documentElement: { getAttribute: () => 'zh-CN' },
  visibilityState: 'visible',
  addEventListener() {},
  removeEventListener() {},
}

await import('../client.js')

const definition = globalThis.__dshMusicDef
assert.ok(definition, 'client.js must register through window.__ModuleLoader__')

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

const api = definition.factory((name) => {
  assert.equal(name, 'react', 'unexpected host module: ' + name)
  return React
})
api.apply({
  effect(factory) {
    factory()
  },
  slots: {
    inject(name, callback) {
      callback()
    },
    register() {
      return () => {}
    },
  },
})

assert.equal(styleNodes.length, 1, 'exactly one style element is injected')
const css = String(styleNodes[0].textContent)
assert.ok(css.length > 10_000, 'the style sheet is non-trivial')

let stack = []
let quote = null
for (const character of css) {
  if (quote !== null) {
    if (character === quote) quote = null
    continue
  }
  if (character === '"' || character === "'") {
    quote = character
    continue
  }
  if (character === '{' || character === '(') {
    stack.push(character)
    continue
  }
  if (character === '}' || character === ')') {
    const open = stack.pop()
    const expected = character === '}' ? '{' : '('
    assert.equal(open, expected, `unbalanced "${character}" near index ${css.indexOf(character)}`)
  }
}
assert.equal(quote, null, 'unterminated string in CSS')
assert.equal(stack.length, 0, 'unclosed CSS block or function remains: ' + stack.join(''))

console.log('style.test.mjs ok')
