/**
 * Unified online-music provider facade.
 *
 * The per-platform modules (netease.js / qq.js / kugou.js) are ported from the
 * MIT-licensed `kendu76/dsh-music-player` project (see lib/providers/README.md).
 * They talk to the official client endpoints and return normalised song data;
 * this module keeps the raw search objects for platforms whose stream lookup
 * needs the full object (KuGou), and exposes one small API to the Host routes.
 *
 * @module dsh-music-panel/providers
 */

import * as NC from './netease.js'
import * as QQ from './qq.js'
import * as KG from './kugou.js'

export const PROVIDERS = ['netease', 'qq', 'kugou']

const rawSongs = new Map()

/** QQ `filename` prefix → the quality the server actually granted. */
const QQ_QUALITY = {
  Q000: '无损',
  Q001: '无损',
  AI00: '无损',
  F000: '无损',
  O801: 'OGG',
  M800: '320k',
  M500: '128k',
}

function shape(provider, song) {
  const id = provider === 'qq' ? song.songmid : song.id
  const payType = Number(song.payType) || 0
  const payplay = Number(song.payplay) || 0
  const fee = Number(song.fee) || 0
  const privilege = Number(song.privilege) || 0
  let qualityHint = ''
  if (provider === 'qq' && (payplay === 1 || (song.pay && Number(song.pay.payplay) === 1))) qualityHint = 'VIP'
  if (provider === 'kugou' && (payType > 0 || privilege > 0)) qualityHint = 'VIP'
  if (provider === 'netease' && fee === 1) qualityHint = 'VIP'
  const albumMid = String(song.albummid || '').trim()
  const coverUrl =
    song.cover ||
    (albumMid !== '' ? 'https://y.gtimg.cn/music/photo_new/T002R300x300M000' + albumMid + '.jpg' : '')
  return {
    provider,
    id: String(id ?? ''),
    title: song.title || '',
    artist: Array.isArray(song.artists) ? song.artists.join(' / ') : '',
    album: song.album || '',
    durationSec: Number(song.interval) || 0,
    coverUrl,
    qualityHint,
  }
}

/**
 * @param {'netease'|'qq'|'kugou'} provider
 * @param {string} query
 * @param {string} [cookie]
 */
export async function search(provider, query, cookie = '') {
  const text = String(query ?? '').trim()
  if (text === '') return []
  if (provider === 'netease') {
    const { results } = await NC.search(text, cookie)
    return (results || []).map((song) => {
      rawSongs.set('netease:' + song.id, song)
      return shape('netease', song)
    })
  }
  if (provider === 'qq') {
    const { results } = await QQ.search(text, cookie)
    return (results || []).map((song) => {
      rawSongs.set('qq:' + song.songmid, song)
      return shape('qq', song)
    })
  }
  if (provider === 'kugou') {
    const { results } = await KG.search(text, cookie)
    return (results || []).map((song) => {
      rawSongs.set('kugou:' + song.id, song)
      return shape('kugou', song)
    })
  }
  throw new Error('未知平台：' + provider)
}

/**
 * Resolve a playable URL for one song id (cookies unlock higher quality).
 * @returns {Promise<{ url: string, quality: string }>}
 */
export async function resolveStream(provider, id, cookie = '', session = {}) {
  if (provider === 'netease') {
    const dl = await NC.getDownloadURL(id, cookie)
    return { url: dl.url || '', quality: dl.quality || '' }
  }
  if (provider === 'qq') {
    const dl = await QQ.getDownloadURL(id, cookie, cookie !== '')
    const prefix = String(dl.filename || '').slice(0, 4)
    return { url: dl.url || '', quality: QQ_QUALITY[prefix] || '' }
  }
  if (provider === 'kugou') {
    const song = rawSongs.get('kugou:' + id) || { hash: id }
    const ready = await ensureKugouDevice(session || {})
    const dl = await KG.getDownloadURL(song, ready, ['flac', '320', '128'])
    return { url: dl.url || '', quality: dl.quality || '' }
  }
  throw new Error('未知平台：' + provider)
}

/** Stable KuGou device identity (generated once, then persisted by the caller). */
export function createKugouDevice() {
  return KG.createDeviceIdentity()
}

const kugouDevices = new Map()

/** KuGou stream lookup only works with a device identity registered by the platform. */
let kugouRegistered = { dfid: '', at: 0 }

async function ensureKugouDevice(session) {
  const now = Date.now()
  if (session.dfid !== '' && session.dfid === kugouRegistered.dfid && now - kugouRegistered.at < 30 * 60 * 1000) {
    return session
  }
  try {
    const reg = await KG.registerDevice(session)
    if (reg && reg.dfid) {
      kugouRegistered = { dfid: reg.dfid, at: now }
      return { ...session, dfid: reg.dfid }
    }
  } catch {
    /* fall back to the stored identity */
  }
  return session
}

/**
 * Start a QR login. Returns the key to poll plus the QR image data URL.
 * @param {'netease'|'qq'|'kugou'} provider
 * @param {{ mid?: string, dfid?: string, guid?: string }} [session]
 */
export async function loginStart(provider, session = {}, mode = 'qq') {
  if (provider === 'netease') {
    const qr = await NC.createQRLogin()
    return { key: qr.key, imageDataUrl: qr.imageDataUrl || '', url: qr.url || '' }
  }
  if (provider === 'qq') {
    const qr = mode === 'wx' ? await QQ.createWXQRLogin() : await QQ.createQRLogin()
    return { key: qr.key, imageDataUrl: qr.imageDataUrl || '', url: '' }
  }
  if (provider === 'kugou') {
    let device = session.mid ? session : createKugouDevice()
    try {
      const reg = await KG.registerDevice(device)
      if (reg && reg.dfid) device = { ...device, dfid: reg.dfid }
    } catch {
      /* keep the generated identity; stream lookup may still work */
    }
    const qr = await KG.createQRLogin(device)
    kugouDevices.set('kugou', device)
    return { key: qr.key, imageDataUrl: qr.imageDataUrl || '', url: qr.url || '' }
  }
  throw new Error('未知平台：' + provider)
}

/**
 * Poll one QR login. On success returns the cookie (NetEase/QQ) or token
 * fields (KuGou); the caller persists them.
 */
export async function loginStatus(provider, key, mode = 'qq') {
  if (provider === 'netease') {
    const r = await NC.checkQRLogin(key)
    return { status: r.status, cookie: r.status === 'success' ? r.cookie || '' : '' }
  }
  if (provider === 'qq') {
    const r = mode === 'wx' ? await QQ.checkWXQRLogin(key) : await QQ.checkQRLogin(key)
    return { status: r.status, cookie: r.status === 'success' ? r.cookie || '' : '' }
  }
  if (provider === 'kugou') {
    const device = kugouDevices.get('kugou') || createKugouDevice()
    const r = await KG.checkQRLogin(key, device)
    return {
      status: r.status,
      cookie: '',
      token: r.tokenInfo ? String(r.tokenInfo.token || '') : '',
      userid: r.tokenInfo ? String(r.tokenInfo.userid || '') : '',
      vipType: r.tokenInfo ? String(r.tokenInfo.vip_type || '') : '',
      vipToken: r.tokenInfo ? String(r.tokenInfo.vip_token || '') : '',
      device: { mid: device.mid, dfid: device.dfid || '', guid: device.guid || '' },
    }
  }
  throw new Error('未知平台：' + provider)
}

/**
 * Online lyric (LRC + optional translation). Unsupported combinations return
 * an empty lyric rather than throwing, so the player just shows "no lyrics".
 * @returns {Promise<{ lrc: string, translation: string }>}
 */
export async function lyric(provider, id, cookie = '') {
  try {
    if (provider === 'netease') {
      const res = await NC.getLyric(id, cookie)
      return { lrc: res.lyric || '', translation: res.trans || '' }
    }
    if (provider === 'qq') {
      const res = await QQ.getLyric(id, cookie)
      return { lrc: res.lyric || res.lrc || '', translation: res.trans || '' }
    }
    if (provider === 'kugou') {
      const res = await KG.getLyric({ hash: id })
      return { lrc: res.lyric || '', translation: '' }
    }
  } catch {
    return { lrc: '', translation: '' }
  }
  return { lrc: '', translation: '' }
}

function shapePlaylist(item) {
  return {
    provider: item.source || '',
    id: String(item.id || ''),
    name: item.name || '',
    cover: item.cover || '',
    trackCount: Number(item.trackCount) || 0,
    creator: item.creator || '',
    kind: item.kind || 'own',
    isDefault: item.isDefault === true || item.isLike === true,
  }
}

/**
 * The signed-in account's playlists (requires a login cookie / session).
 * @returns {Promise<{ provider: string, id: string, name: string, cover: string, trackCount: number, creator: string, kind: string, isDefault: boolean }[]>}
 */
export async function myPlaylists(provider, cookie = '', session = {}) {
  if (provider === 'netease') {
    return (await NC.getMyPlaylists(cookie)).map(shapePlaylist)
  }
  if (provider === 'qq') {
    return (await QQ.getMyPlaylists(cookie)).map(shapePlaylist)
  }
  if (provider === 'kugou') {
    return (await KG.getMyPlaylists(session)).map(shapePlaylist)
  }
  throw new Error('未知平台：' + provider)
}

/**
 * One playlist's songs, normalised like search results.
 * @returns {Promise<{ name: string, cover: string, trackCount: number, songs: object[] }>}
 */
export async function playlistSongs(provider, id, cookie = '', session = {}) {
  let result
  if (provider === 'netease') {
    result = await NC.getPlaylistSongs(id, cookie)
  } else if (provider === 'qq') {
    result = await QQ.getPlaylistSongs(id, cookie)
  } else if (provider === 'kugou') {
    // "我的歌单" ids are cloud-playlist listids (not public specialids): use the
    // cloudlist endpoints. Collected playlists only list songs through
    // get_other_list_file_nofilt (the local copy is often empty).
    let songs = []
    let meta = { name: '', cover: '', trackCount: 0 }
    let matched = false
    try {
      const mine = await KG.getMyPlaylists(session)
      const item = (mine || []).find((entry) => String(entry.id) === String(id))
      if (item) {
        matched = true
        meta = { name: item.name || '', cover: item.cover || '', trackCount: item.trackCount || 0 }
        if (item.kind === 'collect' && item.creatorGid) {
          songs = await KG.getCollectedPlaylistSongs(item.creatorGid, session)
        } else {
          songs = await KG.getMyPlaylistSongs(id, session)
        }
      }
    } catch {
      matched = false
    }
    if (!matched) {
      const detail = await KG.getPlaylistSongs(id, session)
      songs = detail.songs || []
      meta = { name: detail.name || '', cover: detail.cover || '', trackCount: detail.trackCount || 0 }
    }
    result = {
      name: meta.name,
      cover: meta.cover,
      trackCount: meta.trackCount || songs.length,
      songs,
    }
  } else {
    throw new Error('未知平台：' + provider)
  }
  const songs = (result.songs || []).map((song) => {
    const shaped = shape(provider, song)
    rawSongs.set(provider + ':' + shaped.id, song)
    return shaped
  })
  return {
    name: result.name || '',
    cover: result.cover || '',
    trackCount: Number(result.trackCount) || songs.length,
    songs,
  }
}
