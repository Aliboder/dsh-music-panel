/**
 * Host half of dsh-music-panel.
 *
 * Owns nothing but the wiring: settings (seed from the patch, then the user's
 * saved file), the folder scanner, and the `/music/*` HTTP surface that the
 * browser half calls for the library, the audio stream and cover art.
 *
 * @module dsh-music-panel
 */

import { createLibrary } from './lib/library.js'
import { createPlayback } from './lib/playback.js'
import { createPlaylists } from './lib/playlists.js'
import { createRoutes } from './lib/routes.js'
import { createSettings } from './lib/settings.js'
import { createStats } from './lib/stats.js'

/** Cordis plugin name. */
export const name = 'music'

/** The browser carrier is the only hard dependency. */
export const inject = ['webServer']

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {{ roots?: string[], depth?: number, extensions?: string[], dshHome?: string }} [rawConfig]
 */
export function apply(ctx, rawConfig) {
  const config = rawConfig !== null && typeof rawConfig === 'object' ? rawConfig : {}
  const settings = createSettings({ dshHome: config.dshHome, seed: config })
  const stats = createStats({ dir: settings.dir })
  const playback = createPlayback({ dir: settings.dir })
  const library = createLibrary({ getSettings: settings.read, stats })
  const playlists = createPlaylists({ dir: settings.dir })
  const handle = createRoutes({ settings, library, playlists, stats, playback })

  ctx.effect(() => {
    const dispose = ctx.webServer.register({
      kind: 'prefix',
      path: '/music',
      handler: handle,
    })
    return () => {
      if (typeof dispose === 'function') dispose()
    }
  })
}
