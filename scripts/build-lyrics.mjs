#!/usr/bin/env node
/**
 * Build Folia's lyric pipeline into an IIFE for the plugin's client.
 *
 * The ported sources live at src/client/utils/lyrics/** (verbatim Folia) and import
 * ../../types, which resolves to src/shared/types.ts (the same module as
 * src/folia/types.ts).
 *
 * Usage: node scripts/build-lyrics.mjs
 */

import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

// The lyric worker is inline here: the bundle is one script with no worker asset.
// Folia's icu-folia engines import two Vite virtual modules. The plugin never takes that
// path (it loads the same data from the Host and passes a loader to loadIcuFolia), so the
// ids resolve to empty stubs and the dynamic import stays harmless.
const icuFoliaStubs = {
  name: 'icu-folia-virtual-stubs',
  setup(pluginBuild) {
    pluginBuild.onResolve({ filter: /^virtual:icu-folia-(dict|hmm)$/ }, (args) => ({ path: args.path, namespace: 'icu-folia-stub' }))
    pluginBuild.onLoad({ filter: /.*/, namespace: 'icu-folia-stub' }, (args) => ({
      contents: args.path.endsWith('dict')
        ? 'export const DICT_WORDS = ""; export const DICT_FREQS = ""; export const DICT_TOTAL = 0;'
        : 'export const HMM_START = {}; export const HMM_TRANS = {}; export const HMM_EMIT = {}; export const T2S_PAIRS = "";',
      loader: 'js',
    }))
  },
}

const inlineWorker = {
  name: 'inline-lyric-worker',
  setup(pluginBuild) {
    pluginBuild.onResolve({ filter: /^(\.\.\/|\.\/)workerClient$/ }, () => ({ path: join(root, 'src', 'client', 'render', 'lyrics', 'worker-inline.ts') }))
  },
}

await build({
  entryPoints: [join(root, 'src', 'client', 'render', 'lyrics', 'entry.ts')],
  bundle: true,
  format: 'iife',
  globalName: 'MPFoliaLyrics',
  platform: 'browser',
  target: ['chrome120'],
  legalComments: 'none',
  outfile: join(root, 'src', 'client', 'render', 'lyrics', 'lyrics.bundle.js'),
  plugins: [inlineWorker, icuFoliaStubs],
  logLevel: 'info',
})


