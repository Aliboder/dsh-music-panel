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
  assert.equal(defaults.subtitleFontScale, 1, 'translation starts at Folia’s 100%')
  assert.equal(defaults.composerLyrics, true)
  assert.equal(defaults.composerTranslation, true)
})

test('playback defaults', () => {
  assert.equal(defaults.crossfadeEnabled, false, 'page/track transition off')
  assert.equal(defaults.replayGainMode, 'off', 'loudness balance off')
  assert.equal(defaults.normalizeVolume, false)
  assert.equal(defaults.playbackFade, false)
  assert.equal(defaults.queueAddBehavior, 'append')
  assert.equal(defaults.autoSkipUnplayable, false, 'Folia default: stop on an unplayable song')
  assert.equal(defaults.autoHidePlayerChrome, true, 'player chrome auto-hides by default')
  assert.equal(defaults.playerChromeVisibilityMode, 'auto-hide', 'player chrome auto-hides by default')
  assert.equal(defaults.classicTuning.wordSpacing, 0.7, 'Folia classic tuning defaults')
  assert.equal(defaults.tiltTuning.splitProbability, 0.75, 'Folia tilt tuning defaults')
  assert.equal(defaults.partitaTuning.staggerMin, 20, 'Folia partita tuning defaults')
  assert.equal(defaults.fumeTuning.cameraSpeed, 1, 'Folia fume tuning defaults')
  assert.equal(defaults.claddaghTuning.radiusScale, 0.85, 'tuned claddagh defaults')
  assert.equal(defaults.claddaghTuning.ellipseTiltDeg, 39)
  assert.equal(defaults.claddaghTuning.showTranslation, true)
  assert.equal(defaults.claddaghTuning.translationLetterSpacingOffset, 2)
  assert.equal(defaults.hanabiTuning.sparkAmount, 0.5, 'tuned hanabi defaults')
  assert.equal(defaults.hanabiTuning.ornamentAmount, 2)
  assert.equal(defaults.hanabiTuning.glow, 0.55)
  assert.equal(defaults.hanabiTuning.bloom, 0.3)
  assert.equal(defaults.hanabiTuning.chorusBloom, 0.5)
  assert.equal(defaults.hanabiTuning.sky, 0.75)
  assert.equal(defaults.cadenzaTuning.fontScale, 1.12, 'Folia cadenza tuning defaults')
  assert.equal(defaults.sonnetTuning.cameraIntensity, 1.2, 'tuned sonnet defaults')
  assert.equal(defaults.sonnetTuning.mgDensity, 0.6)
  assert.equal(defaults.sonnetTuning.postProcessEnabled, true)
  assert.equal(defaults.sonnetTuning.postProcessRgbShift, 0.05)
  assert.equal(defaults.sonnetTuning.postProcessHalftone, 0.05)
  assert.equal(defaults.sonnetTuning.postProcessVignette, 1.05)
  assert.equal(defaults.monetTuning.fontScale, 1.5, 'tuned monet defaults')
  assert.equal(defaults.machiTuning.aperture, 8, 'Folia machi tuning defaults')
  assert.equal(defaults.lumiereTuning.lightIntensity, 0.4, 'tuned lumiere defaults')
  assert.equal(defaults.lumiereTuning.audioResponse, 2)
  assert.equal(defaults.lumiereTuning.fogDensity, 0.5)
  assert.equal(defaults.lumiereTuning.darkField, 0.5)
  assert.equal(defaults.lumiereTuning.moteAmount, 2)
  assert.equal(defaults.lumiereTuning.bloom, 0.8)
  assert.equal(defaults.lumiereTuning.textBloom, 0.5)
  assert.equal(defaults.lumiereTuning.unlitOpacity, 0.1)
  assert.equal(defaults.lumiereTuning.decay, 1.3)
  assert.equal(defaults.lumiereTuning.echo, 1.2)
  assert.equal(defaults.lumiereTuning.fogOctaves, 1)
  assert.equal(defaults.lumiereTuning.themeColorMix, 1)
  assert.equal(defaults.pendoloTuning.arcRadius, 0.48, 'the tuned pendolo hand-feel is the default')
  assert.equal(defaults.pendoloTuning.arcAngleDeg, 100)
  assert.equal(defaults.pendoloTuning.wheelCenterX, 0)
  assert.equal(defaults.pendoloTuning.wheelCenterY, 0.5)
  assert.equal(defaults.pendoloTuning.tickSnappiness, 3)
  assert.equal(defaults.pendoloTuning.activeScale, 1.41)
  assert.equal(defaults.pendoloTuning.tiltDeg, 2)
  assert.equal(defaults.pendoloTuning.parallaxDepth, 1)
  assert.equal(defaults.pendoloTuning.mirrorLayout, false)
  assert.equal(defaults.dioramaTuning.cameraSpeed, 1.3, 'tuned diorama defaults')
  assert.equal(defaults.dioramaTuning.motionAmount, 0.9)
  assert.equal(defaults.dioramaTuning.audioReactivity, 1.5)
  assert.equal(defaults.dioramaTuning.soulActiveEnabled, true)
  assert.equal(defaults.dioramaTuning.gradientEnabled, true)
  assert.equal(defaults.temperaTuning.cameraIntensity, 1, 'Folia tempera tuning defaults')
  assert.equal(defaults.temperaTuning.glyphDepth, 0.9)
  assert.equal(defaults.temperaTuning.postProcessGrain, 0.1)
  assert.equal(defaults.temperaTuning.postProcessContrast, 0.4)
  assert.equal(defaults.nebbiaTuning.mist, 0.75, 'Folia nebbia tuning defaults')
  assert.equal(defaults.metaphorTuning.cutPace, 1, 'Folia metaphor tuning defaults')
  assert.equal(defaults.metaphorTuning.negative, true, 'metaphor negative shots default on')
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

test('old default Monet migrates once', () => {
  const raw = JSON.stringify({ lyricStyle: 'monet' })
  const legacy = vm.createContext({
    window: { localStorage: { getItem: (key) => (key === 'music.prefs.v2' ? raw : null), setItem() {} } },
    createStore: function (state) {
      return { get: () => state, set() {}, subscribe: () => () => {} }
    },
    console,
  })
  vm.runInContext(source, legacy)
  const migrated = vm.runInContext('readPrefs()', legacy)
  assert.equal(migrated.lyricStyle, 'classic')
  assert.equal(migrated.lyricStyleChosen, true)
})

console.log('install-defaults.test.mjs ok')

test('old always-visible profile migrates to auto-hide once', () => {
  const stored = JSON.stringify({ playerChromeVisibilityMode: 'always-visible', autoHidePlayerChrome: false })
  const context = vm.createContext({
    window: {
      localStorage: {
        getItem: (key) => key === 'music.prefs.v2' ? stored : null,
        setItem() {},
      },
    },
    createStore: function (state) {
      return { get: () => state, set() {}, subscribe: () => () => {} }
    },
    console,
  })
  vm.runInContext(source, context)
  const prefs = vm.runInContext('readPrefs()', context)
  assert.equal(prefs.playerChromeVisibilityMode, 'auto-hide')
  assert.equal(prefs.autoHidePlayerChrome, true)
  assert.equal(prefs.playerChromeModeChosen, true)
})
