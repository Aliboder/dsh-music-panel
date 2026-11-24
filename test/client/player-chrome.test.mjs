/**
 * The player chrome auto-hide is a port of Folia's usePlayerChromeAutoHide:
 * window-level mouseout/mousemove, 3 s after movement and 300 ms after leaving.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const ROOT = join(import.meta.dirname, '..', '..')
const source = readFileSync(join(ROOT, 'src/client/components/ui/now-playing/index.js'), 'utf8')
const theme = readFileSync(join(ROOT, 'src/client/styles/theme.js'), 'utf8')

test('player chrome follows Folia auto-hide timing', () => {
  assert.match(source, /window\.addEventListener\('mouseout'/, 'leaving the window is observed')
  assert.match(source, /window\.addEventListener\('mousemove'/, 'movement wakes the chrome')
  assert.match(source, /window\.addEventListener\('wheel'/, 'wheel wakes the chrome')
  assert.match(source, /schedule\(3000\)/, 'idle delay is 3 s')
  assert.match(source, /schedule\(300\)/, 'leaving the window hides after 300 ms')
  assert.match(source, /var held = false/, 'pointer hold keeps the chrome up')
})

test('hidden chrome targets the controls that actually render', () => {
  assert.match(theme, /\.mp-np\.is-chrome-hidden \.mp-np-pill/, 'the transport pill hides')
  assert.match(theme, /\.mp-np\.is-chrome-hidden \.mp-np-secondary/, 'the secondary actions hide')
})

test('legacy auto-hide preference still enables the mode', () => {
  assert.match(source, /autoHidePlayerChrome === true/, 'old saved switches map to auto-hide')
})

test('player chrome no longer listens on the page root only', () => {
  assert.doesNotMatch(source, /root\.addEventListener\('pointermove'/, 'Folia listens on window, not the stage root')
})
