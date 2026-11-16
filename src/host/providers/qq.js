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
import { decodeEntities } from './qq-legacy.js'
import { callUpstream } from '../services/qq-api.js'

const QR_TTL_MS = 2 * 60 * 1000
const PAGE_SIZE = 60

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
    title: decodeEntities(row.name ?? ''),
    songid: row.id ?? 0,
    songtype: row.type ?? 0,
    artists: Array.isArray(row.singer) ? row.singer.map((singer) => decodeEntities(singer?.name ?? '')) : [],
    album: decodeEntities(row.album?.name ?? ''),
    albummid: String(row.album?.mid ?? ''),
    interval: Number(row.interval) || 0,
    payplay: row.pay?.payplay,
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

/** Legacy contract: `{ url, filename }`; an empty url means "not playable". */
export async function getDownloadURL(songmid, cookie = '', qualityOrVip = 'lossless') {
  const mid = String(songmid ?? '').trim()
  if (mid === '') throw new Error('bad song id')

  // Keep the historical boolean form working.
  const quality = typeof qualityOrVip === 'boolean'
    ? (qualityOrVip ? 'lossless' : 'standard')
    : String(qualityOrVip || 'lossless')

  const json = await callUpstream(`/getMusicPlay/${encodeURIComponent(mid)}`, { quality }, { cookie })
  const entry = json?.data?.playUrl?.[mid] ?? {}
  return {
    url: typeof entry.url === 'string' ? entry.url : '',
    filename: '',
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
