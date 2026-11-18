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
const prefsSource = readFileSync(join(root, 'src/client/stores/prefs.js'), 'utf8')

test('clear-all data flow keeps the confirm token and two-step UI', () => {
  assert.match(source, /data\/clear/)
  assert.match(source, /confirm:\s*'clear-all'/)
  assert.match(source, /setResetStage\(2\)/)
  assert.match(source, /data\.resetTitleFinal/)
  assert.match(source, /location\.reload/)
})

test('clear-all data flow covers the panel-v3 navigation key', () => {
  const route = readFileSync(join(root, 'src/client/panel-v3/p3-nav.js'), 'utf8')
  assert.match(route, /music\.ui\.v4/, 'the new route key lives under the cleared music. prefix')
  assert.match(route, /music\.ui\.v3/, 'the v3 route key is still read for migration')
  assert.match(route, /music\.ui\.v2/, 'the old route key is still read for migration')
})

test('settings page reflects current features and no dead preferences', () => {
  assert.match(source, /onlineQuality/, 'online quality is configurable')
  assert.match(source, /LookChoiceGrid/, 'Folia lyric style and background pickers are in settings')
  assert.match(source, /settings.crossfadeSeconds/, 'crossfade duration is configurable')
  assert.match(source, /about.diagnostics/, 'Host diagnosis lives under About')
  for (const dead of ['bgBlend', 'composerLyricPlace', 'lyricKeepProviderWordTiming', 'coverStyle', 'npTransparentBg']) {
    assert.doesNotMatch(prefsSource, new RegExp(dead), `${dead} was removed from PREF_DEFAULTS`)
    assert.doesNotMatch(source, new RegExp(dead), `${dead} has no settings UI`)
  }
  assert.match(prefsSource, /replayGainMode: 'auto'/, 'replay gain has a default')
})

test('clear-all data flow covers plugin localStorage ownership prefixes', () => {
  for (const prefix of ["'music.'", "'dsh-music'", "'mu.'", "'lyric_'", "'visualizer_'", "'url_background_'", "'folia.dev.'"]) {
    assert.ok(source.includes(prefix), `missing localStorage prefix ${prefix}`)
  }
  assert.match(source, /_tuning/)
})
