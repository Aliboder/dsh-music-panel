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

/** Explicit order comes from src/client/manifest.json; never infer from prefixes. */
const MANIFEST = join(ROOT, 'src/client/manifest.json')
function readManifest() {
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'))
  if (manifest === null || manifest.version !== 1 || !Array.isArray(manifest.fragments)) {
    throw new Error('src/client/manifest.json must be { version: 1, fragments: [] }')
  }
  if (manifest.fragments.length === 0) throw new Error('client manifest is empty')
  const seen = new Set()
  for (const relative of manifest.fragments) {
    if (typeof relative !== 'string' || relative === '' || relative.includes('..')) {
      throw new Error(`invalid fragment path: ${relative}`)
    }
    if (seen.has(relative)) throw new Error(`duplicate fragment: ${relative}`)
    seen.add(relative)
  }
  return manifest.fragments
}
const FILES = readManifest()

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
          // The Folia audio subsystem bundle: tests can build a graph with a fake context.
          MPAudio: typeof __mpAudioBundle === 'function' ? __mpAudioBundle() : null,
          createFoliaGraph: typeof createFoliaGraph === 'function' ? createFoliaGraph : null,
          createFoliaTransport: typeof createFoliaTransport === 'function' ? createFoliaTransport : null,
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
          // Random lyric style: the per-song shuffle and slot maths are pure, so a
          // test can assert the order and boundaries without mounting a renderer.
          mpRandomStyleOrder: typeof mpRandomStyleOrder === 'function' ? mpRandomStyleOrder : null,
          mpResolveLyricStyle: typeof mpResolveLyricStyle === 'function' ? mpResolveLyricStyle : null,
          mpStylePickerCatalog: typeof mpStylePickerCatalog === 'function' ? mpStylePickerCatalog : null,
          mpStyleIdOf: typeof mpStyleIdOf === 'function' ? mpStyleIdOf : null,
          mpStyleLabelOf: typeof mpStyleLabelOf === 'function' ? mpStyleLabelOf : null,
          MP_RANDOM_STYLE_ID: typeof MP_RANDOM_STYLE_ID === 'string' ? MP_RANDOM_STYLE_ID : null,
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
          foliaLyricLines: typeof foliaLyricLines === 'function' ? foliaLyricLines : null,
          legacyLinesToFolia: typeof legacyLinesToFolia === 'function' ? legacyLinesToFolia : null,
          mpLineStart: typeof mpLineStart === 'function' ? mpLineStart : null,
          lyricActiveIndex: typeof lyricActiveIndex === 'function' ? lyricActiveIndex : null,
          foliaStyleLines: typeof foliaStyleLines === 'function' ? foliaStyleLines : null,
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
          // Saved word segmentation (Folia's lyricSegmentationRecord): the dialog test drives
          // the exchange end to end, and the display pass must bake what it saved.
          MPFoliaLyrics: typeof MPFoliaLyrics !== 'undefined' ? MPFoliaLyrics : null,
          LyricSegmentationDialog: LyricSegmentationDialog,
          readLyricSegmentation: typeof readLyricSegmentation === 'function' ? readLyricSegmentation : null,
          saveLyricSegmentation: typeof saveLyricSegmentation === 'function' ? saveLyricSegmentation : null,
          mpSegmentationLineCount: typeof mpSegmentationLineCount === 'function' ? mpSegmentationLineCount : null,
          mpPrepareLyrics: typeof mpPrepareLyrics === 'function' ? mpPrepareLyrics : null,
          mpLocalLyricLines: typeof mpLocalLyricLines === 'function' ? mpLocalLyricLines : null,
          mpStyleCatalog: typeof mpStyleCatalog !== 'undefined' ? mpStyleCatalog : null,
          mpStyleOf: typeof mpStyleOf !== 'undefined' ? mpStyleOf : null,
          // The component test page (settings → about): a render test mounts it to keep
          // every shared control wired.
          ComponentGallery: typeof ComponentGallery === 'function' ? ComponentGallery : null,
          SettingsSheet: typeof SettingsSheet === 'function' ? SettingsSheet : null,
          LoginDialog: typeof LoginDialog === 'function' ? LoginDialog : null,
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









