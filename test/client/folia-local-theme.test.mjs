/**
 * Local theme generation: Folia's AI-theme shape without a model.
 *
 * The cover-derived dual theme already exists (styles bundle); this checks the local
 * layer on top — lyric mood, keyword extraction, and the generated Theme — plus the
 * per-song store the three Folia stages subscribe to. No network is involved.
 */

import assert from 'node:assert/strict'

global.window = {
  __ModuleLoader__: { load(definition) { globalThis.__dshMusicDef = definition } },
  localStorage: { getItem: () => null, setItem() {} },
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent() {},
  setTimeout: (callback) => setTimeout(callback, 0),
  clearTimeout: (id) => clearTimeout(id),
}

global.document = {
  head: { appendChild() {} },
  createElement() {
    return { dataset: {}, textContent: '', style: {}, remove() {}, appendChild() {} }
  },
  documentElement: { getAttribute: () => 'zh-CN' },
  visibilityState: 'visible',
  addEventListener() {},
  removeEventListener() {},
  querySelector: () => null,
}

if (typeof global.navigator === 'undefined') {
  global.navigator = { language: 'zh-CN' }
}

const React = {
  createElement: (type, props, ...children) => ({ type, props, children }),
  useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
  useEffect() {},
  useLayoutEffect() {},
  useRef: (initial) => ({ current: initial }),
  useMemo: (factory) => factory(),
  useCallback: (factory) => factory,
  useContext: () => null,
  createContext: (value) => ({ Provider: (props) => props.children, Consumer: () => null, _currentValue: value }),
  lazy: () => () => null,
  Suspense: (props) => (props && props.children) || null,
  memo: (component) => component,
  forwardRef: (render) => render,
  useId: () => '',
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
const api = definition.factory(() => React)
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
const moodOf = internals.mpLocalMoodOf
const wordsOf = internals.mpLocalWords
const buildTheme = internals.mpBuildLocalTheme
const generateForSong = internals.mpGenerateLocalThemeForSong
const getLocalTheme = internals.mpGetLocalTheme
assert.equal(typeof moodOf, 'function')
assert.equal(typeof wordsOf, 'function')
assert.equal(typeof buildTheme, 'function')
assert.equal(typeof generateForSong, 'function')

// Moods: the lexicon counts Chinese and Latin words, and falls back to calm.
assert.equal(moodOf('雨落在伞上，湿了整条街 rain and tears'), 'rain')
assert.equal(moodOf('我们坐在海边，风很慢，云很低'), 'calm')
assert.equal(moodOf(''), 'calm')

// Keywords: stopwords and one-character particles are dropped; CJK n-grams and
// Latin words survive, and the list is bounded.
const words = wordsOf('深夜的雨落在窗外，城市的灯还亮着。Night rain keeps falling.')
assert.ok(words.length > 0 && words.length <= 14)
assert.ok(words.indexOf('的') < 0, 'particles are not keywords')
assert.ok(words.indexOf('the') < 0, 'English function words are not keywords')
assert.ok(words.some((word) => word.indexOf('雨') >= 0 || word.indexOf('夜') >= 0))

// A built theme keeps Folia's shape and lands inside its contract.
const theme = buildTheme({
  key: '/music/a.flac',
  coverColors: ['#24304a', '#c96a7a', '#e8d6b0'],
  lyricsText: '深夜的雨落在窗外，城市的灯还亮着。',
  variation: 0,
})
assert.ok(theme !== null)
assert.match(theme.backgroundColor, /^#[0-9a-f]{6}$/i)
assert.match(theme.primaryColor, /^#[0-9a-f]{6}$/i)
assert.match(theme.secondaryColor, /^#[0-9a-f]{6}$/i)
assert.match(theme.accentColor, /^#[0-9a-f]{6}$/i)
assert.ok(theme.name.length > 0 && theme.name.length <= 10, 'the name stays within 10 characters')
assert.ok(theme.description.length >= 15 && theme.description.length <= 30, 'the description stays 15–30 characters')
assert.equal(theme.provider, 'Local')
assert.ok(Array.isArray(theme.wordColors) && theme.wordColors.length > 0)
for (const item of theme.wordColors) {
  assert.ok(typeof item.word === 'string' && item.word.length > 0)
  assert.match(item.color, /^#[0-9a-f]{6}$/i)
}

// The generator caches per song key, and the stages read it from there.
const generated = await generateForSong({
  key: '/music/b.flac',
  cover: '',
  lyricsText: '希望明天的太阳照进来',
  variation: 1,
})
assert.ok(generated !== null)
assert.equal(getLocalTheme('/music/b.flac'), generated)
assert.equal(getLocalTheme('/music/does-not-exist.flac'), null)

console.log('folia-local-theme.test.mjs ok')

