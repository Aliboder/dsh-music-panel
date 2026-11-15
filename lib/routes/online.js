/**
 * The `/online/*` HTTP surface.
 *
 * Moved verbatim out of `lib/routes.js` so online work no longer touches the
 * local-library routes. Each branch still ends with a bare `return`: the caller
 * has already been answered, so `handle` only reports whether it matched.
 *
 * Everything online-specific lives here: the upstream user agent, per-provider
 * referers, and the wire-shape helper the client relies on.
 *
 * @module dsh-music-panel/routes/online
 */

import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { fail, readJson, sendJson } from '../http.js'
import { isAllowedCoverUrl } from '../url-safety.js'
import { readTrackMeta } from '../meta.js'
import { omni } from '../sources/index.js'
import * as ND from '../providers/navidrome.js'
import { createLoginBridge, createQrAdapter } from '../login/bridge.js'
import { loginFailureOf } from '../core/login-failure.js'
import { createAmllClient } from '../amll.js'
import { buildLyricSourceOrder } from '../lyrics-sources.js'
import { findBestLyrics, linesFromLrc } from '../lyrics-match-runner.js'

const ONLINE_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

const ONLINE_REFERERS = {
  netease: 'https://music.163.com/',
  qq: 'https://y.qq.com/',
  kugou: 'https://www.kugou.com/',
  kugouLite: 'https://www.kugou.com/',
}

function onlineReferer(provider) {
  return ONLINE_REFERERS[provider] || 'https://www.kugou.com/'
}

/** Client tracks carry onlineId; accept both wire shapes. */
export function onlineSongId(song) {
  if (song === null || typeof song !== 'object') return ''
  return String(song.id || song.onlineId || '')
}

/**
 * @param {{
 *   providerStore: object,
 *   onlineCache: object,
 *   kugouSessions: object,
 *   profileState: (provider: string) => Promise<object | null>,
 *   vipInfoState: (provider: string) => Promise<{ vip: unknown, expiresAt: string }>,
 *   vipState: (provider: string) => Promise<unknown>,
 *   invalidateProviderCaches: (provider: string) => void,
 * }} deps
 */
export function createOnlineRoutes(deps) {
  // These are used without guards inside the handlers; a missing one used to fail
  // silently as a 502 at request time instead of loudly at wiring time.
  const REQUIRED_DEPS = ['settings', 'profileState', 'vipInfoState', 'vipState', 'invalidateProviderCaches']
  for (const key of REQUIRED_DEPS) {
    if (deps[key] === undefined) throw new Error(`createOnlineRoutes is missing dependency: ${key}`)
  }

  const { settings, providerStore, onlineCache, kugouSessions, profileState, vipInfoState, vipState, invalidateProviderCaches } =
    deps

  /** Addressable online sources come from the registry, never a literal list. */
  function isOnlineSource(id) {
    return omni.summaries().some((source) => source.id === id && source.kind === 'online')
  }

  /** QR sign-in is a capability of the source, not a platform name. */
  function supportsQrLogin(id) {
    const source = omni.summaries().find((entry) => entry.id === id)
    return source !== undefined && source.capabilities !== undefined && source.capabilities.loginQr === true
  }

  // QR sign-in goes through the shared state machine; persistence still writes the
  // legacy provider store, so the rest of the plugin keeps reading one source.
  const login = createLoginBridge({
    adapters: Object.fromEntries(
      ['netease', 'qq', 'kugou', 'kugouLite', 'bodian'].map((id) => [
        id,
        (kind) =>
          createQrAdapter({
            sourceId: id,
            omni,
            mode: kind || 'qq',
            getSession: async () => (providerStore === undefined ? {} : await providerStore.session(id)),
          }),
      ]),
    ),
    store: {
      save: async (id, credentials, user) => {
        if (providerStore !== undefined) {
          await providerStore.setLogin(id, {
            ...credentials,
            ...(user !== null && user.nickname !== '' ? { nickname: user.nickname } : {}),
          })
        }
        invalidateProviderCaches(id)
      },
      clear: async (id) => {
        if (providerStore !== undefined) await providerStore.clear(id)
        invalidateProviderCaches(id)
      },
    },
  })

  return async function handle(req, res, ctx) {
    const { url, pathname, method, params } = ctx

      if (pathname === '/online/search' && method === 'GET') {
        const provider = (params.get('provider') || '').trim()
        const query = (params.get('q') || '').trim()
        if (!isOnlineSource(provider)) {
          return fail(res, 400, 'BAD_PROVIDER', '未知平台')
        }
        if (query === '') return fail(res, 400, 'NO_QUERY', '缺少搜索词')
        try {
          var page = Math.max(1, Number(params.get('page')) || 1)
          const cookie = providerStore === undefined ? '' : await providerStore.cookie(provider)
          // Navidrome carries its server + token in the session rather than a
          // cookie, so search needs it too — without this the provider resolves
          // an empty server and every Navidrome search fails.
          const session = providerStore === undefined ? {} : await providerStore.session(provider)
          const paged = await omni.searchPage(provider, query, { cookie, session }, page)
          return sendJson(res, 200, {
            ok: true,
            provider,
            query,
            results: paged.results,
            total: paged.total,
            page: paged.page,
          })
        } catch (error) {
          return fail(
            res,
            502,
            'SEARCH_FAILED',
            error instanceof Error ? error.message : '在线搜索失败',
          )
        }
      }

      if (pathname === '/online/artist-songs' && method === 'GET') {
        const provider = (params.get('provider') || '').trim()
        const artist = (params.get('artist') || '').trim()
        if (!isOnlineSource(provider)) {
          return fail(res, 400, 'BAD_PROVIDER', '未知平台')
        }
        if (artist === '') return fail(res, 400, 'NO_ARTIST', '缺少歌手名')
        try {
          const cookie = providerStore === undefined ? '' : await providerStore.cookie(provider)
          const session = providerStore === undefined ? {} : await providerStore.session(provider)
          const songs = await omni.artistSongs(provider, artist, { cookie, session })
          return sendJson(res, 200, { ok: true, provider, artist, songs })
        } catch (error) {
          return fail(
            res,
            502,
            'ARTIST_FAILED',
            error instanceof Error ? error.message : '歌手歌曲获取失败',
          )
        }
      }

      if (pathname === '/online/stream' && (method === 'GET' || method === 'HEAD')) {
        const provider = (params.get('provider') || '').trim()
        const id = (params.get('id') || '').trim()
        if (!isOnlineSource(provider) || id === '') {
          return fail(res, 400, 'BAD_REQUEST', '缺少 provider / id')
        }
        // Enforce the account entitlement on the Host as well as in the client:
        // a direct /online/stream request must not bypass the VIP gate.
        let vipRequired = omni.requiresVip(provider, id)
        if (vipRequired === null && onlineCache !== undefined) {
          const cachedInfo = await onlineCache.readMeta(provider, id, 'info')
          if (cachedInfo !== null && cachedInfo.vip === true) vipRequired = true
        }
        if (vipRequired === true) {
          const accountVip = await vipState(provider)
          if (accountVip !== true) {
            return fail(res, 403, 'VIP_REQUIRED', '该曲目需要对应平台的 VIP 会员')
          }
        }
        // The client sends the default quality it shows in the panel; older URLs
        // without the parameter keep using the host's saved value.
        const config = await settings.read()
        const requestedQuality = (params.get('quality') || '').trim()
        const quality = ['standard', 'high', 'lossless', 'hires'].includes(requestedQuality)
          ? requestedQuality
          : config.onlineQuality || 'high'
        try {
          // 1) Serve from the on-disk cache when we already have the bytes **of
          // the requested quality**: a cached standard file must not answer a
          // lossless request.
          let cached = onlineCache === undefined ? null : await onlineCache.lookup(provider, id)
          if (cached !== null && onlineCache !== undefined) {
            const cachedQuality = await onlineCache.readMeta(provider, id, 'quality')
            if (
              cachedQuality !== null &&
              typeof cachedQuality.quality === 'string' &&
              cachedQuality.quality !== '' &&
              cachedQuality.quality !== quality
            ) {
              cached = null
            }
          }
          if (cached !== null) {
            const rangeHeader = req.headers.range
            const baseHeaders = {
              'content-type': cached.contentType,
              'accept-ranges': 'bytes',
              'cache-control': 'public, max-age=604800',
            }
            if (typeof rangeHeader === 'string' && rangeHeader !== '') {
              const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim())
              let start = 0
              let end = cached.size - 1
              if (match !== null) {
                if (match[1] !== '') start = Number.parseInt(match[1], 10)
                if (match[2] !== '') end = Number.parseInt(match[2], 10)
              }
              if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= cached.size) {
                res.writeHead(416, { 'content-range': 'bytes */' + cached.size })
                res.end()
                return
              }
              end = Math.min(end, cached.size - 1)
              const length = end - start + 1
              res.writeHead(206, {
                ...baseHeaders,
                'content-length': length,
                'content-range': 'bytes ' + start + '-' + end + '/' + cached.size,
              })
              if (method === 'HEAD') {
                res.end()
                return
              }
              createReadStream(cached.file, { start, end }).pipe(res)
              return
            }
            res.writeHead(200, { ...baseHeaders, 'content-length': cached.size })
            if (method === 'HEAD') {
              res.end()
              return
            }
            createReadStream(cached.file).pipe(res)
            return
          }

          // 2) Miss: resolve the CDN URL, stream it through, and cache the bytes.
          let cookie = providerStore === undefined ? '' : await providerStore.cookie(provider)
          let session = providerStore === undefined ? {} : await providerStore.session(provider)
          if ((provider === 'kugou' || provider === 'kugouLite') && (session.mid === undefined || session.mid === '')) {
            session = omni.createDevice(provider)
            if (providerStore !== undefined) await providerStore.setSession(provider, session)
          }
          // Provider lookups occasionally fail on a transient network hiccup:
          // retry once before surfacing the error.
          let stream = null
          for (let attempt = 0; attempt < 2; attempt += 1) {
            try {
              stream = await omni.stream(provider, id, { cookie, session }, quality)
              break
            } catch (error) {
              if (attempt === 1) throw error
              await new Promise((resolveDelay) => setTimeout(resolveDelay, 400))
            }
          }
          if (stream.url === '') {
            // NetEase answers 404 for region-locked / delisted tracks. Keep the
            // real reason visible instead of blaming the user's login state.
            const message =
              provider === 'netease' && Number(stream.code) === 404
                ? '网易云版权限制：该曲目在当前地区暂不可播放'
                : '该曲目暂不可播（可能需要登录或 VIP）'
            return fail(res, 404, 'NO_STREAM', message)
          }
          const controller = new AbortController()
          const timer = setTimeout(() => controller.abort(), 15000)
          const upstreamHeaders = {
            'User-Agent': ONLINE_UA,
            Referer: onlineReferer(provider),
          }
          // Forward the browser's Range request so seeking streams from the
          // right offset. Chromium probes media with `Range: bytes=0-`, which
          // covers the whole file: treat that as a full fetch so the bytes can
          // be cached (otherwise audio caching would never trigger).
          const rangeHeader = req.headers.range
          let rangeStart = 0
          let rangeEnd = -1
          let hasRange = typeof rangeHeader === 'string' && rangeHeader !== ''
          if (hasRange) {
            const rangeMatch = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim())
            if (rangeMatch !== null) {
              if (rangeMatch[1] !== '') rangeStart = Number.parseInt(rangeMatch[1], 10)
              if (rangeMatch[2] !== '') rangeEnd = Number.parseInt(rangeMatch[2], 10)
            } else {
              rangeStart = -1
            }
          }
          const fullFromStart = hasRange && rangeStart === 0 && rangeEnd === -1
          // Always forward the browser's Range, including `bytes=0-`.
          // Chromium treats a 200 answer to a Range request as "not seekable"
          // and restarts playback when the user scrubs (Chromium issue 973357);
          // a proxied 206 is what keeps seeking working.
          const forwardRange = hasRange
          if (forwardRange) upstreamHeaders.Range = rangeHeader
          let upstream
          try {
            upstream = await fetch(stream.url, {
              redirect: 'follow',
              signal: controller.signal,
              headers: upstreamHeaders,
            })
          } finally {
            clearTimeout(timer)
          }
          if (upstream.status === 416) {
            res.writeHead(416, { 'content-range': upstream.headers.get('content-range') || '' })
            res.end()
            return
          }
          if (!upstream.ok) {
            return fail(res, 502, 'UPSTREAM_FAILED', 'HTTP ' + upstream.status)
          }
          const headers = {
            'content-type': upstream.headers.get('content-type') || 'audio/mpeg',
            'cache-control': 'no-store',
            // We always proxy Range (cache hit serves it locally, a miss is
            // forwarded upstream), so advertise it even when the CDN omits the
            // header. Without this the browser refuses to seek and restarts.
            'accept-ranges': 'bytes',
          }
          const length = upstream.headers.get('content-length')
          if (length !== null) headers['content-length'] = length
          const contentRange = upstream.headers.get('content-range')
          if (contentRange !== null) headers['content-range'] = contentRange
          res.writeHead(upstream.status === 206 ? 206 : 200, headers)
          if (method === 'HEAD') {
            if (upstream.body !== null) upstream.body.cancel().catch(() => {})
            res.end()
            return
          }
          let written = 0
          let interrupted = false
          let truncated = false
          const declared = Number(headers['content-length'] || 0)
          // `bytes=0-` is answered with a full-body 206; that is still a
          // complete download worth caching. Any other Range is a seek.
          const contentRangeHeader = String(headers['content-range'] || '')
          const fullRangeMatch = /^bytes 0-(\d+)\/(\d+)$/.exec(contentRangeHeader)
          const fullRangeBody =
            fullRangeMatch !== null &&
            Number(fullRangeMatch[1]) === Number(fullRangeMatch[2]) - 1
          // Cache only complete downloads under the size cap. The sink writes
          // straight to a temp file, so memory stays flat.
          const cacheable =
            (!hasRange || (fullFromStart && fullRangeBody)) &&
            (upstream.status === 200 || upstream.status === 206) &&
            onlineCache !== undefined &&
            (declared === 0 || declared <= 120 * 1024 * 1024)
          let sink = null
          if (cacheable) {
            sink = await onlineCache.createSink(provider, id, headers['content-type'], declared)
          }
          if (upstream.body !== null) {
            for await (const chunk of upstream.body) {
              if (res.writableEnded || res.destroyed) {
                interrupted = true
                controller.abort()
                break
              }
              res.write(chunk)
              written += chunk.length
              if (sink !== null) {
                if (written <= 120 * 1024 * 1024) {
                  sink.write(chunk)
                } else {
                  truncated = true
                  await sink.abort()
                  sink = null
                }
              }
            }
          }
          if (!res.writableEnded) res.end()
          if (sink !== null) {
            const complete =
              !interrupted && !truncated && (declared > 0 ? written === declared : written > 0)
            if (complete) {
              // Fire-and-forget: the rename must never delay the response.
              void sink.finish().then(() => {
                if (onlineCache !== undefined) {
                  void onlineCache.writeMeta(provider, id, 'quality', {
                    quality,
                    at: Date.now(),
                  })
                }
              })
            } else {
              void sink.abort()
            }
          }
          return
        } catch (error) {
          if (res.headersSent) {
            if (!res.writableEnded) res.end()
            return
          }
          return fail(
            res,
            502,
            'STREAM_FAILED',
            error instanceof Error ? error.message : '在线播放失败',
          )
        }
      }

      if (pathname === '/online/info' && method === 'GET') {
        const provider = (params.get('provider') || '').trim()
        const id = (params.get('id') || '').trim()
        if (!isOnlineSource(provider) || id === '') {
          return fail(res, 400, 'BAD_REQUEST', '缺少 provider / id')
        }
        try {
          const cached = onlineCache === undefined ? null : await onlineCache.lookup(provider, id)
          if (cached === null) {
            return sendJson(res, 200, { ok: true, cached: false })
          }
          const saved = await onlineCache.readMeta(provider, id, 'audio')
          if (saved !== null && saved.v === 1 && saved.size === cached.size && saved.info) {
            return sendJson(res, 200, { ok: true, cached: true, info: saved.info })
          }
          const meta = await readTrackMeta(cached.file)
          const info = {
            codec: meta.codec || '',
            sampleRate: meta.sampleRate || 0,
            bitrate: meta.bitrate || 0,
            durationSec: meta.durationSec || 0,
            size: cached.size,
          }
          await onlineCache.writeMeta(provider, id, 'audio', {
            v: 1,
            size: cached.size,
            info,
            at: Date.now(),
          })
          return sendJson(res, 200, { ok: true, cached: true, info })
        } catch (error) {
          return fail(
            res,
            502,
            'INFO_FAILED',
            error instanceof Error ? error.message : '在线音频信息读取失败',
          )
        }
      }

      if (pathname === '/online/lyric' && method === 'GET') {
        const provider = (params.get('provider') || '').trim()
        const id = (params.get('id') || '').trim()
        if (!isOnlineSource(provider) || id === '') {
          return fail(res, 400, 'BAD_REQUEST', '缺少 provider / id')
        }
        try {
          const cachedLyric =
            onlineCache === undefined ? null : await onlineCache.readMeta(provider, id, 'lyric')
          // A lyric cached without a translation used to be served forever, even
          // when the provider (or another candidate, for KuGou) later supplied
          // one. Give such entries a day of grace and then revalidate.
          const cachedMissingTranslation =
            cachedLyric !== null &&
            cachedLyric.v === 4 &&
            String(cachedLyric.translation || '').trim() === ''
          const cachedStale =
            cachedMissingTranslation &&
            Date.now() - (Number(cachedLyric.at) || 0) > 24 * 60 * 60 * 1000
          if (
            cachedLyric !== null &&
            cachedLyric.v === 4 &&
            typeof cachedLyric.lrc === 'string' &&
            !cachedStale
          ) {
            return sendJson(res, 200, {
              ok: true,
              lrc: cachedLyric.lrc,
              translation: cachedLyric.translation || '',
              romaji: cachedLyric.romaji || '',
              lines: cachedLyric.lines ?? null,
              wordLevel: cachedLyric.wordLevel === true,
              cached: true,
            })
          }
          const cookie = providerStore === undefined ? '' : await providerStore.cookie(provider)
          // Same trap as search: Navidrome keeps its server + token in the
          // session, so the lyric lookup needs it or it resolves nowhere.
          const session = providerStore === undefined ? {} : await providerStore.session(provider)
          const primary = await omni.lyric(provider, id, { cookie, session })
          let lyric = primary
          let lyricSource = provider
          let borrowedFrom = ''
          // Folia's automatic pick: only when the track's own platform has no
          // lyrics do we ask the other sources, so the common path keeps one request.
          const wantedTitle = (params.get('title') || '').trim()
          if (String(primary.lrc ?? '') === '' && wantedTitle !== '') {
            const wantedTrack = {
              title: wantedTitle,
              artist: (params.get('artist') || '').trim(),
              album: (params.get('album') || '').trim(),
              durationMs: Number(params.get('duration')) > 0 ? Number(params.get('duration')) * 1000 : 0,
            }
            const amll = createAmllClient()
            const matched = await findBestLyrics(wantedTrack, {
              order: buildLyricSourceOrder(provider)
                .map((source) => source.id)
                .filter((sourceId) => sourceId !== provider),
              neteaseId: provider === 'netease' ? id : undefined,
              qqId: provider === 'qq' ? id : undefined,
              search: async (sourceId, query, limit) => {
                const paged = await omni.searchPage(sourceId, query, {}, 1)
                return (Array.isArray(paged.results) ? paged.results : []).slice(0, limit).map((song) => ({
                  id: song.id,
                  title: song.title,
                  artist: song.artist,
                  album: song.album,
                  durationMs: Number(song.durationMs) || (Number(song.durationSec) || 0) * 1000,
                }))
              },
              fetchLyric: async (sourceId, sourceSongId) => {
                const got = await omni.lyric(sourceId, sourceSongId, {})
                if (got === null) return null
                const lines = Array.isArray(got.lines) && got.lines.length > 0 ? got.lines : linesFromLrc(got.lrc)
                if (lines.length === 0) return null
                return { lines }
              },
              fetchAmll: (platform, musicId) => amll.fetchLyrics(platform, musicId),
            })
            if (matched !== null) {
              lyricSource = matched.source
              borrowedFrom = matched.source
              lyric = {
                lrc: matched.lyrics.map((line) => lrcTime(line.t) + String(line.text ?? '')).join('\n'),
                translation: '',
                romaji: '',
                lines: matched.lyrics,
                wordLevel: matched.wordLevel === true,
              }
            }
          }
          if (onlineCache !== undefined && lyric.lrc !== '') {
            void onlineCache.writeMeta(provider, id, 'lyric', {
              lrc: lyric.lrc,
              translation: lyric.translation || '',
              romaji: lyric.romaji || '',
              lines: lyric.lines ?? null,
              wordLevel: lyric.wordLevel === true,
              // v4 adds the word-level timeline; v3 entries are re-fetched.
              v: 4,
              at: Date.now(),
            })
          }
          return sendJson(res, 200, {
            ok: true,
            lrc: lyric.lrc,
            translation: lyric.translation,
            romaji: lyric.romaji || '',
            lines: lyric.lines ?? null,
            wordLevel: lyric.wordLevel === true,
            source: lyricSource,
            borrowedFrom,
          })
        } catch (error) {
          return fail(
            res,
            502,
            'LYRIC_FAILED',
            error instanceof Error ? error.message : '在线歌词获取失败',
          )
        }
      }

      // The platform's own ReplayGain. Folia reads it for Navidrome only; the Chinese
      // platforms carry none, so the balance falls back to its own readings there.
      if (pathname === '/online/replaygain' && method === 'GET') {
        const provider = (params.get('provider') || '').trim()
        const id = (params.get('id') || '').trim()
        if (provider !== 'navidrome') {
          return sendJson(res, 200, { ok: true, trackGain: null, albumGain: null })
        }
        if (id === '') return fail(res, 400, 'BAD_REQUEST', '缺少 id')
        try {
          const session = providerStore === undefined ? {} : await providerStore.session('navidrome')
          // The session keeps the token + salt made at login (see /online/navidrome/login).
          const config = {
            server: session.server,
            username: session.username,
            token: session.token,
            salt: session.salt,
          }
          const gain = await ND.songGain(config, id)
          return sendJson(res, 200, { ok: true, trackGain: gain.trackGain, albumGain: gain.albumGain })
        } catch (error) {
          return sendJson(res, 200, { ok: true, trackGain: null, albumGain: null })
        }
      }

      if (pathname === '/online/chorus' && method === 'GET') {
        const provider = (params.get('provider') || '').trim()
        const id = (params.get('id') || '').trim()
        if (!isOnlineSource(provider) || id === '') {
          return fail(res, 400, 'BAD_REQUEST', '缺少 provider / id')
        }
        try {
          const cookie = providerStore === undefined ? '' : await providerStore.cookie(provider)
          const chorus = await omni.chorus(provider, id, { cookie })
          return sendJson(res, 200, { ok: true, chorus })
        } catch (error) {
          return fail(res, 502, 'CHORUS_FAILED', error instanceof Error ? error.message : '副歌信息获取失败')
        }
      }

      if (pathname === '/online/quality' && method === 'GET') {
        const provider = (params.get('provider') || '').trim()
        const id = (params.get('id') || '').trim()
        if (!isOnlineSource(provider) || id === '') {
          return fail(res, 400, 'BAD_REQUEST', '缺少 provider / id')
        }
        try {
          const cookie = providerStore === undefined ? '' : await providerStore.cookie(provider)
          let session = providerStore === undefined ? {} : await providerStore.session(provider)
          if (provider === 'kugou' && (session.mid === undefined || session.mid === '')) {
            session = omni.createDevice(provider)
            if (providerStore !== undefined) await providerStore.setSession('kugou', session)
          }
          const config = await settings.read()
          const stream = await omni.stream(provider, id, { cookie, session }, config.onlineQuality || 'high')
          return sendJson(res, 200, { ok: true, quality: stream.quality || '', playable: stream.url !== '' })
        } catch {
          // The badge is cosmetic: never surface a hard error here.
          return sendJson(res, 200, { ok: true, quality: '', playable: false })
        }
      }

      if (pathname === '/online/check-playable' && method === 'POST') {
        let body
        try {
          body = await readJson(req)
        } catch {
          return fail(res, 400, 'BAD_JSON', '请求体不是合法 JSON')
        }
        const provider = String(body?.provider || '')
        const ids = Array.isArray(body?.ids)
          ? body.ids
              .map((value) => String(value))
              .filter((value) => value !== '')
              .slice(0, 60)
          : []
        if (!isOnlineSource(provider) || ids.length === 0) {
          return fail(res, 400, 'BAD_REQUEST', '缺少 provider / ids')
        }
        const cookie = providerStore === undefined ? '' : await providerStore.cookie(provider)
        let session = providerStore === undefined ? {} : await providerStore.session(provider)
        if (provider === 'kugou' && (session.mid === undefined || session.mid === '')) {
          session = omni.createDevice(provider)
          if (providerStore !== undefined) await providerStore.setSession('kugou', session)
        }
        const config = await settings.read()
        const quality = config.onlineQuality || 'standard'
        const playable = {}
        // Small concurrency window: fast enough for a history sweep without
        // hammering the provider.
        for (let index = 0; index < ids.length; index += 6) {
          const slice = ids.slice(index, index + 6)
          await Promise.all(
            slice.map(async (id) => {
              try {
                const stream = await omni.stream(provider, id, { cookie, session }, quality)
                playable[id] = stream.url !== ''
              } catch {
                playable[id] = false
              }
            }),
          )
        }
        return sendJson(res, 200, { ok: true, playable })
      }

      if (pathname === '/online/login/start' && method === 'POST') {
        let body
        try {
          body = await readJson(req)
        } catch {
          return fail(res, 400, 'BAD_JSON', '请求体不是合法 JSON')
        }
        const provider = String(body?.provider || '')
        if (!supportsQrLogin(provider)) {
          return fail(res, 400, 'BAD_PROVIDER', '未知平台')
        }
        try {
          const mode = String(body?.mode || 'qq')
          const snapshot = await login.start(provider, mode)
          if (snapshot.status === 'error') {
            const failure = loginFailureOf('start', {
              message: snapshot.message,
              code: snapshot.failure === null || snapshot.failure === undefined ? '' : snapshot.failure.code,
              retryAfterMs: snapshot.failure?.retryAfterMs,
            })
            return fail(res, 502, 'LOGIN_START_FAILED', failure.message, { failure: failure.case, facts: failure.facts })
          }
          return sendJson(res, 200, {
            ok: true,
            provider,
            mode,
            key: snapshot.key,
            imageDataUrl: snapshot.imageDataUrl,
            url: snapshot.url,
          })
        } catch (error) {
          const failure = loginFailureOf('start', error)
          return fail(res, 502, 'LOGIN_START_FAILED', failure.message, { failure: failure.case, facts: failure.facts })
        }
      }


      // Folia-shaped account session: one snapshot for the client controller.
      // The Host owns the QR state machine; the client no longer passes keys
      // around or re-derives phases from a raw status string.
      if (pathname === '/online/login/status' && method === 'GET') {
        const provider = (params.get('provider') || '').trim()
        const key = (params.get('key') || '').trim()
        if (!supportsQrLogin(provider) || key === '') {
          return fail(res, 400, 'BAD_REQUEST', '缺少 provider / key')
        }
        try {
          const snapshot = await login.poll(provider)
          if (snapshot.status === 'error') {
            const failure = loginFailureOf('check', {
              message: snapshot.message,
              code: snapshot.failure === null || snapshot.failure === undefined ? '' : snapshot.failure.code,
              retryAfterMs: snapshot.failure?.retryAfterMs,
              scanned: snapshot.detail === 'scanned',
            })
            return fail(res, 502, 'LOGIN_STATUS_FAILED', failure.message, { failure: failure.case, facts: failure.facts })
          }
          const status = snapshot.status === 'authenticated' ? 'success' : snapshot.detail || snapshot.status
          return sendJson(res, 200, { ok: true, status })
        } catch (error) {
          const failure = loginFailureOf('check', error)
          return fail(res, 502, 'LOGIN_STATUS_FAILED', failure.message, { failure: failure.case, facts: failure.facts })
        }
      }

      if (pathname === '/online/login/session' && method === 'GET') {
        const provider = (params.get('provider') || '').trim()
        if (!supportsQrLogin(provider)) {
          return fail(res, 400, 'BAD_PROVIDER', '该平台没有扫码登录')
        }
        try {
          await login.poll(provider)
          return sendJson(res, 200, {
            ok: true,
            provider,
            login: login.sessionOf(provider),
            lastLoginCompletion: null,
            setup: null,
          })
        } catch (error) {
          return fail(
            res,
            502,
            'LOGIN_SESSION_FAILED',
            error instanceof Error ? error.message : '登录会话查询失败',
          )
        }
      }

      // Navidrome/Subsonic has no QR flow: the client posts a server URL plus      // Navidrome/Subsonic has no QR flow: the client posts a server URL plus
      // credentials, we verify with ping, then persist only salt + token.
      if (pathname === '/online/navidrome/login' && method === 'POST') {
        let body
        try {
          body = await readJson(req)
        } catch {
          return fail(res, 400, 'BAD_JSON', '请求体不是合法 JSON')
        }
        const server = ND.normalizeServer(body?.server)
        const username = String(body?.username || '').trim()
        const password = String(body?.password || '')
        if (server === '') return fail(res, 400, 'BAD_SERVER', '服务器地址无效')
        if (username === '') return fail(res, 400, 'BAD_USER', '请填写用户名')
        if (password === '') return fail(res, 400, 'BAD_PASSWORD', '请填写密码')

        const { salt, token } = ND.makeToken(password)
        // Opt-in: keeping the password lets the host mint a native JWT, which is
        // the only way to page through the whole library. Without it we store
        // just the salted token and fall back to Subsonic's random sample.
        const storePassword = body?.storePassword === true
        try {
          const info = await ND.ping({ server, username, salt, token })
          if (storePassword) {
            // Prove the password really works before writing it to disk.
            try {
              await ND.nativeSongs({ server, username, password }, { limit: 1 })
            } catch {
              return fail(res, 400, 'NATIVE_LOGIN_FAILED', '原生接口登录失败，请检查密码')
            }
          }
          if (providerStore !== undefined) {
            await providerStore.setLogin('navidrome', {
              server,
              username,
              salt,
              token,
              password: storePassword ? password : '',
              nativeSongs: storePassword,
              nickname: username,
            })
          }
          return sendJson(res, 200, {
            ok: true,
            serverVersion: info.serverVersion,
            type: info.type,
            nativeSongs: storePassword,
          })
        } catch (error) {
          return fail(
            res,
            502,
            'NAVIDROME_LOGIN_FAILED',
            error instanceof Error ? error.message : '连接服务器失败',
          )
        }
      }

      if (pathname === '/online/logout' && method === 'POST') {
        let body
        try {
          body = await readJson(req)
        } catch {
          return fail(res, 400, 'BAD_JSON', '请求体不是合法 JSON')
        }
        const provider = String(body?.provider || '')
        if (!isOnlineSource(provider)) {
          return fail(res, 400, 'BAD_PROVIDER', '未知平台')
        }
        // The bridge clears the stored session and drops any pending QR state.
        await login.logout(provider)
        // The native-API JWT lives in a module-level cache keyed by server +
        // user, so clearing the stored session is not enough: without this a
        // re-login (or a password change) keeps using the old token.
        omni.forgetTokens(provider)
        return sendJson(res, 200, { ok: true })
      }

      // Browseable song list. Only Navidrome serves one; the Chinese platforms are
      // search-driven and answer with an empty list.
      //
      // Two modes: when the user opted into the native API we page the whole
      // library (ordered on the server so pages never overlap); otherwise we
      // serve Subsonic's getRandomSongs sample, which has no offset.
      if (pathname === '/online/songs' && method === 'GET') {
        const provider = (params.get('provider') || '').trim()
        if (!isOnlineSource(provider)) {
          return fail(res, 400, 'BAD_PROVIDER', '未知平台')
        }
        try {
          const cookie = providerStore === undefined ? '' : await providerStore.cookie(provider)
          const session = providerStore === undefined ? {} : await providerStore.session(provider)
          const size = Number(params.get('size')) || 200
          const offset = Math.max(Number(params.get('offset')) || 0, 0)
          if (provider === 'navidrome' && session.nativeSongs === true && session.password) {
            const page = await omni.nativeSongs(provider, { session }, {
              offset,
              limit: size,
              sort: params.get('sort') || '',
              order: params.get('order') || 'asc',
            })
            return sendJson(res, 200, {
              ok: true,
              provider,
              native: true,
              songs: page.songs,
              total: page.total,
              offset: page.offset,
            })
          }
          const songs = await omni.songs(provider, { cookie, session }, size)
          return sendJson(res, 200, { ok: true, provider, native: false, songs, total: songs.length, offset: 0 })
        } catch (error) {
          return fail(res, 502, 'SONGS_FAILED', error instanceof Error ? error.message : '歌曲列表获取失败')
        }
      }

      // Artist and album cards for a self-hosted library. These are lists
      // only: a row opens the shared /online/album view above, so there is no
      // provider-specific album detail path.
      if (pathname === '/online/artists' && method === 'GET') {
        const provider = (params.get('provider') || '').trim()
        if (!isOnlineSource(provider)) {
          return fail(res, 400, 'BAD_PROVIDER', '未知平台')
        }
        try {
          const cookie = providerStore === undefined ? '' : await providerStore.cookie(provider)
          const session = providerStore === undefined ? {} : await providerStore.session(provider)
          const artists = await omni.artists(provider, { cookie, session })
          return sendJson(res, 200, { ok: true, provider, artists })
        } catch (error) {
          return fail(res, 502, 'ARTISTS_FAILED', error instanceof Error ? error.message : '歌手列表获取失败')
        }
      }

      if (pathname === '/online/albums' && method === 'GET') {
        const provider = (params.get('provider') || '').trim()
        if (!isOnlineSource(provider)) {
          return fail(res, 400, 'BAD_PROVIDER', '未知平台')
        }
        try {
          const cookie = providerStore === undefined ? '' : await providerStore.cookie(provider)
          const session = providerStore === undefined ? {} : await providerStore.session(provider)
          const size = Number(params.get('size')) || 200
          const albums = await omni.albums(provider, { cookie, session }, size)
          return sendJson(res, 200, { ok: true, provider, albums })
        } catch (error) {
          return fail(res, 502, 'ALBUMS_FAILED', error instanceof Error ? error.message : '专辑列表获取失败')
        }
      }

      if (pathname === '/online/artist' && method === 'GET') {
        const provider = (params.get('provider') || '').trim()
        const id = (params.get('id') || '').trim()
        if (!isOnlineSource(provider) || id === '') {
          return fail(res, 400, 'BAD_PROVIDER', '未知平台')
        }
        try {
          const session = providerStore === undefined ? {} : await providerStore.session(provider)
          const cookie = providerStore === undefined ? '' : await providerStore.cookie(provider)
          const result = await omni.artistAlbums(provider, id, { cookie, session })
          return sendJson(res, 200, { ok: true, provider, artist: result.artist, albums: result.albums })
        } catch (error) {
          return fail(res, 502, 'ARTIST_FAILED', error instanceof Error ? error.message : '歌手专辑获取失败')
        }
      }

      if (pathname === '/online/my-playlists' && method === 'GET') {
        const provider = (params.get('provider') || '').trim()
        if (!isOnlineSource(provider)) {
          return fail(res, 400, 'BAD_PROVIDER', '未知平台')
        }
        try {
          const cookie = providerStore === undefined ? '' : await providerStore.cookie(provider)
          const session = providerStore === undefined ? {} : await providerStore.session(provider)
          const playlists = await omni.myPlaylists(provider, { cookie, session })
          return sendJson(res, 200, { ok: true, provider, playlists })
        } catch (error) {
          return fail(
            res,
            502,
            'PLAYLISTS_FAILED',
            error instanceof Error ? error.message : '歌单获取失败',
          )
        }
      }

      if (pathname === '/online/album' && method === 'GET') {
        const provider = (params.get('provider') || '').trim()
        const id = (params.get('id') || '').trim()
        if (!isOnlineSource(provider)) {
          return fail(res, 400, 'BAD_PROVIDER', '未知平台')
        }
        // The Chinese platforms may send only a name and let albumSongs fall
        // back to an album-name search, so an empty id stays valid for them.
        // Navidrome addresses albums purely by id and has no such fallback.
        if (provider === 'navidrome' && id === '') {
          return fail(res, 400, 'BAD_REQUEST', '缺少专辑 id')
        }
        try {
          const cookie = providerStore === undefined ? '' : await providerStore.cookie(provider)
          const session = providerStore === undefined ? {} : await providerStore.session(provider)
          const result = await omni.albumSongs(provider, id, { cookie, session }, {
            name: params.get('name') || '',
            album: params.get('album') || '',
            artist: params.get('artist') || '',
          })
          return sendJson(res, 200, { ok: true, provider, ...result })
        } catch (error) {
          return fail(
            res,
            502,
            'ALBUM_FAILED',
            error instanceof Error ? error.message : '专辑获取失败',
          )
        }
      }

      if (pathname === '/online/playlist-songs' && method === 'GET') {
        const provider = (params.get('provider') || '').trim()
        const id = (params.get('id') || '').trim()
        if (!isOnlineSource(provider) || id === '') {
          return fail(res, 400, 'BAD_REQUEST', '缺少 provider / id')
        }
        try {
          const cookie = providerStore === undefined ? '' : await providerStore.cookie(provider)
          const session = providerStore === undefined ? {} : await providerStore.session(provider)
          const result = await omni.playlistSongs(provider, id, { cookie, session })
          return sendJson(res, 200, {
            ok: true,
            provider,
            name: result.name,
            cover: result.cover,
            trackCount: result.trackCount,
            songs: result.songs,
          })
        } catch (error) {
          return fail(
            res,
            502,
            'PLAYLIST_SONGS_FAILED',
            error instanceof Error ? error.message : '歌单歌曲获取失败',
          )
        }
      }

      if (pathname === '/online/liked' && method === 'GET') {
        const provider = (params.get('provider') || '').trim()
        const id = (params.get('id') || '').trim()
        if (!isOnlineSource(provider) || id === '') {
          return fail(res, 400, 'BAD_REQUEST', '缺少 provider / id')
        }
        try {
          const cookie = providerStore === undefined ? '' : await providerStore.cookie(provider)
          const session = providerStore === undefined ? {} : await providerStore.session(provider)
          const liked = await omni.liked(provider, id, { cookie, session })
          return sendJson(res, 200, { ok: true, liked })
        } catch (error) {
          return fail(res, 502, 'LIKE_STATE_FAILED', error instanceof Error ? error.message : '喜欢状态查询失败')
        }
      }

      if (pathname === '/online/liked-ids' && method === 'GET') {
        const provider = (params.get('provider') || '').trim()
        if (!isOnlineSource(provider)) {
          return fail(res, 400, 'BAD_PROVIDER', '未知平台')
        }
        try {
          const cookie = providerStore === undefined ? '' : await providerStore.cookie(provider)
          const session = providerStore === undefined ? {} : await providerStore.session(provider)
          const ids = await omni.likedIds(provider, { cookie, session })
          return sendJson(res, 200, { ok: true, ids })
        } catch (error) {
          return fail(res, 502, 'LIKE_LIST_FAILED', error instanceof Error ? error.message : '喜欢列表读取失败')
        }
      }

      if (pathname === '/online/like' && method === 'POST') {
        let body
        try {
          body = await readJson(req)
        } catch {
          return fail(res, 400, 'BAD_JSON', '请求体不是合法 JSON')
        }
        const provider = String(body?.provider || '')
        const rawSong = body?.song && typeof body.song === 'object' ? body.song : null
        const songId = onlineSongId(rawSong)
        if (!isOnlineSource(provider) || rawSong === null || songId === '') {
          return fail(res, 400, 'BAD_REQUEST', '缺少 provider / song')
        }
        const song = { ...rawSong, id: songId }
        try {
          const cookie = providerStore === undefined ? '' : await providerStore.cookie(provider)
          const session = providerStore === undefined ? {} : await providerStore.session(provider)
          await omni.setLiked(provider, song, body?.on === true, { cookie, session })
          return sendJson(res, 200, { ok: true, liked: body?.on === true })
        } catch (error) {
          return fail(res, 502, 'LIKE_FAILED', error instanceof Error ? error.message : '喜欢操作失败')
        }
      }

      if (pathname === '/online/playlist-add' && method === 'POST') {
        let body
        try {
          body = await readJson(req)
        } catch {
          return fail(res, 400, 'BAD_JSON', '请求体不是合法 JSON')
        }
        const provider = String(body?.provider || '')
        const playlistId = String(body?.playlistId || '')
        const rawSong = body?.song && typeof body.song === 'object' ? body.song : null
        const songId = String(rawSong?.id || rawSong?.onlineId || '')
        if (!isOnlineSource(provider) || playlistId === '' || rawSong === null || songId === '') {
          return fail(res, 400, 'BAD_REQUEST', '缺少 provider / playlistId / song')
        }
        const song = { ...rawSong, id: songId }
        try {
          const cookie = providerStore === undefined ? '' : await providerStore.cookie(provider)
          const session = providerStore === undefined ? {} : await providerStore.session(provider)
          await omni.addToPlaylist(provider, song, playlistId, { cookie, session })
          return sendJson(res, 200, { ok: true })
        } catch (error) {
          return fail(res, 502, 'PLAYLIST_ADD_FAILED', error instanceof Error ? error.message : '加入歌单失败')
        }
      }

      // Self-hosted covers cannot go through /online/cover: that route only
      // allows the public provider CDNs, and a Navidrome server is by design a
      // private or user-owned host. This route builds the authenticated
      // getCoverArt URL from the stored session, so the caller supplies only an
      // id and can never point the proxy at an arbitrary host.
      if (pathname === '/online/subsonic-cover' && method === 'GET') {
        const provider = (params.get('provider') || 'navidrome').trim()
        const id = (params.get('id') || '').trim()
        if (provider !== 'navidrome' || id === '') {
          return fail(res, 400, 'BAD_REQUEST', '缺少封面 id')
        }
        const session = providerStore === undefined ? {} : await providerStore.session('navidrome')
        let target = ''
        try {
          target = ND.coverArtUrl(
            {
              server: String(session.server || ''),
              username: String(session.username || ''),
              salt: String(session.salt || ''),
              token: String(session.token || ''),
            },
            id,
          )
        } catch {
          return fail(res, 400, 'BAD_SERVER', '服务器地址无效')
        }
        if (target === '') return fail(res, 404, 'NO_COVER', '没有封面')
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 10_000)
        try {
          const upstream = await fetch(target, { signal: controller.signal, redirect: 'follow' })
          if (!upstream.ok) return fail(res, 502, 'COVER_FAILED', 'HTTP ' + upstream.status)
          const type = upstream.headers.get('content-type') || 'image/jpeg'
          if (!type.startsWith('image/')) return fail(res, 502, 'COVER_FAILED', '不是图片')
          const buffer = Buffer.from(await upstream.arrayBuffer())
          res.writeHead(200, {
            'content-type': type,
            'cache-control': 'private, max-age=86400',
            'content-length': String(buffer.length),
          })
          return res.end(buffer)
        } catch {
          return fail(res, 504, 'COVER_TIMEOUT', '封面获取超时')
        } finally {
          clearTimeout(timer)
        }
      }

      if (pathname === '/online/cover' && method === 'GET') {
        const target = (params.get('url') || '').trim()
        let parsed = null
        try {
          parsed = new URL(target)
        } catch {
          parsed = null
        }
        if (parsed === null || (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')) {
          return fail(res, 400, 'BAD_URL', '非法图片地址')
        }
        if (!isAllowedCoverUrl(target)) {
          return fail(res, 400, 'BAD_URL', '封面域名不在允许列表')
        }
        const cacheKey = createHash('sha1').update(parsed.toString()).digest('hex')
        try {
          const cachedCover = onlineCache === undefined ? null : await onlineCache.readAsset(cacheKey)
          if (cachedCover !== null) {
            res.writeHead(200, {
              'content-type': cachedCover.contentType,
              'cache-control': 'public, max-age=604800',
              'content-length': cachedCover.size,
            })
            createReadStream(cachedCover.file).pipe(res)
            return
          }
          const upstream = await fetch(parsed.toString(), {
            redirect: 'follow',
            headers: { 'User-Agent': ONLINE_UA, Referer: 'https://y.qq.com/' },
          })
          if (!upstream.ok) return fail(res, 502, 'COVER_FAILED', 'HTTP ' + upstream.status)
          const contentType = upstream.headers.get('content-type') || 'image/jpeg'
          const headers = {
            'content-type': contentType,
            'cache-control': 'public, max-age=86400',
          }
          const buffer = Buffer.from(await upstream.arrayBuffer())
          headers['content-length'] = buffer.length
          res.writeHead(200, headers)
          res.end(buffer)
          if (onlineCache !== undefined) {
            const ext = contentType.includes('png')
              ? 'png'
              : contentType.includes('webp')
                ? 'webp'
                : contentType.includes('gif')
                  ? 'gif'
                  : 'jpg'
            void onlineCache.writeAsset(cacheKey, buffer, ext)
          }
          return
        } catch (error) {
          return fail(
            res,
            502,
            'COVER_FAILED',
            error instanceof Error ? error.message : '封面代理失败',
          )
        }
      }

      if (pathname === '/online/cache/list' && method === 'GET') {
        if (onlineCache === undefined) return sendJson(res, 200, { ok: true, songs: [] })
        const entries = await onlineCache.listEntries()
        const providerFilter = (params.get('provider') || '').trim()
        const grouped = new Map()
        for (const entry of entries) {
          if (entry.provider === 'cover') continue
          if (providerFilter !== '' && entry.provider !== providerFilter) continue
          const key = entry.provider + ':' + entry.id
          const item = grouped.get(key) || {
            provider: entry.provider,
            id: entry.id,
            size: 0,
            mtime: 0,
            kinds: [],
          }
          item.size += entry.size
          item.mtime = Math.max(item.mtime, entry.mtime)
          item.kinds.push(entry.kind)
          grouped.set(key, item)
        }
        const songs = []
        for (const item of grouped.values()) {
          if (!item.kinds.includes('audio')) continue
          const meta = await onlineCache.readMeta(item.provider, item.id, 'info')
          songs.push({
            provider: item.provider,
            id: item.id,
            title: (meta && meta.title) || item.id,
            artist: (meta && meta.artist) || '',
            album: (meta && meta.album) || '',
            coverUrl: (meta && meta.coverUrl) || '',
            durationSec: Number(meta && meta.durationSec) || 0,
            size: item.size,
            mtime: item.mtime,
            hasLyric: item.kinds.includes('lyric'),
          })
        }
        songs.sort((left, right) => right.mtime - left.mtime)
        return sendJson(res, 200, { ok: true, songs })
      }

      if (pathname === '/online/cache/remove' && method === 'POST') {
        let body
        try {
          body = await readJson(req)
        } catch {
          return fail(res, 400, 'BAD_JSON', '请求体不是合法 JSON')
        }
        const provider = String(body?.provider || '')
        const id = String(body?.id || '')
        if (!isOnlineSource(provider) || id === '') {
          return fail(res, 400, 'BAD_REQUEST', '缺少 provider / id')
        }
        let removed = 0
        if (onlineCache !== undefined) {
          for (const kind of ['audio', 'lyric', 'info']) {
            if (await onlineCache.removeEntry(provider, id, kind)) removed += 1
          }
        }
        return sendJson(res, 200, { ok: true, removed })
      }

      if (pathname === '/online/cache/meta' && method === 'POST') {
        let body
        try {
          body = await readJson(req)
        } catch {
          return fail(res, 400, 'BAD_JSON', '请求体不是合法 JSON')
        }
        const provider = String(body?.provider || '')
        const id = String(body?.id || '')
        if (!isOnlineSource(provider) || id === '') {
          return fail(res, 400, 'BAD_REQUEST', '缺少 provider / id')
        }
        if (onlineCache !== undefined) {
          await onlineCache.writeMeta(provider, id, 'info', {
            title: String(body?.title || ''),
            artist: String(body?.artist || ''),
            album: String(body?.album || ''),
            coverUrl: String(body?.coverUrl || ''),
            durationSec: Number(body?.durationSec) || 0,
            vip: body?.vip === true,
            at: Date.now(),
          })
        }
        return sendJson(res, 200, { ok: true })
      }

      if (pathname === '/online/cache/status' && method === 'GET') {
        const provider = (params.get('provider') || '').trim()
        const ids = (params.get('ids') || '')
          .split(',')
          .map((value) => value.trim())
          .filter((value) => value !== '')
          .slice(0, 200)
        if (!isOnlineSource(provider)) {
          return fail(res, 400, 'BAD_PROVIDER', '未知平台')
        }
        const cached = {}
        const progress = {}
        if (onlineCache !== undefined) {
          for (const id of ids) {
            cached[id] = await onlineCache.isCached(provider, id)
            const live = onlineCache.progress(provider, id)
            if (live !== null) progress[id] = live
          }
        }
        return sendJson(res, 200, { ok: true, cached, progress })
      }

      if (pathname === '/online/cache' && method === 'GET') {
        const stats =
          onlineCache === undefined
            ? { files: 0, bytes: 0, maxBytes: 0 }
            : await onlineCache.stats()
        return sendJson(res, 200, { ok: true, ...stats })
      }

      if (pathname === '/online/cache' && method === 'POST') {
        const removed = onlineCache === undefined ? 0 : await onlineCache.clear()
        return sendJson(res, 200, { ok: true, removed })
      }

      if (pathname === '/online/providers' && method === 'GET') {
        if (kugouSessions !== undefined) {
          await kugouSessions.refreshIfDue('kugou')
          await kugouSessions.validate('kugouLite')
        }
        const summary = providerStore === undefined ? {} : await providerStore.summary()
        for (const provider of ['netease', 'qq', 'kugou', 'kugouLite', 'navidrome']) {
          if (summary[provider] && summary[provider].loggedIn === true) {
            const vipInfo = await vipInfoState(provider)
            summary[provider].vip = vipInfo.vip
            summary[provider].vipExpiresAt = vipInfo.expiresAt
            const profile = await profileState(provider)
            if (profile) {
              if (profile.nickname) summary[provider].nickname = profile.nickname
              if (profile.avatarUrl) summary[provider].avatarUrl = profile.avatarUrl
              if (profile.accountId) summary[provider].accountId = profile.accountId
            }
          }
        }
        // Sources registered outside the legacy provider store (Bodian today) are
        // merged in here so the client can list every platform with its
        // capabilities. Legacy keys are preserved for the existing UI.
        const merged = {}
        for (const source of omni.summaries()) {
          merged[source.id] = {
            ...(summary[source.id] ?? {}),
            displayName: source.displayName,
            kind: source.kind,
            capabilities: source.capabilities,
            qualityLevels: source.qualityLevels,
            loginMethods: source.loginMethods,
          }
        }
        for (const [id, entry] of Object.entries(summary)) {
          if (merged[id] === undefined) merged[id] = entry
        }
        return sendJson(res, 200, { ok: true, providers: merged })
      }


    // Nothing matched: answer here instead of letting the caller write twice.
    fail(res, 404, 'NOT_FOUND', '接口不存在')
  }
}
