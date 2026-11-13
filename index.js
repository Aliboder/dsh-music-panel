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
import { createOnlineCache } from './lib/online-cache.js'
import { createProviderStore } from './lib/provider-store.js'
import { createKugouSessionManager } from './lib/kugou-session.js'
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
  const providerStore = createProviderStore({ dir: settings.dir })
  const onlineCache = createOnlineCache({ dir: settings.dir })
  const kugouSessions = createKugouSessionManager({ providerStore })
  const handle = createRoutes({ settings, library, playlists, stats, playback, favorites, providerStore, onlineCache, kugouSessions })

  // KuGou standard tokens last under a day. Refresh while the app stays open;
  // the settings route also refreshes on demand and validates Lite.
  ctx.effect(() => {
    let disposed = false
    const tick = () => {
      if (disposed) return
      void kugouSessions.refreshIfDue('kugou').catch(() => {})
    }
    tick()
    const timer = setInterval(tick, kugouSessions.intervalMs)
    return () => {
      disposed = true
      clearInterval(timer)
    }
  }, 'music: kugou session refresh')

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
  // Tools / systemPrompt are optional services: read them defensively so the
  // plugin still loads where they are unavailable.
  const tools = typeof ctx.get === 'function' ? ctx.get('tools') : undefined
  if (tools !== undefined && tools !== null && typeof tools.register === 'function') {
    ctx.effect(() => {
      const dispose = tools.register(
        {
          name: 'music_control',
          description:
            'Control the music player: play a song by title/artist (local library or an online provider), pause, next, previous. Actions are queued and applied by the open music panel within about two seconds.',
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
              source: {
                type: 'string',
                enum: ['local', 'netease', 'qq', 'kugou', 'kugouLite'],
                description:
                  'Where to play from: local library (default), or the online providers NetEase / QQ Music / KuGou (free tracks work without signing in; sign in from the panel for higher quality).',
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
            const source = args !== null && typeof args === 'object' ? args.source : ''
            const queued = enqueueControl({ action, query, source })
            return { queued, source: source || 'local' }
          },
        },
        {},
      )
      return typeof dispose === 'function' ? dispose : () => {}
    }, 'music-control-tool')
  }

  // Let the model know about online playback sources.
  const systemPrompt = typeof ctx.get === 'function' ? ctx.get('systemPrompt') : undefined
  if (systemPrompt !== undefined && systemPrompt !== null && typeof systemPrompt.section === 'function') {
    ctx.effect(() => {
      systemPrompt.section({
        name: 'tool:music-online',
        order: 117,
        text: '在线音乐：music_control 的 source 可设为 netease / qq / kugou / kugouLite（酷狗概念版），按歌名或歌手在线搜索并播放（未登录只播免费曲；用户可在「设置 → 在线」扫码登录以提升音质）。',
      })
      return () => {}
    }, 'music-online-prompt')
  }
}
