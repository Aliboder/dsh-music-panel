/**
 * The composer lyric strip must survive the host's hero (empty-session) layout.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const theme = readFileSync(join(root, 'src/client/styles/theme.js'), 'utf8')
const rule = theme.slice(theme.indexOf('.mp-composer-lyrics{'), theme.indexOf('.mp-composer-lyric-icon{'))

test('the strip keeps its own height in a tight composer stack', () => {
  assert.match(rule, /flex:0 0 auto/, 'flex: none prevents the hero stack from squeezing it')
  assert.match(rule, /min-height:calc\(24px \+ var\(--dsh-content-font-delta,0px\)\)/)
  assert.doesNotMatch(rule, /[^-]height:calc\(24px/, 'no fixed height that a flex parent can shrink')
  assert.match(rule, /overflow:visible/, 'the outer box does not clip the line')
})

test('the viewport still owns the horizontal clip', () => {
  const viewport = theme.slice(theme.indexOf('.mp-composer-lyric-viewport{'), theme.indexOf('.mp-composer-lyric-layer{'))
  assert.match(viewport, /height:calc\(20px \+ var\(--dsh-content-font-delta,0px\)\)/)
  assert.match(viewport, /overflow:hidden/)
})
console.log('composer-lyrics-layout.test.mjs ok')
