/**
 * The player card renders every pane.
 *
 * The panes are plain functions called while the card renders, so one render with
 * `open: true` exercises all of them — this is what catches a pane that was renamed
 * or dropped (the controls pane went missing once and the card would have thrown on
 * open in the browser).
 */

import assert from 'node:assert/strict'

const texts = []

function fakeElement() {
  return { dataset: {}, textContent: '', remove() {} }
}

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
  innerHeight: 900,
  innerWidth: 1400,
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  setTimeout: (callback) => setTimeout(callback, 0),
  clearTimeout: (id) => clearTimeout(id),
}

global.document = {
  head: { appendChild: (node) => texts.push(node) },
  body: { appendChild() {}, removeChild() {} },
  createElement: () => fakeElement(),
  querySelector: () => null,
  documentElement: { getAttribute: () => 'zh-CN' },
  visibilityState: 'visible',
  addEventListener() {},
  removeEventListener() {},
}

const React = {
  createElement: (type, props, ...children) => ({ type, props, children }),
  useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
  useEffect() {},
  useLayoutEffect() {},
  useRef: (initial) => ({ current: initial }),
  useMemo: (factory) => factory(),
  useCallback: (factory) => factory,
  useSyncExternalStore: null,
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
assert.ok(definition, 'client.js must register')

const api = definition.factory((name) => {
  assert.equal(name, 'react')
  return React
})

assert.equal(typeof api.__internals, 'object', 'the test API must be exposed')
assert.equal(typeof api.__internals.PlayerSheet, 'function', 'PlayerSheet must be exposed')

const card = api.__internals.PlayerSheet({
  open: true,
  onClose() {},
  favoriteSet: {},
  track: {
    path: 'D:/Music/a.flac',
    title: '晴天',
    artist: '周杰伦',
    album: '叶惠美',
    durationSec: 269,
    cover: '',
    onlineProvider: 'netease',
    onlineId: '186016',
  },
  onAction() {},
})

assert.ok(card !== null && typeof card === 'object', 'the card renders')
// The mock React does not run components, so the element the wrapper returned is
// invoked by hand: that is what executes every pane function and would throw.
const inner = typeof card.type === 'function' ? card.type(card.props) : card
const rendered = typeof inner.type === 'function' ? inner.type(inner.props) : inner

/** Every string in the tree, in render order. */
function textOf(node, out) {
  const list = out || []
  if (node === null || node === undefined) return list
  if (typeof node === 'string' || typeof node === 'number') {
    list.push(String(node))
    return list
  }
  if (Array.isArray(node)) {
    node.forEach((child) => textOf(child, list))
    return list
  }
  if (typeof node === 'object' && node.children) textOf(node.children, list)
  return list
}

/** Every element that carries a title (the card's icon buttons). */
function titlesOf(node, out) {
  const list = out || []
  if (node === null || node === undefined || typeof node !== 'object') return list
  if (Array.isArray(node)) {
    node.forEach((child) => titlesOf(child, list))
    return list
  }
  if (node.props && typeof node.props.title === 'string') list.push(node.props.title)
  titlesOf(node.children, list)
  return list
}

// Every pane function runs while the bodies array is built, so a pane that was renamed or
// dropped throws here. The dock labels come from TABS through KitSegmentedTabs (asserted in
// sheet-pages), not from this tree: the mock React does not execute component elements.
assert.deepEqual(
  titlesOf(rendered).filter((title) => title === '设置'),
  [],
  'the card no longer carries the global settings gear',
)
assert.equal(rendered.props.className, 'mp-card-root', 'the card root is the dialog')
// The motion engine is labelled so the browser can be checked.
assert.ok(['framer', 'css'].includes(rendered.props['data-card-motion']))

// The card is closed: nothing renders.
assert.equal(api.__internals.PlayerSheet({ open: false, onClose() {}, track: null }), null)

console.log('player-card.test.mjs ok')

