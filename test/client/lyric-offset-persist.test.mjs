/**
 * Lyric timeline offset must survive leaving and re-entering the player.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const index = readFileSync(join(root, 'src/client/components/ui/now-playing/index.js'), 'utf8')
const loader = readFileSync(join(root, 'src/client/services/lyrics/loader.js'), 'utf8')

test('every offset edit persists to the per-song memory', () => {
  assert.match(index, /function setLyricOffset\(value\)/)
  assert.match(index, /Math\.max\(-60000, Math\.min\(60000, Number\(value\) \|\| 0\)\)/)
  assert.match(index, /rememberLyricOffset\(trackPath, next\)/)
  assert.match(index, /function applyOffset\(delta\)[\s\S]{0,180}setLyricOffset\(offsetMs \+ delta\)/)
})

test('the player card uses the persistent handler, not the raw setter', () => {
  assert.match(index, /onOffsetChange: setLyricOffset/)
  assert.doesNotMatch(index, /onOffsetChange: setOffsetMs/)
})

test('the loader restores the saved offset when the song loads again', () => {
  assert.match(loader, /result\.offsetMs = readSavedLyricOffset\(key\)/)
  assert.match(loader, /offsetMs: Number\(body\.offsetMs\) \|\| readSavedLyricOffset\(key\)/)
})
console.log('lyric-offset-persist.test.mjs ok')
