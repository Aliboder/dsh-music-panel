/**
 * The floating volume rail: on by default, hidden by its switch, and wired to the player.
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
const api = definition.factory((name) => {
  assert.equal(name, 'react')
  return React
})
const internals = api.__internals
assert.equal(typeof internals.MpVolumeRail, 'function', 'the rail is exposed to tests')

function walk(node, visit) {
  if (node === null || node === undefined) return
  if (Array.isArray(node)) {
    node.forEach((child) => walk(child, visit))
    return
  }
  if (typeof node === 'object') {
    visit(node)
    walk(node.children, visit)
  }
}

const rail = internals.MpVolumeRail({})
assert.ok(rail !== null, 'the rail renders by default')
assert.ok(String(rail.props.className).includes('mp-vol-rail'), 'it is the floating rail')
let range = null
let percent = ''
walk(rail, (node) => {
  if (node.type === 'input') range = node
  if (node.type === 'span' && node.props && node.props.className === 'mp-vol-rail-value') percent = node.children.join('')
})
assert.ok(range !== null, 'the rail has a volume range')
assert.equal(range.props.type, 'range')
assert.equal(range.props['aria-label'], '音量', 'the range is labelled')
assert.ok(/%$/.test(percent), 'the rail shows a percentage')

// Dragging writes the player's volume; the rail reads it back from the snapshot.
internals.player.setVolume(1)
range.props.onChange({ target: { value: '0.35' } })
assert.ok(Math.abs(internals.player.getSnapshot().volume - 0.35) < 0.001, 'the drag reaches the player')

// The switch hides it.
internals.prefsStore.set({ floatingVolume: false })
assert.equal(internals.MpVolumeRail({}), null, 'switching it off removes the rail')
internals.prefsStore.set({ floatingVolume: true })
console.log('volume-rail.test.mjs ok')
