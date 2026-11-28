/**
 * 搜索、目录、推荐与排行的读接口：门面里所有「读」的酷狗分支。
 *
 * 上游把这些读法分在 search@1 / catalog@1 / recommendations@1 三个能力族里，分页一律是
 * offset/limit（不是页码），条目是 FoliumSourceSong / FoliumSourceCollection。这里只做三件事：把门面的页码与
 * 参数翻成上游的 offset/limit，把上游答复翻回门面的形状（dto.js），再把读到的完整对象记进 cache.js
 * （取流、歌词、写歌单要的 data 侧车）。每次上游调用单独 try/catch，交回 kugouError() 翻好的 MusicError；
 * 拼 DTO 的代码不放进 try 里。
 *
 * 派工表（dispatch.js）只在 provider === 'kugou' 时进来，所以下面的 provider 参数不参与分支。
 *
 * @module dsh-music-panel/sources/kugou-folia/read
 */
import { MusicError } from '../../../services/core/errors.js'
import { SOURCE_ID, kugouDefinition, kugouError } from './instance.js'
import { albumCardOf, artistCardOf, playlistCardOf, searchPageOf, songOf, songsPageOf } from './dto.js'
import { collectionOf, rememberCollection, rememberCollections, rememberSong } from './cache.js'

// 页宽都是门面这边定的，行数由上游答复里的 hasMore / nextOffset 决定：
// 搜索分页取 30，与门面里网易云、QQ 的页宽一致。
const SEARCH_PAGE_SIZE = 30
// 一次性搜索取上游的单请求上限 100（上游匿名搜索的 pagesize 也只收 1..100）。
const SEARCH_ONE_SHOT_SIZE = 100
// 专辑 / 歌单搜索：上游按页号翻（page * pagesize 推下一页），页宽照旧 30。
const COLLECTION_PAGE_SIZE = 30
// 上游 getAlbumTracks 把页宽夹到 30。
const ALBUM_TRACK_PAGE_SIZE = 30
// 把一张专辑读完的守卫，不是业务上限：只防上游一直答「还有下一页」。
const ALBUM_TRACK_MAX_PAGES = 100
// 歌手页的页宽：门面原来按 60 取，最多 100。
const ARTIST_PAGE_SIZE = 60
const ARTIST_PAGE_SIZE_MAX = 100
// 歌手的专辑：门面这一项没有分页，一次取 50 张。
const ARTIST_ALBUM_SIZE = 50
// 云盘一页 100：路由 /online/cloud 就是按 100 条判断 hasMore 的。
const CLOUD_PAGE_SIZE = 100
// 排行上游一次给全表（data.lists），取一个大于它上限的行数当整表。
const LISTENING_RANK_SIZE = 500

/** 上游的能力族：每次现取，实例换了也拿到新的那份。 */
function capabilities(family) {
  const definition = kugouDefinition()
  const found = definition !== null && typeof definition === 'object' ? definition.capabilities?.[family] : undefined
  if (found === undefined || found === null) {
    throw new MusicError('酷狗音源没有 ' + family + ' 能力', { code: 'unavailable', sourceId: SOURCE_ID })
  }
  return found
}

/** 上游的歌 → 门面的行，并把完整对象记进缓存（data 侧车后面要用）。 */
function songsOf(list) {
  const rows = Array.isArray(list) ? list : []
  for (const song of rows) rememberSong(song)
  return rows.map(songOf).filter((song) => song.id !== '')
}

/** 上游的一页歌 → 门面的 { songs, total, hasMore, nextOffset }；游标原样用上游的。 */
function toSongsPage(page, offset) {
  const rows = Array.isArray(page?.items) ? page.items : []
  for (const song of rows) rememberSong(song)
  return songsPageOf(page, offset)
}

/** 上游的一页歌 → 门面的 { results, total, page, hasMore }。 */
function toSearchPage(page, pageNumber) {
  const rows = Array.isArray(page?.items) ? page.items : []
  for (const song of rows) rememberSong(song)
  return searchPageOf(page, pageNumber)
}

/** 门面拿得到的账号记号：登录桥把 userid 写进会话，未登录是 0。 */
function accountIdOf(session) {
  return Number(session?.userid) || 0
}

/** 「A / B」这种多歌手字段里有没有这个人（名字回退只用它筛，不参与分页）。 */
function sameArtist(actual, wanted) {
  const target = String(wanted ?? '').trim().toLowerCase()
  const text = String(actual ?? '').trim().toLowerCase()
  if (target === '' || text === '') return false
  if (text === target || text.includes(target)) return true
  const parts = text.split(/\s*[/,&、]\s*/)
  return target.split(/\s*[/,&、]\s*/).some((part) => part !== '' && parts.includes(part))
}

/**
 * 名字 → 酷狗的 author_id。
 *
 * 上游的歌手页只认 id（catalog@1.getArtistSongs），门面的行允许只带名字（旧缓存行）。这里借一次搜索，
 * 从歌手的 ref 不是 false（酷狗真有这个 id）的条目里取一个。反查是尽力而为的一步：它失败不让页面失败，
 * 真正的读法在下一条路里，那里的错才报给用户。
 */
async function resolveArtistId(name) {
  const wanted = String(name ?? '').trim().toLowerCase()
  if (wanted === '') return ''
  let page = null
  try {
    page = await capabilities('search@1').searchSongs(String(name).trim(), SEARCH_ONE_SHOT_SIZE, 0)
  } catch {
    return ''
  }
  const rows = Array.isArray(page?.items) ? page.items : []
  for (const song of rows) {
    for (const artist of Array.isArray(song?.artists) ? song.artists : []) {
      // 没有酷狗 id 的歌手，上游发的是 kugou-artist-* 假 id 并标 ref:false：那种开不了歌手页。
      if (artist?.ref === false) continue
      const id = String(artist?.id ?? '').trim()
      if (id === '') continue
      if (String(artist?.name ?? '').trim().toLowerCase() === wanted) return id
    }
  }
  return ''
}

/**
 * 没有歌手 id 时的退回：用搜索的第一页，按歌手名筛完再切片。
 * 这是一次性读法（上游没有按名字分页的歌手接口），第二页起会读不到东西。
 */
async function nameSearchPage(name, offset, limit) {
  let page = null
  try {
    page = await capabilities('search@1').searchSongs(name, SEARCH_ONE_SHOT_SIZE, 0)
  } catch (error) {
    throw kugouError(error)
  }
  const songs = songsOf(page?.items).filter((song) => sameArtist(song.artist, name))
  const windowed = songs.slice(offset, offset + limit)
  return {
    songs: windowed,
    total: songs.length,
    hasMore: offset + windowed.length < songs.length,
    nextOffset: offset + windowed.length,
  }
}

/** 一次搜索（不带页码）：取上游第一页的最大页宽，交回门面的歌曲行。 */
export async function search(provider, query, cookie = '', session = {}) {
  const text = String(query ?? '').trim()
  if (text === '') return []
  let page = null
  try {
    page = await capabilities('search@1').searchSongs(text, SEARCH_ONE_SHOT_SIZE, 0)
  } catch (error) {
    throw kugouError(error)
  }
  return songsOf(page?.items)
}

/**
 * 真分页的搜索：第 page 页 → 上游的 offset；hasMore 与 nextOffset 都由上游答复定。
 * 未登录时上游自己会退回匿名搜索（search@1 的 access 是 account，但内部有这条退路），这里不另写。
 */
export async function searchPage(provider, query, cookie = '', session = {}, page = 1) {
  const target = Math.max(1, Number(page) || 1)
  const text = String(query ?? '').trim()
  if (text === '') return { results: [], total: 0, page: target, hasMore: false }
  const offset = (target - 1) * SEARCH_PAGE_SIZE
  let answer = null
  try {
    answer = await capabilities('search@1').searchSongs(text, SEARCH_PAGE_SIZE, offset)
  } catch (error) {
    throw kugouError(error)
  }
  return toSearchPage(answer, target)
}

/** 专辑搜索：上游 search 的 type=album。 */
export async function searchAlbums(provider, query, cookie = '', session = {}, page = 1) {
  const target = Math.max(1, Number(page) || 1)
  const text = String(query ?? '').trim()
  if (text === '') return { items: [], total: 0, page: target }
  const offset = (target - 1) * COLLECTION_PAGE_SIZE
  let answer = null
  try {
    answer = await capabilities('search@1').searchAlbums(text, COLLECTION_PAGE_SIZE, offset)
  } catch (error) {
    throw kugouError(error)
  }
  const items = Array.isArray(answer?.items) ? answer.items : []
  rememberCollections(items)
  return {
    items: items.map(albumCardOf).filter((album) => album.id !== ''),
    total: Number(answer?.total) || 0,
    page: target,
  }
}

/** 歌单搜索：上游 search 的 type=special（创建者只有一个昵称，上游已放进 creator）。 */
export async function searchPlaylists(provider, query, cookie = '', session = {}, page = 1) {
  const target = Math.max(1, Number(page) || 1)
  const text = String(query ?? '').trim()
  if (text === '') return { items: [], total: 0, page: target }
  const offset = (target - 1) * COLLECTION_PAGE_SIZE
  let answer = null
  try {
    answer = await capabilities('search@1').searchPlaylists(text, COLLECTION_PAGE_SIZE, offset)
  } catch (error) {
    throw kugouError(error)
  }
  const items = Array.isArray(answer?.items) ? answer.items : []
  rememberCollections(items)
  return {
    items: items.map(playlistCardOf).filter((card) => card.id !== ''),
    total: Number(answer?.total) || 0,
    page: target,
  }
}

/**
 * 一位歌手的歌，按页。
 *
 * 上游只认歌手 id（artist_audios）；门面允许只带名字，那就先反查 id，再照上游分页。
 * 反查不到时退回「搜名字再按歌手筛」的一次性结果。
 */
export async function artistSongs(provider, artist, cookie = '', session = {}, artistId = '', page = {}) {
  const name = String(artist ?? '').trim()
  const offset = Math.max(0, Number(page?.offset) || 0)
  const limit = Math.min(ARTIST_PAGE_SIZE_MAX, Math.max(1, Number(page?.limit) || ARTIST_PAGE_SIZE))
  const empty = { songs: [], total: 0, hasMore: false, nextOffset: offset }
  let id = String(artistId ?? '').trim()
  if (id === '' && name === '') return empty
  if (id === '' || /^kugou-artist-/.test(id)) {
    id = await resolveArtistId(name)
  }
  if (id !== '') {
    let answer = null
    try {
      answer = await capabilities('catalog@1').getArtistSongs(id, limit, offset)
    } catch (error) {
      // 只带 id 没有名字时没有退路，如实报错；有名字就再把名字那条路走一遍。
      if (name === '') throw kugouError(error)
      answer = null
    }
    if (answer !== null) {
      const result = toSongsPage(answer, offset)
      if (result.songs.length > 0 || result.total > 0) return result
    }
  }
  if (name === '') return empty
  return nameSearchPage(name, offset, limit)
}

/**
 * 把一张专辑的曲目按上游的页读完（页宽 30 是上游 getAlbumTracks 的上限）。
 * 上游说没有下一页就停；游标没往前走（同一页又答一次）也停，避免空转。
 */
async function albumTrackSongs(albumId, collection) {
  const catalog = capabilities('catalog@1')
  const songs = []
  let offset = 0
  for (let read = 0; read < ALBUM_TRACK_MAX_PAGES; read += 1) {
    let page = null
    try {
      page = await catalog.getAlbumTracks(albumId, ALBUM_TRACK_PAGE_SIZE, offset, collection)
    } catch (error) {
      throw kugouError(error)
    }
    songs.push(...(Array.isArray(page?.items) ? page.items : []))
    if (page?.hasMore !== true) break
    const next = Number(page?.nextOffset)
    if (!Number.isFinite(next) || next <= offset) break
    offset = next
  }
  return songs
}

/** 名字退回：上游没有按名字读专辑的接口，借它的歌曲搜索，再按专辑名相等筛。 */
async function searchAlbumByName(albumName, artistName) {
  const query = [String(artistName ?? '').trim(), String(albumName ?? '').trim()]
    .filter((part) => part !== '')
    .join(' ')
  if (query === '') return []
  let page = null
  try {
    page = await capabilities('search@1').searchSongs(query, SEARCH_ONE_SHOT_SIZE, 0)
  } catch (error) {
    throw kugouError(error)
  }
  const target = String(albumName).trim().toLowerCase()
  const rows = Array.isArray(page?.items) ? page.items : []
  return rows.filter((song) => String(song?.album?.name ?? '').trim().toLowerCase() === target)
}

/**
 * 一张专辑的曲目。
 *
 * 上游按 id 读：catalog@1.getAlbumDetail 取详情、getAlbumTracks 一页 30 地翻。门面这一项没有分页，
 * 所以一次读完整张。id 为空或读不出时按 hint 里的专辑名借搜索兜一次（路由允许酷狗只带名字，
 * 见 online.js 的 /online/album）；这样也保住了旧缓存里没有专辑 id 的行。
 */
export async function albumSongs(provider, id, cookie = '', session = {}, hint = {}) {
  const albumId = String(id ?? '').trim()
  const albumName = String(hint?.album || hint?.name || '').trim()
  const artistName = String(hint?.artist ?? '').trim()
  if (albumId === '' && albumName === '') {
    throw new MusicError('缺少专辑信息', { code: 'unavailable', sourceId: SOURCE_ID })
  }

  let collection = null
  let songs = []
  if (albumId !== '') {
    try {
      const detail = await capabilities('catalog@1').getAlbumDetail(albumId, collectionOf(albumId, 'album'))
      if (detail !== null && detail !== undefined) collection = rememberCollection(detail)
      songs = await albumTrackSongs(albumId, collection)
    } catch (error) {
      // 带名字来的：上游读不出这张专辑就按名字再搜一次；没名字就没退路，如实报错。
      if (albumName === '') throw kugouError(error)
      songs = []
    }
  }
  if (songs.length === 0 && albumName !== '') {
    songs = await searchAlbumByName(albumName, artistName)
  }

  const album = collection === null ? null : albumCardOf(collection)
  const rows = songsOf(songs)
  if (album === null && rows.length === 0) {
    throw new MusicError('未找到该专辑曲目', { code: 'unavailable', sourceId: SOURCE_ID })
  }
  return {
    id: albumId || (album === null ? '' : album.id),
    name: (album === null ? '' : album.name) || albumName || String(rows[0]?.album ?? ''),
    cover: (album === null ? '' : album.cover) || String(rows[0]?.coverUrl ?? ''),
    artist: (album === null ? '' : album.artist) || artistName || String(rows[0]?.artist ?? ''),
    songs: rows,
  }
}

/** 一位歌手的专辑：上游 artist_detail 给名字与头像，artist_albums 一页 50 张。 */
export async function artistAlbums(provider, id, cookie = '', session = {}) {
  const artistId = String(id ?? '').trim()
  if (artistId === '') return { artist: null, albums: [] }
  const catalog = capabilities('catalog@1')
  let detail = null
  let answer = null
  try {
    detail = await catalog.getArtistDetail(artistId)
    answer = await catalog.getArtistAlbums(artistId, ARTIST_ALBUM_SIZE, 0)
  } catch (error) {
    throw kugouError(error)
  }
  const items = Array.isArray(answer?.items) ? answer.items : []
  rememberCollections(items)
  return {
    artist: detail === null || detail === undefined ? null : artistCardOf(detail),
    albums: items.map(albumCardOf).filter((album) => album.id !== ''),
  }
}

/** 门面这一项酷狗没有浏览列表：如实答空表（中文平台都是搜索驱动的）。 */
export function songs() {
  return []
}

/** 只有 Navidrome 有原生全库列表；这里照门面的形状答空。 */
export function nativeSongs() {
  return { songs: [], total: 0, offset: 0 }
}

/** 上游没有全站歌手列表。 */
export function artists() {
  return []
}

/** 上游没有全站专辑列表。 */
export function albums() {
  return []
}

/** 日推：上游 everyday_recommend，一次给整表。 */
export async function dailySongs(provider, cookie = '', session = {}) {
  let songs = null
  try {
    songs = await capabilities('recommendations@1').getDailySongs()
  } catch (error) {
    throw kugouError(error)
  }
  return songsOf(songs)
}

/**
 * 推荐歌单：上游给的是概念版自己的 6 张卡（id 形如 kugou-card-*），不是网页歌单。
 * 卡对象要记进缓存：点进卡时 catalog 读的是卡内歌曲，靠它的 data 侧车（virtualRecommendation / cardId）。
 */
export async function recommendedCollections(provider, cookie = '', session = {}, limit = 30) {
  let collections = null
  try {
    collections = await capabilities('recommendations@1').getRecommendedCollections(limit)
  } catch (error) {
    throw kugouError(error)
  }
  const rows = Array.isArray(collections) ? collections : []
  rememberCollections(rows)
  return rows.map(playlistCardOf).filter((card) => card.id !== '')
}

/** 私人 FM：上游 personal_fm，一次给整表。 */
export async function personalFm(provider, cookie = '', session = {}) {
  let songs = null
  try {
    songs = await capabilities('recommendations@1').getPersonalFm()
  } catch (error) {
    throw kugouError(error)
  }
  return songsOf(songs)
}

/**
 * 云盘：门面按页要（路由按每页 100 条判断 hasMore），上游 user_cloud 按 offset 读。
 * 云盘是账号的集合（上游 library@1.getCloudCollection 只在有账号时给出它）：未登录就没有这个集合，
 * 直接答空表，不去问 user_cloud——那一路只会带着 auth-required 回来。
 */
export async function cloudSongs(provider, cookie = '', session = {}, page = 1) {
  if (accountIdOf(session) === 0) return []
  const target = Math.max(1, Number(page) || 1)
  const offset = (target - 1) * CLOUD_PAGE_SIZE
  let answer = null
  try {
    answer = await capabilities('catalog@1').getCloudTracks(CLOUD_PAGE_SIZE, offset)
  } catch (error) {
    throw kugouError(error)
  }
  return songsOf(answer?.items)
}

/** 听歌排行：上游一次给全表（data.lists），这里整表取出，每行带上 listen_count。 */
export async function listeningRank(provider, range, cookie = '', session = {}) {
  const span = range === 'all' ? 'all' : 'week'
  let answer = null
  try {
    answer = await capabilities('catalog@1').getListeningRankTracks(span, LISTENING_RANK_SIZE, 0)
  } catch (error) {
    throw kugouError(error)
  }
  const rows = Array.isArray(answer?.items) ? answer.items : []
  for (const song of rows) rememberSong(song)
  return rows
    .map((song) => ({ ...songOf(song), listenCount: Number(song?.row?.listenCount) || 0 }))
    .filter((song) => song.id !== '')
}

/** 日推历史：上游 everyday_history 的 mode=list，交回的是一串日期。 */
export async function historyDates(provider, cookie = '') {
  let dates = null
  try {
    dates = await capabilities('recommendations@1').getHistoryDates()
  } catch (error) {
    throw kugouError(error)
  }
  const rows = Array.isArray(dates) ? dates : []
  return rows.map((date) => String(date ?? '').trim()).filter((date) => date !== '')
}

/**
 * 某一天的日推：门面只有日期，上游按日期自己反查 history_name 再读歌（getHistorySongs 收字符串就走这条路）。
 * 上游把条目也放在 recommendations@1 里；门面的 historySongs 只收日期，所以这里传字符串。
 */
export async function historySongs(provider, cookie = '', date = '') {
  const day = String(date ?? '').trim()
  if (day === '') return []
  let songs = null
  try {
    songs = await capabilities('recommendations@1').getHistorySongs(day)
  } catch (error) {
    throw kugouError(error)
  }
  return songsOf(songs)
}
