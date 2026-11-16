import assert from 'node:assert/strict'
const fake = () => ({ dataset: {}, textContent: '', remove() {}, appendChild() {}, style: {}, getContext: () => ({}) })
global.window = {
  __ModuleLoader__: { load: (d) => { globalThis.__def = d } },
  localStorage: { getItem: () => null, setItem() {} },
  addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
  innerHeight: 900, innerWidth: 1400, devicePixelRatio: 1,
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  requestAnimationFrame: () => 0, cancelAnimationFrame() {}, AudioContext: function () {},
}
global.document = { head: { appendChild() {} }, body: { appendChild() {}, removeChild() {} }, createElement: fake, documentElement: { getAttribute: () => 'zh-CN' }, visibilityState: 'visible', addEventListener() {}, removeEventListener() {}, querySelector: () => null, querySelectorAll: () => [] }
const React = {
  createElement: (type, props, ...children) => ({ type, props, children }),
  useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
  useEffect() {}, useLayoutEffect() {}, useRef: (i) => ({ current: i }),
  useMemo: (f) => f(), useCallback: (f) => f, useContext: () => ({}),
  Component: class { constructor(p) { this.props = p; this.state = {} } setState() {} },
}
await import('../../client.js')
const api = globalThis.__def.factory(() => React)
function expand(node, depth) {
  if (node === null || node === undefined || depth > 12) return
  if (typeof node === 'string' || typeof node === 'number') return
  if (Array.isArray(node)) { node.forEach((n) => expand(n, depth + 1)); return }
  if (typeof node.type === 'function' && node.type.prototype && node.type.prototype.isReactComponent) return
  if (typeof node.type === 'function') {
    const out = node.type(Object.assign({}, node.props, { children: node.children }))
    expand(out, depth + 1)
    return
  }
  expand(node.children, depth + 1)
}
try {
  const page = api.__internals.PlayerPage({ open: true, onClose() {} })
  expand(page, 0)
  console.log('player-page expanded ok')
} catch (e) {
  console.error('EXPAND THREW:', e && e.stack ? e.stack.split('\n').slice(0,4).join(' | ') : e)
  process.exit(1)
}
