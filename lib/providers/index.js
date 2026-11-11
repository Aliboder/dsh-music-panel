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
import * as KGL from './kugou-lite.js'

export const PROVIDERS = ['netease', 'qq', 'kugou', 'kugouLite']

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
  if (provider === 'kugouLite' ? privilege >= 10 : (provider === 'kugou' && (payType > 0 || privilege > 0))) qualityHint = 'VIP'
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
  if (provider === 'kugou' || provider === 'kugouLite') {
    const { results } = await KG.search(text, cookie)
    return (results || []).map((song) => {
      const key = provider === 'kugouLite' ? 'kugouLite:' : 'kugou:'
      rawSongs.set(key + song.id, song)
      return shape(provider, song)
    })
  }
  throw new Error('未知平台：' + provider)
}

/**
 * Resolve a playable URL for one song id (cookies unlock higher quality).
 * @returns {Promise<{ url: string, quality: string }>}
 */
export async function resolveStream(provider, id, cookie = '', session = {}, quality = 'high') {
  if (provider === 'netease') {
    const dl = await NC.getDownloadURL(id, cookie, quality)
    return { url: dl.url || '', quality: dl.quality || '' }
  }
  if (provider === 'qq') {
    const dl = await QQ.getDownloadURL(id, cookie, quality)
    const prefix = String(dl.filename || '').slice(0, 4)
    return { url: dl.url || '', quality: QQ_QUALITY[prefix] || '' }
  }
  if (provider === 'kugou' || provider === 'kugouLite') {
    const concept = provider === 'kugouLite'
    const song = rawSongs.get((concept ? 'kugouLite:' : 'kugou:') + id) || { hash: id }
    const ready = await ensureKugouDevice(session || {})
    const prefer =
      quality === 'standard'
        ? ['128', '320']
        : quality === 'high'
          ? ['320', '128']
          : ['flac', '320', '128']
    const dl = concept ? await KGL.resolveStream(song, ready, prefer) : await KG.getDownloadURL(song, ready, prefer)
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
  if (provider === 'kugou' || provider === 'kugouLite') {
    const concept = provider === 'kugouLite'
    let device = session.mid ? session : createKugouDevice()
    if (!concept) {
      try {
        const reg = await KG.registerDevice(device)
        if (reg && reg.dfid) device = { ...device, dfid: reg.dfid }
      } catch {
        /* keep the generated identity; stream lookup may still work */
      }
    }
    const qr = concept ? await KGL.createQRLogin(device) : await KG.createQRLogin(device)
    kugouDevices.set(provider, device)
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
  if (provider === 'kugou' || provider === 'kugouLite') {
    const concept = provider === 'kugouLite'
    const device = kugouDevices.get(provider) || createKugouDevice()
    const r = concept ? await KGL.checkQRLogin(key, device) : await KG.checkQRLogin(key, device)
    return {
      status: r.status,
      cookie: '',
      token: r.tokenInfo ? String(r.tokenInfo.token || '') : '',
      userid: r.tokenInfo ? String(r.tokenInfo.userid || '') : '',
      nickname: r.tokenInfo ? String(r.tokenInfo.nickname || '') : '',
      vipType: r.tokenInfo ? String(r.tokenInfo.vip_type || '') : '',
      vipToken: r.tokenInfo ? String(r.tokenInfo.vip_token || '') : '',
      platform: concept ? 'lite' : 'standard',
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
      const base = res.lyric || ''
      if (res.trans && String(res.trans).trim() !== '') {
        return { lrc: base, translation: res.trans }
      }
      // QQ only exposes translations through the QRC endpoint (`data.trans`).
      try {
        const info = await QQ.getSongInfoByMid(id, cookie)
        const qrc = await QQ.getQrcLyric(
          {
            songid: info.songid,
            interval: info.interval,
            title: info.title,
            artist: info.artist,
            album: info.album,
          },
          cookie,
        )
        if (qrc && typeof qrc.translation === 'string' && qrc.translation.trim() !== '') {
          return { lrc: base, translation: qrc.translation }
        }
      } catch {
        /* fall through to the bilingual split */
      }
      const split = splitBilingual(base)
      return { lrc: split.lrc, translation: split.trans }
    }
    if (provider === 'kugou' || provider === 'kugouLite') {
      const res = await KG.getLyric({ hash: id })
      // KuGou keeps translations in the KRC stream, not in the plain LRC.
      let translation = ''
      try {
        const word = await KG.getWordLines({ hash: id })
        if (word && Array.isArray(word.translations) && Array.isArray(word.lines)) {
          const parts = []
          for (let index = 0; index < word.lines.length; index += 1) {
            const line = word.lines[index]
            const text = word.translations[index]
            if (typeof text !== 'string' || text.trim() === '') continue
            const seconds = Math.max(0, Number(line && line.t) || 0)
            const minutes = Math.floor(seconds / 60)
            const rest = (seconds % 60).toFixed(3).padStart(6, '0')
            parts.push('[' + String(minutes).padStart(2, '0') + ':' + rest + ']' + text)
          }
          translation = parts.join('\n')
        }
      } catch {
        /* no word-level translation: keep the plain lyric */
      }
      if (translation === '') {
        const split = splitBilingual(res.lyric || '')
        return { lrc: split.lrc, translation: split.trans }
      }
      return { lrc: res.lyric || '', translation }
    }
  } catch {
    return { lrc: '', translation: '' }
  }
  return { lrc: '', translation: '' }
}

// ── bilingual lyric splitter ─────────────────────────────────────────────
// Some providers put the translation on its own timestamped line right after
// the original (or share its timestamp). Detect which language class is the
// minority and emit it as translation lines.
function lyricClassOf(text) {
  const letters = (text.match(/[a-zA-Z]/g) || []).length
  const cjk = (text.match(/[\u4e00-\u9fff]/g) || []).length
  if (letters >= 3 && cjk === 0) return 'latin'
  if (cjk >= 2 && letters === 0) return 'cjk'
  return 'other'
}

function parseLrcLines(text) {
  const lines = []
  String(text || '')
    .split(/\r?\n/)
    .forEach((raw) => {
      const match = /^\[(\d{1,2}):(\d{1,2}(?:\.\d+)?)\](.*)$/.exec(raw.trim())
      if (match === null) return
      const t = Number(match[1]) * 60 + Number(match[2])
      if (!Number.isFinite(t)) return
      lines.push({ t, text: match[3].trim() })
    })
  return lines
}

function lrcTime(t) {
  const seconds = Math.max(0, t)
  const minutes = Math.floor(seconds / 60)
  const rest = (seconds % 60).toFixed(3)
  return '[' + String(minutes).padStart(2, '0') + ':' + (rest.length < 6 ? '0' + rest : rest) + ']'
}

function splitBilingual(text) {
  const lines = parseLrcLines(text)
  if (lines.length === 0) return { lrc: text, trans: '' }
  let latinCount = 0
  let cjkCount = 0
  let firstClass = null
  for (const line of lines) {
    const cls = lyricClassOf(line.text)
    if (cls === 'latin') {
      latinCount += 1
      if (firstClass === null) firstClass = 'latin'
    } else if (cls === 'cjk') {
      cjkCount += 1
      if (firstClass === null) firstClass = 'cjk'
    }
  }
  const mainClass = latinCount > cjkCount ? 'latin' : cjkCount > latinCount ? 'cjk' : firstClass
  if (mainClass === null || mainClass === undefined) return { lrc: text, trans: '' }
  const transClass = mainClass === 'latin' ? 'cjk' : 'latin'
  const kept = []
  const trans = []
  let lastKeepT = null
  let lastTransT = null
  for (const line of lines) {
    const cls = lyricClassOf(line.text)
    const isTrans = cls === transClass
    const afterKeep = lastKeepT !== null && Math.abs(line.t - lastKeepT) < 0.6
    const sameTrans = lastTransT !== null && line.t === lastTransT
    if (isTrans && (afterKeep || sameTrans)) {
      trans.push(lrcTime(line.t) + line.text)
      lastTransT = line.t
      continue
    }
    kept.push(line)
    lastKeepT = line.t
    lastTransT = null
  }
  if (trans.length === 0) return { lrc: text, trans: '' }
  return {
    lrc: kept.map((line) => lrcTime(line.t) + line.text).join('\n'),
    trans: trans.join('\n'),
  }
}

function shapePlaylist(item) {  return {
    provider: item.source || '',
    id: String(item.id || ''),
    name: item.name || '',
    cover: item.cover || '',
    trackCount: Number(item.trackCount) || 0,
    creator: item.creator || '',
    kind: item.kind || 'own',
    isLike: item.isLike === true,
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
  if (provider === 'kugou' || provider === 'kugouLite') {
    return (await (provider === 'kugouLite' ? KGL.getMyPlaylists(session) : KG.getMyPlaylists(session))).map(shapePlaylist)
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
  } else if (provider === 'kugou' || provider === 'kugouLite') {
    // "我的歌单" ids are cloud-playlist listids (not public specialids): use the
    // cloudlist endpoints. Collected playlists only list songs through
    // get_other_list_file_nofilt (the local copy is often empty).
    let songs = []
    let meta = { name: '', cover: '', trackCount: 0 }
    let matched = false
    try {
      const mine = await (provider === 'kugouLite' ? KGL.getMyPlaylists(session) : KG.getMyPlaylists(session))
      const item = (mine || []).find((entry) => String(entry.id) === String(id))
      if (item) {
        matched = true
        meta = { name: item.name || '', cover: item.cover || '', trackCount: item.trackCount || 0 }
        if (item.kind === 'collect' && item.creatorGid) {
          songs = await KG.getCollectedPlaylistSongs(item.creatorGid, session)
        } else {
          songs = await (provider === 'kugouLite' ? KGL.getMyPlaylistSongs(id, session) : KG.getMyPlaylistSongs(id, session))
        }
      }
    } catch {
      matched = false
    }
    if (!matched) {
      const detail = await (provider === 'kugouLite' ? KGL.getMyPlaylistSongs(id, session) : KG.getPlaylistSongs(id, session))
      songs = detail.songs || []
      meta = { name: detail.name || '', cover: detail.cover || '', trackCount: detail.trackCount || songs.length }
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


// =====================================================================
// Cloud writes: like one song / add it to one of the account's playlists.
// These reuse the provider modules' verified write endpoints and the raw
// search object cache, so the Host routes only pass provider + id.
// =====================================================================

async function resolveLikePlaylist(provider, cookie, session) {
  const list = await myPlaylists(provider, cookie, session)
  return (
    list.find((item) => item.isLike === true) ||
    list.find((item) => item.kind === 'default') ||
    list.find((item) => item.isDefault === true) ||
    null
  )
}

async function qqWriteSong(id, cookie) {
  const raw = rawSongs.get('qq:' + id) || null
  if (raw !== null && Number(raw.songid)) return raw
  const info = await QQ.getSongInfoByMid(id, cookie)
  return { songid: info.songid, songtype: 0, songmid: id }
}

function kgWriteSong(id, song) {
  const raw = rawSongs.get('kugou:' + id) || null
  if (raw !== null) return raw
  return { hash: id, title: (song && song.title) || '', interval: Number((song && song.durationSec) || 0) * 1000 }
}

export async function onlineLiked(provider, id, cookie = '', session = {}) {
  const target = String(id || '')
  if (target === '') return false
  if (provider === 'qq') {
    const favs = await QQ.getQQFavIds(cookie)
    return (favs.mids || []).includes(target)
  }
  if (provider === 'kugou' || provider === 'kugouLite') {
    const like = await resolveLikePlaylist(provider, cookie, session)
    if (like === null) return false
    const songs = await (provider === 'kugouLite' ? KGL.getMyPlaylistSongs(like.id, session) : KG.getMyPlaylistSongs(like.id, session))
    return songs.some((song) => String(song.hash) === target)
  }
  const like = await resolveLikePlaylist(provider, cookie, session)
  if (like === null) return false
  const result = await NC.getPlaylistSongs(like.id, cookie)
  return (result.songs || []).some((song) => String(song.id) === target)
}

export async function setOnlineLiked(provider, song, on, cookie = '', session = {}) {
  const id = String((song && song.id) || '')
  if (id === '') throw new Error('缺少歌曲 id')
  if (provider === 'qq') {
    const raw = await qqWriteSong(id, cookie)
    return on ? QQ.addQQFav(raw, cookie) : QQ.removeQQFav(raw, cookie)
  }
  if (provider === 'kugouLite') throw new Error('酷狗概念版暂不支持云端喜欢写入')
  const like = await resolveLikePlaylist(provider, cookie, session)
  if (like === null) throw new Error('没有找到「我喜欢」歌单')
  if (provider === 'kugou') {
    if (on) {
      await KG.addSongToPlaylist(kgWriteSong(id, song), like.id, session)
      return true
    }
    const songs = await KG.getMyPlaylistSongs(like.id, session)
    const hit = songs.find((item) => String(item.hash) === id)
    if (!hit || !hit.fileId) throw new Error('未找到该歌曲')
    await KG.deleteSongFromPlaylist(hit.fileId, like.id, session)
    return true
  }
  await NC.manipulateTracks(like.id, [id], cookie, on ? 'add' : 'del')
  return true
}

export async function addOnlineSongToPlaylist(provider, song, playlistId, cookie = '', session = {}) {
  const id = String((song && song.id) || '')
  if (id === '') throw new Error('缺少歌曲 id')
  if (provider === 'qq') {
    const raw = await qqWriteSong(id, cookie)
    await QQ.addSongToPlaylist(raw, playlistId, 0, cookie)
    return true
  }
  if (provider === 'kugou') {
    await KG.addSongToPlaylist(kgWriteSong(id, song), playlistId, session)
    return true
  }
  if (provider === 'kugouLite') throw new Error('酷狗概念版暂不支持加入云歌单')
  await NC.manipulateTracks(playlistId, [id], cookie, 'add')
  return true
}


/** All liked track keys for one provider, shaped like client track.path. */
export async function onlineLikedIds(provider, cookie = '', session = {}) {
  const like = await resolveLikePlaylist(provider, cookie, session)
  if (like === null) return []
  if (provider === 'qq') {
    const favs = await QQ.getQQFavIds(cookie)
    return (favs.mids || []).map((mid) => 'online:qq:' + mid)
  }
  if (provider === 'kugou' || provider === 'kugouLite') {
    const songs = await (provider === 'kugouLite' ? KGL.getMyPlaylistSongs(like.id, session) : KG.getMyPlaylistSongs(like.id, session))
    return songs.map((song) => 'online:' + provider + ':' + song.hash)
  }
  const result = await NC.getPlaylistSongs(like.id, cookie)
  return (result.songs || []).map((song) => 'online:netease:' + song.id)
}

/** Whether the signed-in account has a paid membership; null when unknown. */
export async function providerVip(provider, cookie = '', session = {}) {
  if (provider === 'netease') {
    if (!cookie) return false
    const account = await NC.getAccount(cookie)
    return account === null ? false : Number(account.vipType) > 0
  }
  if (provider === 'qq') {
    if (!cookie) return false
    return await QQ.detectVip(cookie)
  }
  if (provider === 'kugou' || provider === 'kugouLite') {
    if (!session || !session.token) return false
    if (provider === 'kugouLite') return (await KGL.getVip(session)).vip
    const type = String(session.vipType || '').trim()
    return Number(type) > 0
  }
  return null
}

function cookiePart(cookie, name) {
  const m = new RegExp('(?:^|;\\s*)' + name + '=([^;]+)').exec(String(cookie || ''))
  return m ? m[1].trim() : ''
}

/** Public account profile for settings (nickname + avatar URL; never cookies). */
export async function providerProfile(provider, cookie = '', session = {}) {
  if (provider === 'netease') {
    const account = await NC.getAccount(cookie)
    return account === null
      ? null
      : { nickname: account.nickname || '', avatarUrl: account.avatarUrl || '' }
  }
  if (provider === 'kugou' || provider === 'kugouLite') {
    if (provider === 'kugouLite') {
      const info = await KGL.getProfile(session)
      return info || { nickname: '', avatarUrl: '' }
    }
    const info = await KG.getMyUserInfo(session)
    return { nickname: info.nickname || '', avatarUrl: info.pic || '' }
  }
  if (provider === 'qq') {
    const uin = cookiePart(cookie, 'uin') || cookiePart(cookie, 'musicid') || cookiePart(cookie, 'p_uin')
    return {
      nickname: '',
      avatarUrl: uin === '' ? '' : 'https://q.qlogo.cn/headimg_dl?dst_uin=' + encodeURIComponent(uin) + '&spec=100',
    }
  }
  return null
}
