#!/usr/bin/env node
/**
 * Build client.js from src/ fragments.
 *
 * The shipped artifact stays a single zero-build script for the host; this
 * script only concatenates the sources in an explicit order and fails on
 * duplicate top-level declarations (the 0.11.1 client had two).
 *
 *   node scripts/build-client.mjs            # write client.js
 *   node scripts/build-client.mjs --check    # fail if client.js is stale
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const PKG = JSON.parse(readFileSync(join(HERE, '..', 'package.json'), 'utf8'))
const ROOT = resolve(HERE, '..')
const OUT = join(ROOT, 'client.js')
const MODULE_ID = 'dsh-music-panel'

/** Explicit order: runtime → generated blocks → core → states → UI → plugin. */
const FILES = [
  'src/00-runtime.js',
  'src/vendor/00-react-global.js',
  'src/vendor/framer.bundle.js',
  'src/vendor/pixi.bundle.js',
  'src/vendor/three.bundle.js',
  'src/vendor/10-framer-aliases.js',
  'src/vendor/20-pixi-global.js',
  'src/vendor/30-three-global.js',
  'src/02-layers.js',
  'src/02-autoanimate.js',
  'src/00-host-ui.js',
  'src/render/folia/folia-css.js',
  'src/render/folia/folia-tailwind.js',
  'src/05-i18n.js',
  'src/06-strings.js',
  'src/10-base.js',
  'src/15-icons.js',
  'src/16-lyrics.js',
  'src/render/lyrics/lyrics.bundle.js',
  'src/17-list.js',
  'src/18-stats.js',
  'src/19-extra-icons.js',
  'src/20-api.js',
  'src/render/registry.js',
  'src/render/shell.js',
  'src/render/stage.js',
  'src/render/canvas-stage.js',
  'src/render/pixi-stage.js',
  'src/render/three-stage.js',
  'src/render/folia/pendolo.bundle.js',
  'src/render/styles/folia-audio.js',
  'src/render/styles/folia-pendolo.js',
  'src/render/folia/styles.bundle.js',
  'src/render/styles/folia-local-theme.js',
  'src/render/styles/folia-styles.js',
  'src/render/folia/backgrounds.bundle.js',
  'src/render/styles/folia-backdrop.js',
  'src/28-look.js',
  'src/30-prefs.js',
  'src/35-loudness.js',
  'src/35-provider-logos.js',
  'src/36-guide-shots.js',
  'src/40-eq.js',
  'src/40-store.js',
  'src/44-filter.js',
  'src/45-crossfade.js',
  'src/46-transition.js',
  'src/45-ui.js',
  'src/47-wave-color.js',
  'src/50-player.js',
  'src/60-library.js',
  'src/70-online.js',
  'src/47-likes.js',
  'src/48-volume-balance.js',
  'src/49-balance-meter.js',
  'src/80-overlay.js',
  'src/85-select.js',
  'src/90-theme.js',
  'src/ui/01-primitives.js',
  'src/ui/02-track-row.js',
  'src/ui/03-player-bar.js',
  'src/ui/04-eq-panel.js',
  'src/ui/04-player-page.js',
  'src/ui/04-now-playing.js',
  'src/ui/05-queue.js',
  'src/ui/06-settings.js',
  'src/ui/07-dialogs.js',
  'src/ui/08-local.js',
  'src/ui/09-online.js',
  'src/ui/20-player-sheet.js',
  'src/ui/21-lyric-match.js',
  'src/ui/22-lyric-preview.js',
  'src/ui/23-online-add.js',
  'src/ui/24-lyric-file.js',
  'src/ui/25-look-picker.js',
  'src/ui/26-fx.js',
  'src/ui/10-navigation.js',
  'src/ui/11-panel.js',
  'src/ui/12-composer.js',
  'src/ui/13-batch.js',
  'src/ui/14-online-lyric.js',
  'src/ui/15-trash.js',
  'src/ui/16-header.js',
  'src/ui/17-folder-picker.js',
  'src/ui/18-online-add.js',
  'src/ui/19-navidrome-dialog.js',
  'src/99-plugin.js',
]

function readFragments() {
  const out = []
  for (const relative of FILES) {
    const absolute = join(ROOT, relative)
    if (!existsSync(absolute)) {
      throw new Error(`missing fragment: ${relative}`)
    }
    const text = readFileSync(absolute, 'utf8').replace(/\r\n/g, '\n').trimEnd()
    if (text.trim() === '') throw new Error(`empty fragment: ${relative}`)
    out.push({ file: relative, text })
  }
  return out
}

/** Top-level declarations only: the factory shares one scope with all files. */
function topLevelNames(fragment) {
  const names = []
  const pattern = /^(?:function\s+([A-Za-z_$][\w$]*)\s*\(|var\s+([A-Za-z_$][\w$]*)|const\s+([A-Za-z_$][\w$]*)|let\s+([A-Za-z_$][\w$]*))/gm
  let match
  while ((match = pattern.exec(fragment.text)) !== null) {
    names.push(match[1] || match[2] || match[3] || match[4])
  }
  return names
}

function assertNoDuplicates(fragments) {
  const seen = new Map()
  const problems = []
  for (const fragment of fragments) {
    // Bundled vendor/scene fragments contain shader source strings whose GLSL
    // declarations look like JS declarations to the regex above; their top-level
    // surface is the single `__mp*Bundle` function.
    if (fragment.file.endsWith('.bundle.js')) continue
    for (const name of topLevelNames(fragment)) {
      if (seen.has(name)) {
        problems.push(`  ${name}: ${seen.get(name)} ↔ ${fragment.file}`)
      } else {
        seen.set(name, fragment.file)
      }
    }
  }
  if (problems.length > 0) {
    throw new Error(`duplicate top-level declarations:\n${problems.join('\n')}`)
  }
  return seen.size
}

function build() {
  const fragments = readFragments()
  const declared = assertNoDuplicates(fragments)
  // Indent only lines that have content: `^` also matches blank lines, which
  // turned every separator into four trailing spaces and made the generated
  // artifact fail `git diff --check`.
  const indent = (text) => text.replace(/^(?=.)/gm, '    ')
  const body = fragments
    .map((fragment) => `    // ── ${fragment.file}\n${indent(fragment.text)}`)
    .join('\n\n')
  const banner = `/**
 * dsh-music-panel — Web Client half.
 *
 * GENERATED FILE. Edit src/** instead, then run: node scripts/build-client.mjs
 */

`
  const output = `${banner}window.__ModuleLoader__.load({
  id: '${MODULE_ID}',
  factory: function (require) {
    'use strict'
    var APP_VERSION = ${JSON.stringify(PKG.version)}

${body}

    var plugin = {
      name: '${MODULE_ID}',
      inject: ['slots', 'locale'],
      apply: apply,
    }
    // Non-enumerable handles for tests and debugging; the host never sees them.
    try {
      Object.defineProperty(plugin, '__internals', {
        value: {
          uiStore: uiStore,
          libraryStore: libraryStore,
          onlineStore: onlineStore,
          prefsStore: prefsStore,
          overlayStore: overlayStore,
          selectionStore: selectionStore,
          player: player,
          lufsFromAudioBuffer: lufsFromAudioBuffer,
          analyzeLoudnessBlob: analyzeLoudnessBlob,
          mergeLyricTranslation: mergeLyricTranslation,
          buildTranslatedLrc: buildTranslatedLrc,
          formatLrcTime: formatLrcTime,
          // Pure pager math; the render mock cannot reach the paged branch.
          pageWindow: pageWindow,
          SONG_PAGE_SIZE: SONG_PAGE_SIZE,
          // Pure sidebar model, so tests can assert entries without matching
          // rendered copy (which shares words with empty-state text).
          navGroupsFor: navGroupsFor,          // Derived from UI_SOURCES; asserted so the music_control tool cannot
          // drift away from the provider list again.
          isOnlineSource: isOnlineSource,
          UI_SOURCES: UI_SOURCES,
          // The album entry point decides which view the user lands in; the
          // render mock cannot click a row, so the test drives it directly.
          openOnlineAlbum: openOnlineAlbum,
          // Equalizer: the panel renders in tests, and the curve maths is pure.
          AudioEffectsPanel: AudioEffectsPanel,
          // The player card renders in tests so a missing pane cannot ship silently.
          PlayerSheet: PlayerSheet,
          PlayerPage: PlayerPage,
          LyricMatchDialog: LyricMatchDialog,
          EqPanel: EqPanel,
          normalizeEqPrefs: normalizeEqPrefs,
          eqCurveSamples: eqCurveSamples,
          EQ_PRESETS: EQ_PRESETS,
          // The Folia port's boundary: tests assert the Line/Theme mapping it hands the
          // unmodified Folia renderer, and that the compiled bundle really loaded.
          foliaPendoloLines: typeof foliaPendoloLines === 'function' ? foliaPendoloLines : null,
          foliaPendoloTheme: typeof foliaPendoloTheme === 'function' ? foliaPendoloTheme : null,
          FOLIA_PENDOLO: typeof FOLIA_PENDOLO !== 'undefined' ? FOLIA_PENDOLO : null,
          FOLIA_BG: typeof FOLIA_BG !== 'undefined' ? FOLIA_BG : null,
          foliaBackgroundConfig: typeof foliaBackgroundConfig === 'function' ? foliaBackgroundConfig : null,
          // Folia's band maths (folia-audio.js): pure, so a test can feed it a wave.
          foliaAudioBandsFromWave: typeof foliaAudioBandsFromWave === 'function' ? foliaAudioBandsFromWave : null,
          // Lyric pipeline: the Folia document → renderer lines bridge, and the Folia Line
          // conversion the styles use; tests assert fields survive the two hops.
          linesFromFoliaDocument: typeof linesFromFoliaDocument === 'function' ? linesFromFoliaDocument : null,
          lyricFilterRules: typeof lyricFilterRules === 'function' ? lyricFilterRules : null,
          readSavedLyricOffset: typeof readSavedLyricOffset === 'function' ? readSavedLyricOffset : null,
          rememberLyricOffset: typeof rememberLyricOffset === 'function' ? rememberLyricOffset : null,
          foliaPendoloLines: typeof foliaPendoloLines === 'function' ? foliaPendoloLines : null,
          foliaAudioBands: typeof foliaAudioBands === 'function' ? foliaAudioBands : null,
          // Local theme generation (folia-local-theme.js): pure build + store.
          mpBuildLocalTheme: typeof mpBuildLocalTheme === 'function' ? mpBuildLocalTheme : null,
          mpLocalMoodOf: typeof mpLocalMoodOf === 'function' ? mpLocalMoodOf : null,
          mpLocalWords: typeof mpLocalWords === 'function' ? mpLocalWords : null,
          mpGenerateLocalThemeForSong: typeof mpGenerateLocalThemeForSong === 'function' ? mpGenerateLocalThemeForSong : null,
          mpGetLocalTheme: typeof mpGetLocalTheme === 'function' ? mpGetLocalTheme : null,
          FOLIA_STYLES: typeof FOLIA_STYLES !== 'undefined' ? FOLIA_STYLES : null,
          FOLIA_STYLE_META: typeof FOLIA_STYLE_META !== 'undefined' ? FOLIA_STYLE_META : null,
          mpStyleCatalog: typeof mpStyleCatalog !== 'undefined' ? mpStyleCatalog : null,
          mpStyleOf: typeof mpStyleOf !== 'undefined' ? mpStyleOf : null,
        },
        enumerable: false,
      })
    } catch (error) {
      // Older engines without defineProperty simply skip the hook.
    }
    return plugin
  },
})
`
  return { output, declared, fragments: fragments.length }
}

const result = build()
const check = process.argv.includes('--check')

if (check) {
  const current = existsSync(OUT) ? readFileSync(OUT, 'utf8') : ''
  if (current !== result.output) {
    console.error('client.js is stale. Run: node scripts/build-client.mjs')
    process.exit(1)
  }
  console.log(`client.js up to date (${result.fragments} fragments, ${result.declared} top-level names)`)
} else {
  writeFileSync(OUT, result.output, 'utf8')
  console.log(
    `client.js written: ${result.fragments} fragments, ${result.declared} top-level names, ${result.output.length} bytes`,
  )
}








