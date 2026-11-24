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
const primitives = read('src/client/components/ui/primitives.js')
const sheet = read('src/client/components/ui/player-sheet.js')
const p3 = read('src/client/panel-v3/p3-shell.js')
const player = read('src/client/components/ui/now-playing/index.js')
const sidebar = read('src/client/app/plugin.js')
const gallery = read('src/client/components/ui/component-gallery.js')
const theme = read('src/client/styles/theme.js')

test('one wheel contract feeds the volume slider and the appearance sliders', () => {
  assert.match(primitives, /MP_SLIDER_WHEEL_RATIO = 0\.05/)
  assert.match(primitives, /function useWheelStep\(nodeRef, onStep\)/)
  assert.match(primitives, /addEventListener\('wheel', onWheel, \{ passive: false \}\)/, 'the listener is native and non-passive')
  assert.match(primitives, /event\.preventDefault\(\)/, 'the slider owns the wheel, the page never scrolls')
  assert.match(control, /useWheelStep\(rootRef,/, 'the volume row uses the shared hook')
  assert.match(sheet, /useWheelStep\(rootRef,/, 'the appearance tuning rows use the same hook')
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
  vm.createContext(sandbox)
  vm.runInContext(primitives, sandbox)
  vm.runInContext(control, sandbox)
  assert.equal(sandbox.mpVolumeWheelNext(0.5, false, 1), 0.55)
  assert.equal(sandbox.mpVolumeWheelNext(0.5, false, -1), 0.45)
  assert.equal(sandbox.mpVolumeWheelNext(0.98, false, 1), 1)
  assert.equal(sandbox.mpVolumeWheelNext(0.02, false, -1), 0)
  assert.equal(sandbox.mpVolumeWheelNext(0.7, true, 1), 0.05, 'scrolling up from muted starts at 5%')
})

test('the tuning rows take 5% of their own range per notch, snapped to step', () => {
  const sandbox = { clamp: (v, low, high) => Math.min(high, Math.max(low, v)) }
  vm.createContext(sandbox)
  vm.runInContext(primitives, sandbox)
  assert.equal(sandbox.mpSliderWheelValue(1.05, 0, 2, 0.05, 1), 1.15, '5% of a 0..2 range is two 0.05 steps')
  assert.equal(sandbox.mpSliderWheelValue(0.95, 0, 2, 0.05, -1), 0.85)
  assert.equal(sandbox.mpSliderWheelValue(0, 0, 1, 0.01, 1), 0.05, 'a 0..1 range steps by 0.05, not 0.01')
  assert.equal(sandbox.mpSliderWheelValue(0.99, 0, 1, 0.01, 1), 1)
  assert.equal(sandbox.mpSliderWheelValue(180, 0, 180, 1, 1), 180, 'the range is clamped')
  assert.equal(sandbox.mpSliderWheelValue(0, 0, 180, 1, -1), 0)
  assert.equal(sandbox.mpSliderWheelValue(1, 0, 24, 1, 1), 2, 'a notch is at least one step')
  assert.equal(sandbox.mpSliderWheelValue(0.8, 0.5, 4, 0.1, 1), 1, '0.2-ish of a 0.5..4 range snaps to 0.1 steps')
})

console.log('volume-control.test.mjs ok')
