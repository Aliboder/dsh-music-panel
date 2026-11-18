/**
 * Render smoke test for panel-v3.
 *
 * Loads the generated client bundle with a minimal React mock, seeds the stores
 * and walks the rendered tree. Effects do not run; the test catches reference
 * errors and structural regressions in every page branch.
 */

import assert from 'node:assert/strict'

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

internals.p3RouteStore.set({ source: 'local', page: 'search', param: null, filter: null, query: 'Alpha', history: [], scroll: {} })
assert.ok(textOf(panel()).includes('Alpha'), 'local search renders matching tracks')

assert.ok(internals.p3Tabs('netease').indexOf('recent') >= 0, 'online sources expose recent')
assert.ok(internals.p3Tabs('netease').indexOf('songs') < 0, 'Chinese platforms do not expose a library songs page')
assert.ok(internals.p3Tabs('navidrome').indexOf('songs') >= 0, 'Navidrome exposes its library songs page')

internals.p3RouteStore.set({ source: 'netease', page: 'recent', param: null, filter: null, query: '', history: [], scroll: {} })
internals.onlineStore.set({
  provider: 'netease', phase: 'ready', providers: { netease: { loggedIn: true, nickname: 'Tester', capabilities: { recent: true } } },
  history: [{ provider: 'netease', id: '42', title: 'Online Song', artist: 'Online Artist', album: 'Online Album', durationSec: 210, coverUrl: '', qualityHint: '', playedAt: Date.now() }],
})
const onlineText = textOf(panel())
assert.ok(onlineText.includes('Online Song'), 'online history rows render')

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

internals.overlayStore.set({ layers: [{ kind: 'menu', props: { track: TRACKS[0], x: 40, y: 40 } }] })
assert.ok(classesOf(panel()).has('mp-ctx'), 'the context menu renders')

internals.overlayStore.set({ layers: [{ kind: 'settings', props: {} }] })
assert.ok(classesOf(panel()).has('mp-sheet'), 'the settings sheet renders')

console.log('panel.render.test.mjs ok')
