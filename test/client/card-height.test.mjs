/**
 * The player card is bottom-anchored; its expanded height must never exceed the viewport.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const sheet = readFileSync(join(root, 'src/client/components/ui/player-sheet.js'), 'utf8')

test('the body is clamped with the real viewport and bottom anchor', () => {
  assert.match(sheet, /function clampCardBodyHeight\(measured, viewport, bottom, topClearance\)/)
  assert.match(sheet, /var gap = bottom >= 0 \? bottom : MP_BOTTOM_GAP/)
  assert.match(sheet, /MP_BODY_GAP - MP_BODY_LINE - MP_BODY_UNDER/)
  assert.match(sheet, /clampCardBodyHeight\(el\.scrollHeight, viewportH, cardBottom\)/)
  assert.match(sheet, /var cardBottom = props\.anchor && props\.anchor\.bottom >= 0/)
})

test('the surface and the cover are capped by the free height', () => {
  assert.match(sheet, /var cardMaxH = Math\.max\(240, viewportForLayout - MP_TOP_MARGIN - cardBottom\)/)
  assert.match(sheet, /var coverRoom = cardMaxH - MP_PADDING \* 2 - MP_DOCK_HEIGHT - MP_DOCK_GAP - MP_COVER_GAP - underHForLayout/)
  assert.match(sheet, /min\(336px, 52vh, /)
  assert.match(sheet, /maxHeight: 'max\(240px, calc\(100% - '/)
  assert.doesNotMatch(sheet, /maxHeight:[\s\S]{0,120}100dvh/)
})

test('the top edge clears the player page fullscreen button', () => {
  // The card root is `position:fixed;inset:0` inside the player page, and `.mp-np-fs` is a
  // sibling in that same box (top 22 + 36 tall). The max height is expressed as a percentage
  // of that box, so the card's top cannot reach the button whatever the window does.
  assert.match(sheet, /var MP_TOP_MARGIN = 70/)
  assert.match(sheet, /maxHeight: 'max\(240px, calc\(100% - ' \+ String\(MP_TOP_MARGIN\) \+ 'px - ' \+ String\(cardBottom\) \+ 'px\)\)'/) 
})

test('resizing the window re-clamps the body', () => {
  assert.match(sheet, /window\.addEventListener\('resize', update\)/)
  assert.match(sheet, /setViewportH\(window\.innerHeight \|\| 800\)/)
})
console.log('card-height.test.mjs ok')
