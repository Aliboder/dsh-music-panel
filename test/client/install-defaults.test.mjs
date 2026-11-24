/**
 * Fresh-install preferences: the defaults a new user gets before touching any switch.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const source = readFileSync(join(root, 'src/client/stores/prefs.js'), 'utf8')
const context = vm.createContext({
  window: { localStorage: { getItem: () => null, setItem() {} } },
  createStore: function (state) {
    return { get: () => state, set() {}, subscribe: () => () => {} }
  },
  console,
})
vm.runInContext(source, context)
const defaults = vm.runInContext('PREF_DEFAULTS', context)

test('look and layout defaults', () => {
  assert.equal(defaults.layout, 'top', 'top bar layout')
  assert.equal(defaults.composerListButton, true, 'composer list button')
  assert.equal(defaults.lyricStyle, 'classic', 'Folia classic lyrics')
  assert.equal(defaults.bgMode, 'latent', 'latent background')
  assert.equal(defaults.lyricIntensity, 'normal', 'standard lyric motion')
  assert.equal(defaults.themeSource, 'default', 'default theme source')
})

test('lyric defaults', () => {
  assert.equal(defaults.autoUseBestLyric, true)
  assert.equal(defaults.lyricPreferredSource, 'kugouLite', 'KuGou first')
  assert.equal(defaults.lyricKeepProviderWordTiming, true)
  assert.equal(defaults.lyricLocalPriority, 'online')
  assert.equal(defaults.showTranslation, true)
  assert.equal(defaults.subtitleOverlayBackground, true)
  assert.equal(defaults.lyricsFontScale, 1, '100%')
  assert.equal(defaults.composerLyrics, true)
  assert.equal(defaults.composerTranslation, true)
})

test('playback defaults', () => {
  assert.equal(defaults.crossfadeEnabled, false, 'page/track transition off')
  assert.equal(defaults.replayGainMode, 'off', 'loudness balance off')
  assert.equal(defaults.normalizeVolume, false)
  assert.equal(defaults.playbackFade, false)
  assert.equal(defaults.queueAddBehavior, 'append')
  assert.equal(defaults.autoSkipUnplayable, true)
  assert.equal(defaults.resumeOnStart, true)
  assert.equal(defaults.onlineQuality, 'standard')
})

test('storage defaults', () => {
  assert.equal(defaults.onlineCacheEnabled, true, 'song cache on')
  // Lyrics have no switch: resolved lyrics are written to the cache unconditionally.
  assert.equal(Object.prototype.hasOwnProperty.call(defaults, 'lyricCacheEnabled'), false)
})
test('legacy lyric variants migrate to Folia classic', () => {
  const raw = JSON.stringify({ lyricStyle: 'glow' })
  const legacy = vm.createContext({
    window: { localStorage: { getItem: (key) => (key === 'music.prefs.v2' ? raw : null), setItem() {} } },
    createStore: function (state) {
      return { get: () => state, set() {}, subscribe: () => () => {} }
    },
    console,
  })
  vm.runInContext(source, legacy)
  assert.equal(vm.runInContext('readPrefs().lyricStyle', legacy), 'classic')
})

console.log('install-defaults.test.mjs ok')
