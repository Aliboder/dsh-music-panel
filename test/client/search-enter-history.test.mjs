/**
 * Search is committed by Enter, and recent queries live in prefs.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (file) => readFileSync(join(root, file), 'utf8')
const shell = read('src/client/panel-v3/p3-shell.js')
const prefs = read('src/client/stores/prefs.js')
const strings = read('src/client/i18n/strings.js')
const styles = read('src/client/panel-v3/p3-styles.js')

test('typing no longer commits a search', () => {
  const handler = shell.slice(shell.indexOf('function onChangeSearch'), shell.indexOf('function onSearchKey'))
  assert.doesNotMatch(handler, /p3SetSearchQuery\(value\)/)
  assert.match(handler, /setDraft\(value\)/)
  assert.match(handler, /p3SetSearchQuery\(''\)/)
})

test('Enter commits and records the query', () => {
  assert.match(shell, /event\.isComposing/) 
  assert.match(shell, /event\.key === 'Enter'/)
  assert.match(shell, /submitSearch\(draft\)/)
  assert.match(shell, /rememberSearch\(text\)/)
  assert.match(shell, /setPrefs\(\{ searchHistory: next \}\)/)
  assert.match(shell, /\.slice\(0, 8\)/)
})

test('recent searches render as a selectable dropdown with a clear action', () => {
  assert.match(shell, /className: 'mpv3-search-history'/)
  assert.match(shell, /pickHistory\(text\)/)
  assert.match(shell, /className: 'mpv3-search-history-clear'/)
  assert.match(strings, /'p3\.searchHistory': '搜索历史'/)
  assert.match(strings, /'p3\.searchHistory': 'Recent searches'/)
  assert.match(styles, /\.mpv3-search-clear \{/) 
  assert.match(styles, /\.mpv3-search-clear \{[\s\S]{0,120}position: absolute; right: 4px; top: 4px/) 
  assert.match(styles, /\.mpv3-search-history \{/)
})

test('the native search cancel button is hidden so only one clear × shows', () => {
  // The custom .mpv3-search-clear button is the one the plugin owns; <input type=search>
  // also paints Chromium's own cancel × unless the pseudo-element is removed.
  assert.match(styles, /\.mpv3-search input::-webkit-search-cancel-button/)
  assert.match(styles, /\.mpv3-search input::-webkit-search-decoration/)
  assert.match(styles, /display: none; -webkit-appearance: none; appearance: none;/)
  assert.match(shell, /className: 'mpv3-search-clear'/, 'the plugin clear button stays')
})

test('search history is a persisted preference cleared with plugin data', () => {
  assert.match(prefs, /searchHistory: \[\]/)
  assert.match(prefs, /var PREFS_KEY = 'music\.prefs\.v2'/)
})
console.log('search-enter-history.test.mjs ok')
