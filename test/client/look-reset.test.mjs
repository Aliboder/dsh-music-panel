/**
 * 外观 → 样式参数 的重置：当前歌词样式的调参对象回到出厂默认，并给出提示。
 * Folia 的 tuning 默认就在各样式的 DEFAULT_*_TUNING 里；这里是插件 PREF_DEFAULTS 的同一份。
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (path) => readFileSync(join(root, path), 'utf8')

test('prefs exposes a deep-copied factory default', () => {
  const prefs = read('src/client/stores/prefs.js')
  assert.match(prefs, /function prefDefaultOf\(key\)/)
  assert.match(prefs, /var value = PREF_DEFAULTS\[key\]/)
  assert.match(prefs, /return JSON\.parse\(JSON\.stringify\(value\)\)/, 'the default is copied, never shared')
})

test('every lyric style has a tuning preference to reset', () => {
  const sheet = read('src/client/components/ui/player-sheet.js')
  const block = sheet.slice(sheet.indexOf('var STYLE_TUNING_PREF = {'), sheet.indexOf('/** 样式参数的重置'))
  for (const style of [
    'classic', 'tilt', 'partita', 'fume', 'claddagh', 'hanabi', 'cadenza', 'sonnet',
    'monet', 'machi', 'lumiere', 'pendolo', 'diorama', 'tempera', 'nebbia', 'metaphor',
  ]) {
    assert.ok(block.includes(style + ':'), style + ' has a tuning key')
  }
  assert.match(sheet, /var key = STYLE_TUNING_PREF\[style\]/)
  assert.match(sheet, /var defaults = prefDefaultOf\(key\)/)
  assert.match(sheet, /setPrefs\(\{ \[key\]: defaults \}\)/, 'the reset writes the factory default back')
  assert.match(sheet, /showToast\(t\('sheet\.styleParamsReset'\)\)/)
})

test('the section header carries the reset button', () => {
  const sheet = read('src/client/components/ui/player-sheet.js')
  assert.match(sheet, /function mpSection\(title, children, action\)/)
  assert.match(sheet, /action === undefined \|\| action === null \? null : action/)
  assert.match(sheet, /t\('sheet\.resetStyleParams'\), resetStyleParams/, 'the look tab renders it')
  assert.match(sheet, /cardButton\(t\('sheet\.resetStyleParams'\)/, 'it is the shared button, not a new control')
  const strings = read('src/client/i18n/strings.js')
  for (const key of ['sheet.resetStyleParams', 'sheet.styleParamsReset']) {
    assert.equal(strings.split("'" + key + "':").length, 3, key + ' has a zh and an en string')
  }
})

console.log('look-reset.test.mjs ok')
