/**
 * Volume control surfaces and the wheel contract.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (file) => readFileSync(join(root, file), 'utf8')
const control = read('src/client/components/ui/volume-control.js')
const p3 = read('src/client/panel-v3/p3-shell.js')
const player = read('src/client/components/ui/now-playing/index.js')
const sidebar = read('src/client/app/plugin.js')
const gallery = read('src/client/components/ui/component-gallery.js')
const theme = read('src/client/styles/theme.js')

test('the wheel changes volume by 5% and cannot scroll the page', () => {
  assert.match(control, /MP_VOLUME_WHEEL_STEP = 0\.05/)
  assert.match(control, /addEventListener\('wheel', onWheel, \{ passive: false \}\)/)
  assert.match(control, /event\.preventDefault\(\)/)
})

test('the sidebar, queue and player page all use the shared control', () => {
  assert.match(sidebar, /h\(VolumePopover,/)
  assert.match(sidebar, /data-volume-trigger/)
  assert.match(p3, /h\(VolumeControl, \{/)
  assert.match(p3, /className: 'mpv3-queue-foot'/)
  assert.match(player, /h\(VolumeControl, \{/)
})

test('the gallery case and layout hooks exist', () => {
  assert.match(gallery, /gallery\.caseVolume/)
  assert.match(theme, /'\.mp-volume\{display:inline-flex/)
  assert.match(theme, /'\.mp-np-meta-volume\{/)
  assert.match(theme, /'\.mp-volume-pop\{/)
})
test('one wheel notch is exactly 5% at the edges and from muted', () => {
  const sandbox = { clamp: (v, low, high) => Math.min(high, Math.max(low, v)) }
  vm.runInNewContext(control, sandbox)
  assert.equal(sandbox.mpVolumeWheelNext(0.5, false, -100), 0.55)
  assert.equal(sandbox.mpVolumeWheelNext(0.5, false, 100), 0.45)
  assert.equal(sandbox.mpVolumeWheelNext(0.98, false, -100), 1)
  assert.equal(sandbox.mpVolumeWheelNext(0.02, false, 100), 0)
  assert.equal(sandbox.mpVolumeWheelNext(0.7, true, -100), 0.05, 'scrolling up from muted starts at 5%')
})

console.log('volume-control.test.mjs ok')
