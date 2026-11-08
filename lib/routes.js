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
import { createReadStream } from 'node:fs'
import { copyFile, mkdir, readdir, realpath, rename, stat, unlink, writeFile } from 'node:fs/promises'
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
export function createRoutes({ settings, library, playlists, stats, playback, favorites }) {
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
        const rawRoots = Array.isArray(body?.roots) ? body.roots : []
        const { good, bad } = await validateRoots(rawRoots)
        if (bad.length > 0) {
          return sendJson(res, 400, {
            ok: false,
            error: { code: 'BAD_ROOT', message: '目录不存在或不是文件夹' },
            bad,
          })
        }
        const patch = { roots: good }
        if (body?.depth !== undefined) patch.depth = body.depth
        if (Array.isArray(body?.extensions)) patch.extensions = body.extensions
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
        const trashDir = join(settings.dir, 'trash')
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
            await mkdir(trashDir, { recursive: true })
            const target = join(
              trashDir,
              `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}-${basename(file)}`,
            )
            try {
              await rename(file, target)
            } catch {
              await copyFile(file, target)
              await unlink(file)
            }
            moved.push(raw)
          } catch (error) {
            failed.push({
              path: raw,
              error: error instanceof Error ? error.message : '移动失败',
            })
          }
        }
        return sendJson(res, 200, { ok: true, moved, failed, trash: trashDir })
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
