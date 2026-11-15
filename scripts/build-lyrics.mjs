#!/usr/bin/env node
/**
 * Build Folia's lyric pipeline into an IIFE for the plugin's client.
 *
 * The ported sources live at src/utils/lyrics/** (verbatim Folia) and import
 * ../../types, which resolves to src/types.ts (the same module as
 * src/render/folia/types.ts).
 *
 * Usage: node scripts/build-lyrics.mjs
 */

import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

// The lyric worker is inline here: the bundle is one script with no worker asset.
const inlineWorker = {
  name: 'inline-lyric-worker',
  setup(pluginBuild) {
    pluginBuild.onResolve({ filter: /^(\.\.\/|\.\/)workerClient$/ }, () => ({ path: join(root, 'src', 'render', 'lyrics', 'worker-inline.ts') }))
  },
}

await build({
  entryPoints: [join(root, 'src', 'render', 'lyrics', 'entry.ts')],
  bundle: true,
  format: 'iife',
  globalName: 'MPFoliaLyrics',
  platform: 'browser',
  target: ['chrome120'],
  legalComments: 'none',
  outfile: join(root, 'src', 'render', 'lyrics', 'lyrics.bundle.js'),
  plugins: [inlineWorker],
  logLevel: 'info',
})
