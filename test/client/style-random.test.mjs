/**
 * 随机歌词样式: the shuffle is stable per song and each style gets an equal slice
 * of the song. The maths is pure, so it is tested without mounting a renderer.
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

const internals = api.__internals
assert.equal(typeof internals.mpRandomStyleOrder, 'function', 'the shuffle is exposed')
assert.equal(typeof internals.mpResolveLyricStyle, 'function', 'the resolver is exposed')
assert.equal(typeof internals.mpStylePickerCatalog, 'function', 'the picker catalog is exposed')

const order = internals.mpRandomStyleOrder
const resolve = internals.mpResolveLyricStyle
const pool = ['a', 'b', 'c', 'd', 'e']

// The same song must always get the same order, and every choice exactly once.
const first = order(pool, 'D:/Music/song.flac')
const second = order(pool, 'D:/Music/song.flac')
assert.deepEqual(first, second, 'one song gets one order')
assert.deepEqual([...first].sort(), [...pool].sort(), 'the shuffle is a permutation')
assert.notDeepEqual(order(pool, 'D:/Music/other.flac'), first, 'another song gets another order')
// The input must not be mutated.
assert.deepEqual(pool, ['a', 'b', 'c', 'd', 'e'], 'the shuffle does not mutate its input')

// Concrete preferences pass through; an unknown one still falls back.
assert.equal(resolve('monet', { seed: 'x', time: 0, duration: 100 }), 'monet')
assert.equal(resolve('whatever', { seed: 'x', time: 0, duration: 100 }), 'monet')

// 99 s over three choices: each style owns 33 s, and a seek lands on the same slot.
const at = (time, duration = 99) => resolve('random', { seed: 'song', time, duration, pool: ['a', 'b', 'c'] })
assert.equal(at(0), at(0.1), 'the first slice is stable')
assert.notEqual(at(0), at(33.1), 'the next slice is a different style')
assert.equal(at(33.1), at(65.9), 'a seek inside the middle slice keeps the style')
assert.equal(at(98), at(999), 'a known duration ends on its last slice')
assert.notEqual(at(0), at(66.1), 'the last slice is a different style')

// No duration: an 8 s fallback and a wrapping cycle, so a stream still rotates.
const stream = (time) => resolve('random', { seed: 'radio', time, duration: 0, pool: ['a', 'b', 'c'] })
assert.notEqual(stream(0), stream(8), 'the fallback slice advances')
assert.equal(stream(24), stream(0), 'the fallback cycle wraps')

// 静止 and the pseudo style are never candidates.
const filtered = (time) =>
  resolve('random', {
    seed: 'song',
    time,
    duration: 100,
    pool: ['still', 'random', 'a', 'b'],
  })
for (const time of [0, 10, 25, 50, 75, 99]) {
  const id = filtered(time)
  assert.notEqual(id, 'still', '静止 is not in the random pool')
  assert.notEqual(id, 'random', 'random never resolves to itself')
  assert.ok(id === 'a' || id === 'b', 'only real choices are returned')
}

// The picker has one tile per real style plus the random entry at the end.
const picker = internals.mpStylePickerCatalog()
assert.equal(picker[picker.length - 1].id, 'random', 'the random tile is last')
assert.equal(internals.mpStyleIdOf('random'), 'random', 'random is a valid stored preference')
assert.ok(internals.mpStyleLabelOf('random') !== '', 'random has a label')

console.log('style-random.test.mjs ok')

