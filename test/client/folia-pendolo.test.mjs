/**
 * Folia Pendolo port: boundary contract.
 *
 * The renderer itself is Folia's, compiled verbatim by scripts/build-pendolo.mjs. What
 * this plugin owns is the boundary: plugin lyric lines must become Folia `Line`s with
 * word timings, and the theme must carry the accent the player page uses. The test
 * loads client.js with the same minimal React mock as the smoke test and exercises the
 * two pure functions through the debugging internals.
 */

import assert from 'node:assert/strict'

global.window = {
  __ModuleLoader__: {
    load(definition) {
      globalThis.__dshMusicDef = definition
    },
  },
  localStorage: {
    getItem() {
      return null
    },
    setItem() {},
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
  createElement: (type, props, ...children) => ({ type, props, children }),
  useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
  useEffect() {},
  useRef: (initial) => ({ current: initial }),
  useMemo: (factory) => factory(),
  useCallback: (factory) => factory,
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

api.apply({
  effect(factory) {
    return factory()
  },
  slots: {
    inject(name, callback) {
      callback()
      return () => {}
    },
    register() {
      return () => {}
    },
  },
})

const internals = api.__internals
assert.ok(internals, 'client exposes its internals to tests')

const bundle = internals.FOLIA_PENDOLO
assert.ok(bundle, 'the compiled Folia Pendolo bundle must load')
assert.equal(typeof bundle.VisualizerPendolo, 'function')
assert.equal(typeof bundle.buildTimedWords, 'function')
assert.equal(typeof bundle.estimateLrcLineEndTime, 'function')
assert.equal(typeof bundle.DEFAULT_PENDOLO_TUNING, 'object')

// Plugin lines → Folia Line[]: fullText, seconds, an end time, word timings and the
// translation the renderer lays out itself.
const lines = internals.foliaPendoloLines([
  { time: 1, text: '你好世界', translation: 'hello world' },
  { time: 4, text: '再见', translation: '' },
  { time: -1, text: 'untimed' },
])
assert.equal(lines.length, 2, 'untimed lines are dropped')
assert.equal(lines[0].fullText, '你好世界')
assert.equal(lines[0].startTime, 1)
assert.ok(lines[0].endTime > 1, 'a line always has a positive duration')
assert.equal(lines[0].translation, 'hello world')
assert.ok(lines[0].words.length >= 4, 'grapheme tokens become timed words')
assert.ok(lines[0].words[0].startTime >= 1)
assert.ok(lines[0].words[lines[0].words.length - 1].endTime <= lines[0].endTime + 1e-9)
assert.equal(lines[1].startTime, 4)
assert.equal(lines[0].sourceIndex, 0)
assert.equal(lines[1].sourceIndex, 1, 'source indices survive a dropped untimed line')

// A line that already carries a word timeline keeps it.
const timed = internals.foliaPendoloLines([
  { time: 2, end: 4, text: 'ab', words: [{ t: 2, end: 2.5, text: 'a' }, { t: 2.5, end: 4, text: 'b' }] },
])
assert.equal(timed[0].words.length, 2)
assert.equal(timed[0].words[1].startTime, 2.5)
assert.equal(timed[0].endTime, 4)

// Theme: the player's cover accent reaches the renderer as a colour Folia can parse
// (it only understands hex/rgb()), with Folia's Theme shape.
const theme = internals.foliaPendoloTheme('hsl(350 70% 60%)')
assert.match(theme.accentColor, /^#[0-9a-f]{6}$/i)
assert.notEqual(theme.accentColor, '#f2607a')
assert.equal(internals.foliaPendoloTheme('#123456').accentColor, '#123456')
assert.equal(theme.fontStyle, 'sans')
assert.ok(Array.isArray(theme.fontFamilyStack) && theme.fontFamilyStack.length > 0)
assert.ok(Array.isArray(theme.wordColors))

console.log('folia-pendolo.test.mjs ok')

