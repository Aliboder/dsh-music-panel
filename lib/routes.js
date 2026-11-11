/**
 * The `/music/*` HTTP surface.
 *
 *   GET  /music/config             effective settings + resolved DSH home
 *   POST /music/config             validate and persist roots/depth/extensions
 *   GET  /music/library?refresh=1  scan the configured roots
 *   GET  /music/stream?path=...    range-capable audio stream
 *   GET  /music/cover?path=...     embedded front cover (404 when absent)
 *   GET  /music/lyrics?path=...    sidecar .lrc as timed lines
 *   GET  /music/playlists          user playlists
 *   POST /music/play               record one playback for a track
 *   GET  /music/state              last playback state (resume)
 *   POST /music/state              persist last playback state
 *   POST /music/playback           add actually-listened seconds
 *   POST /music/position           remember one track's resume point
 *   GET  /music/stats?range=...    aggregated play time / plays (all|week|month)
 *
 * Every path parameter is re-resolved against the configured roots, so a
 * crafted `?path=` can never read outside the folders the user granted.
 *
 * @module dsh-music-panel/routes
 */

import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { copyFile, mkdir, readdir, readFile, realpath, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, isAbsolute, join, relative, resolve } from 'node:path'
import { SUPPORTED_EXTENSIONS, extensionOf, mimeOf } from './config.js'
import { fail, isLoopback, isSameOrigin, queryOf, readJson, sendJson } from './http.js'
import { readLyricsFor } from './lyrics.js'
import { backupLyrics, serializeLrc, shiftLrc, writeEmbeddedLyrics } from './lyrics-write.js'
import { readCover } from './meta.js'
import { readTags, writeTags } from './tags.js'
import { searchOnline } from './online.js'
import { fetchLyricById, searchLyricCandidates } from './lyrics-search.js'
import { takeControls } from './control.js'
import { createTrash } from './trash.js'
import * as providers from './providers/index.js'

/** Route prefix owned by this plugin. */
export const PREFIX = '/music'

/** `relative()` handles case-insensitive drives poorly on Windows; normalize. */
function isInside(root, target) {
  const rel = relative(root.toLowerCase(), target.toLowerCase())
  if (rel === '') return true
  return !rel.startsWith('..') && !isAbsolute(rel)
}

/**
 * Turn an untrusted `?path=` into a real file inside one of the roots.
 *
 * @param {string | null} raw
 * @param {readonly string[]} roots
 * @returns {Promise<string | null>}
 */
export async function resolveTrack(raw, roots) {
  if (typeof raw !== 'string' || raw === '') return null
  let real
  try {
    real = await realpath(resolve(raw))
  } catch {
    return null
  }
  if (!SUPPORTED_EXTENSIONS.includes(extensionOf(real))) return null
  const lowered = real.toLowerCase()
  for (const root of roots) {
    let realRoot
    try {
      realRoot = await realpath(resolve(root))
    } catch {
      continue
    }
    if (isInside(realRoot, lowered)) return real
  }
  return null
}

/**
 * Parse one `Range: bytes=...` header against the known size.
 *
 * @returns {null | { invalid: true } | { start: number, end: number }}
 */
export function parseRange(header, size) {
  if (typeof header !== 'string' || header === '') return null
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (match === null) return null
  let start = match[1] === '' ? null : Number(match[1])
  let end = match[2] === '' ? null : Number(match[2])
  if (start === null && end === null) return null
  if (start === null) {
    start = Math.max(size - end, 0)
    end = size - 1
  } else if (end === null) {
    end = size - 1
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) {
    return { invalid: true }
  }
  return { start, end: Math.min(end, size - 1) }
}

function pipeFile(stream, req, res) {
  stream.on('error', () => {
    if (!res.writableEnded) {
      try {
        res.destroy()
      } catch {
        // Already gone.
      }
    }
  })
  req.on('close', () => {
    if (!stream.destroyed) stream.destroy()
  })
  stream.pipe(res)
}

async function sendStream(req, res, file) {
  const info = await stat(file)
  const size = info.size
  const common = {
    'content-type': mimeOf(file),
    'accept-ranges': 'bytes',
    'cache-control': 'private, max-age=0, must-revalidate',
  }
  if (size === 0) {
    res.writeHead(200, { ...common, 'content-length': 0 })
    res.end()
    return
  }

  if (req.method === 'HEAD') {
    res.writeHead(200, { ...common, 'content-length': size })
    res.end()
    return
  }

  const range = parseRange(req.headers.range, size)
  if (range !== null && range.invalid === true) {
    res.writeHead(416, { ...common, 'content-range': `bytes */${size}` })
    res.end()
    return
  }
  if (range === null) {
    res.writeHead(200, { ...common, 'content-length': size })
    pipeFile(createReadStream(file), req, res)
    return
  }
  // Chromium treats a first 206 that carries the entire body as an unseekable
  // stream; a range covering the whole file is answered with 200 instead.
  if (range.start === 0 && range.end === size - 1) {
    res.writeHead(200, { ...common, 'content-length': size })
    pipeFile(createReadStream(file), req, res)
    return
  }
  res.writeHead(206, {
    ...common,
    'content-length': range.end - range.start + 1,
    'content-range': `bytes ${range.start}-${range.end}/${size}`,
  })
  pipeFile(createReadStream(file, { start: range.start, end: range.end }), req, res)
}

async function sendCover(res, file) {
  const info = await stat(file)
  const cover = await readCover(file, info.mtimeMs)
  if (cover === null) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' })
    res.end('no cover')
    return
  }
  res.writeHead(200, {
    'content-type': cover.mime,
    'content-length': cover.data.length,
    'cache-control': 'private, max-age=86400, immutable',
    etag: `"${info.size.toString(16)}-${Math.round(info.mtimeMs).toString(16)}"`,
  })
  res.end(cover.data)
}

/**
 * Validate user-provided roots before persisting them: every entry must exist
 * and be a directory. Missing entries are reported, not silently dropped.
 *
 * @param {unknown[]} list
 */
async function validateRoots(list) {
  const good = []
  const bad = []
  for (const raw of list) {
    if (typeof raw !== 'string' || raw.trim() === '') continue
    const abs = resolve(raw.trim())
    try {
      const info = await stat(abs)
      if (info.isDirectory()) good.push(abs)
      else bad.push(abs)
    } catch {
      bad.push(abs)
    }
  }
  return { good, bad }
}

/**
 * @param {{
 *   settings: { read: () => Promise<any>, write: (patch: any) => Promise<any>, home: string, file: string },
 *   library: { scan: (options?: { refresh?: boolean }) => Promise<any> },
 *   playlists: {
 *     list: () => Promise<any[]>,
 *     create: (name?: string) => Promise<any | null>,
 *     update: (id: string, patch: { name?: string, add?: string[], remove?: string[] }) => Promise<any | null>,
 *     remove: (id: string) => Promise<boolean>,
 *   },
 *   stats: { recordPlay: (path: string) => Promise<{ plays: number }> },
 *   favorites: { list: () => Promise<Array<{path:string,addedAt:number}>>, toggle: (path: string) => Promise<{ favorite: boolean, favorites: Array<object> }> },
 *   playback: { read: () => Promise<object | null>, write: (state: unknown) => Promise<object | null> },
 * }} deps
 */
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

export function createRoutes({ settings, library, playlists, stats, playback, favorites, providerStore, onlineCache }) {
  const trash = createTrash({ dir: join(settings.dir || settings.home || '.', 'trash') })
  const vipCache = new Map()
  const profileCache = new Map()
  async function profileState(provider) {
    const cached = profileCache.get(provider)
    if (cached && Date.now() - cached.at < 5 * 60 * 1000) return cached.profile
    let profile = null
    try {
      const cookie = providerStore === undefined ? '' : await providerStore.cookie(provider)
      const session = providerStore === undefined ? {} : await providerStore.session(provider)
      profile = await providers.providerProfile(provider, cookie, session)
    } catch {
      profile = null
    }
    profileCache.set(provider, { at: Date.now(), profile })
    return profile
  }
  async function vipState(provider) {
    const cached = vipCache.get(provider)
    if (cached && Date.now() - cached.at < 5 * 60 * 1000) return cached.vip
    let vip = null
    try {
      const cookie = providerStore === undefined ? '' : await providerStore.cookie(provider)
      const session = providerStore === undefined ? {} : await providerStore.session(provider)
      vip = await providers.providerVip(provider, cookie, session)
    } catch {
      vip = null
    }
    vipCache.set(provider, { at: Date.now(), vip })
    return vip
  }
  return async function handle(req, res) {
    try {
      if (!isLoopback(req)) return fail(res, 403, 'NOT_LOOPBACK', '仅允许本机访问（远程访问已禁用音乐面板）')
      if (!isSameOrigin(req)) return fail(res, 403, 'BAD_ORIGIN', '跨站请求被拒绝')

      const url = new URL(req.url ?? '/', 'http://localhost')
      const pathname = url.pathname.startsWith(PREFIX) ? url.pathname.slice(PREFIX.length) || '/' : url.pathname
      const method = (req.method ?? 'GET').toUpperCase()
      const params = queryOf(req)

      // Model tools enqueue playback actions here; the open panel drains them.
      if (pathname === '/control/pending' && method === 'GET') {
        return sendJson(res, 200, { ok: true, actions: takeControls() })
      }

      // ── online providers (NetEase / QQ / KuGou) ─────────────────────────
      if (pathname === '/online/search' && method === 'GET') {
        const provider = (params.get('provider') || '').trim()
        const query = (params.get('q') || '').trim()
        if (!['netease', 'qq', 'kugou', 'kugouLite'].includes(provider)) {
          return fail(res, 400, 'BAD_PROVIDER', '未知平台')
        }
        if (query === '') return fail(res, 400, 'NO_QUERY', '缺少搜索词')
        try {
          const cookie = providerStore === undefined ? '' : await providerStore.cookie(provider)
          const results = await providers.search(provider, query, cookie)
          return sendJson(res, 200, { ok: true, provider, query, results })
        } catch (error) {
          return fail(
            res,
            502,
            'SEARCH_FAILED',
            error instanceof Error ? error.message : '在线搜索失败',
          )
        }
      }

      if (pathname === '/online/stream' && (method === 'GET' || method === 'HEAD')) {
        const provider = (params.get('provider') || '').trim()
        const id = (params.get('id') || '').trim()
        if (!['netease', 'qq', 'kugou', 'kugouLite'].includes(provider) || id === '') {
          return fail(res, 400, 'BAD_REQUEST', '缺少 provider / id')
        }
        // Enforce the account entitlement on the Host as well as in the client:
        // a direct /online/stream request must not bypass the VIP gate.
        const vipRequired = providers.requiresVip(provider, id)
        if (vipRequired === true) {
          const accountVip = await vipState(provider)
          if (accountVip !== true) {
            return fail(res, 403, 'VIP_REQUIRED', '该曲目需要对应平台的 VIP 会员')
          }
        }
        try {
          // 1) Serve from the on-disk cache when we already have the bytes.
          const cached = onlineCache === undefined ? null : await onlineCache.lookup(provider, id)
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
            session = providers.createKugouDevice()
            if (providerStore !== undefined) await providerStore.setSession(provider, session)
          }
          const config = await settings.read()
          const quality = config.onlineQuality || 'high'
          // Provider lookups occasionally fail on a transient network hiccup:
          // retry once before surfacing the error.
          let stream = null
          for (let attempt = 0; attempt < 2; attempt += 1) {
            try {
              stream = await providers.resolveStream(provider, id, cookie, session, quality)
              break
            } catch (error) {
              if (attempt === 1) throw error
              await new Promise((resolveDelay) => setTimeout(resolveDelay, 400))
            }
          }
          if (stream.url === '') {
            return fail(res, 404, 'NO_STREAM', '该曲目暂不可播（可能需要登录或 VIP）')
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
              void sink.finish()
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

      if (pathname === '/online/lyric' && method === 'GET') {
        const provider = (params.get('provider') || '').trim()
        const id = (params.get('id') || '').trim()
        if (!['netease', 'qq', 'kugou', 'kugouLite'].includes(provider) || id === '') {
          return fail(res, 400, 'BAD_REQUEST', '缺少 provider / id')
        }
        try {
          const cachedLyric =
            onlineCache === undefined ? null : await onlineCache.readMeta(provider, id, 'lyric')
          if (cachedLyric !== null && typeof cachedLyric.lrc === 'string') {
            return sendJson(res, 200, {
              ok: true,
              lrc: cachedLyric.lrc,
              translation: cachedLyric.translation || '',
              cached: true,
            })
          }
          const cookie = providerStore === undefined ? '' : await providerStore.cookie(provider)
          const lyric = await providers.lyric(provider, id, cookie)
          if (onlineCache !== undefined && lyric.lrc !== '') {
            void onlineCache.writeMeta(provider, id, 'lyric', {
              lrc: lyric.lrc,
              translation: lyric.translation || '',
              at: Date.now(),
            })
          }
          return sendJson(res, 200, { ok: true, lrc: lyric.lrc, translation: lyric.translation })
        } catch (error) {
          return fail(
            res,
            502,
            'LYRIC_FAILED',
            error instanceof Error ? error.message : '在线歌词获取失败',
          )
        }
      }

      if (pathname === '/online/quality' && method === 'GET') {
        const provider = (params.get('provider') || '').trim()
        const id = (params.get('id') || '').trim()
        if (!['netease', 'qq', 'kugou', 'kugouLite'].includes(provider) || id === '') {
          return fail(res, 400, 'BAD_REQUEST', '缺少 provider / id')
        }
        try {
          const cookie = providerStore === undefined ? '' : await providerStore.cookie(provider)
          let session = providerStore === undefined ? {} : await providerStore.session(provider)
          if (provider === 'kugou' && (session.mid === undefined || session.mid === '')) {
            session = providers.createKugouDevice()
            if (providerStore !== undefined) await providerStore.setSession('kugou', session)
          }
          const config = await settings.read()
          const stream = await providers.resolveStream(
            provider,
            id,
            cookie,
            session,
            config.onlineQuality || 'high',
          )
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
        if (!['netease', 'qq', 'kugou', 'kugouLite'].includes(provider) || ids.length === 0) {
          return fail(res, 400, 'BAD_REQUEST', '缺少 provider / ids')
        }
        const cookie = providerStore === undefined ? '' : await providerStore.cookie(provider)
        let session = providerStore === undefined ? {} : await providerStore.session(provider)
        if (provider === 'kugou' && (session.mid === undefined || session.mid === '')) {
          session = providers.createKugouDevice()
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
                const stream = await providers.resolveStream(provider, id, cookie, session, quality)
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
        if (!['netease', 'qq', 'kugou', 'kugouLite'].includes(provider)) {
          return fail(res, 400, 'BAD_PROVIDER', '未知平台')
        }
        try {
          const session = providerStore === undefined ? {} : await providerStore.session(provider)
          const mode = String(body?.mode || 'qq')
          const qr = await providers.loginStart(provider, session, mode)
          return sendJson(res, 200, {
            ok: true,
            provider,
            mode,
            key: qr.key,
            imageDataUrl: qr.imageDataUrl,
            url: qr.url,
          })
        } catch (error) {
          return fail(
            res,
            502,
            'LOGIN_START_FAILED',
            error instanceof Error ? error.message : '登录二维码获取失败',
          )
        }
      }

      if (pathname === '/online/login/status' && method === 'GET') {
        const provider = (params.get('provider') || '').trim()
        const key = (params.get('key') || '').trim()
        if (!['netease', 'qq', 'kugou', 'kugouLite'].includes(provider) || key === '') {
          return fail(res, 400, 'BAD_REQUEST', '缺少 provider / key')
        }
        try {
          const mode = String(params.get('mode') || 'qq')
          const result = await providers.loginStatus(provider, key, mode)
          if (result.status === 'success' && providerStore !== undefined) {
            await providerStore.setLogin(provider, {
              cookie: result.cookie || '',
              token: result.token || '',
              mid: result.device ? result.device.mid : '',
              dfid: result.device ? result.device.dfid : '',
              guid: result.device ? result.device.guid : '',
              userid: result.userid || 0,
              nickname: result.nickname || (result.extra && result.extra.nickname) || '',
              vip_type: result.vipType || '',
              vip_token: result.vipToken || '',
            })
          }
          return sendJson(res, 200, { ok: true, status: result.status })
        } catch (error) {
          return fail(
            res,
            502,
            'LOGIN_STATUS_FAILED',
            error instanceof Error ? error.message : '登录状态查询失败',
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
        if (!['netease', 'qq', 'kugou', 'kugouLite'].includes(provider)) {
          return fail(res, 400, 'BAD_PROVIDER', '未知平台')
        }
        if (providerStore !== undefined) await providerStore.clear(provider)
        return sendJson(res, 200, { ok: true })
      }

      if (pathname === '/online/my-playlists' && method === 'GET') {
        const provider = (params.get('provider') || '').trim()
        if (!['netease', 'qq', 'kugou', 'kugouLite'].includes(provider)) {
          return fail(res, 400, 'BAD_PROVIDER', '未知平台')
        }
        try {
          const cookie = providerStore === undefined ? '' : await providerStore.cookie(provider)
          const session = providerStore === undefined ? {} : await providerStore.session(provider)
          const playlists = await providers.myPlaylists(provider, cookie, session)
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

      if (pathname === '/online/playlist-songs' && method === 'GET') {
        const provider = (params.get('provider') || '').trim()
        const id = (params.get('id') || '').trim()
        if (!['netease', 'qq', 'kugou', 'kugouLite'].includes(provider) || id === '') {
          return fail(res, 400, 'BAD_REQUEST', '缺少 provider / id')
        }
        try {
          const cookie = providerStore === undefined ? '' : await providerStore.cookie(provider)
          const session = providerStore === undefined ? {} : await providerStore.session(provider)
          const result = await providers.playlistSongs(provider, id, cookie, session)
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
        if (!['netease', 'qq', 'kugou', 'kugouLite'].includes(provider) || id === '') {
          return fail(res, 400, 'BAD_REQUEST', '缺少 provider / id')
        }
        try {
          const cookie = providerStore === undefined ? '' : await providerStore.cookie(provider)
          const session = providerStore === undefined ? {} : await providerStore.session(provider)
          const liked = await providers.onlineLiked(provider, id, cookie, session)
          return sendJson(res, 200, { ok: true, liked })
        } catch (error) {
          return fail(res, 502, 'LIKE_STATE_FAILED', error instanceof Error ? error.message : '喜欢状态查询失败')
        }
      }

      if (pathname === '/online/liked-ids' && method === 'GET') {
        const provider = (params.get('provider') || '').trim()
        if (!['netease', 'qq', 'kugou', 'kugouLite'].includes(provider)) {
          return fail(res, 400, 'BAD_PROVIDER', '未知平台')
        }
        try {
          const cookie = providerStore === undefined ? '' : await providerStore.cookie(provider)
          const session = providerStore === undefined ? {} : await providerStore.session(provider)
          const ids = await providers.onlineLikedIds(provider, cookie, session)
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
        if (!['netease', 'qq', 'kugou', 'kugouLite'].includes(provider) || rawSong === null || songId === '') {
          return fail(res, 400, 'BAD_REQUEST', '缺少 provider / song')
        }
        const song = { ...rawSong, id: songId }
        try {
          const cookie = providerStore === undefined ? '' : await providerStore.cookie(provider)
          const session = providerStore === undefined ? {} : await providerStore.session(provider)
          await providers.setOnlineLiked(provider, song, body?.on === true, cookie, session)
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
        if (!['netease', 'qq', 'kugou', 'kugouLite'].includes(provider) || playlistId === '' || rawSong === null || songId === '') {
          return fail(res, 400, 'BAD_REQUEST', '缺少 provider / playlistId / song')
        }
        const song = { ...rawSong, id: songId }
        try {
          const cookie = providerStore === undefined ? '' : await providerStore.cookie(provider)
          const session = providerStore === undefined ? {} : await providerStore.session(provider)
          await providers.addOnlineSongToPlaylist(provider, song, playlistId, cookie, session)
          return sendJson(res, 200, { ok: true })
        } catch (error) {
          return fail(res, 502, 'PLAYLIST_ADD_FAILED', error instanceof Error ? error.message : '加入歌单失败')
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
        // Only provider CDNs, so this route cannot become a general SSRF proxy.
        const host = parsed.hostname.toLowerCase()
        const allowed =
          host.endsWith('.gtimg.cn') ||
          host.endsWith('.qq.com') ||
          host.endsWith('.126.net') ||
          host.endsWith('.kugou.com') ||
          host.endsWith('.kgimg.com')
        if (!allowed) return fail(res, 400, 'BAD_URL', '不支持的图片域名')
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
        if (!['netease', 'qq', 'kugou', 'kugouLite'].includes(provider) || id === '') {
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
        if (!['netease', 'qq', 'kugou', 'kugouLite'].includes(provider) || id === '') {
          return fail(res, 400, 'BAD_REQUEST', '缺少 provider / id')
        }
        if (onlineCache !== undefined) {
          await onlineCache.writeMeta(provider, id, 'info', {
            title: String(body?.title || ''),
            artist: String(body?.artist || ''),
            album: String(body?.album || ''),
            coverUrl: String(body?.coverUrl || ''),
            durationSec: Number(body?.durationSec) || 0,
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
        if (!['netease', 'qq', 'kugou', 'kugouLite'].includes(provider)) {
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
        const summary = providerStore === undefined ? {} : await providerStore.summary()
        for (const provider of ['netease', 'qq', 'kugou', 'kugouLite']) {
          if (summary[provider] && summary[provider].loggedIn === true) {
            summary[provider].vip = await vipState(provider)
            const profile = await profileState(provider)
            if (profile) {
              if (profile.nickname) summary[provider].nickname = profile.nickname
              if (profile.avatarUrl) summary[provider].avatarUrl = profile.avatarUrl
            }
          }
        }
        return sendJson(res, 200, { ok: true, providers: summary })
      }

      if (pathname === '/config' && method === 'GET') {
        const config = await settings.read()
        return sendJson(res, 200, { ok: true, config, home: settings.home, file: settings.file })
      }

      // Folder browser backing the library picker (read-only directory listing).
      if (pathname === '/browse' && method === 'GET') {
        const requested = (params.get('path') || '').trim()

        // Empty path is a virtual root: list drives so other disks are reachable.
        if (requested === '') {
          const dirs = []
          if (process.platform === 'win32') {
            for (let code = 65; code <= 90; code += 1) {
              const drive = String.fromCharCode(code) + ':\\'
              try {
                await stat(drive)
                dirs.push({ name: drive.slice(0, 2), path: drive })
              } catch {
                // Drive letter not present.
              }
            }
          } else {
            dirs.push({ name: '/', path: '/' })
          }
          return sendJson(res, 200, { ok: true, path: '', parent: null, dirs })
        }

        const target = requested
        if (!isAbsolute(target)) return fail(res, 400, 'BAD_PATH', '需要绝对路径')

        let entries
        try {
          entries = await readdir(target, { withFileTypes: true })
        } catch {
          return fail(res, 404, 'NOT_FOUND', '目录不存在或不可读')
        }

        const dirs = entries
          .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
          .map((entry) => ({ name: entry.name, path: join(target, entry.name) }))
          .sort((left, right) => left.name.localeCompare(right.name))

        const up = dirname(target)
        // A drive root goes back to the virtual root (drive list), not nowhere.
        const parent = up === target ? '' : up
        return sendJson(res, 200, { ok: true, path: target, parent, dirs })
      }

      if (pathname === '/config' && method === 'POST') {
        let body
        try {
          body = await readJson(req)
        } catch {
          return fail(res, 400, 'BAD_JSON', '请求体不是合法 JSON')
        }
        const rawRoots = Array.isArray(body?.roots) ? body.roots : null
        const patch = {}
        if (rawRoots !== null) {
          const { good, bad } = await validateRoots(rawRoots)
          if (bad.length > 0) {
            return sendJson(res, 400, {
              ok: false,
              error: { code: 'BAD_ROOT', message: '目录不存在或不是文件夹' },
              bad,
            })
          }
          patch.roots = good
        }
        if (body?.depth !== undefined) patch.depth = body.depth
        if (Array.isArray(body?.extensions)) patch.extensions = body.extensions
        if (typeof body?.onlineQuality === 'string') patch.onlineQuality = body.onlineQuality
        const config = await settings.write(patch)
        return sendJson(res, 200, { ok: true, config, home: settings.home, file: settings.file })
      }

      if (pathname === '/library' && (method === 'GET' || method === 'HEAD')) {
        const config = await settings.read()
        const result = await library.scan({ refresh: params.get('refresh') === '1' })
        return sendJson(res, 200, { ok: true, config, ...result })
      }

      if (pathname === '/stream' && (method === 'GET' || method === 'HEAD')) {
        const config = await settings.read()
        const file = await resolveTrack(params.get('path'), config.roots)
        if (file === null) return fail(res, 404, 'NOT_FOUND', '文件不在已配置的音乐目录内')
        return await sendStream(req, res, file)
      }

      if (pathname === '/cover' && method === 'GET') {
        const config = await settings.read()
        const file = await resolveTrack(params.get('path'), config.roots)
        if (file === null) return fail(res, 404, 'NOT_FOUND', '文件不在已配置的音乐目录内')
        return await sendCover(res, file)
      }

      // Online lyric lookup (NetEase), then save the chosen LRC next to the track.
      if (pathname === '/lyrics/search' && method === 'GET') {
        const query = (params.get('q') || '').trim()
        if (query === '') return fail(res, 400, 'NO_QUERY', '缺少搜索词')
        try {
          const candidates = await searchLyricCandidates(query)
          return sendJson(res, 200, { ok: true, candidates })
        } catch (error) {
          return fail(
            res,
            502,
            'SEARCH_FAILED',
            error instanceof Error ? error.message : '歌词搜索失败',
          )
        }
      }

      if (pathname === '/lyrics/fetch' && method === 'GET') {
        const id = (params.get('id') || '').trim()
        if (id === '') return fail(res, 400, 'NO_ID', '缺少歌曲 id')
        try {
          const lyric = await fetchLyricById(id)
          return sendJson(res, 200, { ok: true, lrc: lyric.lrc, translation: lyric.translation })
        } catch (error) {
          return fail(
            res,
            502,
            'LYRIC_FAILED',
            error instanceof Error ? error.message : '歌词获取失败',
          )
        }
      }

      if (pathname === '/lyrics/save' && method === 'POST') {
        let body
        try {
          body = await readJson(req)
        } catch {
          return fail(res, 400, 'BAD_JSON', '请求体不是合法 JSON')
        }
        const config = await settings.read()
        const file = await resolveTrack(body?.path, config.roots)
        if (file === null) return fail(res, 404, 'NOT_FOUND', '文件不在已配置的音乐目录内')
        const lrc = typeof body?.lrc === 'string' ? body.lrc : ''
        if (lrc.trim() === '') return fail(res, 400, 'EMPTY', '歌词为空')
        let backup = ''
        try {
          const existing = await readLyricsFor(file)
          const raw = typeof existing?.raw === 'string' && existing.raw.trim() !== '' ? existing.raw : ''
          if (raw !== '') backup = await backupLyrics(file, raw)
        } catch {
          backup = ''
        }
        try {
          const target = await writeEmbeddedLyrics(file, lrc)
          return sendJson(res, 200, { ok: true, target, backup })
        } catch (error) {
          const code =
            error !== null && typeof error === 'object' && typeof error.code === 'string'
              ? error.code
              : 'WRITE_FAILED'
          return fail(res, 500, code, String(error?.message ?? error))
        }
      }

      if (pathname === '/lyrics' && method === 'GET') {
        const config = await settings.read()
        const file = await resolveTrack(params.get('path'), config.roots)
        if (file === null) return fail(res, 404, 'NOT_FOUND', '文件不在已配置的音乐目录内')
        const order = String(params.get('order') || '')
          .split(',')
          .map((part) => part.trim())
          .filter((part) => part === 'embedded' || part === 'lrc')
        const result = await readLyricsFor(file, order.length > 0 ? order : undefined)
        const offsetMs = stats !== undefined ? (await stats.get(file))?.lyricOffsetMs ?? 0 : 0
        return sendJson(res, 200, {
          ok: true,
          lines: result.lines,
          timed: result.timed,
          source: result.source,
          file: result.file,
          offsetMs,
        })
      }

      if (pathname === '/lyrics/calibrate' && method === 'POST') {
        if (stats === undefined) return fail(res, 503, 'UNAVAILABLE', '统计未启用')
        let body
        try {
          body = await readJson(req)
        } catch {
          return fail(res, 400, 'BAD_JSON', '请求体不是合法 JSON')
        }
        const config = await settings.read()
        const file = await resolveTrack(body?.path, config.roots)
        if (file === null) return fail(res, 404, 'NOT_FOUND', '文件不在已配置的音乐目录内')
        const offsetMs = Math.max(-60_000, Math.min(60_000, Math.round(Number(body?.offsetMs) || 0)))

        if (body?.write === true) {
          const lyrics = await readLyricsFor(file)
          if (lyrics.lines.length === 0) return fail(res, 404, 'NO_LYRICS', '没有可写回的歌词')
          const raw = typeof lyrics.raw === 'string' && lyrics.raw.trim() !== '' ? lyrics.raw : serializeLrc(lyrics.lines)
          const shifted = shiftLrc(raw, offsetMs)
          const backup = await backupLyrics(file, raw)
          try {
            const target = await writeEmbeddedLyrics(file, shifted)
            const entry = await stats.setLyricOffset(file, 0)
            return sendJson(res, 200, { ok: true, target, backup, offsetMs: entry.lyricOffsetMs })
          } catch (error) {
            const code = error !== null && typeof error === 'object' && typeof error.code === 'string'
              ? error.code
              : 'WRITE_FAILED'
            return fail(res, 500, code, String(error?.message ?? error))
          }
        }

        const entry = await stats.setLyricOffset(file, offsetMs)
        return sendJson(res, 200, { ok: true, offsetMs: entry.lyricOffsetMs })
      }

      if (pathname === '/favorites' && method === 'GET') {
        const list = favorites === undefined ? [] : await favorites.list()
        return sendJson(res, 200, { ok: true, favorites: list })
      }

      if (pathname === '/favorites' && method === 'POST') {
        if (favorites === undefined) return fail(res, 503, 'UNAVAILABLE', '收藏未启用')
        let body
        try {
          body = await readJson(req)
        } catch {
          return fail(res, 400, 'BAD_JSON', '请求体不是合法 JSON')
        }
        const config = await settings.read()
        const file = await resolveTrack(body?.path, config.roots)
        if (file === null) return fail(res, 404, 'NOT_FOUND', '文件不在已配置的音乐目录内')
        const result = await favorites.toggle(file)
        return sendJson(res, 200, { ok: true, favorite: result.favorite, favorites: result.favorites })
      }

      // Reveal a track in the OS file manager. Only files already inside the
      // configured roots reach this point; args are passed to spawn without a
      // shell, so the path cannot inject commands.
      // Move files into the plugin trash instead of deleting them, so duplicate
      // cleanup stays recoverable.
      if (pathname === '/remove' && method === 'POST') {
        let body
        try {
          body = await readJson(req)
        } catch {
          return fail(res, 400, 'BAD_JSON', '请求体不是合法 JSON')
        }
        const config = await settings.read()
        const list = Array.isArray(body?.paths) ? body.paths : []
        if (list.length === 0) return fail(res, 400, 'NO_PATHS', '没有要删除的文件')
        const moved = []
        const failed = []
        for (const raw of list) {
          if (typeof raw !== 'string') continue
          const file = await resolveTrack(raw, config.roots)
          if (file === null) {
            failed.push({ path: raw, error: '不在音乐目录内' })
            continue
          }
          let info
          try {
            info = await stat(file)
          } catch {
            failed.push({ path: raw, error: '文件不存在' })
            continue
          }
          if (!info.isFile()) {
            failed.push({ path: raw, error: '不是文件' })
            continue
          }
          try {
            await trash.moveIn(file, raw)
            moved.push(raw)
          } catch (error) {
            failed.push({
              path: raw,
              error: error instanceof Error ? error.message : '移动失败',
            })
          }
        }
        return sendJson(res, 200, { ok: true, moved, failed, trash: trash.dir })
      }

      if (pathname === '/trash' && method === 'GET') {
        try {
          return sendJson(res, 200, { ok: true, entries: await trash.list() })
        } catch (error) {
          return fail(res, 500, 'TRASH_FAILED', String(error?.message ?? error))
        }
      }

      if (pathname === '/trash/restore' && method === 'POST') {
        let body
        try {
          body = await readJson(req)
        } catch {
          return fail(res, 400, 'BAD_JSON', '请求体不是合法 JSON')
        }
        try {
          const result = await trash.restore(typeof body?.id === 'string' ? body.id : '')
          return sendJson(res, 200, { ok: true, path: result.path })
        } catch (error) {
          const code = error?.code === 'BAD_ID' ? 400 : error?.code === 'NOT_FOUND' ? 404 : error?.code === 'NO_PATH' ? 409 : 500
          return fail(res, code, String(error?.code ?? 'RESTORE_FAILED'), String(error?.message ?? error))
        }
      }

      if (pathname === '/reveal' && method === 'POST') {
        let body
        try {
          body = await readJson(req)
        } catch {
          return fail(res, 400, 'BAD_JSON', '请求体不是合法 JSON')
        }
        const config = await settings.read()
        const file = await resolveTrack(body?.path, config.roots)
        if (file === null) return fail(res, 404, 'NOT_FOUND', '文件不在已配置的音乐目录内')
        try {
          // Explorer parses its command line itself: the reliable form is
          // `/select,"C:\path\file.mp3"` with quotes hugging the comma. Node
          // would re-quote/escape that argument, so pass it verbatim.
          const opener =
            process.platform === 'win32'
              ? { name: 'explorer.exe', args: ['/select,"' + file + '"'], verbatim: true }
              : process.platform === 'darwin'
                ? { name: 'open', args: ['-R', file], verbatim: false }
                : { name: 'xdg-open', args: [dirname(file)], verbatim: false }
          const child = spawn(opener.name, opener.args, {
            detached: true,
            stdio: 'ignore',
            windowsVerbatimArguments: opener.verbatim,
          })
          // Without this listener an ENOENT would surface as an unhandled error.
          child.on('error', () => {})
          child.unref()
          return sendJson(res, 200, { ok: true })
        } catch (error) {
          return fail(res, 500, 'REVEAL_FAILED', String(error?.message ?? error))
        }
      }

      // Editable tags: read the full field set, or rewrite it in place.
      if (pathname === '/tags' && method === 'GET') {
        const config = await settings.read()
        const file = await resolveTrack(params.get('path'), config.roots)
        if (file === null) return fail(res, 404, 'NOT_FOUND', '文件不在已配置的音乐目录内')
        try {
          const result = await readTags(file)
          return sendJson(res, 200, { ok: true, format: result.format, tags: result.tags })
        } catch (error) {
          if (error?.code === 'UNSUPPORTED_FORMAT') {
            return fail(res, 400, 'UNSUPPORTED_FORMAT', String(error.message))
          }
          return fail(res, 500, 'TAGS_READ_FAILED', String(error?.message ?? error))
        }
      }
      if (pathname === '/tags' && method === 'PUT') {
        let body
        try {
          body = await readJson(req)
        } catch {
          return fail(res, 400, 'BAD_JSON', '请求体不是合法 JSON')
        }
        const config = await settings.read()
        const file = await resolveTrack(body?.path, config.roots)
        if (file === null) return fail(res, 404, 'NOT_FOUND', '文件不在已配置的音乐目录内')
        try {
          const result = await writeTags(
            file,
            body?.tags,
            typeof body?.coverUrl === 'string' ? body.coverUrl : '',
          )
          return sendJson(res, 200, { ok: true, format: result.format, tags: result.tags })
        } catch (error) {
          const code = error?.code
          if (
            code === 'UNSUPPORTED_FORMAT' ||
            code === 'INVALID_TAGS' ||
            code === 'INVALID_COVER'
          ) {
            return fail(res, 400, code, String(error.message))
          }
          return fail(res, 500, 'TAGS_WRITE_FAILED', String(error?.message ?? error))
        }
      }

      // Multi-source online metadata lookup (NetEase / QQ / iTunes / MusicBrainz).
      if (pathname === '/online-search' && method === 'POST') {
        let body
        try {
          body = await readJson(req)
        } catch {
          return fail(res, 400, 'BAD_JSON', '请求体不是合法 JSON')
        }
        try {
          const result = await searchOnline({
            title: typeof body?.title === 'string' ? body.title : '',
            artist: typeof body?.artist === 'string' ? body.artist : '',
            album: typeof body?.album === 'string' ? body.album : '',
          })
          return sendJson(res, 200, { ok: true, results: result.results, sources: result.sources })
        } catch (error) {
          return fail(res, 500, 'ONLINE_SEARCH_FAILED', String(error?.message ?? error))
        }
      }

      if (pathname === '/playlists' && method === 'GET') {
        return sendJson(res, 200, { ok: true, playlists: await playlists.list() })
      }
      if (pathname === '/playlists' && method === 'POST') {
        let body
        try {
          body = await readJson(req)
        } catch {
          return fail(res, 400, 'BAD_JSON', '请求体不是合法 JSON')
        }
        const created = await playlists.create(body?.name)
        if (created === null) return fail(res, 400, 'LIMIT', '播放列表数量已达上限')
        return sendJson(res, 200, { ok: true, playlist: created })
      }

      const playlistMatch = /^\/playlists\/([^/]+)$/.exec(pathname)
      if (playlistMatch !== null) {
        const id = decodeURIComponent(playlistMatch[1])
        if (method === 'PATCH') {
          let body
          try {
            body = await readJson(req)
          } catch {
            return fail(res, 400, 'BAD_JSON', '请求体不是合法 JSON')
          }
          const updated = await playlists.update(id, body !== null && typeof body === 'object' ? body : {})
          if (updated === null) return fail(res, 404, 'NOT_FOUND', '没有这个播放列表')
          return sendJson(res, 200, { ok: true, playlist: updated })
        }
        if (method === 'DELETE') {
          const removed = await playlists.remove(id)
          if (!removed) return fail(res, 404, 'NOT_FOUND', '没有这个播放列表')
          return sendJson(res, 200, { ok: true })
        }
      }

      if (pathname === '/state' && method === 'GET') {
        const state = playback === undefined ? null : await playback.read()
        return sendJson(res, 200, { ok: true, state })
      }

      if (pathname === '/state' && method === 'POST') {
        if (playback === undefined) return fail(res, 503, 'UNAVAILABLE', '播放状态持久化未启用')
        let body
        try {
          body = await readJson(req)
        } catch {
          return fail(res, 400, 'BAD_JSON', '请求体不是合法 JSON')
        }
        const state = await playback.write(body)
        if (state === null) return fail(res, 400, 'BAD_STATE', '播放状态格式不正确')
        return sendJson(res, 200, { ok: true, state })
      }

      if (pathname === '/playback' && method === 'POST') {
        if (stats === undefined) return fail(res, 503, 'UNAVAILABLE', '统计未启用')
        let body
        try {
          body = await readJson(req)
        } catch {
          return fail(res, 400, 'BAD_JSON', '请求体不是合法 JSON')
        }
        const config = await settings.read()
        const file = await resolveTrack(body?.path, config.roots)
        if (file === null) return fail(res, 404, 'NOT_FOUND', '文件不在已配置的音乐目录内')
        const seconds = Number(body?.seconds)
        if (!Number.isFinite(seconds) || seconds <= 0) {
          return fail(res, 400, 'BAD_SECONDS', 'seconds 必须是正数')
        }
        const entry = await stats.addPlayTime(file, seconds)
        if (entry === null) return fail(res, 400, 'BAD_SECONDS', 'seconds 必须是正数')
        if (body?.positionSec !== undefined) {
          await stats.setPosition(file, body.positionSec)
        }
        return sendJson(res, 200, {
          ok: true,
          path: file,
          playSeconds: entry.playSeconds,
          plays: entry.plays,
        })
      }

      if (pathname === '/position' && method === 'GET') {
        if (stats === undefined) return sendJson(res, 200, { ok: true, lastPositionSec: null })
        const config = await settings.read()
        const file = await resolveTrack(params.get('path'), config.roots)
        if (file === null) return fail(res, 404, 'NOT_FOUND', '文件不在已配置的音乐目录内')
        const entry = await stats.get(file)
        return sendJson(res, 200, { ok: true, path: file, lastPositionSec: entry === null ? null : entry.lastPositionSec })
      }

      if (pathname === '/position' && method === 'POST') {
        if (stats === undefined) return fail(res, 503, 'UNAVAILABLE', '统计未启用')
        let body
        try {
          body = await readJson(req)
        } catch {
          return fail(res, 400, 'BAD_JSON', '请求体不是合法 JSON')
        }
        const config = await settings.read()
        const file = await resolveTrack(body?.path, config.roots)
        if (file === null) return fail(res, 404, 'NOT_FOUND', '文件不在已配置的音乐目录内')
        const entry = await stats.setPosition(file, body?.seconds)
        if (entry === null) return fail(res, 400, 'BAD_POSITION', 'seconds 必须是非负数')
        return sendJson(res, 200, { ok: true, path: file, lastPositionSec: entry.lastPositionSec })
      }

      if (pathname === '/stats' && method === 'GET') {
        if (stats === undefined || typeof stats.summarize !== 'function') {
          return sendJson(res, 200, { ok: true, range: 'all', tracks: {} })
        }
        const requested = String(params.get('range') || 'all')
        const range = requested === 'week' || requested === 'month' ? requested : 'all'
        return sendJson(res, 200, { ok: true, range, tracks: await stats.summarize(range) })
      }

      if (pathname === '/play' && method === 'POST') {
        let body
        try {
          body = await readJson(req)
        } catch {
          return fail(res, 400, 'BAD_JSON', '请求体不是合法 JSON')
        }
        const config = await settings.read()
        const file = await resolveTrack(body?.path, config.roots)
        if (file === null) return fail(res, 404, 'NOT_FOUND', '文件不在已配置的音乐目录内')
        const entry = await stats.recordPlay(file)
        return sendJson(res, 200, { ok: true, plays: entry.plays })
      }

      return fail(res, 404, 'NO_ROUTE', `未知接口：${method} ${pathname}`)
    } catch (error) {
      return fail(res, 500, 'INTERNAL', String(error?.message ?? error))
    }
  }
}


