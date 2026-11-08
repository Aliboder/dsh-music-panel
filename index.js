/**
 * Host half of dsh-music-panel.
 *
 * Owns nothing but the wiring: settings (seed from the patch, then the user's
 * saved file), the folder scanner, and the `/music/*` HTTP surface that the
 * browser half calls for the library, the audio stream and cover art.
 *
 * @module dsh-music-panel
 */

import { createFavorites } from './lib/favorites.js'
import { createLibrary } from './lib/library.js'
import { createPlayback } from './lib/playback.js'
import { createPlaylists } from './lib/playlists.js'
import { createRoutes } from './lib/routes.js'
import { createSettings } from './lib/settings.js'
import { createStats } from './lib/stats.js'
import { enqueueControl } from './lib/control.js'

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
  const favorites = createFavorites({ dir: settings.dir })
  const library = createLibrary({ getSettings: settings.read, stats })
  const playlists = createPlaylists({ dir: settings.dir })
  const handle = createRoutes({ settings, library, playlists, stats, playback, favorites })

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

  // Model-facing control: queue an action the open player panel applies.
  ctx.inject(['tools'], (toolsCtx) => {
    toolsCtx.effect(
      () =>
        toolsCtx.tools.register(
          {
            name: 'music_control',
            description:
              'Control the local music player: play a song by title/artist, pause, next, previous. Actions are queued and applied by the open music panel within about two seconds.',
            parameters: {
              type: 'object',
              properties: {
                action: {
                  type: 'string',
                  enum: ['play', 'pause', 'next', 'previous'],
                  description: 'play starts a song, pause stops playback, next/previous switch tracks.',
                },
                query: {
                  type: 'string',
                  description: 'Song title or artist to look for when action is "play".',
                },
              },
              required: ['action'],
              additionalProperties: false,
            },
            output: {
              schema: {
                type: 'object',
                properties: { queued: { type: 'boolean' } },
                additionalProperties: true,
              },
              render: (args) => [
                { type: 'text', text: 'music: queued ' + String(args?.action ?? '') },
              ],
            },
            async execute(args) {
              const action = args !== null && typeof args === 'object' ? args.action : ''
              const query = args !== null && typeof args === 'object' ? args.query : ''
              const queued = enqueueControl({ action, query })
              return { queued }
            },
          },
          {},
        ),
      'music-control-tool',
    )
  })
}
