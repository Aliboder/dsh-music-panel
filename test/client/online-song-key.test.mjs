/**
 * 在线歌单页的歌曲身份与去重。
 *
 * Host 返回的是成形行（provider + id），客户端 track 带 path；两者必须能对成同一个键。
 * 酷狗歌单整页重复的界面现象里，合并那一步读的是根本不存在于 Host 行上的 path，
 * 于是重复页被当成新歌追加。React 也按这个键渲染行，键相同本身就是渲染问题。
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

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
const key = api.__internals.onlineSongKey
const unique = api.__internals.onlineSongsUnique
assert.equal(typeof key, 'function', 'the song identity helper is exposed to tests')
assert.equal(typeof unique, 'function', 'the per-page dedupe helper is exposed to tests')

// A Host row and a client track of the same song must come out as one key.
assert.equal(key({ provider: 'kugouLite', id: 'ABC' }), 'online:kugouLite:ABC')
assert.equal(key({ path: 'online:qq:001abc' }), 'online:qq:001abc')
assert.equal(key({ id: 'x' }, 'netease'), 'online:netease:x')
assert.equal(key({ title: '没有 id' }), '')
assert.equal(key(null), '')

// One row per song inside a page: the same id twice is one entry, a track keeps its path.
const listed = unique([{ id: 'a' }, { id: 'a' }, { id: 'b' }, { path: 'online:qq:c' }], 'kugouLite')
assert.deepEqual(listed.map((row) => row.id || row.path), ['a', 'b', 'online:qq:c'])

// The playlist merge keys on that identity instead of the (missing) path, and stops when
// the Host cursor refuses to advance.
const source = readFileSync(new URL('../../src/client/components/online/online.js', import.meta.url), 'utf8')
assert.match(source, /seen\[onlineSongKey\(song, provider\)\]/, 'the merge keys on provider song id')
assert.match(source, /onlineSongsUnique\(Array\.isArray\(body\.songs\)/, 'every page is deduped as it arrives')
assert.match(source, /nextOffset <= offset/, 'a cursor that cannot advance ends the list')

console.log('online-song-key.test.mjs ok')