/**
 * Bodian Music as a first-class source.
 *
 * The upstream package (`bodian-music-api`, AGPL-3.0) owns the signing and session
 * protocol; this module only adapts its shapes to our contract. It is registered
 * directly in the source registry instead of going through the legacy
 * `providers/index.js` factory, which is the pattern every new platform follows:
 * one directory, one registration line.
 *
 * Sessions are injected: the caller decides where credentials live. Until the
 * login rewrite lands, `createMemorySessions()` keeps them in memory.
 *
 * @module dsh-music-panel/sources/bodian
 */

import { capabilities as buildCapabilities, providerApi } from '../../../services/core/contract.js'
import { MusicError, toMusicError } from '../../../services/core/errors.js'
import { parseLrc } from '../lrc.js'

const SOURCE_ID = 'bodian'
const PAGE_SIZE = 60

/** In-memory session repository shaped like the upstream package expects. */
export function createMemorySessions(initial = null) {
  let value = initial
  return {
    get: () => value,
    set: (next) => {
      value = next
    },
    clear: () => {
      value = null
    },
  }
}

/** One upstream search row → our `Track` shape. */
export function toTrack(row) {
  const item = row ?? {}
  const id = item.id ?? item.songId
  if (id === undefined || id === null || String(id) === '') return null

  const artists = Array.isArray(item.artists)
    ? item.artists.map((artist) => String(artist?.name ?? artist?.artistName ?? '')).filter(Boolean)
    : []
  const artist = String(item.artist ?? '')
  const cover = String(item.albumPic ?? item.albumPic120 ?? '')
  const durationSec = Number(item.duration) || 0

  return {
    id: String(id),
    title: String(item.name ?? item.songName ?? item.FSONGNAME ?? '').trim(),
    artist: artist !== '' ? artist : artists.join(' / '),
    album: String(item.album ?? ''),
    durationMs: Math.round(durationSec * 1000),
    coverUrl: cover,
    sourceRef: { kind: 'online', sourceId: SOURCE_ID, ref: String(id) },
    providerData: {
      albumId: item.albumId ?? null,
      artistId: item.artistId ?? null,
      pay: item.payInfo ?? null,
    },

    // ── Full entity, aligned with the online source contract ─────────────
    artistsDetail: Array.isArray(item.artists)
      ? item.artists.map((entry) => ({
          id: String(entry?.id ?? ''),
          name: String(entry?.name ?? ''),
          avatarUrl: String(entry?.pic ?? ''),
        }))
      : [],
    albumDetail: {
      id: String(item.albumId ?? ''),
      name: String(item.album ?? ''),
      coverUrl: String(item.albumPic ?? ''),
      coverUrlSmall: String(item.albumPic120 ?? ''),
    },
    aliases: item.subtitle ? [String(item.subtitle)] : [],
    translatedNames: [],
    publishTime: Number(item.releaseDate) || 0,
    popularity: 0,
    songType: 0,
    mvId: String(item.vid ?? ''),
    isVideo: item.isMv === true || String(item.isMv) === '1',
    mvDurationMs: (Number(item.mvduration) || 0) * 1000,
    copyright: 0,
    // `online: false` means the platform pulled the track.
    resourceState: item.online === undefined ? null : Boolean(item.online),
    preOnline: item.preOnline === true,
    noCopyright: null,
    privilegeDetail: item.payInfo ?? null,
    // Every bitrate the platform advertises is a selectable rung.
    availableQualities: Array.isArray(item.audios)
      ? item.audios
          .map((audio) => String(audio?.level ?? audio?.format ?? '').toLowerCase())
          .filter((level) => level !== '')
      : [],
    audioFormats: Array.isArray(item.audios)
      ? item.audios.map((audio) => ({
          bitrate: Number(audio?.bitrate) || 0,
          format: String(audio?.format ?? ''),
          level: String(audio?.level ?? ''),
          size: Number(audio?.size) || 0,
        }))
      : [],
  }
}

function unwrap(result, what) {
  if (result !== null && typeof result === 'object' && result.ok === true) return result.data
  const error = result?.error ?? {}
  throw new MusicError(String(error.message ?? `${what} failed`), {
    code: error.code === 'network' ? 'network' : 'protocol',
    sourceId: SOURCE_ID,
  })
}

/**
 * @param {{
 *   createApi: (options: object) => { request: (operation: string, params?: object) => Promise<object> },
 *   deviceId: string,
 *   sessions?: object,
 * }} options
 */
export function createBodianSource(options) {
  const sessions = options.sessions ?? createMemorySessions()
  const api = options.createApi({ deviceId: options.deviceId, sessions })
  const capabilities = buildCapabilities({
    search: true,
    playback: true,
    lyrics: true,
    loginQr: true,
  })

  async function request(operation, params) {
    try {
      // Registration starts the stored-session read in the background; a
      // request that arrives first waits for it instead of acting signed out.
      if (typeof sessions.whenReady === 'function') await sessions.whenReady()
      return unwrap(await api.request(operation, params), operation)
    } catch (error) {
      throw toMusicError(error, SOURCE_ID)
    }
  }

  const source = {
    id: SOURCE_ID,
    kind: 'online',
    displayName: 'Bodian Music',
    capabilities,
    qualityLevels: ['standard', 'high', 'lossless'],
    loginMethods: ['qr'],

    availability() {
      return { configured: true }
    },

    async search(query, page = 1, _ctx) {
      const keyword = String(query ?? '').trim()
      if (keyword === '') return { songs: [], total: 0, page: 1 }

      const data = await request('search', {
        query: keyword,
        limit: PAGE_SIZE,
        offset: Math.max(0, (Math.max(1, page) - 1) * PAGE_SIZE),
      })
      const rows = Array.isArray(data?.resultList) ? data.resultList : []
      const songs = rows.map(toTrack).filter(Boolean)
      return {
        songs,
        total: Number(data?.total) || songs.length,
        page: Math.max(1, page),
        hasMore: songs.length >= PAGE_SIZE,
      }
    },

    async getAudioSource(mediaId, _ctx, quality) {
      const data = await request('audio', { id: String(mediaId) })
      const url = typeof data?.url === 'string' ? data.url : ''
      if (url === '') {
        throw new MusicError('this track has no playable URL', { code: 'not-playable', sourceId: SOURCE_ID })
      }
      const preview = data.preview ?? null
      return {
        url,
        quality: String(data.quality ?? quality ?? 'standard'),
        preview: preview !== null,
        clipStartMs: preview !== null ? Math.max(0, Number(preview.startTime) || 0) * 1000 : 0,
      }
    },

    async getLyrics(mediaId, _ctx) {
      const data = await request('lyrics', { id: String(mediaId) })
      const text = String(data?.mainText ?? '')
      const lines = parseLrc(text)
      if (lines.length === 0) {
        throw new MusicError('this track has no timed lyrics', { code: 'not-playable', sourceId: SOURCE_ID })
      }
      return { lines, wordByWord: false, source: SOURCE_ID }
    },

    // The plugin's facade calls `stream` / `lyric` (the legacy adapter vocabulary);
    // this source implements the newer names, so both are exposed.
    stream(id, ctx, quality) {
      return this.getAudioSource(id, ctx, quality)
    },
    // Routes consume the adapter-level shape `{ lrc, translation }` (the legacy
    // adapter converts `{ lyric, trans }` before answering; a native source must
    // speak that shape directly).
    async lyric(id) {
      const data = await request('lyrics', { id: String(id) })
      const text = String(data?.mainText ?? '')
      if (text.trim() === '') {
        throw new MusicError('this track has no lyrics', { code: 'not-playable', sourceId: SOURCE_ID })
      }
      return { lrc: text, translation: String(data?.transText ?? data?.translation ?? '') }
    },

    // Facade methods so `omni.loginStart/loginStatus` work like any other source.
    loginStart() {
      return this.auth.startLogin()
    },
    loginStatus(key) {
      return this.auth.checkLogin(key)
    },
    async cancelLogin() {
      return true
    },

    auth: {
      async startLogin() {
        const key = await request('login_qr_key', {})
        const keyId = String(key?.key ?? key?.qrcode ?? key?.unikey ?? '')
        if (keyId === '') throw new MusicError('Bodian did not return a QR key', { code: 'invalid-response', sourceId: SOURCE_ID })
        const created = await request('login_qr_create', { key: keyId })
        return {
          key: keyId,
          imageDataUrl: String(created?.imageUrl ?? created?.qrimg ?? created?.image ?? ''),
          url: String(created?.qrurl ?? ''),
          expiresAt: Date.now() + 2 * 60 * 1000,
        }
      },

      async checkLogin(key) {
        const result = await request('login_qr_check', { key })
        // Upstream reports `state`; older builds used `status`.
        const status = String(result?.state ?? result?.status ?? 'failed')
        if (status === 'success' || status === 'scanned') {
          const session = result?.session ?? result?.credential ?? null
          // The package normally writes the session into the injected repository
          // itself; persist it here too in case this build only returns it.
          if (session !== null) sessions.set(session)
          return {
            status: status === 'scanned' ? 'scanned' : 'success',
            session,
            user: result?.user ?? null,
          }
        }
        return { status, message: String(result?.message ?? '') }
      },

      async readUser() {
        try {
          const data = await request('login_status', {})
          return data?.user ?? null
        } catch {
          return null
        }
      },
    },
  }
  source.api = providerApi(source)
  return source
}
