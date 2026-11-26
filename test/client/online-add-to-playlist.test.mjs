/**
 * 「加入歌单」的两个回归点：
 *  1. 右键菜单只传了歌曲（`{ track }`）时，弹窗仍要从歌曲自身认出在线平台——
 *     Folia 的 picker 也是用 `getPlaybackSourceRef(song)` 读来源的；以前弹窗只认
 *     `provider` 属性，于是永远报「当前曲目没有在线平台」。
 *  2. 歌单列表自己滚（Folia PlaylistSelectionDialog 的滚动列表），歌单多时不再被弹窗裁掉。
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL('../../' + path, import.meta.url), 'utf8')

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
const target = api.__internals.onlineAddTarget
assert.equal(typeof target, 'function', 'the picker target resolver is exposed to tests')

// The context menu sends only the song; the platform must come off it.
const kugouSong = { onlineProvider: 'kugouLite', onlineId: 'abc', id: 'abc', title: '雪落下的声音' }
assert.equal(target({ track: kugouSong }).provider, 'kugouLite', 'a bare `track` still names its platform')
assert.equal(target({ song: kugouSong }).provider, 'kugouLite', '`song` names its platform too')
assert.equal(target({ song: kugouSong }).song, kugouSong, 'the song the picker adds is the song it was asked for')
assert.equal(target({ provider: 'qq', track: kugouSong }).provider, 'qq', 'an explicit provider still wins')
assert.deepEqual(target(undefined), { song: null, provider: '' }, 'nothing to add answers nothing')

// The dialog renders from that resolver: opening it with the context menu's payload
// reaches the real 「添加到歌单」 window instead of the error branch.
const dialog = api.__internals.OnlineAddToPlaylistDialog({ layer: { kind: 'onlineAddTo', props: { track: kugouSong } } })
assert.ok(dialog !== null && typeof dialog === 'object', 'the picker renders')
assert.equal(dialog.props.title, '添加到歌单', 'it opens as the add-to-playlist window')

// The list scrolls on its own in both pickers, with a bounded height (Folia's picker
// keeps its rows in a scrolling list so a long account list is reachable).
const localDialog = read('src/client/components/ui/dialogs.js')
const onlineDialog = read('src/client/components/ui/online-add-to-playlist-dialog.js')
assert.match(localDialog, /className: 'mp-pick-list'/, 'the local picker scrolls its playlist list')
assert.match(onlineDialog, /mp-set-card-body mp-pick-list/, 'the online picker scrolls its playlist list')
const theme = read('src/client/styles/theme.js')
const rule = /\.mp-pick-list\{([^}]*)\}/.exec(theme)
assert.ok(rule !== null, 'the scroll container has a rule')
assert.match(rule[1], /overflow-y:auto/, 'the container scrolls vertically')
assert.match(rule[1], /max-height:/, 'the container is bounded, so the dialog cannot clip it')

console.log('online-add-to-playlist.test.mjs ok')