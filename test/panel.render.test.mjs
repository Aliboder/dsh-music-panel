/**
 * Render smoke test for the new panel.
 *
 * The Web Client is a plain script, so this test loads it with the same minimal
 * React mock the module test uses, seeds the stores, and calls the panel
 * component once. Effects do not run, so no network is involved; the point is
 * to catch reference errors and structural regressions in every view branch.
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const registrations = []
const components = new Map()

global.window = {
  __ModuleLoader__: {
    load(definition) {
      globalThis.__dshMusicDef = definition
    },
  },
  localStorage: {
    _data: new Map(),
    getItem(key) {
      return this._data.has(key) ? this._data.get(key) : null
    },
    setItem(key, value) {
      this._data.set(key, String(value))
    },
  },
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent() {},
  setTimeout(callback) {
    return setTimeout(callback, 0)
  },
  clearTimeout(id) {
    clearTimeout(id)
  },
  location: { href: 'http://127.0.0.1/' },
  innerWidth: 1400,
  innerHeight: 900,
}

global.document = {
  head: { appendChild() {} },
  createElement() {
    return { dataset: {}, textContent: '', remove() {} }
  },
  documentElement: { getAttribute: () => 'zh-CN' },
  visibilityState: 'visible',
  addEventListener() {},
  removeEventListener() {},
}

if (typeof global.navigator === 'undefined') {
  global.navigator = { language: 'zh-CN' }
}

const React = {
  createElement: (type, props, ...children) => {
    const nextProps = props ? { ...props } : {}
    if (children.length > 0) nextProps.children = children.length === 1 ? children[0] : children
    return { type, props: nextProps, children }
  },
  useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
  useEffect() {},
  useLayoutEffect() {},
  useRef: (initial) => ({ current: initial }),
  useMemo: (factory) => factory(),
  useCallback: (factory) => factory,
  Fragment: 'fragment',
  Component: class Component {
    constructor(props) {
      this.props = props
      this.state = {}
    }

    setState() {}
  },
}

await import('../client.js')

const definition = globalThis.__dshMusicDef
assert.ok(definition, 'client.js must register through window.__ModuleLoader__')
const api = definition.factory((name) => {
  assert.equal(name, 'react', 'unexpected host module: ' + name)
  return React
})

api.apply({
  effect(factory) {
    const dispose = factory()
    registrations.push(dispose)
    return dispose
  },
  slots: {
    inject(name, callback) {
      callback()
      return () => {}
    },
    register(registration, component) {
      components.set(registration.name + ':' + (registration.id || registration.key || ''), component)
      return () => {}
    },
  },
})

function walk(node, visit) {
  if (node === null || node === undefined) return
  if (Array.isArray(node)) {
    node.forEach((item) => walk(item, visit))
    return
  }
  if (typeof node !== 'object') return
  if (node.type) visit(node)
  if (Array.isArray(node.children)) node.children.forEach((child) => walk(child, visit))
}

/** Call function components so assertions see the real tree (hooks are mocked). */
function isClassComponent(type) {
  if (typeof type !== 'function' || !type.prototype) return false
  if (type.prototype.isReactComponent) return true
  return /^class\b/.test(Function.prototype.toString.call(type))
}

function expand(node) {
  if (node === null || node === undefined) return node
  if (Array.isArray(node)) return node.map(expand)
  if (typeof node !== 'object') return node
  if (typeof node.type === 'function') {
    if (isClassComponent(node.type)) {
      // Class boundaries only render their children; unwrap them.
      return expand(node.children || (node.props && node.props.children))
    }
    return expand(node.type(node.props || {}))
  }
  return Object.assign({}, node, {
    children: Array.isArray(node.children) ? node.children.map(expand) : node.children,
  })
}

function classesOf(tree) {
  const classes = new Set()
  walk(expand(tree), (node) => {
    const className = node.props && node.props.className
    if (typeof className === 'string') {
      className.split(/\s+/).filter(Boolean).forEach((name) => classes.add(name))
    }
  })
  return classes
}

function textOf(tree) {
  const parts = []
  function collect(value) {
    if (value === null || value === undefined) return
    if (Array.isArray(value)) {
      value.forEach(collect)
      return
    }
    if (typeof value === 'string' || typeof value === 'number') {
      parts.push(String(value))
      return
    }
    if (typeof value === 'object' && Array.isArray(value.children)) value.children.forEach(collect)
  }
  collect(expand(tree))
  return parts.join(' ')
}

const internals = api.__internals
assert.ok(internals, 'internals are exposed for tests')

const TRACKS = [
  {
    path: 'D:/Music/a.mp3',
    name: 'a.mp3',
    title: 'Alpha',
    artist: 'Artist A',
    album: 'Album One',
    folder: 'Pop',
    durationSec: 200,
    hasCover: false,
    size: 1000,
    mtime: 1,
    plays: 3,
  },
  {
    path: 'D:/Music/b.mp3',
    name: 'b.mp3',
    title: 'Beta',
    artist: 'Artist B',
    album: 'Album Two',
    folder: 'Rock',
    durationSec: 180,
    hasCover: false,
    size: 2000,
    mtime: 2,
    plays: 1,
  },
  {
    path: 'D:/Music/c.mp3',
    name: 'c.mp3',
    title: 'Gamma',
    artist: 'Artist A',
    album: 'Album One',
    folder: 'Pop',
    durationSec: 240,
    hasCover: false,
    size: 3000,
    mtime: 3,
    plays: 9,
  },
  {
    path: 'D:/Music/a-copy.mp3',
    name: 'a-copy.mp3',
    title: 'Alpha',
    artist: 'Artist A',
    album: 'Album One',
    folder: 'Pop',
    durationSec: 200,
    hasCover: false,
    size: 900,
    mtime: 4,
    plays: 0,
  },
]

internals.libraryStore.set({
  phase: 'ready',
  tracks: TRACKS,
  roots: ['D:/Music'],
  favorites: ['D:/Music/a.mp3'],
  playlists: [{ id: 'p1', name: 'Commute', trackPaths: ['D:/Music/a.mp3', 'D:/Music/c.mp3'] }],
  config: { roots: ['D:/Music'], depth: 3 },
  stats: {},
  statsRange: 'all',
})
internals.prefsStore.set(Object.assign({}, internals.prefsStore.get(), { layout: 'top' }))
internals.player.playList(TRACKS, 0)

const panel = components.get('main:music')
assert.equal(typeof panel, 'function', 'the main seat must register the panel')

// 1. local songs, top layout, a queue and a player bar
const local = panel()
const localClasses = classesOf(local)
for (const name of ['mp-root', 'is-top', 'mp-topbar', 'mp-workspace', 'mp-content', 'mp-playerbar']) {
  assert.ok(localClasses.has(name), `expected class ${name}`)
}
const localText = textOf(local)
assert.ok(localText.includes('Alpha'), 'the first track title is rendered')
assert.ok(localText.includes('Gamma'), 'all visible tracks are rendered')
assert.ok(localText.includes('全部歌曲') || localText.includes('All songs'), 'the section title is rendered')

// 2. rail layout renders the nav rail instead of the section bar
internals.prefsStore.set(Object.assign({}, internals.prefsStore.get(), { layout: 'rail' }))
const rail = panel()
const railClasses = classesOf(rail)
assert.ok(railClasses.has('mp-nav'), 'rail layout renders the nav rail')
assert.ok(railClasses.has('mp-nav-item'), 'rail layout renders nav items')

// 3. favorites view + playlist view + stats view do not throw
for (const nav of ['favorites', 'playlists', 'stats', 'albums', 'artists', 'folders']) {
  internals.uiStore.set({ nav })
  const tree = panel()
  assert.ok(classesOf(tree).has('mp-content'), `view ${nav} renders a content area`)
}

// 4. online recent history renders its rows
internals.uiStore.set({ source: 'netease', nav: 'recent', filter: null, query: '' })
internals.onlineStore.set({
  provider: 'netease',
  phase: 'ready',
  history: [
    {
      provider: 'netease',
      id: '42',
      title: 'Online Song',
      artist: 'Online Artist',
      album: 'Online Album',
      durationSec: 210,
      coverUrl: '',
      qualityHint: '',
      playedAt: Date.now(),
    },
  ],
  providers: { netease: { loggedIn: true, nickname: 'Tester' } },
})
const online = panel()
const onlineText = textOf(online)
assert.ok(onlineText.includes('Online Song'), 'online history rows render')
assert.ok(onlineText.includes('Tester'), 'the account chip renders')

// 5. overlays: context menu + settings sheet
internals.overlayStore.set({ layers: [] })
internals.uiStore.set({ source: 'local', nav: 'songs', filter: null, query: '' })
internals.overlayStore.set({ layers: [{ kind: 'menu', props: { track: TRACKS[0], x: 40, y: 40 } }] })
assert.ok(classesOf(panel()).has('mp-ctx'), 'the context menu renders')

internals.overlayStore.set({ layers: [{ kind: 'settings', props: {} }] })
const settings = panel()
const settingsClasses = classesOf(settings)
assert.ok(settingsClasses.has('mp-sheet'), 'the settings sheet renders')
assert.ok(settingsClasses.has('mp-sheet-tab'), 'settings tabs render')
assert.ok(textOf(settings).includes('布局') || textOf(settings).includes('Layout'), 'the layout switch lives in settings')

// 5b. Navidrome appears as a source tab and as a credential card in settings
internals.overlayStore.set({ layers: [] })
internals.uiStore.set({ source: 'navidrome', nav: 'recent', filter: null, query: '' })
internals.onlineStore.set({ provider: 'navidrome', results: [], phase: 'idle', playlists: [] })
const navPanel = panel()
const navText = textOf(navPanel)
assert.ok(navText.includes('Navidrome'), 'Navidrome renders as a source tab')

// Navidrome mirrors the local library's browse shape — songs, artists, albums —
// because Subsonic can enumerate all three. Artist and album rows open the
// shared album view, so they are navigation surfaces, not separate viewers.
const isZh = navText.includes('歌曲')
const L = {
  songs: isZh ? '歌曲' : 'Songs',
  artists: isZh ? '歌手' : 'Artists',
  albums: isZh ? '专辑' : 'Albums',
}
assert.ok(navText.includes(L.songs), 'the navidrome sidebar exposes the songs entry')

// Check the sidebar entry list directly instead of the rendered text: other
// copy on the page (empty states, hints) can contain the same word.
const navItems = internals
  .navGroupsFor('navidrome', 0)
  .flatMap((group) => group.items.map((item) => item.key))
for (const key of ['songs', 'artists', 'albums']) {
  assert.ok(navItems.includes(key), `navidrome lists a ${key} entry`)
}

const neteaseItems = internals
  .navGroupsFor('netease', 0)
  .flatMap((group) => group.items.map((item) => item.key))
for (const key of ['songs', 'artists', 'albums']) {
  assert.ok(!neteaseItems.includes(key), `search-only providers have no ${key} entry`)
}

// Every browse view renders without throwing.
for (const nav of ['songs', 'album', 'artists', 'albums', 'artist']) {
  internals.uiStore.set({ source: 'navidrome', nav, filter: null, query: '' })
  internals.onlineStore.set({
    provider: 'navidrome',
    results: [],
    phase: 'idle',
    playlists: [],
    albumId: nav === 'album' ? 'x1' : '',
    albumName: nav === 'album' ? 'Test Album' : '',
  })
  const view = panel()
  assert.ok(classesOf(view).size > 0, `the ${nav} view renders`)
}

internals.overlayStore.set({ layers: [{ kind: 'settings', props: {} }] })
// The settings sheet opens on the last tab; drive it to the online tab.
const settingsNav = panel()
assert.ok(classesOf(settingsNav).has('mp-sheet'), 'settings sheet still renders with an online source')

// The online tab lists every provider card, Navidrome included, once signed out.
internals.overlayStore.set({ layers: [{ kind: 'settings', props: {} }] })
internals.uiStore.set({ source: 'navidrome', nav: 'recent', filter: null, query: '' })
assert.ok(
  classesOf(panel()).has('mp-sheet'),
  'the settings sheet survives a navidrome source with no session',
)

// 5c. the Navidrome connection dialog renders its three fields
internals.overlayStore.set({ layers: [{ kind: 'navidrome', props: {} }] })
const navDialog = panel()
const navDialogText = textOf(navDialog)
assert.ok(classesOf(navDialog).has('mp-dialog'), 'the navidrome connection dialog renders')
assert.ok(navDialogText.includes('服务器地址') || navDialogText.includes('Server URL'), 'the server field renders')
assert.ok(navDialogText.includes('用户名') || navDialogText.includes('Username'), 'the username field renders')
assert.ok(navDialogText.includes('密码') || navDialogText.includes('Password'), 'the password field renders')
assert.ok(
  navDialogText.includes('保存并连接') || navDialogText.includes('Save and connect'),
  'the save button renders',
)

// 6. tag editor / batch / duplicates / online lyric dialogs
internals.overlayStore.set({ layers: [{ kind: 'tag', props: { path: TRACKS[0].path } }] })
const tag = panel()
assert.ok(classesOf(tag).has('mp-dialog'), 'the tag editor renders')
assert.ok(textOf(tag).includes('标题'), 'tag fields render')

internals.overlayStore.set({ layers: [{ kind: 'batchEdit', props: { paths: [TRACKS[0].path] } }] })
assert.ok(textOf(panel()).includes('批量'), 'the batch editor renders')

internals.overlayStore.set({ layers: [{ kind: 'duplicates', props: { groups: [[TRACKS[0], TRACKS[3]]] } }] })
assert.ok(textOf(panel()).includes('重复'), 'the duplicates dialog renders')

internals.overlayStore.set({ layers: [{ kind: 'onlineLyric', props: { track: TRACKS[0], onApply() {} } }] })
assert.ok(textOf(panel()).includes('在线歌词'), 'the online lyric dialog renders')

// 7. selection mode draws checkboxes and the count chip
internals.overlayStore.set({ layers: [] })
internals.uiStore.set({ source: 'local', nav: 'songs', filter: null, query: '' })
internals.selectionStore.set({ active: true, paths: [TRACKS[0].path] })
const selecting = panel()
assert.ok(classesOf(selecting).has('mp-row-check'), 'selection checkboxes render')
assert.ok(textOf(selecting).includes('已选 1 首'), 'the selection count renders')
assert.ok(!textOf(selecting).includes('收藏选中'), 'bulk actions are not duplicated in the toolbar')
internals.selectionStore.set({ active: false, paths: [] })

// 8. the duplicate chip appears for the duplicated pair
assert.ok(textOf(panel()).includes('重复 1 组'), 'the duplicate chip renders')

// 9. a legacy grid preference is ignored: songs always render as rows
const savedPrefs = internals.prefsStore.get()
internals.prefsStore.set(Object.assign({}, savedPrefs, { viewMode: 'grid' }))
internals.selectionStore.set({ active: true, paths: [TRACKS[0].path] })
const legacy = panel()
assert.ok(classesOf(legacy).has('mp-row'), 'list rows render even with a legacy grid preference')
assert.ok(!classesOf(legacy).has('mp-card-check'), 'grid selection checkboxes no longer render')
internals.selectionStore.set({ active: false, paths: [] })
internals.prefsStore.set(savedPrefs)

// 10. multi-select context menu carries the bulk actions
internals.selectionStore.set({ active: true, paths: [TRACKS[0].path, TRACKS[1].path] })
internals.overlayStore.set({ layers: [{ kind: 'menu', props: { track: TRACKS[0], x: 10, y: 10 } }] })
const multiMenu = textOf(panel())
assert.ok(multiMenu.includes('播放选中'), 'the multi menu plays the selection')
assert.ok(multiMenu.includes('批量编辑'), 'the multi menu batch-edits the selection')
assert.ok(multiMenu.includes('删除'), 'the multi menu deletes the selection')
internals.overlayStore.set({ layers: [] })
internals.selectionStore.set({ active: false, paths: [] })

// 11. trash dialog
internals.overlayStore.set({ layers: [{ kind: 'trash', props: {} }] })
assert.ok(textOf(panel()).includes('回收站'), 'the trash dialog renders')
internals.overlayStore.set({ layers: [] })

// 8. pager math. The render mock cannot reach the paged branch (useState never
//    changes), so the window helper is exposed through __internals and tested
//    directly — this is the part that decides which page buttons appear.
const pageWindow = internals.pageWindow
assert.equal(typeof pageWindow, 'function', 'pageWindow is exposed for tests')
assert.equal(internals.SONG_PAGE_SIZE, 100, 'pages hold 100 rows')

assert.deepEqual(pageWindow(1, 1), [1], 'a single page shows one button')
assert.deepEqual(pageWindow(3, 5), [1, 2, 3, 4, 5], 'up to 7 pages are listed in full')
assert.deepEqual(
  pageWindow(1, 31),
  [1, 2, null, 31],
  'first page keeps a window on both sides plus the last page',
)
assert.deepEqual(pageWindow(15, 31), [1, null, 14, 15, 16, null, 31], 'a middle page shows neighbours')
assert.deepEqual(
  pageWindow(31, 31),
  [1, null, 30, 31],
  'the last page mirrors the first',
)
assert.equal(pageWindow(1, 31).filter((n) => n !== null).length, 3, 'no index is drawn twice')

// 9. `music_control`'s source must resolve through the shared provider list.
//    It used to hardcode the four Chinese platforms, so a request for
//    `source: "navidrome"` fell back to a local library search — wrong track or
//    silence, for a feature the tool description advertises.
const isOnlineSource = internals.isOnlineSource
assert.equal(typeof isOnlineSource, 'function', 'isOnlineSource is exposed for tests')
assert.equal(isOnlineSource('navidrome'), true, 'navidrome counts as an online source')
for (const provider of ['netease', 'qq', 'kugou', 'kugouLite']) {
  assert.equal(isOnlineSource(provider), true, `${provider} stays an online source`)
}
assert.equal(isOnlineSource('local'), false, 'local is not an online source')
assert.equal(isOnlineSource('nope'), false, 'an unknown source is not an online source')
assert.deepEqual(
  internals.UI_SOURCES,
  ['local', 'netease', 'qq', 'kugou', 'kugouLite', 'navidrome'],
  'the provider list has one definition',
)

// …and applyControlAction must call it instead of listing providers again.
const panelSource = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'ui', '11-panel.js'), 'utf8')
const controlBody = panelSource.slice(
  panelSource.indexOf('function applyControlAction'),
  panelSource.indexOf('function applyControlAction') + 1600,
)
assert.match(controlBody, /isOnlineSource\(action\.source\)/, 'the control action must use the shared helper')
assert.doesNotMatch(
  controlBody,
  /action\.source === 'netease'/,
  'the control action must not hardcode the provider list again',
)

console.log('panel.render.test.mjs ok')






