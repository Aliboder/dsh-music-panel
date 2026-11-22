/**
 * The component test page renders its standard cases with adapter + snippet.
 */
import assert from 'node:assert/strict'

global.window = {
  __ModuleLoader__: { load(definition) { globalThis.__dshMusicDef = definition } },
  localStorage: { getItem: () => null, setItem() {} },
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent() {},
  innerHeight: 900,
  innerWidth: 1400,
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  setTimeout: (callback) => setTimeout(callback, 0),
  clearTimeout: (id) => clearTimeout(id),
}

global.document = {
  head: { appendChild() {} },
  body: { appendChild() {}, removeChild() {} },
  createElement: () => ({ dataset: {}, textContent: '', remove() {} }),
  querySelector: () => null,
  documentElement: { getAttribute: () => 'zh-CN' },
  visibilityState: 'visible',
  addEventListener() {},
  removeEventListener() {},
}

const React = {
  createElement: (type, props, ...children) => ({ type, props: Object.assign({}, props, children.length ? { children: children.length === 1 ? children[0] : children } : {}), children }),
  useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
  useEffect() {},
  useLayoutEffect() {},
  useRef: (initial) => ({ current: initial }),
  useMemo: (factory) => factory(),
  useCallback: (factory) => factory,
  useSyncExternalStore: null,
  Component: class Component {
    constructor(props) { this.props = props; this.state = {} }
    setState() {}
  },
}

await import('../../client.js')
const api = globalThis.__dshMusicDef.factory((name) => {
  assert.equal(name, 'react')
  return React
})
const gallery = api.__internals.ComponentGallery
assert.equal(typeof gallery, 'function', 'the test page is exposed to tests')

// The mock React returns component elements without running them; expand them so the
// rendered case chrome (adapter pill + snippet) is visible to the assertions.
function expand(node, depth) {
  if (node === null || node === undefined || typeof node !== 'object' || depth > 6) return node
  if (Array.isArray(node)) return node.map((child) => expand(child, depth))
  if (typeof node.type === 'function') return expand(node.type(node.props), depth + 1)
  return Object.assign({}, node, { children: (node.children || []).map((child) => expand(child, depth)) })
}
const tree = expand(gallery({ onClose() {} }), 0)
function walk(node, visit) {
  if (node === null || node === undefined) return
  if (Array.isArray(node)) { node.forEach((child) => walk(child, visit)); return }
  if (typeof node === 'object') { visit(node); walk(node.children, visit) }
}
const adapters = []
const codes = []
walk(tree, (node) => {
  if (node.props && typeof node.props['data-adapter'] === 'string') adapters.push(node.props['data-adapter'])
  if (node.props && node.props.className === 'mp-gallery-code') codes.push(node)
})
assert.ok(adapters.includes('Button'), 'the button case carries its adapter name')
assert.ok(adapters.includes('IconButton'), 'the icon-button case carries its adapter name')
assert.ok(codes.length > 0, 'cases render their copyable snippet')
const codeText = JSON.stringify(codes)
assert.ok(codeText.includes('h(Button'), 'the snippet shows the real call')
console.log('gallery.render.test.mjs ok')
