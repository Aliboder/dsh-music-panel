/**
 * Every lyric style the picker shows ships a real screenshot thumbnail.
 *
 * The picker draws a place-holder icon for any style missing from the map or from disk, so
 * the grid quietly lost two pictures (町景 / 流光) until someone looked. This keeps the three
 * lists in sync: the registered styles, the map in look-picker.js, and the .webp files.
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const styles = readFileSync(join(root, 'src/client/render/styles/folia-styles.js'), 'utf8')
const picker = readFileSync(join(root, 'src/client/components/ui/look-picker.js'), 'utf8')
const thumbDir = join(root, 'src/host/assets/lyric-style-thumbs')

// The picker's catalog: every real style, then the random pseudo-style that has no picture.
const ids = [...styles.matchAll(/\{ id: '([a-z]+)', labelKey: 'sheet\.foliaStyle[A-Za-z]+'/g)].map((match) => match[1])
assert.ok(ids.length >= 15, 'the style list parses: ' + ids.length)

const start = picker.indexOf('var MP_LYRIC_STYLE_THUMBS = {')
assert.ok(start >= 0, 'the thumbnail map exists')
const end = picker.indexOf('}', start)
const mapped = [...picker.slice(start, end).matchAll(/([a-z]+): '([a-z]+)'/g)].map((match) => [match[1], match[2]])
assert.ok(mapped.length >= 15, 'the thumbnail map parses: ' + mapped.length)

for (const [id, file] of mapped) {
  assert.equal(file, id, id + ' maps to its own file name')
  assert.ok(existsSync(join(thumbDir, file + '.webp')), id + ' ships ' + file + '.webp')
}
for (const id of ids) {
  assert.ok(mapped.some(([key]) => key === id), 'style ' + id + ' has a thumbnail')
}
assert.ok(!mapped.some(([key]) => key === 'random'), 'the random pseudo-style keeps the place-holder icon')

console.log('style-thumbs.test.mjs ok')