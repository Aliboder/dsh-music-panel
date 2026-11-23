/**
 * Headphone preset browser is shared by the EQ panel and the audio-effects window.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (file) => readFileSync(join(root, file), 'utf8')
const browser = read('src/client/components/ui/eq-device-browser.js')
const panel = read('src/client/components/ui/eq-panel.js')
const window = read('src/client/components/ui/audio-equalizer.js')
const strings = read('src/client/i18n/strings.js')

test('the AutoEQ browser owns search, paging and selection', () => {
  assert.match(browser, /function EqDeviceBrowser\(props\)/)
  assert.match(browser, /eq\/presets\?q=/)
  assert.match(browser, /EQ_DEVICE_PAGE/)
  assert.match(browser, /props\.onChange\(entry\)/)
})

test('both equalizer surfaces mount the shared browser', () => {
  assert.match(panel, /h\(EqDeviceBrowser, \{/)
  assert.match(panel, /tab === 'device'/)
  assert.match(window, /h\(EqDeviceBrowser, \{/)
  assert.match(window, /eq\.headphonePresets/)
  assert.match(window, /AUDIO_EQ_BUILTIN_PRESET_IDS[\s\S]{0,40}\.concat\(\['device'\]\)/)
  assert.match(window, /id === 'device' \? deviceTab/)
})

test('the window labels the headphone preset section in both languages', () => {
  assert.match(strings, /'eq\.headphonePresets': '耳机预设'/)
  assert.match(strings, /'eq\.headphonePresets': 'Headphone presets'/)
  assert.match(strings, /'eq\.devicePresets': '设备预设'/)
  assert.match(strings, /'eq\.devicePresets': 'Device presets'/)
})
console.log('eq-headphone-presets.test.mjs ok')
