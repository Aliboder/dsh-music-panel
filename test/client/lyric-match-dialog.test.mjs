/**
 * The lyric-match window renders and asks nothing until a search runs.
 */
import assert from 'node:assert/strict'

function fakeElement() {
  return { dataset: {}, textContent: '', remove() {} }
}

global.window = {
  __ModuleLoader__: { load: (definition) => { globalThis.__dshMusicDef = definition } },
  localStorage: { getItem: () => null, setItem() {} },
  addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
  innerHeight: 900, innerWidth: 1400,
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  setTimeout: (callback) => setTimeout(callback, 0),
  clearTimeout: (id) => clearTimeout(id),
}
global.document = {
  head: { appendChild() {} },
  body: { appendChild() {}, removeChild() {} },
  createElement: () => fakeElement(),
  documentElement: { getAttribute: () => 'zh-CN' },
  visibilityState: 'visible',
  addEventListener() {}, removeEventListener() {},
}

const React = {
  createElement: (type, props, ...children) => ({ type, props, children }),
  useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
  useEffect() {},
  useLayoutEffect() {},
  useRef: (initial) => ({ current: initial }),
  useMemo: (factory) => factory(),
  useCallback: (factory) => factory,
  Component: class Component { constructor(props) { this.props = props; this.state = {} } setState() {} },
}

await import('../../client.js')
const api = globalThis.__dshMusicDef.factory(() => React)
assert.equal(typeof api.__internals.LyricMatchDialog, 'function')

const dialog = api.__internals.LyricMatchDialog({
  layer: { kind: 'lyricMatch', props: { track: { path: 'D:/m/a.flac', title: '晴天', artist: '周杰伦', album: '叶惠美', durationSec: 269 } } },
})
assert.ok(dialog !== null && typeof dialog === 'object', 'the window renders')
// It renders through the host modal so it stacks above the tag editor.\nassert.equal(dialog.props.className, 'mp-lym-modal')

console.log('lyric-match-dialog.test.mjs ok')
