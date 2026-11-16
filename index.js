/**
 * Host half of dsh-music-panel.
 *
 * Owns nothing but the wiring: settings (seed from the patch, then the user's
 * saved file), the folder scanner, and the `/music/*` HTTP surface that the
 * browser half calls for the library, the audio stream and cover art.
 *
 * @module dsh-music-panel
 */

import { createFavorites } from './src/host/stores/favorites.js'
import { createLibrary } from './src/host/services/media/library.js'
import { createPlayback } from './src/host/services/playback/playback.js'
import { createPlaylists } from './src/host/stores/playlists.js'
import { createOnlineCache } from './src/host/services/media/online-cache.js'
import { createProviderStore } from './src/host/providers/provider-store.js'
import { createKugouSessionManager } from './src/host/providers/kugou-session.js'
import { createRoutes } from './src/host/http/routes.js'
import { createSettings } from './src/host/stores/settings.js'
import { createStats } from './src/host/stores/stats.js'
import { readLyricsFor } from './src/host/services/lyrics/lyrics.js'
import { enqueueControl } from './src/host/services/playback/control.js'
import { registerBodianSource, registerLocalSource, registerOnlineSources, resetSources } from './src/host/providers/sources/index.js'
import { createLoginStore } from './src/host/providers/login/store.js'
import { stopNeteaseService } from './src/host/services/netease-api.js'
import { stopQqService } from './src/host/services/qq-api.js'
import { stopAllKugouServices } from './src/host/services/kugou-api.js'

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
  // Bodian persists its own session; it shares the same credential file format.
  const loginStore = createLoginStore({ dir: settings.dir })
  const onlineCache = createOnlineCache({ dir: settings.dir })
  const kugouSessions = createKugouSessionManager({ providerStore })
  const handle = createRoutes({ settings, library, playlists, stats, playback, favorites, providerStore, onlineCache, kugouSessions })

  // Sources are registered once per load; the registry is the single list every
  // future caller reads instead of branching on platform names.
  ctx.effect(() => {
    registerOnlineSources()
    // Native upstream package (AGPL), registered outside the legacy factory.
    registerBodianSource({ dir: settings.dir, store: loginStore })
    if (library !== null && typeof library.scan === 'function') {
      registerLocalSource({
        scan: (options) => library.scan(options),
        readLyrics: (file) => readLyricsFor(file),
      })
    }
    return () => {
      resetSources()
      // Upstream services hold listening sockets and workers; they must not outlive the plugin.
      void stopNeteaseService()
      void stopQqService()
      void stopAllKugouServices()
    }
  }, 'music: sources')

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
                enum: ['local', 'netease', 'qq', 'kugou', 'kugouLite', 'navidrome'],
                description:
                  'Where to play from: local library (default), the online providers NetEase / QQ Music / KuGou / KuGou Concept (free tracks work without signing in), or navidrome for a self-hosted Navidrome/Subsonic library (configure it in Settings → Online first).',
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
        text: '在线音乐：music_control 的 source 可设为 netease / qq / kugou / kugouLite（酷狗概念版）/ navidrome（自建 Navidrome 或 Subsonic 服务器），按歌名或歌手在线搜索并播放（未登录只播免费曲；用户可在「设置 → 在线」扫码登录以提升音质，Navidrome 则在此填写服务器地址与账号）。',
      })
      return () => {}
    }, 'music-online-prompt')
  }
}
