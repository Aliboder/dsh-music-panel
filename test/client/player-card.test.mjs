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
const rendered = typeof card.type === 'function' ? card.type(card.props) : card
assert.equal(rendered.props.className, 'mp-card-root', 'the card root is the dialog')
// The motion engine is labelled so the browser can be checked.
assert.ok(['framer', 'css'].includes(rendered.props['data-card-motion']))

// The card is closed: nothing renders.
assert.equal(api.__internals.PlayerSheet({ open: false, onClose() {}, track: null }), null)

console.log('player-card.test.mjs ok')

