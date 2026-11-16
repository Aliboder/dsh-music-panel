/**
 * Source guard for the destructive "clear all plugin data" flow.
 *
 * The actual flow is UI-only (two modals + reload), so this test locks the
 * pieces that are easy to lose during refactors: the confirm token, the host
 * route, the two-step state, and the localStorage ownership prefixes.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const source = readFileSync(join(root, 'src/client/components/ui/settings.js'), 'utf8')

test('clear-all data flow keeps the confirm token and two-step UI', () => {
  assert.match(source, /data\/clear/)
  assert.match(source, /confirm:\s*'clear-all'/)
  assert.match(source, /setResetStage\(2\)/)
  assert.match(source, /data\.resetTitleFinal/)
  assert.match(source, /location\.reload/)
})

test('clear-all data flow covers plugin localStorage ownership prefixes', () => {
  for (const prefix of ["'music.'", "'dsh-music'", "'mu.'", "'lyric_'", "'visualizer_'", "'url_background_'", "'folia.dev.'"]) {
    assert.ok(source.includes(prefix), `missing localStorage prefix ${prefix}`)
  }
  assert.match(source, /_tuning/)
})
