import crypto from 'node:crypto'
/**
 * KuGou Concept Edition ("lite") client.
 *
 * The concept app uses a different appid (3116), clientver (11440), signature
 * salt and token namespace from the standard KuGou Music client (1005/20489).
 * A standard-edition login must never be reused for concept playback.
 */

import { createDeviceIdentity, signWeb } from './kugou.js'

const APPID = 3116
const CLIENTVER = 11440
const AND_SALT = 'LnT6xpN3khm36zse0QzvmgTZ3waWdRSA'
const TRACK_KEY_SALT = '185672dd44712f60bb1736df5a377e82'
const SRCAPPID = 2919
const QR_APPID_CREATE = '1001'
const UA_ANDROID = 'Android15-1070-11440-46-0-DiscoveryDRADProtocol-wifi'
const UA_WEB = 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Mobile Safari/537.36'
const GATEWAY_HEADERS = (session, clienttime) => ({
  'User-Agent': UA_ANDROID,
  dfid: session.dfid || '-',
  mid: session.mid,
  clienttime,
  'kg-rc': '1',
  'kg-thash': '5d816a0',
  'kg-rec': '1',
  'kg-rf': 'B9EDA08A64250DEFFBCADDEE00F8F25F',
})

function md5Hex(value) {
  return crypto.createHash('md5').update(String(value || ''), 'utf8').digest('hex')
}

async function fetchJson(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    const text = await response.text()
    let json = null
    try {
      json = text === '' ? null : JSON.parse(text)
    } catch {
      json = null
    }
    return { response, json, text }
  } finally {
    clearTimeout(timer)
  }
}

function normSession(session = {}) {
  return {
    ...session,
    mid: String(session.mid || ''),
    dfid: String(session.dfid || ''),
    token: String(session.token || ''),
    userid: String(session.userid || ''),
    platform: 'lite',
  }
}

function signParams(params, body = '') {
  const ordered = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('')
  const text = typeof body === 'string' ? body : JSON.stringify(body)
  return md5Hex(`${AND_SALT}${ordered}${text}${AND_SALT}`)
}

function signTrackKey(hash, session) {
  return md5Hex(`${String(hash || '').toLowerCase()}${TRACK_KEY_SALT}${APPID}${session.mid}${Number(session.userid) || 0}`)
}

async function liteRequest(path, params = {}, session = {}, options = {}) {
  const s = normSession(session)
  if (!s.mid) throw new Error('酷狗概念版 session 缺少设备标识')
  const clienttime = String(Math.floor(Date.now() / 1000))
  const bodyText = options.body === undefined ? '' : JSON.stringify(options.body)
  const merged = {
    dfid: s.dfid || '-',
    mid: s.mid,
    uuid: '-',
    appid: APPID,
    clientver: CLIENTVER,
    clienttime,
    ...(s.token ? { token: s.token } : {}),
    ...(s.userid && s.userid !== '0' ? { userid: s.userid } : {}),
    ...params,
  }
  const q = new URLSearchParams({ ...merged, signature: signParams(merged, bodyText) })
  const base = options.baseUrl || 'https://gateway.kugou.com'
  const res = await fetchJson(`${base}${path}?${q.toString()}`, {
    method: options.method || 'GET',
    headers: {
      ...GATEWAY_HEADERS(s, merged.clienttime),
      ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(options.headers || {}),
    },
    ...(options.body === undefined ? {} : { body: bodyText }),
  })
  if (!res.response.ok) throw new Error('酷狗概念版请求失败：HTTP ' + res.response.status)
  if (!res.json) throw new Error('酷狗概念版返回了无法解析的数据')
  const errorCode = Number(res.json.error_code || 0)
  if (Number(res.json.status) === 0 || errorCode !== 0) {
    const code = res.json.error_code || res.json.errcode || res.json.code || res.json.status
    const message = res.json.error_msg || res.json.msg || res.json.error || res.json.message || '酷狗概念版请求失败'
    throw new Error((options.label ? '[' + options.label + '] ' : '') + String(message) + (code !== undefined ? '（code=' + code + '）' : ''))
  }
  return res.json
}

export async function createQRLogin(device = {}) {
  const dev = device.mid ? device : createDeviceIdentity()
  const params = {
    appid: QR_APPID_CREATE,
    type: '1',
    plat: '4',
    qrcode_txt: `https://h5.kugou.com/apps/loginQRCode/html/index.html?appid=${APPID}&`,
    srcappid: String(SRCAPPID),
    dfid: dev.dfid || '-',
    mid: dev.mid,
    uuid: '-',
    clienttime: String(Math.floor(Date.now() / 1000)),
    clientver: String(CLIENTVER),
  }
  const q = new URLSearchParams({ ...params, signature: signWeb(params) })
  const { json: data } = await fetchJson(`https://login-user.kugou.com/v2/qrcode?${q.toString()}`, {
    headers: { 'User-Agent': UA_WEB },
  })
  const key = data && data.data && data.data.qrcode
  if (!key) throw new Error('酷狗概念版二维码获取失败')
  return {
    source: 'kugouLite',
    key: String(key),
    imageDataUrl: data.data.qrcode_img && String(data.data.qrcode_img).startsWith('data:image')
      ? String(data.data.qrcode_img)
      : '',
    url: `https://h5.kugou.com/apps/loginQRCode/html/index.html?qrcode=${encodeURIComponent(key)}`,
    extra: { device: { guid: dev.guid, mid: dev.mid, dfid: dev.dfid } },
  }
}

export async function checkQRLogin(key, device = {}) {
  const dev = device.mid ? device : createDeviceIdentity()
  const params = {
    plat: '4',
    appid: String(APPID),
    srcappid: String(SRCAPPID),
    qrcode: String(key),
    dev: device.dev || '',
    dfid: dev.dfid || '-',
    mid: dev.mid,
    uuid: '-',
    clienttime: String(Math.floor(Date.now() / 1000)),
    clientver: String(CLIENTVER),
  }
  const q = new URLSearchParams({ ...params, signature: signWeb(params) })
  const { json: data } = await fetchJson(`https://login-user.kugou.com/v2/get_userinfo_qrcode?${q.toString()}`, {
    headers: { 'User-Agent': UA_WEB },
  })
  const statusCode = Number(data && data.data && data.data.status)
  const status = { 0: 'expired', 1: 'waiting', 2: 'scanned', 4: 'success' }[statusCode] || 'failed'
  const result = {
    source: 'kugouLite',
    key: `key=${encodeURIComponent(key)}`,
    status,
    message: { expired: '二维码已过期', waiting: '等待扫码中', scanned: '已扫码，请在酷狗概念版中确认', success: '登录成功' }[status] || '状态未知',
    extra: { code: statusCode },
  }
  if (status === 'success' && data.data && data.data.token) {
    result.tokenInfo = {
      token: String(data.data.token),
      userid: String(data.data.userid || ''),
      vip_type: String(data.data.vip_type || ''),
      vip_token: String(data.data.vip_token || ''),
      nickname: String(data.data.nickname || data.data.nick_name || ''),
    }
  }
  return result
}

function flattenObjects(root) {
  const out = []
  const visit = (value) => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item)
    } else if (value && typeof value === 'object') {
      out.push(value)
      for (const key of Object.keys(value)) visit(value[key])
    }
  }
  visit(root)
  return out
}

function firstNumber(objects, keys) {
  for (const item of objects) {
    for (const key of keys) {
      const raw = item[key]
      if (raw !== undefined && raw !== null && raw !== '') {
        const value = Number(raw)
        if (Number.isFinite(value)) return value
      }
    }
  }
  return 0
}

function firstBoolean(objects, keys) {
  for (const item of objects) {
    for (const key of keys) {
      const raw = item[key]
      if (raw === true || raw === 1 || raw === '1' || raw === 'true') return true
    }
  }
  return false
}

/** Concept membership status, including concept-vs-super VIP. */
export async function getVip(session = {}) {
  const s = normSession(session)
  if (!s.token) return { vip: false, superVip: false, type: 0, expiresAt: 0 }
  try {
    const data = await liteRequest('/v1/get_union_vip', {
      busi_type: 'concept',
      opt_product_types: 'dvip,qvip',
      product_type: 'svip',
    }, s, { baseUrl: 'https://kugouvip.kugou.com' })
    const objects = flattenObjects(data)
    const type = firstNumber(objects, ['vip_type', 'vipType'])
    const expiresAt = firstNumber(objects, ['vip_end_time', 'vip_expire_time', 'expire_time', 'end_time'])
    const vip = firstBoolean(objects, ['is_vip', 'vip', 'isVip', 'vip_status']) || type > 0 || expiresAt > Date.now() / 1000
    const superVip = firstBoolean(objects, ['super_vip', 'is_super_vip', 'suvip', 'svip']) || type === 6
    return { vip, superVip, type, expiresAt }
  } catch {
    const type = Number(s.vipType || 0) || 0
    return { vip: type > 0, superVip: type === 6, type, expiresAt: 0 }
  }
}

async function ensureAuth(session) {
  const data = await liteRequest('/v1/user_verify', { module_id: '51' }, session, {
    headers: { 'x-router': 'trackercdngz.kugou.com' },
  })
  const auth = data && data.data && data.data.auth
  if (!auth) throw new Error('酷狗概念版没有返回播放授权')
  return String(auth)
}

async function songAuth(session, song) {
  const auth = await ensureAuth(session)
  const hash = String(song.hash || '').toLowerCase()
  const albumAudioId = Number(song.albumAudioId || song.album_audio_id || 0) || 0
  const data = await liteRequest('/v1/authorization', {
    authorization: auth,
    module_id: '51',
    album_audio_id: String(albumAudioId),
    clientver: '11561',
    hash,
  }, session, { label: 'authorization', headers: { 'x-router': 'trackercdngz.kugou.com' } })
  const row = data && data.data ? data.data : data
  return {
    auth: String(row.auth || row.authorization || auth),
    openTime: Number(row.open_time || row.openTime || 0) || 0,
  }
}

export async function resolveStream(song, session = {}, prefer = ['flac', '320', '128']) {
  const s = normSession(session)
  const hash = String(song.hash || '').toLowerCase()
  if (!hash) throw new Error('缺少歌曲 hash')
  const auth = await songAuth(s, song)
  const qualities = prefer.filter((item) => ['flac', '320', '128'].includes(item))
  for (const quality of qualities.length ? qualities : ['128']) {
    const params = {
      album_id: String(song.albumId || song.album_id || 0),
      area_code: '1',
      module: '',
      hash,
      need_m: '0',
      ssa_flag: 'is_fromtrack',
      version: '11430',
      open_time: String(auth.openTime),
      ptype: '0',
      need_ogg: '1',
      page_id: '967177915',
      auth: auth.auth,
      mtype: '0',
      quality,
      album_audio_id: String(song.albumAudioId || song.album_audio_id || 0),
      behavior: 'play',
      pid: '411',
      module_id: '51',
      cmd: '26',
      ppage_id: '356753938,823673182,967485191',
      clientver: '11561',
      pidversion: '3001',
      cdnBackup: '1',
      dfid: s.dfid || '-',
      key: signTrackKey(hash, s),
    }
    const data = await liteRequest('/v5/url', params, s, {
      label: 'v5_url',
      headers: { 'x-router': 'trackercdn.kugou.com' },
    })
    const url = findPlaybackUrl(data)
    if (!url) continue
    const full = Number(data.is_full_audio) !== 0 && !/\/p_0_/.test(url)
    if (!full) throw new Error('该曲目仅返回试听片段，概念版 VIP 未生效')
    return { url, quality, bitrate: Number(data.bitrate) || 0 }
  }
  throw new Error('酷狗概念版取链失败')
}

function findPlaybackUrl(root) {
  if (typeof root === 'string') return /^https?:\/\//.test(root) ? root : ''
  if (Array.isArray(root)) {
    for (const item of root) {
      const hit = findPlaybackUrl(item)
      if (hit) return hit
    }
    return ''
  }
  if (root && typeof root === 'object') {
    for (const key of ['url', 'play_url', 'playUrl', 'backup_url', 'backupUrl']) {
      const hit = findPlaybackUrl(root[key])
      if (hit) return hit
    }
    for (const value of Object.values(root)) {
      const hit = findPlaybackUrl(value)
      if (hit) return hit
    }
  }
  return ''
}

export async function getProfile(session = {}) {
  const s = normSession(session)
  if (!s.token) return null
  // The lite gateway exposes account identity through the Web user page; avoid
  // leaking token in a URL and keep only public profile fields.
  try {
    const data = await liteRequest('/v1/user_verify', { module_id: '51' }, s, {
      headers: { 'x-router': 'trackercdngz.kugou.com' },
    })
    const row = data && data.data ? data.data : {}
    return { nickname: String(row.nickname || row.nick_name || ''), avatarUrl: String(row.pic || row.avatar || '') }
  } catch {
    return { nickname: '', avatarUrl: '' }
  }
}

/** Minimal concept playlist support; signs every request with the lite identity. */
export async function getMyPlaylists(session = {}) {
  const s = normSession(session)
  const body = { userid: s.userid, token: s.token, total_ver: 979, type: 2, page: 1, pagesize: 60 }
  const data = await liteRequest('/v7/get_all_list', {
    plat: '1',
    userid: s.userid,
    token: s.token,
  }, s, {
    method: 'POST',
    body,
    headers: { 'x-router': 'cloudlist.service.kugou.com' },
  })
  return flattenObjects(data)
    .map((item) => {
      if (item.hash || item.Hash || item.FileHash) return null
      const id = String(item.global_collection_id || item.specialid || item.listid || item.id || '')
      const name = String(item.specialname || item.listname || item.name || '')
      if (!id || !name) return null
      return {
        source: 'kugouLite',
        id,
        name,
        cover: String(item.imgurl || item.cover || item.pic || ''),
        trackCount: Number(item.song_count || item.songcount || item.count || 0) || 0,
        creator: String(item.nickname || item.username || ''),
        kind: item.is_def === 2 || item.is_like ? 'like' : 'own',
        isLike: item.is_def === 2 || item.is_like === true,
        isDefault: item.is_def === 2 || item.is_like === true,
      }
    })
    .filter(Boolean)
}

export async function getMyPlaylistSongs(listId, session = {}) {
  const s = normSession(session)
  const data = await liteRequest('/pubsongs/v2/get_other_list_file_nofilt', {
    area_code: '1',
    begin_idx: '0',
    plat: '1',
    type: '1',
    mode: '1',
    personal_switch: '1',
    extend_fields: 'abtags,hot_cmt,popularization',
    pagesize: '200',
    global_collection_id: String(listId),
  }, s)
  return flattenObjects(data)
    .map((item) => {
      const hash = String(item.hash || item.Hash || item.FileHash || '')
      if (!hash) return null
      const singerInfo = Array.isArray(item.singerinfo) ? item.singerinfo : []
      const singers = singerInfo.map((entry) => String(entry && entry.name ? entry.name : '')).filter(Boolean)
      const rawName = String(item.name || item.SongName || item.songname || item.AudioName || item.filename || '')
      let singer = singers.join(' / ')
      let title = rawName
      if (rawName.includes(' - ')) {
        const at = rawName.indexOf(' - ')
        const prefix = rawName.slice(0, at).trim()
        if (singers.length > 0) {
          // KuGou's display name is "artist - title"; use singerinfo for the
          // artist and strip the prefix even when separators differ (、 vs /).
          title = rawName.slice(at + 3).trim()
        } else {
          singer = prefix
          title = rawName.slice(at + 3).trim()
        }
      }
      const album = String((item.albuminfo && item.albuminfo.name) || item.album_name || item.AlbumName || item.albumname || '')
      const rawTimelen = Number(item.timelen || item.Duration || item.duration || 0) || 0
      const interval = rawTimelen > 10000 ? Math.round(rawTimelen / 1000) : rawTimelen
      const cover = String(item.cover || (item.trans_param && item.trans_param.union_cover) || '').replace(/\{size\}/g, '240')
      return {
        id: hash.toLowerCase(),
        hash: hash.toLowerCase(),
        albumAudioId: Number(item.mixsongid || item.album_audio_id || item.MixSongID || 0) || 0,
        albumId: Number(item.album_id || (item.albuminfo && item.albuminfo.id) || 0) || 0,
        title,
        singer,
        artists: singers.length > 0 ? singers : singer === '' ? [] : [singer],
        album,
        interval,
        durationSec: interval,
        cover,
        privilege: Number(item.privilege) || 0,
        payType: Number((item.relate_goods || []).find((row) => row && row.pay_type)?.pay_type) || 0,
        fileId: item.fileid || 0,
      }
    })
    .filter((item) => item && item.title)
}


