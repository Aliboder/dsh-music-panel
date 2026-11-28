/**
 * 歌词设置守卫：settings 页上的每一行都必须有真实的消费者。
 *
 * 背景（A_other/docs/踩坑记录.md「歌词排版设置只写不读」）：设置页曾是按已移除的
 * 经典歌词列表写的，字号/间距/对齐/模糊四个键只写 localStorage，没有任何渲染器读，
 * 用户拖动滑杆看不到变化。这条测试锁住两件事：
 *   1. 歌词页只暴露真实生效的偏好（字号倍率 / 翻译缩放 / 翻译开关 / 字幕背景 …）；
 *   2. 歌词页出现的每个 prefs.* 在设置页之外都有读取方。
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const clientDir = join(root, 'src/client')
const settingsSource = readFileSync(join(root, 'src/client/components/ui/settings.js'), 'utf8')
const prefsSource = readFileSync(join(root, 'src/client/stores/prefs.js'), 'utf8')

/** Every .js under src/client, so a consumer anywhere in the client counts. */
function clientFiles(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) out.push(...clientFiles(path))
    else if (name.endsWith('.js')) out.push(path)
  }
  return out
}

/** The lyrics tab's source, from its header to the next tab. */
function lyricsTabSource() {
  const start = settingsSource.indexOf('function lyricsTab()')
  const end = settingsSource.indexOf('function playbackTab()')
  assert.ok(start >= 0 && end > start, 'settings.js still has a lyrics tab')
  return settingsSource.slice(start, end)
}

test('歌词页只保留真实生效的排版设置', () => {
  const tab = lyricsTabSource()
  // Dead keys of the removed classic list must not come back on this page.
  for (const dead of ['lyricSize', 'lyricGap', 'lyricBlur', 'lyricAlign', 'npLayoutV2']) {
    assert.doesNotMatch(tab, new RegExp('\\b' + dead + '\\b'), dead + ' has no consumer any more')
  }
  // One text-size control: the multiplier every style uses. The translation row keeps
  // Folia's fixed 90% ratio instead of a second, relative size slider.
  assert.match(tab, /prefs\.lyricsFontScale/, '歌词字号 reads the multiplier every style uses')
  assert.match(tab, /patchPrefs\(\{ lyricsFontScale: Number\(event\.target\.value\) \/ 100 \}\)/, 'the font-size slider writes a multiplier')
  assert.doesNotMatch(tab, /translationScale/, 'no second translation-size slider')
  assert.match(tab, /prefs\.showTranslation/, '显示 / 隐藏翻译 is still offered')
  assert.match(tab, /prefs\.subtitleOverlayBackground/, '字幕背景 is still offered')
  assert.match(tab, /subtitleBackgroundApplies/, '字幕背景 says when the current style ignores it')
})

test('歌词页的每个偏好键在设置页之外都有读取方', () => {
  const tab = lyricsTabSource()
  const used = [...new Set([...tab.matchAll(/prefs\.([A-Za-z0-9_]+)/g)].map((m) => m[1]))]
  assert.ok(used.length >= 8, 'the lyrics tab reads a realistic set of preferences')
  const others = clientFiles(clientDir)
    .filter((path) => path !== join(clientDir, 'components/ui/settings.js'))
    .map((path) => readFileSync(path, 'utf8'))
    .join('\n')
  for (const key of used) {
    assert.ok(others.includes(key), key + ' has no reader outside the settings page')
    assert.ok(prefsSource.includes(key + ':'), key + ' has a persisted default')
  }
})

test('被移除的经典排版键不再有默认值，旧的持久化值会被清掉', () => {
  for (const dead of ['lyricSize', 'lyricGap', 'lyricBlur', 'lyricAlign']) {
    assert.doesNotMatch(prefsSource, new RegExp('^\\s*' + dead + ':', 'm'), dead + ' is not a PREF_DEFAULTS key')
  }
  assert.match(prefsSource, /deadLyricKeys = \[[^\]]*'translationScale'\]/, 'stored values are dropped on read, including the retired translation scale')
  assert.match(prefsSource, /lyricsFontScale: 1/, 'the multiplier keeps a default')
  assert.doesNotMatch(prefsSource, /translationScale:/, 'the relative translation size is not a stored preference')
})

test('时计样式读取真实偏好，而不是写死的 1', () => {
  const pendolo = readFileSync(join(root, 'src/client/render/styles/folia-pendolo.js'), 'utf8')
  assert.match(pendolo, /prefs\.lyricsFontScale/, '字号倍率 reaches 时计')
  assert.match(pendolo, /prefs\.subtitleFontScale/, '译文字号 reaches 时计')
  assert.match(pendolo, /subtitleFontScale: subtitleFontScale/, 'the translation multiplier is passed through')
  assert.doesNotMatch(pendolo, /subtitleFontScale: 0\.9/, 'the old fixed 90% ratio is gone')
  assert.match(pendolo, /prefs\.showTranslation/, '翻译开关 reaches 时计')
  assert.doesNotMatch(pendolo, /lyricsFontScale: 1,/, 'the hardcoded multiplier is gone')
})

test('经典歌词列表的残留不再被打包', () => {
  const manifest = readFileSync(join(root, 'src/client/manifest.json'), 'utf8')
  assert.doesNotMatch(manifest, /lyrics-scroll\.js/, 'the inert auto-scroll hook is not a fragment')
  assert.doesNotMatch(manifest, /text-styles\.js/, 'the classic text renderer is not a fragment')
  const indexSource = readFileSync(join(root, 'src/client/components/ui/now-playing/index.js'), 'utf8')
  assert.doesNotMatch(indexSource, /useLyricAutoScroll/, 'the player does not wire a hook whose refs never connect')
  assert.doesNotMatch(indexSource, /--mp-lyric-size|--mp-line-gap|--mp-lyric-trans/, 'no dead CSS custom properties')
  const theme = readFileSync(join(root, 'src/client/styles/theme.js'), 'utf8')
  assert.doesNotMatch(theme, /mp-align-|mp-np\.is-blur|mp-np-line-trans/, 'the classic list CSS hooks are gone')
})

test('歌词页按 Folia 分组，插件自有设置落在「插件」组', () => {
  const tab = lyricsTabSource()
  for (const key of [
    'settings.lyricGroupSource',
    'settings.lyricGroupTiming',
    'settings.lyricGroupFormat',
    'settings.lyricGroupPlugin',
  ]) {
    assert.ok(settingsSource.includes(key), key + ' is one of the page groups')
  }
  for (const key of ['source', 'timing', 'format', 'plugin']) {
    assert.match(tab, new RegExp("lyricGroup\\('" + key + "'"), 'the ' + key + ' group renders')
  }
  // The plugin's own display controls live in the last group, not scattered over Folia's.
  const start = tab.indexOf('var pluginRows = [')
  const end = tab.indexOf('return [')
  assert.ok(start >= 0 && end > start, 'the plugin group is one block')
  const pluginRows = tab.slice(start, end)
  for (const key of [
    'showTranslation',
    'subtitleOverlayBackground',
    'lyricsFontScale',
    'composerLyrics',
    'composerTranslation',
  ]) {
    assert.ok(pluginRows.includes(key), key + ' sits in the plugin group')
  }
  // Folia's rows are in Folia's groups.
  const sourceRows = tab.slice(tab.indexOf('var sourceRows = ['), tab.indexOf('var timingRows = ['))
  for (const key of ['autoUseBestLyric', 'lyricPreferredSource', 'lyricKeepProviderWordTiming', 'lyricLocalPriority']) {
    assert.ok(sourceRows.includes(key), key + ' sits in 歌词来源')
  }
  const timingRows = tab.slice(tab.indexOf('var timingRows = ['), tab.indexOf('var segmentationRows = ['))
  assert.ok(timingRows.includes('setLyricOffsetOpen'), 'the global offset sits in 时间与过滤')
  assert.ok(timingRows.includes('setLyricFilterOpen'), 'the lyric filter sits in 时间与过滤')
})

test('保留平台逐字歌词与全局偏移都有真实消费者', () => {
  const loader = readFileSync(join(root, 'src/client/services/lyrics/loader.js'), 'utf8')
  assert.match(loader, /lyricKeepProviderWordTiming/, 'the keep-own switch is read by the loader')
  assert.match(loader, /only: preferred/, 'and narrows the upgrade to the preferred source')
  assert.match(loader, /requireWordLevel: true/, 'and refuses line-level answers')
  const indexSource = readFileSync(join(root, 'src/client/components/ui/now-playing/index.js'), 'utf8')
  assert.match(indexSource, /lyricClock\(time\.currentTime \+ clipStartSec, offsetMs, lyricGlobalOffsetMs\)/, 'the stage clock adds the preview clip start and the global offset')
  assert.match(indexSource, /offsetMs: offsetMs \+ lyricGlobalOffsetMs/, 'the style host clock gets the combined offset')
  assert.match(indexSource, /lyricFormatOrder\.join\(','\)/, 'a new sidecar order re-reads the current track')
  const foliaStyles = readFileSync(join(root, 'src/client/render/styles/folia-styles.js'), 'utf8')
  assert.match(foliaStyles, /player\.seek\(\(Number\(seconds\) \|\| 0\) - clipStartSec \+ offsetRef\.current\)/, 'line clicks are mapped back onto the clip and compensated for the offset')
  assert.match(foliaStyles, /subtitleContentMode: showTranslation \? 'translation' : 'none'/, 'Monet hides the translation with the mode, not a flag it ignores')
  const pendolo = readFileSync(join(root, 'src/client/render/styles/folia-pendolo.js'), 'utf8')
  assert.match(pendolo, /player\.seek\(\(Number\(seconds\) \|\| 0\) - clipStartSec \+ offsetRef\.current\)/, '时计 line clicks too')
  const composer = readFileSync(join(root, 'src/client/components/ui/composer.js'), 'utf8')
  assert.match(composer, /lyricClock\(time\.currentTime \+ composerClipStartSec, lyricOffsetMs, prefs\.lyricGlobalOffsetMs\)/, 'the composer strip uses the same clip-aware clock')
  assert.match(composer, /mpPrepareLyrics\(saved\.document, trackPath, saved\.chorusRanges\)/, 'a filter change re-bakes the composer strip too')
  assert.match(composer, /lyricSourceKey/, 'a source/priority change refreshes the composer strip')
  const lyrics = readFileSync(join(root, 'src/client/services/lyrics/lyrics.js'), 'utf8')
  assert.match(lyrics, /function lyricClock\(seconds, offsetMs, globalOffsetMs\)/, 'the clock adds both offsets')
  assert.match(prefsSource, /lyricKeepProviderWordTiming: true/, 'keep-own defaults on')
  assert.match(prefsSource, /lyricGlobalOffsetMs: 0/, 'the global offset defaults to zero')
  // The 分词 group was not wanted: its switch must not come back, and a stored value is dropped.
  assert.doesNotMatch(prefsSource, /^\s*lyricAutoWordSegmentation:/m, 'no segmentation preference is persisted')
  assert.doesNotMatch(settingsSource, /lyricSegmentationAuto|lyricGroupSegmentation/, 'no 分词 group or switch')
})

console.log('lyric-settings.test.mjs ok')
