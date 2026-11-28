/**
 * Folia 音源的 DTO → 本插件门面的 DTO。
 *
 * 上游定义交出来的是 FoliumSourceSong / FoliumSourceCollection / FoliumSourcePage（见
 * A_other/docs/酷狗对齐Folia-上游规格.md §3），门面与路由认的是 shape() 那一套。两边字段名不同，
 * 但信息更全：上游把平台侧的侧车放在 song.data 里（hash、albumId、albumAudioId、mixSongId、fileId），
 * 正是本插件原来 shape() 压平后丢掉、写歌单又要用的那几项。这里逐项摆过去，不压平。
 *
 * @module dsh-music-panel/sources/kugou-folia/dto
 */
import { SOURCE_ID, kugouTexts } from './instance.js'
import { rememberSong } from './cache.js'

/** FoliumText / 普通字符串 → 当前语言的字符串。 */
export function text(value) {
  if (value === null || value === undefined) return ''
  try {
    return kugouTexts().resolveText(value)
  } catch {
    return typeof value === 'string' ? value : ''
  }
}

/** 酷狗的歌 id 是 hash：上游内部统一转大写，插件里存下来的都是小写，出口统一小写。 */
export function hashOf(song) {
  const raw = song?.data?.hash ?? song?.lyricIds?.kugou ?? song?.id ?? ''
  return String(raw).toLowerCase()
}

const artistNames = (artists) => (Array.isArray(artists) ? artists.map((artist) => String(artist?.name ?? '')).filter(Boolean).join(' / ') : '')

/** 一首上游的歌 → 门面的 shape() 形状。 */
export function songOf(song) {
  const item = song && typeof song === 'object' ? song : {}
  const data = item.data && typeof item.data === 'object' ? item.data : {}
  const id = hashOf(item)
  const album = item.album && typeof item.album === 'object' ? item.album : {}
  const durationMs = Number(item.durationMs) || 0
  const artists = Array.isArray(item.artists) ? item.artists : []
  // 读到的完整歌对象留一份：稍后只拿到 id 的取流与点赞要靠它的 data 侧车（hash/albumId/albumAudioId/fileId）。
  rememberSong(item)
  const coverUrl = String(item.coverUrl || album.coverUrl || '')
  return {
    provider: SOURCE_ID,
    id,
    title: String(item.title ?? ''),
    artist: artistNames(artists),
    album: String(album.name ?? ''),
    albumId: String(album.id ?? data.albumId ?? ''),
    durationSec: Math.round(durationMs / 1000),
    durationMs,
    coverUrl,
    qualityHint: item.availability?.label ? text(item.availability.label) : '',
    fee: 0,
    artistsDetail: artists.map((artist) => ({
      id: String(artist?.id ?? ''),
      name: String(artist?.name ?? ''),
      // 上游用 ref:false 表示这个音源开不了它的页面（酷狗按名字排出来的 id 就是这种）。
      ref: artist?.ref !== false,
    })),
    albumDetail: {
      id: String(album.id ?? ''),
      name: String(album.name ?? ''),
      coverUrl,
      ref: album.ref !== false,
    },
    aliases: Array.isArray(item.aliases) ? item.aliases.slice() : [],
    translatedNames: Array.isArray(item.translatedTitles) ? item.translatedTitles.slice() : [],
    publishTime: 0,
    popularity: Number(item.row?.listenCount) || 0,
    songType: 0,
    mvId: '',
    isVideo: item.video === true,
    copyright: 0,
    resourceState: null,
    noCopyright: null,
    privilegeDetail: null,
    availableQualities: [],
    // 云盘的歌：门面与路由靠这个字段区分取流分支。
    variant: item.variant ?? null,
    // 移除歌单要的行号（上游 song.data.fileId）；其余侧车原样带上，写操作要用。
    fileId: Number(data.fileId) || 0,
    data,
    lyricIds: item.lyricIds ?? null,
    replayGain: item.replayGain ?? null,
    pureMusic: item.pureMusic === true,
  }
}

/** 一页上游的歌 → 门面的 { songs, total, hasMore, nextOffset }。 */
export function songsPageOf(page, offset = 0) {
  const items = Array.isArray(page?.items) ? page.items : []
  const songs = items.map(songOf).filter((song) => song.id !== '')
  return {
    songs,
    total: Number(page?.total ?? 0) || 0,
    hasMore: page?.hasMore === true,
    nextOffset: Number(page?.nextOffset ?? 0) || offset + items.length,
  }
}

/** 搜索页要的 { results, total, page, hasMore }。 */
export function searchPageOf(page, pageNumber = 1) {
  const items = Array.isArray(page?.items) ? page.items : []
  const results = items.map(songOf).filter((song) => song.id !== '')
  return {
    results,
    total: Number(page?.total ?? 0) || 0,
    page: pageNumber,
    hasMore: page?.hasMore === true,
  }
}

/** 歌单 / 专辑 / 歌手 / 推荐卡 → 门面的 playlistCard（搜索页与推荐行共用）。 */
export function playlistCardOf(collection) {
  const item = collection && typeof collection === 'object' ? collection : {}
  return {
    id: String(item.id ?? ''),
    name: text(item.name),
    cover: String(item.coverUrl ?? ''),
    creator: item.creator?.nickname ? String(item.creator.nickname) : '',
    trackCount: Number(item.trackCount) || 0,
    playCount: Number(item.playCount) || 0,
    source: SOURCE_ID,
    type: item.type === 'album' ? 'album' : 'playlist',
    data: item.data && typeof item.data === 'object' ? item.data : {},
  }
}

/** 我的歌单行 → 门面的 shapePlaylist 形状（isOwned / isLike / addable 都在这里定）。 */
export function playlistRowOf(collection, canAdd) {
  const item = collection && typeof collection === 'object' ? collection : {}
  // 上游只给「自建」歌单写 isOwned: true（收藏的、别人的都不写），所以这里是 === true 而不是 !== false。
  const isOwned = item.isOwned === true
  // 「我喜欢」那张：上游的判据是 data.listId === '2' 或者名字就是「我喜欢 / 我喜欢的音乐」。
  const isLike = String(item.data?.listId ?? '') === '2'
    || String(item.id) === '2'
    || /^我喜欢/.test(text(item.name))
  return {
    provider: SOURCE_ID,
    id: String(item.id ?? ''),
    name: text(item.name),
    cover: String(item.coverUrl ?? ''),
    trackCount: Number(item.trackCount) || 0,
    creator: item.creator?.nickname ? String(item.creator.nickname) : '',
    kind: isOwned ? 'own' : 'collect',
    isOwned,
    isLike,
    isDefault: isLike,
    // 「加入歌单」只列能写进去的：上游 mutations.canAddToPlaylist 的判据。
    addable: typeof canAdd === 'function' ? canAdd(item) === true : false,
    data: item.data && typeof item.data === 'object' ? item.data : {},
  }
}

/** 一张专辑 / 一位歌手 → 门面的 albumCard / artistCard。 */
export function albumCardOf(collection) {
  const item = collection && typeof collection === 'object' ? collection : {}
  return {
    id: String(item.id ?? ''),
    name: text(item.name),
    cover: String(item.coverUrl ?? ''),
    artist: artistNames(item.artists),
    trackCount: Number(item.trackCount) || 0,
    publishTime: Number(item.publishedAt) || 0,
    source: SOURCE_ID,
    type: 'album',
    data: item.data && typeof item.data === 'object' ? item.data : {},
  }
}

export function artistCardOf(collection) {
  const item = collection && typeof collection === 'object' ? collection : {}
  return {
    id: String(item.id ?? ''),
    name: text(item.name),
    avatar: String(item.coverUrl ?? ''),
    // 旧的 artistCard 用 cover 这个键，客户端两种都存在过，两个都给。
    cover: String(item.coverUrl ?? ''),
    albumCount: Number(item.albumCount) || 0,
    source: SOURCE_ID,
    type: 'artist',
  }
}
