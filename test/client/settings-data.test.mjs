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
const composerSource = readFileSync(join(root, 'src/client/components/ui/composer.js'), 'utf8')
const i18nSource = readFileSync(join(root, 'src/client/i18n/i18n.js'), 'utf8')
const profileSource = readFileSync(join(root, 'src/client/services/player/effects/profile.js'), 'utf8')

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
  // Folia's 歌词来源 page restored this switch: a platform's own word timing is kept
  // unless the preferred source has word timing too.
  assert.match(prefsSource, /lyricKeepProviderWordTiming: true/, 'the keep-own-word-timing switch has a default')
  assert.match(source, /settings\.lyricKeepProviderWordTiming/, 'and a settings row')
  for (const dead of ['bgBlend', 'composerLyricPlace', 'coverStyle', 'npTransparentBg']) {
    assert.doesNotMatch(prefsSource, new RegExp(dead), `${dead} was removed from PREF_DEFAULTS`)
    assert.doesNotMatch(source, new RegExp(dead), `${dead} has no settings UI`)
  }
  assert.match(prefsSource, /replayGainMode: 'auto'/, 'replay gain has a default')
  assert.match(source, /voiceInputPause/, 'Folia voice-input pause has a settings row')
  assert.match(source, /audioFocusDucking/, 'external TTS ducking has a settings row')
  assert.match(prefsSource, /audioFocusDuckLevel/, 'ducking level has a persisted default')
})

test('the composer seat is one list button, hidden by its own switch', () => {
  const start = composerSource.indexOf('function ComposerCluster')
  const end = composerSource.length
  assert.ok(start >= 0 && end > start, 'ComposerCluster still exists')
  const cluster = composerSource.slice(start, end)
  assert.match(cluster, /data-queue-toggle/, 'the seat opens the queue')
  assert.equal(
    (cluster.match(/mp-cbtn/g) || []).length,
    1,
    'the seat renders one button: pause/resume lives in the sidebar transport, not here',
  )
  assert.doesNotMatch(cluster, /player\.toggle/, 'the seat carries no transport action')
  assert.match(cluster, /prefs\.composerListButton === false/, 'the switch removes the seat')
  // The button pops the queue out beside itself: leaving the chat to the panel was the bug.
  assert.match(cluster, /onClick: toggle/, 'the seat toggles a popover instead of leaving the page')
  assert.match(cluster, /function toggle\(event\)[\s\S]{0,260}setOpen\(\!open\)/, 'the toggle flips a local popover')
  assert.match(cluster, /h\(P3Queue, \{/, 'the popover is the panel queue, one implementation')
  assert.match(composerSource, /function composerQueueStyle\(rect\)/, 'the popover position is computed from the button rect')
  assert.match(cluster, /\{ rect: anchor \}/, 'the popover is anchored to the button')
  assert.match(composerSource, /popover: 'manual'/, 'the top layer keeps a transformed host ancestor from clipping it')
  assert.match(prefsSource, /composerListButton: true/, 'the seat is shown by default')
  assert.match(source, /settings\.composerListButton/, 'the switch has a settings row')
  for (const key of ['settings.composerListButton', 'settings.composerListButtonDesc']) {
    assert.equal(
      (i18nSource.match(new RegExp("'" + key.replace(/\./g, '\\.') + "':", 'g')) || []).length,
      2,
      key + ' is defined in zh and en',
    )
  }
})

test('profile storage is covered by the music. clear prefix', () => {
  assert.match(profileSource, /music\.profile\.v1/, 'profile storage lives under music.')
  assert.match(source, /'music\.'/, 'clear-all removes the music. prefix')
})

test('clear-all data flow covers plugin localStorage ownership prefixes', () => {
  for (const prefix of ["'music.'", "'dsh-music'", "'mu.'", "'lyric_'", "'visualizer_'", "'url_background_'", "'folia.dev.'"]) {
    assert.ok(source.includes(prefix), `missing localStorage prefix ${prefix}`)
  }
  assert.match(source, /_tuning/)
})
