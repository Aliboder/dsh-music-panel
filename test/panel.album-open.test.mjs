/**
 * Guard: opening an album from a search result must actually open the album.
 *
 * The online views render the search result list whenever a search is active
 * (`online.query !== ''`), and that check sits before the per-section branches.
 * Search is deliberately sticky — it keeps showing results while the user walks
 * the sidebar — so every entry point that opens a section has to end the search
 * first. `openOnlineArtist` does; `openOnlineAlbum` did not, so clicking an
 * album under a Navidrome search result left the panel on the search list: the
 * row looked dead, and only the local view (which filters `songs` by album name
 * instead of using a dedicated album view) appeared to work.
 *
 * The symptom lives in the gap between two stores (ui.nav and online.query), so
 * a source-shape guard cannot catch it: this test drives the real entry point
 * and reads the state it leaves behind.
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (path) => readFileSync(join(...path.split('/')), 'utf8')

// ── 1. the entry point ends the search it was launched from ──────────────
const online = read('src/70-online.js')
const openAlbum = online.slice(
  online.indexOf('async function openOnlineAlbum'),
  online.indexOf('function closeOnlineAlbum'),
)
assert.ok(openAlbum.includes('async function openOnlineAlbum'), 'openOnlineAlbum is defined')
assert.match(
  openAlbum,
  /query: ''/,
  'opening an album must clear online.query, or the search list keeps rendering over it',
)
assert.match(
  openAlbum,
  /setNav\('album'\)/,
  'opening an album must switch to the album view',
)

// The search phase has to be reset as well: leaving phase at 'ready' with an
// empty query is harmless, but resetting it at the same place as query keeps
// both halves of "a search is active" together, so later edits cannot split
// them (which is how this bug appeared in the first place).
assert.match(
  openAlbum,
  /phase: 'idle'/,
  'opening an album must reset the search phase alongside the query',
)
assert.match(
  openAlbum,
  /error: ''/,
  'opening an album must clear the stale search error',
)

// ── 2. the artist entry point keeps doing the same thing ────────────────
// This is the working sibling the album path should match; if it ever loses
// the reset, both entry points break the same way and the tests stay green.
const openArtist = online.slice(
  online.indexOf('async function openOnlineArtist'),
  online.indexOf('function closeOnlineArtist'),
)
assert.match(openArtist, /query: ''/, 'openOnlineArtist must keep clearing the search query')

// ── 3. behaviour: the real entry point leaves no active search behind ───
const components = new Map()
global.window = {
  __ModuleLoader__: { load(d) { globalThis.__def = d } },
  localStorage: {
    _d: new Map(),
    getItem(k) { return this._d.has(k) ? this._d.get(k) : null },
    setItem(k, v) { this._d.set(k, String(v)) },
  },
  addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
  setTimeout(cb) { return setTimeout(cb, 0) }, clearTimeout(id) { clearTimeout(id) },
  location: { href: 'http://127.0.0.1/' }, innerWidth: 1400, innerHeight: 900,
}
global.document = {
  head: { appendChild() {} },
  createElement() { return { dataset: {}, textContent: '', remove() {} } },
  documentElement: { getAttribute: () => 'zh-CN' },
  visibilityState: 'visible', addEventListener() {}, removeEventListener() {},
}
if (typeof navigator === 'undefined') global.navigator = { language: 'zh-CN' }

const React = {
  createElement: (type, props, ...children) => {
    const next = props ? { ...props } : {}
    if (children.length > 0) next.children = children.length === 1 ? children[0] : children
    return { type, props: next, children }
  },
  useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
  useEffect() {},
  useLayoutEffect() {},
  useRef: (initial) => ({ current: initial }),
  useMemo: (factory) => factory(),
  useCallback: (factory) => factory,
  Fragment: 'fragment',
  Component: class { constructor(props) { this.props = props; this.state = {} } setState() {} },
}

await import('../client.js')
const api = globalThis.__def.factory(() => React)
api.apply({
  effect(factory) { return factory() },
  slots: { inject(name, cb) { cb(); return () => {} }, register(r, c) { components.set(r.name, c); return () => {} } },
})
const internals = api.__internals
assert.equal(typeof internals.openOnlineAlbum, 'function', 'the album entry point is exposed for tests')

// The search that the click came from: results are on screen, a query is set.
internals.uiStore.set({ source: 'navidrome', nav: 'recent', filter: null, query: '' })
internals.onlineStore.set({
  provider: 'navidrome',
  query: 'radiohead',
  phase: 'ready',
  error: '',
  results: [{ provider: 'navidrome', id: 's1', title: 'Creep', durationSec: 200 }],
})

const realFetch = global.fetch
global.fetch = async () => ({
  ok: true,
  status: 200,
  async json() {
    return { ok: true, name: 'Pablo Honey', artist: 'Radiohead', cover: '', songs: [] }
  },
})

try {
  await internals.openOnlineAlbum({
    onlineProvider: 'navidrome',
    album: 'Pablo Honey',
    albumId: 'al-1',
    artist: 'Radiohead',
  })
} finally {
  global.fetch = realFetch
}

assert.equal(internals.onlineStore.get().query, '', 'the active search is cleared on entering the album')
assert.equal(internals.uiStore.get().nav, 'album', 'the panel switches to the album view')
assert.equal(internals.onlineStore.get().albumPhase, 'ready', 'the album request still resolves')

console.log('  ok  opening an album ends the search it came from')
console.log('  ok  the album view is the one that renders afterwards')
console.log('\npanel.album-open.test.mjs ok')
