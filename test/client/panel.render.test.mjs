/**
 * Render smoke test for panel-v3.
 *
 * Loads the generated client bundle with a minimal React mock, seeds the stores
 * and walks the rendered tree. Effects do not run; the test catches reference
 * errors and structural regressions in every page branch.
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const registrations = []
const components = new Map()

global.window = {
  __ModuleLoader__: {
    load(definition) { globalThis.__dshMusicDef = definition },
  },
  localStorage: {
    _data: new Map([['music.startupGuide.intro.v1', '1']]),
    getItem(key) { return this._data.has(key) ? this._data.get(key) : null },
    setItem(key, value) { this._data.set(key, String(value)) },
    removeItem(key) { this._data.delete(key) },
  },
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent() {},
  requestAnimationFrame(callback) { return setTimeout(callback, 0) },
  cancelAnimationFrame(id) { clearTimeout(id) },
  setTimeout(callback) { return setTimeout(callback, 0) },
  clearTimeout(id) { clearTimeout(id) },
  innerWidth: 1400,
  innerHeight: 900,
  location: { href: 'http://127.0.0.1/' },
  matchMedia() { return { matches: false, addEventListener() {}, removeEventListener() {} } },
}

global.HTMLElement = class HTMLElement {}
global.ResizeObserver = undefined
global.document = {
  head: { appendChild() {} },
  body: { appendChild() {} },
  activeElement: null,
  createElement() { return { dataset: {}, textContent: '', remove() {}, appendChild() {} } },
  documentElement: { getAttribute: () => 'zh-CN' },
  visibilityState: 'visible',
  addEventListener() {},
  removeEventListener() {},
  querySelector() { return null },
  querySelectorAll() { return [] },
}

if (typeof global.navigator === 'undefined') global.navigator = { language: 'zh-CN' }

const React = {
  createElement: (type, props, ...children) => {
    const next = props ? { ...props } : {}
    const kids = children.length > 0 ? children : next.children === undefined ? [] : Array.isArray(next.children) ? next.children : [next.children]
    if (kids.length > 0) next.children = kids.length === 1 ? kids[0] : kids
    return { type, props: next, children: kids }
  },
  useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
  useEffect() {},
  useLayoutEffect() {},
  useRef: (initial) => ({ current: initial }),
  useMemo: (factory) => factory(),
  useCallback: (factory) => factory,
  Fragment: 'fragment',
  Component: class Component { constructor(props) { this.props = props; this.state = {} } setState() {} },
}

await import('../../client.js')

const definition = globalThis.__dshMusicDef
assert.ok(definition, 'client.js must register through window.__ModuleLoader__')
const api = definition.factory((name) => {
  assert.equal(name, 'react', 'unexpected host module: ' + name)
  return React
})

api.apply({
  effect(factory) { const dispose = factory(); registrations.push(dispose); return dispose },
  slots: {
    inject(name, callback) { callback(); return () => {} },
    register(registration, component) { components.set(registration.name + ':' + (registration.id || registration.key || ''), component); return () => {} },
  },
})

function walk(node, visit) {
  if (node === null || node === undefined) return
  if (Array.isArray(node)) { node.forEach((item) => walk(item, visit)); return }
  if (typeof node !== 'object') return
  if (node.type) visit(node)
  if (Array.isArray(node.children)) node.children.forEach((child) => walk(child, visit))
}

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
    if (isClassComponent(node.type)) return expand(node.children || (node.props && node.props.children))
    return expand(node.type(node.props || {}))
  }
  return Object.assign({}, node, { children: Array.isArray(node.children) ? node.children.map(expand) : node.children })
}

function classesOf(tree) {
  const classes = new Set()
  walk(expand(tree), (node) => {
    const className = node.props && node.props.className
    if (typeof className === 'string') className.split(/\s+/).filter(Boolean).forEach((name) => classes.add(name))
  })
  return classes
}

function nodesWithClass(tree, name) {
  const out = []
  walk(expand(tree), (node) => {
    const className = node.props && node.props.className
    if (typeof className === 'string' && className.split(/\s+/).filter(Boolean).includes(name)) out.push(node)
  })
  return out
}

function textOf(tree) {
  const parts = []
  function collect(value) {
    if (value === null || value === undefined) return
    if (Array.isArray(value)) { value.forEach(collect); return }
    if (typeof value === 'string' || typeof value === 'number') { parts.push(String(value)); return }
    if (typeof value === 'object' && Array.isArray(value.children)) value.children.forEach(collect)
  }
  collect(expand(tree))
  return parts.join(' ')
}

const internals = api.__internals
assert.ok(internals, 'internals are exposed for tests')

const TRACKS = [
  { path: 'D:/Music/a.mp3', name: 'a.mp3', title: 'Alpha', artist: 'Artist A', album: 'Album One', folder: 'Pop', durationSec: 200, hasCover: false, size: 1000, mtime: 1, plays: 3 },
  { path: 'D:/Music/b.mp3', name: 'b.mp3', title: 'Beta', artist: 'Artist B', album: 'Album Two', folder: 'Rock', durationSec: 180, hasCover: false, size: 2000, mtime: 2, plays: 1 },
  { path: 'D:/Music/c.mp3', name: 'c.mp3', title: 'Gamma', artist: 'Artist A', album: 'Album One', folder: 'Pop', durationSec: 240, hasCover: false, size: 3000, mtime: 3, plays: 9 },
]

internals.libraryStore.set({
  phase: 'ready', tracks: TRACKS, roots: ['D:/Music'], favorites: ['D:/Music/a.mp3'],
  playlists: [{ id: 'p1', name: 'Commute', trackPaths: ['D:/Music/a.mp3', 'D:/Music/c.mp3'] }],
  config: { roots: ['D:/Music'], depth: 3 }, stats: {}, statsRange: 'all',
})
internals.prefsStore.set(Object.assign({}, internals.prefsStore.get(), { layout: 'top' }))
internals.p3RouteStore.set({ source: 'local', page: 'songs', param: null, filter: null, query: '', history: [], scroll: {} })
internals.player.playList(TRACKS, 0)

const panel = components.get('main:music')
assert.equal(typeof panel, 'function', 'the main seat must register panel-v3')

const local = panel()
const localClasses = classesOf(local)
for (const name of ['mpv3-root', 'mpv3-topbar', 'mpv3-workspace', 'mpv3-content', 'mpv3-player']) {
  assert.ok(localClasses.has(name), 'expected class ' + name)
}
const localText = textOf(local)
assert.ok(localText.includes('Alpha'), 'the first track title is rendered')
assert.ok(localText.includes('Gamma'), 'visible tracks are rendered')

internals.prefsStore.set(Object.assign({}, internals.prefsStore.get(), { layout: 'rail' }))
const railTree = panel()
assert.ok(classesOf(railTree).has('mpv3-rail'), 'rail layout renders the left rail')
assert.ok(!classesOf(railTree).has('mpv3-tabs'), 'rail layout does not duplicate the tab strip')
internals.prefsStore.set(Object.assign({}, internals.prefsStore.get(), { layout: 'top' }))

for (const page of ['favorites', 'playlists', 'stats', 'albums', 'artists', 'folders']) {
  internals.p3RouteStore.set({ source: 'local', page, param: null, filter: null, query: '', history: [], scroll: {} })
  const tree = panel()
  assert.ok(classesOf(tree).has('mpv3-content'), 'view ' + page + ' renders content')
}

internals.p3RouteStore.set({ source: 'local', page: 'playlist', param: 'p1', filter: null, query: '', history: [], scroll: {} })
assert.ok(classesOf(panel()).has('mpv3-hero'), 'playlist detail renders a hero')

internals.p3RouteStore.set({ source: 'local', page: 'album', param: 'Artist A|Album One', filter: null, query: '', history: [], scroll: {} })
assert.ok(classesOf(panel()).has('mpv3-hero'), 'album detail renders a hero')

internals.p3RouteStore.set({ source: 'local', page: 'artist', param: 'Artist A', filter: null, query: '', history: [], scroll: {} })
assert.ok(classesOf(panel()).has('mpv3-hero'), 'artist detail renders a hero')

internals.p3RouteStore.set({ source: 'local', page: 'search', param: null, filter: null, query: 'Artist', history: [], scroll: {} })
const searchTree = panel()
assert.ok(textOf(searchTree).includes('Alpha'), 'local search renders matching tracks')
assert.ok(classesOf(searchTree).has('mpv3-search-artist'), 'local search puts the best artist first')
assert.equal(nodesWithClass(searchTree, 'mpv3-search-artist').length, 1, 'only one artist is shown')
assert.ok(classesOf(searchTree).has('mpv3-hrow'), 'local search renders a horizontal album row')
const searchHeads = nodesWithClass(searchTree, 'mpv3-section-head').map((node) => textOf(node))
assert.ok(searchHeads[0] && searchHeads[0].includes('歌手'), 'artist section is first')
assert.ok(searchHeads[1] && searchHeads[1].includes('专辑'), 'album section is second')
assert.ok(searchHeads[2] && searchHeads[2].includes('歌曲'), 'song section is last')
assert.ok(!classesOf(searchTree).has('mpv3-search-kinds'), 'search no longer shows kind tabs')
assert.ok(!classesOf(searchTree).has('mpv3-tabs'), 'search page hides the library tab strip')
internals.p3RouteStore.set({ source: 'local', page: 'search', param: null, filter: null, query: '', history: [], scroll: {} })
assert.ok(textOf(panel()).includes('返回'), 'empty search page offers a centered back action')

assert.ok(internals.p3Tabs('netease').indexOf('recent') >= 0, 'online sources expose recent')
assert.ok(internals.p3Tabs('netease').indexOf('songs') < 0, 'Chinese platforms do not expose a library songs page')
assert.ok(internals.p3Tabs('netease').indexOf('albums') < 0, 'Chinese platforms do not expose an album browse tab')
assert.ok(internals.p3Tabs('netease').indexOf('artists') < 0, 'Chinese platforms do not expose an artist browse tab')
assert.ok(internals.p3Tabs('navidrome').indexOf('songs') >= 0, 'Navidrome exposes its library songs page')
internals.onlineStore.set({ providers: { navidrome: { loggedIn: true, capabilities: { browseAlbums: true, browseArtists: true, userPlaylists: true } } } })
assert.ok(internals.p3Tabs('navidrome').indexOf('albums') >= 0, 'Navidrome exposes its album browse tab')
assert.ok(internals.p3Tabs('navidrome').indexOf('artists') >= 0, 'Navidrome exposes its artist browse tab')

internals.p3RouteStore.set({ source: 'netease', page: 'recent', param: null, filter: null, query: '', history: [], scroll: {} })
internals.onlineStore.set({
  provider: 'netease', phase: 'ready', providers: { netease: { loggedIn: true, nickname: 'Tester', vip: true, vipExpiresAt: '2027-01-01', capabilities: { recent: true, userPlaylists: true, searchAlbums: true, search: true, recommendations: true, userCloud: true, listeningRank: true } } },
  history: [{ provider: 'netease', id: '42', title: 'Online Song', artist: 'Online Artist', album: 'Online Album', durationSec: 210, coverUrl: '', qualityHint: '', playedAt: Date.now() }],
})
const onlineTree = panel()
const onlineText = textOf(onlineTree)
assert.ok(onlineText.includes('Online Song'), 'online history rows render')
assert.ok(classesOf(onlineTree).has('mpv3-source-avatar'), 'platform and account share one avatar control')
assert.ok(classesOf(onlineTree).has('mpv3-source-badge'), 'the platform logo badges the account avatar')
assert.ok(classesOf(onlineTree).has('mp-provider-logo'), 'the platform logo image is rendered')
assert.ok(classesOf(onlineTree).has('mpv3-source-vip'), 'the account VIP badge is shown')
const neteaseTabs = internals.p3Tabs('netease')
assert.ok(neteaseTabs.indexOf('playlists') >= 0, 'online tabs expose playlists')
assert.ok(neteaseTabs.indexOf('playlists') < neteaseTabs.indexOf('recent'), 'playlists come before recent')
assert.ok(neteaseTabs.indexOf('discover') >= 0, 'recommendation-capable sources expose Discover')
assert.ok(neteaseTabs.indexOf('cloud') >= 0, 'cloud-capable sources expose Cloud')
internals.p3SwitchSource('netease')
assert.equal(internals.p3BrowseStore.get().tab, 'playlists', 'online sources default to playlists')
internals.p3SwitchSource('local')
assert.ok(!classesOf(onlineTree).has('mpv3-account-btn'), 'the separate account button is gone')

internals.onlineStore.set({
  provider: 'netease', phase: 'ready', searchTotal: 1, searchPage: 1,
  providers: { netease: { loggedIn: true, capabilities: { recent: true, searchAlbums: true, searchPlaylists: true, search: true } } },
  results: [{ provider: 'netease', id: '42', title: 'Online Song', artist: 'Online Artist', album: 'Online Album', durationSec: 210, coverUrl: '', qualityHint: '' }],
})
internals.p3RouteStore.set({ source: 'netease', page: 'search', param: null, filter: null, query: 'Online', history: [], scroll: {} })
const onlineSearch = panel()
assert.ok(classesOf(onlineSearch).has('mpv3-search-artist'), 'online search puts the best artist first')
assert.ok(!classesOf(onlineSearch).has('mpv3-search-kinds'), 'online search has no kind tabs')
assert.ok(textOf(onlineSearch).includes('Online Song'), 'online song search renders results')

internals.p3RouteStore.set({ source: 'local', page: 'songs', filter: null, query: '', history: [], scroll: {} })

const queueTree = internals.P3Queue({
  open: true,
  onClose: function () {},
  onLocate: function () {},
})
assert.ok(classesOf(queueTree).has('mpv3-queue'), 'queue popover renders')
assert.ok(textOf(queueTree).includes('Alpha'), 'queue lists the current track')
const removeButtons = nodesWithClass(queueTree, 'mpv3-queue-remove')
assert.ok(removeButtons.length > 0, 'queue rows expose a remove action')
const queueBefore = internals.player.getSnapshot().queue.length
removeButtons[0].props.onClick({ stopPropagation: function () {} })
assert.equal(internals.player.getSnapshot().queue.length, queueBefore - 1, 'remove action drops one queue row')

internals.openP3Playlist('create')
const playlistDialog = internals.P3PlaylistDialogHost()
assert.ok(classesOf(playlistDialog).has('mp-overlay'), 'playlist dialog renders through the kit modal')
assert.ok(textOf(playlistDialog).includes('新建歌单'), 'playlist dialog shows its title')
internals.closeP3Playlist()

internals.overlayStore.set({ layers: [{ kind: 'menu', props: { track: TRACKS[0], x: 40, y: 40 } }] })
assert.ok(classesOf(panel()).has('mp-ctx'), 'the context menu renders')

internals.overlayStore.set({ layers: [{ kind: 'settings', props: {} }] })
assert.ok(classesOf(panel()).has('mp-sheet'), 'the settings sheet renders')

internals.overlayStore.set({ layers: [] })

internals.p3SelectBrowseTab('songs')
internals.p3OpenSearch()
internals.p3SetSearchQuery('Alpha')
assert.equal(internals.p3RouteStore.get().page, 'search', 'typing opens the search view')
assert.ok(!classesOf(internals.P3Shell()).has('mpv3-tabs'), 'search view hides the library tabs')

internals.p3PushCollection({ type: 'artist', source: 'local', id: 'Artist A', param: 'Artist A', name: 'Artist A', artist: 'Artist A' })
assert.equal(internals.p3RouteStore.get().page, 'artist', 'artist detail is a collection layer')
assert.ok(internals.p3CanGoBack(), 'a collection layer can go back')
assert.ok(!classesOf(internals.P3Shell()).has('mpv3-tabs'), 'detail view hides the library tabs')
const detailBack = nodesWithClass(internals.P3Shell(), 'mpv3-back-btn')[0]
assert.ok(detailBack, 'detail view has a back control')
assert.ok(textOf(detailBack).includes('返回'), 'the back control has a visible label')
assert.notEqual(detailBack.props.disabled, true, 'detail back control is enabled')
internals.p3GoBack()
assert.equal(internals.p3RouteStore.get().page, 'search', 'back from detail restores search')
assert.equal(internals.p3RouteStore.get().query, 'Alpha', 'back from detail keeps the search query')
internals.p3GoBack()
assert.equal(internals.p3RouteStore.get().page, 'songs', 'back from search restores browse')

internals.p3OpenSearch()
internals.p3SetSearchQuery('Alpha')
internals.p3SetSearchQuery('')
assert.equal(internals.p3RouteStore.get().page, 'songs', 'deleting the whole query exits search')
assert.equal(internals.p3SearchStore.get().open, false, 'empty search does not leave a blank overlay')

internals.p3SelectBrowseTab('albums')
assert.ok(textOf(internals.P3Shell()).includes('Album One'), 'albums tab lists every album')
internals.p3PushCollection({ type: 'album', source: 'local', id: 'Artist A|Album One', param: 'Artist A|Album One', name: 'Album One', artist: 'Artist A' })
assert.equal(internals.p3RouteStore.get().page, 'album', 'album detail opens from the albums tab')
assert.ok(!classesOf(internals.P3Shell()).has('mpv3-tabs'), 'album detail hides the library tabs')
internals.p3GoBack()
assert.equal(internals.p3RouteStore.get().page, 'albums', 'album detail returns to the full album grid')

internals.p3OpenSearch()
internals.p3SetSearchQuery('Alpha')
internals.p3PushCollection({ type: 'artist', source: 'local', id: 'Artist A', param: 'Artist A', name: 'Artist A', artist: 'Artist A' })
const savedNav = JSON.parse(window.localStorage.getItem('music.ui.v4'))
assert.equal(savedNav.v, 4, 'navigation snapshot is versioned')
assert.equal(savedNav.collection.origin, 'search', 'collection remembers search as its origin')
assert.equal(savedNav.search.open, true, 'search overlay stays open under a collection')
internals.p3InitNav()
assert.equal(internals.p3RouteStore.get().page, 'artist', 'v4 restores the collection layer')
assert.equal(internals.p3RouteStore.get().query, '', 'collection projection has no search query')
internals.p3GoBack()
assert.equal(internals.p3RouteStore.get().page, 'search', 'restored collection returns to search')
assert.equal(internals.p3RouteStore.get().query, 'Alpha', 'restored search keeps the submitted query')
internals.p3SelectBrowseTab('songs')

const multiArtistRow = internals.P3Row({
  track: { path: 'online:test:1', title: 'Multi', artist: '周杰伦 / 李硕 / 张鑫', album: 'Live', durationSec: 120, onlineProvider: 'kugouLite', id: '1' },
  index: 0,
  list: [],
  currentPath: '',
  playing: false,
  favoriteSet: {},
  selected: false,
  tabIndex: -1,
})
assert.equal(nodesWithClass(multiArtistRow, 'mpv3-artist-link').length, 3, 'each artist gets its own hover link')

window.localStorage.setItem('music.ui.v3', JSON.stringify({ source: 'local', page: 'album', param: 'Artist A|Album One' }))
window.localStorage.removeItem('music.ui.v4')
internals.p3InitNav()
assert.equal(internals.p3RouteStore.get().page, 'album', 'v3 detail routes migrate into the collection stack')
assert.equal(internals.p3BrowseStore.get().tab, 'albums', 'v3 detail keeps its parent tab')
internals.p3GoBack()
assert.equal(internals.p3RouteStore.get().page, 'albums', 'migrated collection returns to its parent tab')
window.localStorage.removeItem('music.ui.v3')
internals.p3SelectBrowseTab('songs')

// Recent rows expose the existing history removal through the context menu.
const pagesSource = readFileSync(new URL('../../src/client/panel-v3/p3-pages.js', import.meta.url), 'utf8')
const coreSource = readFileSync(new URL('../../src/client/panel-v3/p3-core.js', import.meta.url), 'utf8')
assert.match(pagesSource, /onRemove: removeRecent/, 'recent page passes its remove handler to P3List')
assert.match(pagesSource, /removeHistory\(\{ provider: track\.onlineProvider, id: track\.onlineId \}\)/, 'recent remove uses the shared history store')
assert.match(coreSource, /p3OpenTrackMenu\(track, event, props\.list, props\.onRemove\)/, 'row context menu carries the remove action')
assert.match(coreSource, /onRemove: function \(\) \{ onRemove\(track\) \}/, 'menu action is bound to the row track')

console.log('panel.render.test.mjs ok')
