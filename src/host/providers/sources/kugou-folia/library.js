/**
 * 曲库与写入：门面的 myPlaylists / playlistSongs(Page) / 喜欢 / 歌单增删 / 订阅状态。
 *
 * 门面只给得到 id 字符串，上游要的是集合对象：listId、推荐卡的 virtualRecommendation、
 * 云盘与排行这两类集合的 type 都在它的集合里，所以一律先回查 cache，再交给上游。普通歌单读
 * catalog@1.getPlaylistTracks，第 4 个参数一定把集合交回去——推荐卡的虚拟歌单由上游按这个集合
 * 分流（它只看 collection.data.cardId/virtualRecommendation，不看 id 前缀），这里不自己判；
 * 云盘与排行两类集合上游另有 getCloudTracks / getListeningRankTracks。
 * 账号 id 取门面会话里的 userid（登录路由把上游答回的账号写进了会话），会话里没有时不自己造，
 * 交给上游按未登录处理。provider / cookie 两个参数只为派工表原样转发而保留：源 id 一律用
 * SOURCE_ID，凭据在上游桥自己的会话里。
 *
 * @module dsh-music-panel/sources/kugou-folia/library
 */
import { MusicError } from '../../../services/core/errors.js'
import { SOURCE_ID, kugouDefinition, kugouError, kugouUserId } from './instance.js'
import { playlistRowOf, songsPageOf, text as foliaText } from './dto.js'
import { collectionOf, foliaSongOf, rememberCollection, rememberCollections, rememberSong } from './cache.js'

/** 上游一页的上限（KUGOU_MAX_PAGE_SIZE）；门面要更多时也只能按这个宽度往前翻。 */
const PAGE_SIZE = 100
/** 整表读的保护上限：200 页 = 20000 行，与上游读收藏列表用的是同一把尺子。 */
const MAX_PAGES = 200
/**
 * 听歌排行的两张卡（library@1.getListeningRankCollections）默认不在这里列：
 * /online/my-playlists 的路由按 listeningRank 能力自己注入它们（online.js:1801-1825），
 * 这里再列一遍同一个 id 会出现两次。若哪天路由那一段删了，把这里改成 true 即可接回上游的集合。
 */
const MERGE_LISTENING_RANK = false

/** 一个能力族；上游没有这一族时按「音源没提供」报错，而不是让 TypeError 冒出去。 */
function capability(name) {
  const families = kugouDefinition().capabilities
  const family = families && typeof families === 'object' ? families[name] : undefined
  if (!family || typeof family !== 'object') {
    throw new MusicError('酷狗音源没有提供 ' + name, { code: 'unavailable', sourceId: SOURCE_ID })
  }
  return family
}

/** 会话里的账号 id；没有（或还是占位的 0）就当没有账号，不拿别的东西顶替。 */
function userIdOf(session) {
  // 登录态在上游桥里：账号提示写在它的页存储（kugouUserId），门面会话里的 userid 只在旧登录遗留时才有。
  const raw = (session && typeof session === 'object' ? session.userid : '') || kugouUserId()
  const id = String(raw === null || raw === undefined ? '' : raw).trim()
  return id === '0' ? '' : id
}

/** 门面的 page 参数 → 上游认的 limit/offset（上游自己再把 limit 夹到 1..100）。 */
function pageBounds(page) {
  const limit = Math.max(1, Math.min(200, parseInt(page && page.limit, 10) || 100))
  const offset = Math.max(0, parseInt(page && page.offset, 10) || 0)
  return { limit: Math.min(limit, PAGE_SIZE), offset }
}

/** 集合里有没有可供页头用的元数据（名字或封面）。 */
function hasMeta(collection) {
  return foliaText(collection && collection.name) !== '' || String((collection && collection.coverUrl) || '') !== ''
}

/**
 * 按 id 找回上游集合。cache 是按「类型:id」存的，而云盘与排行这两类集合的 id 本身不带类型，
 * 所以按歌单选找不到时再把这两类补查一次；推荐卡等虚拟歌单由别的映射在列出来时存好。
 */
function collectionFor(id) {
  const key = String(id)
  const playlist = collectionOf(key)
  if (hasMeta(playlist) || Object.keys((playlist && playlist.data) || {}).length > 0) return playlist
  for (const type of ['listening_rank', 'cloud']) {
    const found = collectionOf(key, type)
    if (hasMeta(found) || found.listeningRank !== undefined) return found
  }
  return playlist
}

/**
 * 一页歌。普通歌单读 playlist_track_all（集合必给，推荐卡才会走上游的内存切片）；
 * 云盘与排行是另外两种集合，上游的目录族里各自有方法。
 */
async function trackPage(id, collection, limit, offset) {
  const catalog = capability('catalog@1')
  let page
  try {
    if (collection.type === 'cloud') {
      page = await catalog.getCloudTracks(limit, offset, collection)
    } else if (collection.type === 'listening_rank') {
      const range = collection.listeningRank === 'all' ? 'all' : 'week'
      page = await catalog.getListeningRankTracks(range, limit, offset, collection)
    } else {
      page = await catalog.getPlaylistTracks(String(id), limit, offset, collection)
    }
  } catch (error) {
    throw kugouError(error)
  }
  // 留一份完整歌对象（dto 映射时也会留）：门面后面按 id 回查它，侧车带着 albumId/mixSongId/fileId。
  for (const item of Array.isArray(page && page.items) ? page.items : []) rememberSong(item)
  return page
}

/** 门面的一页歌曲映射（shape 后的歌 + 上游自己的 hasMore/nextOffset）。 */
function songsPage(page, offset) {
  const mapped = songsPageOf(page, offset)
  return {
    songs: mapped.songs,
    total: mapped.total,
    hasMore: mapped.hasMore === true,
    nextOffset: mapped.nextOffset,
  }
}

/** 整表读：按上游这一页实际消费的行数往前翻，直到它说没有下一页。 */
async function readAllTracks(id, collection) {
  const songs = []
  let total = 0
  let offset = 0
  for (let index = 0; index < MAX_PAGES; index += 1) {
    const page = await trackPage(id, collection, PAGE_SIZE, offset)
    const mapped = songsPage(page, offset)
    if (mapped.total > 0) total = mapped.total
    songs.push(...mapped.songs)
    const consumed = Array.isArray(page && page.items) ? page.items.length : 0
    if (mapped.hasMore !== true || consumed === 0) return { songs, total }
    const next = Number(mapped.nextOffset)
    if (!Number.isFinite(next) || next <= offset) return { songs, total }
    offset = next
  }
  throw new MusicError('酷狗歌单超过 ' + MAX_PAGES + ' 页仍未读完', { code: 'invalid-response', sourceId: SOURCE_ID })
}

/** 歌单详情：缓存里没有名字时（冷启动）向上游要一次，它会把缺的元数据补齐。 */
async function detailOf(id, collection) {
  if (collection.type !== 'playlist' || hasMeta(collection)) return collection
  let detail
  try {
    detail = await capability('catalog@1').getPlaylistDetail(String(id), collection)
  } catch (error) {
    throw kugouError(error)
  }
  if (!detail || typeof detail !== 'object') return collection
  return rememberCollection(detail)
}

/** 喜欢的整张表（上游一次给全，读不完它会自己抛错）。 */
async function likedIdsOf(session) {
  const userId = userIdOf(session)
  let result
  try {
    result = await capability('library@1').getLikedSongIds(userId || undefined)
  } catch (error) {
    throw kugouError(error)
  }
  return Array.isArray(result && result.ids) ? result.ids : []
}

/** 一首歌的 id；写入前缺 id 直接报错，与门面原来的说法一致。 */
function songIdOf(song) {
  return String((song && song.id) || '').trim()
}

/** 歌单内的行号（fileId）：上游放在歌的 data 侧车里，门面的 DTO 另在顶层带了一份。 */
function fileIdOf(song) {
  const data = song && typeof song.data === 'object' && song.data !== null ? song.data : {}
  const value = data.fileId === undefined || data.fileId === null ? song && song.fileId : data.fileId
  const textValue = value === undefined || value === null ? '' : String(value).trim()
  return textValue === '0' ? '' : textValue
}

/**
 * 账号的歌单。上游按页给（还顺手给自己歌单补最近一首的封面），这里读到它说没有下一页为止；
 * 云盘按上游的办法也作为一行集合列在歌单里；听歌排行那两张卡见 MERGE_LISTENING_RANK。
 *
 * @returns {Promise<object[]>} 门面的 shapePlaylist 形状
 */
export async function myPlaylists(provider, cookie = '', session = {}) {
  const userId = userIdOf(session)
  const library = capability('library@1')
  const canAdd = capability('mutations@1').canAddToPlaylist
  const collections = []
  let offset = 0
  for (let index = 0; index < MAX_PAGES; index += 1) {
    let page
    try {
      page = await library.getUserPlaylists(userId || undefined, PAGE_SIZE, offset)
    } catch (error) {
      throw kugouError(error)
    }
    const items = Array.isArray(page && page.items) ? page.items : []
    rememberCollections(items)
    collections.push(...items)
    if (!page || page.hasMore !== true || items.length === 0) break
    const next = Number(page.nextOffset)
    offset = Number.isFinite(next) && next > offset ? next : offset + items.length
  }
  const rankCards = []
  if (MERGE_LISTENING_RANK) {
    try {
      rankCards.push(...await library.getListeningRankCollections({ id: userId || undefined }))
    } catch (error) {
      throw kugouError(error)
    }
    rememberCollections(rankCards)
  }
  let cloud = null
  try {
    cloud = await library.getCloudCollection({ id: userId || undefined })
  } catch (error) {
    throw kugouError(error)
  }
  if (cloud) rememberCollection(cloud)
  return [...rankCards, ...collections, ...(cloud ? [cloud] : [])].map((collection) => playlistRowOf(collection, canAdd))
}

/**
 * 一整张歌单（门面在路由之外的那条完整读法）。名字与封面用回查到的集合，歌曲按页读全。
 *
 * @returns {Promise<{ name: string, cover: string, trackCount: number, songs: object[] }>}
 */
export async function playlistSongs(provider, id, cookie = '', session = {}) {
  const collectionId = String(id === null || id === undefined ? '' : id).trim()
  if (collectionId === '') throw new Error('缺少歌单 id')
  const collection = await detailOf(collectionId, collectionFor(collectionId))
  const { songs, total } = await readAllTracks(collectionId, collection)
  return {
    name: foliaText(collection.name),
    cover: String(collection.coverUrl || ''),
    trackCount: Number(collection.trackCount) || total || songs.length,
    songs,
  }
}

/**
 * 一页歌单。一页只问上游一次，hasMore/nextOffset 原样用上游这一页的（按实际消费的行数推进）。
 *
 * @returns {Promise<{ name: string, cover: string, trackCount: number, songs: object[], hasMore: boolean, nextOffset: number }>}
 */
export async function playlistSongsPage(provider, id, cookie = '', session = {}, page = {}) {
  const collectionId = String(id === null || id === undefined ? '' : id).trim()
  if (collectionId === '') throw new Error('缺少歌单 id')
  const { limit, offset } = pageBounds(page)
  const collection = collectionFor(collectionId)
  const answer = await trackPage(collectionId, collection, limit, offset)
  const mapped = songsPage(answer, offset)
  return {
    // 页头的元数据用列表行上的（旧门面走直读时名字与封面本来就是空的，客户端接着用行上的）。
    name: foliaText(collection.name),
    cover: String(collection.coverUrl || ''),
    trackCount: Number(collection.trackCount) || mapped.total || mapped.songs.length,
    songs: mapped.songs,
    hasMore: mapped.hasMore,
    nextOffset: mapped.nextOffset,
  }
}

/** 一首歌在不在「我喜欢」里（上游按 hash 比对，两边都按小写）。 */
export async function onlineLiked(provider, id, cookie = '', session = {}) {
  const target = String(id === null || id === undefined ? '' : id).trim().toLowerCase()
  if (target === '') return false
  const ids = await likedIdsOf(session)
  return ids.some((value) => String(value).toLowerCase() === target)
}

/** 喜欢的全部歌键，形状与客户端 track.path 一致：online:<源>:<小写 hash>。 */
export async function onlineLikedIds(provider, cookie = '', session = {}) {
  const ids = await likedIdsOf(session)
  return ids
    .map((value) => String(value === null || value === undefined ? '' : value).trim().toLowerCase())
    .filter((value) => value !== '')
    .map((value) => 'online:' + SOURCE_ID + ':' + value)
}

/** 红心开关：上游的 likeSong 自己会判「没有账号就抛 auth-required」与「取消时去哪里找行号」。 */
export async function setOnlineLiked(provider, song, on, cookie = '', session = {}) {
  if (songIdOf(song) === '') throw new Error('缺少歌曲 id')
  const mutations = capability('mutations@1')
  try {
    await mutations.likeSong(foliaSongOf(song), on === true)
  } catch (error) {
    throw kugouError(error)
  }
  return true
}

/** 把一首歌加进账号的某个歌单（目标歌单的 listId 来自 cache 里的集合，缺了就让上游按 id 发）。 */
export async function addOnlineSongToPlaylist(provider, song, playlistId, cookie = '', session = {}) {
  if (songIdOf(song) === '') throw new Error('缺少歌曲 id')
  const mutations = capability('mutations@1')
  const collection = collectionOf(String(playlistId))
  try {
    await mutations.updatePlaylistTracks('add', collection, [foliaSongOf(song)])
  } catch (error) {
    throw kugouError(error)
  }
  return true
}

/**
 * 从账号的某个歌单里移除一首歌。上游按行号（fileId）删，且行号只对「取它的那张歌单」有效，
 * 所以这里只认门面 DTO 带回来的 fileId，缺了就说缺，不替它猜。
 */
export async function removeOnlineSongFromPlaylist(provider, song, playlistId, cookie = '', session = {}) {
  if (songIdOf(song) === '') throw new Error('缺少歌曲 id')
  const fileId = fileIdOf(song)
  if (fileId === '') throw new Error('酷狗歌曲缺少 fileId，无法从歌单移除')
  const mutations = capability('mutations@1')
  const collection = collectionOf(String(playlistId))
  const foliaSong = foliaSongOf(song)
  const track = { ...foliaSong, data: { ...(foliaSong.data || {}), fileId } }
  try {
    await mutations.updatePlaylistTracks('del', collection, [track])
  } catch (error) {
    throw kugouError(error)
  }
  return true
}

/**
 * 订阅状态：上游 catalog@1 有 getSubscriptionStatus，但本插件的能力表把 playlistSubscription
 * 声明为 false（路由不会问到），所以这里如实回「没有订阅这件事」。能力表打开时改成调上游即可。
 */
export function subscriptionStatus(provider, type, id, cookie = '') {
  return false
}

/** 订阅写入：上游的 mutations@1 只实现了 playlist_add/del 的裸接口，本插件没有声明这条能力。 */
export async function subscribeCollection(provider, type, id, subscribed, cookie = '') {
  throw new MusicError('该平台不支持订阅', { code: 'unavailable', sourceId: SOURCE_ID })
}
