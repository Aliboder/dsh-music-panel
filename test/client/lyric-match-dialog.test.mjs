/**
 * The lyric-match window renders through KitModal and keeps its search state local.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../../src/client/components/ui/lyric-match.js', import.meta.url), 'utf8')

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
// It renders through the host modal so it stacks above the tag editor and
// inherits focus trapping, Escape and the portal from KitModal.
assert.equal(dialog.props.className, 'mp-lym-modal')
assert.equal(dialog.props.headless, true, 'the host modal only supplies the frame')

// The window opens on the song's own Folia query, searches immediately and uses
// the DSH primitives instead of one-off zinc/blue controls.
assert.match(source, /lyricMatchSongQuery/, 'the initial query is built from title/artist/album')
assert.match(source, /runSearch\(initialQueryRef\.current, 'netease'\)/, 'the first source searches on open')
assert.match(source, /lyricMatchPickResult/, 'online results auto-pick the first candidate')
assert.match(source, /KitSegmentedTabs/, 'source tabs use the host tab primitive')
assert.match(source, /KitInput/, 'search uses the host input primitive')
assert.doesNotMatch(source, /rgba\(255,\s*255,\s*255|#3b82f6|#60a5fa|#7fb0ff/, 'no legacy zinc/blue control colours')

console.log('lyric-match-dialog.test.mjs ok')
