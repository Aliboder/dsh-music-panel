/**
 * QQ Music transport, served by the upstream API package.
 *
 * Same strategy as NetEase: `export *` keeps every not-yet-migrated function from
 * `qq-legacy.js`, and the explicit exports below replace the hot paths (search,
 * stream URL, lyrics, QR login). Return shapes are byte-for-byte the legacy ones,
 * so nothing above this module changes.
 *
 * @module dsh-music-panel/providers/qq
 */

export * from './qq-legacy.js'

// `export *` re-exports but creates no local binding, so helpers we call here must
// be imported explicitly.
import { decodeEntities, getPlaylistSongs as legacyPlaylistSongs } from './qq-legacy.js'
import { callUpstream } from '../services/qq-api.js'

const QR_TTL_MS = 2 * 60 * 1000
const PAGE_SIZE = 60
const playlistMeta = new Map()

const QR_STATUS = { 800: 'expired', 801: 'waiting', 802: 'scanned', 803: 'success' }
const QR_MESSAGE = {
  expired: '二维码已过期',
  waiting: '等待扫码中',
  scanned: '已扫码，请在 QQ 中确认',
  success: '登录成功',
}

/** One upstream search item → the legacy `results[]` entry. */
export function toLegacyResult(item) {
  const row = item ?? {}
  const mid = String(row.mid ?? row.songmid ?? '')
  if (mid === '') return null
  return {
    id: mid,
    songmid: mid,
    title: decodeEntities(row.name ?? row.title ?? row.songname ?? row.audio_name ?? ''),
    songid: row.id ?? row.songid ?? 0,
    songtype: row.type ?? row.songtype ?? 0,
    artists: Array.isArray(row.singer) ? row.singer.map((singer) => decodeEntities(singer?.name ?? '')) : [],
    album: decodeEntities(row.album?.name ?? row.albumname ?? row.album_name ?? ''),
    albummid: String(row.album?.mid ?? row.albummid ?? row.album_mid ?? ''),
    interval: Number(row.interval) || 0,
    // QQ's own payload spells it `pay.pay_play`; the camelCase form appears in older
    // responses. Both mean "this song needs VIP to play".
    payplay: Number(row.pay?.pay_play ?? row.pay?.payplay ?? row.payplay ?? 0),
    pay: row.pay,
    source: 'qq',

    // ── Full entity ──────────────────────────────────────────────────────
    durationMs: (Number(row.interval) || 0) * 1000,
    artistsDetail: Array.isArray(row.singer)
      ? row.singer.map((singer) => ({ id: String(singer?.mid ?? singer?.id ?? ''), name: decodeEntities(singer?.name ?? '') }))
      : [],
    albumDetail: {
      id: String(row.album?.id ?? ''),
      name: decodeEntities(row.album?.name ?? ''),
      coverUrl: String(row.album?.mid ?? '') === '' ? '' : `https://y.gtimg.cn/music/photo_new/T002R500x500M000${row.album.mid}.jpg`,
      mid: String(row.album?.mid ?? ''),
      subtitle: decodeEntities(row.album?.subtitle ?? ''),
      timePublic: String(row.album?.time_public ?? ''),
    },
    aliases: row.subtitle ? [decodeEntities(row.subtitle)] : [],
    translatedNames: [],
    publishTime: Date.parse(String(row.album?.time_public ?? '')) || 0,
    popularity: Number(row.bpm) || 0,
    songType: Number(row.type) || 0,
    mvId: String(row.mv?.vid ?? row.mvid ?? ''),
    isVideo: Boolean(row.mv?.vid ?? row.mvid),
    copyright: 0,
    resourceState: null,
    noCopyright: null,
    privilegeDetail: row.pay ?? null,
    // Sizes tell us which rungs the platform actually holds.
    availableQualities: [
      ['standard', row.file?.size_128mp3],
      ['high', row.file?.size_320mp3],
      ['lossless', row.file?.size_flac],
      ['hires', row.file?.size_hires],
    ].filter(([, size]) => Number(size) > 0).map(([level]) => level),
  }
}

/** Legacy contract: `{ results, total, page }`. */
export async function search(keyword, cookie = '', page = 1) {
  const p = Math.max(1, parseInt(page, 10) || 1)
  const kw = String(keyword ?? '').trim()
  if (kw === '') return { results: [], total: 0, page: p }

  const json = await callUpstream('/search', { keyword: kw, page: p, limit: PAGE_SIZE }, { cookie })
  const items = Array.isArray(json.items) ? json.items : []
  const results = items.map(toLegacyResult).filter(Boolean)
  return {
    results,
    total: Number(json.total) || results.length,
    page: p,
  }
}

/** Own playlists and the built-in liked list, from the package's `/user/playlist`. */
export async function getMyPlaylists(cookie = '') {
  const json = await callUpstream('/user/playlist', {}, { cookie })
  const rows = Array.isArray(json.playlist) ? json.playlist : []
  return rows.map((row) => {
    const dirId = Number(row.dirId) || 0
    const tid = String(row.tid ?? '')
    const id = tid || String(dirId)
    const liked = dirId === 201
    playlistMeta.set(id, { dirId, tid, liked })
    return {
      source: 'qq',
      id,
      name: decodeEntities(row.dirName || ''),
      cover: String(row.picUrl || row.bigpicUrl || ''),
      trackCount: Number(row.songNum) || 0,
      creator: decodeEntities(row.nick || ''),
      kind: liked ? 'default' : 'own',
      isLike: liked,
      isDefault: liked,
    }
  })
}

/** One own playlist (or the liked list), from the package's authenticated routes. */
export async function getPlaylistSongs(id, cookie = '') {
  const key = String(id ?? '')
  const meta = playlistMeta.get(key)
  if (!meta) return await legacyPlaylistSongs(key, cookie)

  if (meta.liked) {
    const songs = []
    let offset = 0
    while (offset < 10000) {
      const page = await callUpstream('/user/liked-songs', { limit: 100, offset }, { cookie })
      const rows = Array.isArray(page.songs) ? page.songs : []
      songs.push(...rows)
      if (page.more !== true || rows.length === 0) break
      offset += rows.length
    }
    return { name: '我喜欢', cover: '', trackCount: songs.length, songs: songs.map(toLegacyResult).filter(Boolean) }
  }

  if (meta.tid === '') throw new Error('QQ playlist has no tid')
  const page = await callUpstream('/user/playlist-detail', {
    tid: meta.tid,
    dirid: meta.dirId,
    offset: 0,
    limit: 1000,
  }, { cookie })
  const songs = Array.isArray(page.songs) ? page.songs : []
  return { name: '', cover: '', trackCount: Number(page.total) || songs.length, songs: songs.map(toLegacyResult).filter(Boolean) }
}

/** Legacy contract: `{ mids, songids }` for the liked songs. */
export async function getQQFavIds(cookie = '') {
  const mids = []
  const songids = []
  let offset = 0
  while (offset < 10000) {
    const page = await callUpstream('/user/liked-songs', { limit: 100, offset }, { cookie })
    const rows = Array.isArray(page.songs) ? page.songs : []
    for (const row of rows) {
      const mid = String(row.mid ?? row.songmid ?? '')
      if (mid !== '') mids.push(mid)
      if (Number(row.id)) songids.push(Number(row.id))
    }
    if (page.more !== true || rows.length === 0) break
    offset += rows.length
  }
  return { mids, songids }
}

async function setQqLiked(song, liked, cookie) {
  const mid = String(song?.songmid ?? song?.mid ?? '')
  const id = Number(song?.songid ?? song?.id ?? 0)
  if (mid === '' || !Number.isFinite(id) || id <= 0) throw new Error('QQ 喜欢写入缺少 songmid/songid')
  const response = await callUpstream('/user/song/like', {}, {
    cookie,
    method: 'POST',
    body: { song: { id, mid, type: 0 }, liked },
  })
  if (response?.liked !== liked) throw new Error('QQ 没有确认喜欢写入')
  return true
}

export async function addQQFav(song, cookie = '') {
  return await setQqLiked(song, true, cookie)
}

export async function removeQQFav(song, cookie = '') {
  return await setQqLiked(song, false, cookie)
}

/** Legacy contract: `{ url, filename }`; an empty url means "not playable". */
export async function getDownloadURL(songmid, cookie = '', qualityOrVip = 'lossless') {
  const mid = String(songmid ?? '').trim()
  if (mid === '') throw new Error('bad song id')

  // Keep the historical boolean form working.
  const quality = typeof qualityOrVip === 'boolean'
    ? (qualityOrVip ? 'lossless' : 'standard')
    : String(qualityOrVip || 'lossless')

  const json = await callUpstream(`/getMusicPlay/${encodeURIComponent(mid)}`, { quality }, { cookie })
  let entry = json?.data?.playUrl?.[mid] ?? {}
  let preview = false
  if ((typeof entry.url !== 'string' || entry.url === '') && cookie !== '') {
    try {
      const previewJson = await callUpstream(`/getMusicPlay/${encodeURIComponent(mid)}`, { quality: 'standard', preview: 1 }, { cookie })
      const previewEntry = previewJson?.data?.playUrl?.[mid] ?? {}
      if (typeof previewEntry.url === 'string' && previewEntry.url !== '') {
        entry = previewEntry
        preview = previewEntry.preview === true
      }
    } catch {
      // No preview is the same answer as no stream.
    }
  }
  return {
    url: typeof entry.url === 'string' ? entry.url : '',
    filename: '',
    preview,
  }
}

/** Legacy contract: `{ lyric, trans }`. */
export async function getLyric(songmid, cookie = '') {
  const mid = String(songmid ?? '').trim()
  if (mid === '') throw new Error('bad song id')

  const json = await callUpstream('/getLyric', { songmid: mid }, { cookie })
  const payload = json.response ?? json.data ?? json
  const lyric = typeof payload.lyric === 'string' ? decodeEntities(payload.lyric) : ''
  if (lyric === '') throw new Error('未获取到歌词')
  return {
    lyric,
    trans: typeof payload.trans === 'string' ? decodeEntities(payload.trans) : '',
  }
}

/** Legacy contract: `{ source, key, imageDataUrl, expiresAt, extra }`. */
export async function createQRLogin() {
  return await createQrLogin('qq')
}

/** WeChat is the other package channel; it must not use the legacy wx endpoints. */
export async function createWXQRLogin() {
  return await createQrLogin('wechat')
}

async function createQrLogin(channel) {
  const keyJson = await callUpstream('/login/qr/key', { channel })
  const key = String(keyJson.data?.unikey ?? '')
  if (key === '') throw new Error('qq qr key missing')

  const created = await callUpstream('/login/qr/create', { key, qrimg: true })
  const imageDataUrl = String(created.data?.qrimg ?? '')
  const url = String(created.data?.qrurl ?? '')
  return {
    source: 'qq',
    key,
    imageDataUrl,
    url,
    expiresAt: Date.now() + QR_TTL_MS,
    extra: { unikey: key },
  }
}

/** Legacy contract: `{ source, key, status, message, extra, cookie? }`. */
export async function checkQRLogin(keyStr) {
  return await checkQrLogin(keyStr)
}

export async function checkWXQRLogin(keyStr) {
  return await checkQrLogin(keyStr)
}

async function checkQrLogin(keyStr) {
  const key = String(keyStr ?? '').trim()
  if (key === '') throw new Error('qq qr login key missing')

  // The poll answers 800–803 as the scan state; the generic success gate would
  // throw on every *waiting* answer and surface as "platform refused the login".
  const json = await callUpstream('/login/qr/check', { key }, { skipCodeCheck: true, includeHeaders: true })
  const status = QR_STATUS[Number(json.code)] ?? 'failed'
  // The package names the reason it recognised (loginHints): device limit, rate
  // limited, wrong scan app, restricted account. Carry it through so the login window
  // can say which one it was instead of "refused".
  const hint = json.failureHint !== null && typeof json.failureHint === 'object' ? json.failureHint : null
  const result = {
    source: 'qq',
    key,
    status,
    message: QR_MESSAGE[status] ?? String(json.message ?? '状态未知'),
    extra: {
      code: Number(json.code),
      hint: hint === null ? '' : String(hint.key ?? ''),
      hintMessage: hint === null ? '' : String(hint.message ?? ''),
      failureStage: String(json.failureStage ?? ''),
      failureReason: String(json.failureReason ?? ''),
      retryAfterMs: Number(json.retryAfterMs) || 0,
    },
  }
  if (status !== 'success') return result

  const bodyCookie = typeof json.cookie === 'string' ? json.cookie.trim() : ''
  // Node stores the session in the package repository; serverless/other builds may
  // return the sealed credential as the `qqmusic_session` Set-Cookie instead.
  const setCookies = Array.isArray(json.__setCookie) ? json.__setCookie : []
  const sealed = setCookies
    .map((line) => /(?:^|;\s*)qqmusic_session=([^;]+)/.exec(String(line)))
    .find((match) => match && match[1] !== '')
  const cookie = [bodyCookie, sealed ? 'qqmusic_session=' + sealed[1] : '']
    .filter((part) => part !== '')
    .join('; ')
  if (cookie === '') {
    result.status = 'failed'
    result.message = '登录成功但未取到 cookie，请重试'
    return result
  }
  result.cookie = cookie
  return result
}
