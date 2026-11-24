/**
 * The player card is four pages, one subject each.
 *
 * The card renders only the open page, so this guard reads the pane functions themselves:
 * a control that was moved must be in exactly one page, and the pages that lost it must not
 * still carry it. It is the cheapest way to catch a move that was half done.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const sheet = readFileSync(join(root, 'src/client/components/ui/player-sheet.js'), 'utf8')

function paneSource(name) {
  const start = sheet.indexOf('function ' + name + '(')
  assert.ok(start >= 0, name + ' still exists')
  const next = sheet.indexOf('\n  function ', start + 1)
  return sheet.slice(start, next > start ? next : sheet.length)
}

const lyrics = paneSource('cardLyricsPane')
const audio = paneSource('cardAudioPane')
const look = paneSource('cardLookPane')
const queue = paneSource('cardQueuePane')

test('five tabs, one subject each', () => {
  assert.match(
    sheet,
    /var TABS = \['sheet\.song', 'sheet\.lyrics', 'sheet\.queue', 'sheet\.audio', 'sheet\.look'\]/,
    'the dock is 歌曲 / 歌词 / 队列 / 音频 / 外观',
  )
  assert.match(sheet, /var bodies = \[null, cardLyricsPane\(\), cardQueuePane\(\), cardAudioPane\(\), cardLookPane\(\)\]/, 'the pages line up with the tabs')
  assert.match(sheet, /h\(KitSegmentedTabs, \{/, 'the dock is the official SegmentedTabs')
})

test('队列 page: Folia row, move and remove actions', () => {
  assert.match(queue, /mp-queue-row/, 'the queue renders Folia rows')
  assert.match(queue, /player\.reorderQueue/, 'move next/end uses the player order')
  assert.match(queue, /player\.removeQueueAt/, 'remove uses the player queue')
})

test('歌词 page: source, timeline, match/file, word split and style', () => {
  for (const key of ['sheet.lyrics', 'sheet.lyricOffset', 'sheet.matchOnline', 'sheet.lyricFile']) {
    assert.ok(lyrics.includes("t('" + key + "')"), key + ' stays on the lyrics page')
  }
  assert.match(lyrics, /lyricSegRow\(\)/, 'the word split is on the lyrics page')
  assert.match(lyrics, /lyricLookBlock\(\)/, 'the lyric style is on the lyrics page')
  assert.doesNotMatch(lyrics, /sheet\.audioGain/, 'the gain control left the lyrics page')
})

test('歌词显示 has named controls, not glyph-only buttons', () => {
  const style = paneSource('lyricLookBlock')
  for (const key of ['settings.lyricIntensity', 'sheet.showTranslation', 'settings.lyricFontScale']) {
    assert.ok(style.includes("t('" + key + "')"), key + ' is labelled in the lyric display group')
  }
  assert.match(style, /segmented\(/, '歌词动态 is a segmented choice (KitSegmented)')
  assert.match(style, /mpScaleStepper\(/, 'the two size rows are steppers with a percentage')
  assert.match(style, /classicTuningBlock\(\)/, 'classic exposes its Folia tuning')
  assert.match(style, /tiltTuningBlock\(\)/, 'tilt exposes its Folia tuning')
  assert.match(style, /partitaTuningBlock\(\)/, 'partita exposes its Folia tuning')
  assert.match(style, /fumeTuningBlock\(\)/, 'fume exposes its Folia tuning')
  assert.match(style, /claddaghTuningBlock\(\)/, 'claddagh exposes its Folia tuning')
  assert.match(style, /hanabiTuningBlock\(\)/, 'hanabi exposes its Folia tuning')
  assert.match(style, /cadenzaTuningBlock\(\)/, 'cadenza exposes its Folia tuning')
  assert.match(style, /sonnetTuningBlock\(\)/, 'sonnet exposes its Folia tuning')
  assert.match(style, /cappellaTuningBlock\(\)/, 'cappella exposes its Folia tuning')
  assert.doesNotMatch(style, /mpSmallButton\('≡'/, 'the wired ≡ glyph is gone')
  assert.doesNotMatch(style, /mpSmallButton\('≋'/, 'the wired ≋ glyph is gone')
})

test('音频 page: quality, volume, play mode, fade, gain and the effects window', () => {
  for (const key of ['sheet.quality', 'sheet.playMode', 'sheet.smartFade', 'sheet.effects']) {
    assert.ok(audio.includes("t('" + key + "')"), key + ' is on the audio page')
  }
  assert.match(audio, /volumeBlock\(\)/, 'the volume row is on the audio page')
  assert.match(audio, /gainBlock\(\)/, 'the gain block is the one the lyrics page used to hold')
  assert.match(sheet, /function gainBlock\(\)[\s\S]{0,600}sheet\.audioGain/, 'the gain block keeps its label')
  assert.match(audio, /autoHidePlayerChrome/, 'the chrome auto-hide switch is on the audio page')
  assert.match(sheet, /function volumeBlock\(\)/, 'the volume block exists')
  assert.doesNotMatch(audio, /sheet\.lyricSegmentation/, 'the word split left the audio page')
  assert.doesNotMatch(audio, /sheet\.provider|sheet\.account/, 'platform and account facts left the card')
})

test('外观 page: background and theme, and nothing that makes sound', () => {
  for (const key of ['sheet.background', 'sheet.theme', 'sheet.backgroundSection']) {
    assert.ok(look.includes("t('" + key + "')"), key + ' is on the look page')
  }
  assert.doesNotMatch(look, /sheet\.volume/, 'the volume row is on the audio page, not here')
  assert.doesNotMatch(look, /sheet\.lyricStyle/, 'the lyric style left the look page')
  assert.doesNotMatch(look, /sheet\.smartFade|sheet\.effects/, 'sound controls left the look page')
  assert.doesNotMatch(look, /player\.setLoop/, 'the play mode left the look page')
})

test('opening the queue locates the playing row without jumping under a click', () => {
  const shell = readFileSync(join(root, 'src/client/panel-v3/p3-shell.js'), 'utf8')
  assert.match(shell, /if \(rowRect\.top >= listRect\.top && rowRect\.bottom <= listRect\.bottom\) return/, 'a row already on screen is left alone')
  assert.match(shell, /\}, \[props\.open\]\)/, 'the scroll runs when the queue opens, not on every track change')
  assert.match(shell, /schedule\(place\)/, 'a hidden popover is measured again on the next frame')
})

test('the cover header reserves the measured title block, not a fixed guess', () => {
  assert.match(sheet, /underHForLayout = underH > 0 \? underH : 114/, 'the one-line fallback is explicit')
  assert.match(sheet, /headerH = isCover[\s\S]{0,220}underHForLayout/, 'the header uses the measured height')
  assert.doesNotMatch(sheet, /\+ 108px\)/, 'the old fixed reserve that slid a wrapped title onto the cover is gone')
  assert.match(sheet, /underRef = useRef\(null\)/, 'the under block is measured through a ref')
  assert.match(sheet, /setUnderH\(el\.offsetHeight\)/, 'its real height feeds the header')
})

test('the song page keeps its actions and drops the settings gear', () => {
  const actions = sheet.slice(sheet.indexOf('function actionsRow()'), sheet.indexOf('function actionsRow()') + 4200)
  assert.match(actions, /iconButton\(\s*'favorite'/, 'the heart stays')
  assert.match(actions, /iconButton\(\s*'addToPlaylist'/, 'the star stays')
  assert.match(actions, /'locate'/, 'the locate control stays')
  assert.match(actions, /iconButton\(\s*'outputDevice'/, 'the output device is the fourth action')
  assert.doesNotMatch(actions, /iconButton\(\s*'settings'/, 'the gear moved to the panel header')
  assert.doesNotMatch(actions, /iconButton\(\s*'home'/, 'the home button gave its place to the device button')
})
console.log('sheet-pages.test.mjs ok')
