/**
 * Folia 音源 DTO → 本插件的 Track / 集合 / 分页。
 *
 * 上游交回 FoliumSourceSong / FoliumSourceCollection / FoliumSourcePage（见
 * A_other/docs/酷狗对齐Folia-上游规格.md §3）；门面与路由认的是 shape() 那一套。
 * 与酷狗那份不同的是：这里的 sourceId 与文字表都由调用方给，供四个平台共用。
 *
 * @module dsh-music-panel/sources/folia-bridge/dto
 */

import { vipOfSong } from '../song-vip.js'
import { rememberSong } from '../song-registry.js'

const textOf = (texts, value) => {
  if (value === null || value === undefined) return ''
  try {
    return texts ? texts.resolveText(value) : (typeof value === 'string' ? value : '')
  } catch {
    return typeof value === 'string' ? value : ''
  }
}

const artistNames = (artists) => (Array.isArray(artists)
  ? artists.map((artist) => String(artist?.name ?? '')).filter(Boolean).join(' / ')
  : '')

/** 一首上游的歌 → 我们的 Track。 */
export function songOf(song, sourceId, texts) {
  const item = song && typeof song === 'object' ? song : {}
  const album = item.album && typeof item.album === 'object' ? item.album : {}
  const artists = Array.isArray(item.artists) ? item.artists : []
  const durationMs = Number(item.durationMs) || 0
  const coverUrl = String(item.coverUrl || album.coverUrl || '')
  const data = item.data && typeof item.data === 'object' ? item.data : {}
  // 本插件自己的 VIP 角标：可用行上的 availability 文案之外，再按平台字段补一个 'VIP'。
  const qualityHint = vipOfSong(sourceId, item) ? 'VIP' : (item.availability?.label ? textOf(texts, item.availability.label) : '')
  const track = {
    provider: sourceId,
    id: String(item.publicId ?? item.id ?? ''),
    title: String(item.title ?? ''),
    artist: artistNames(artists),
    album: String(album.name ?? ''),
    albumId: String(album.id ?? ''),
    durationSec: Math.round(durationMs / 1000),
    durationMs,
    coverUrl,
    qualityHint,
    fee: 0,
    artistsDetail: artists.map((artist) => ({
      id: String(artist?.id ?? ''),
      name: String(artist?.name ?? ''),
      ref: artist?.ref !== false,
    })),
    albumDetail: { id: String(album.id ?? ''), name: String(album.name ?? ''), coverUrl, ref: album.ref !== false },
    aliases: Array.isArray(item.aliases) ? item.aliases.slice() : [],
    translatedNames: Array.isArray(item.translatedTitles) ? item.translatedTitles.slice() : [],
    publishTime: 0,
    popularity: Number(item.row?.listenCount) || 0,
    songType: 0,
    mvId: '',
    isVideo: item.video === true,
    copyright: 0,
    resourceState: item.availability?.state === 'unavailable' ? false : null,
    noCopyright: null,
    privilegeDetail: null,
    availableQualities: [],
    variant: item.variant ?? null,
    data,
    lyricIds: item.lyricIds ?? null,
    replayGain: item.replayGain ?? null,
    pureMusic: item.pureMusic === true,
  }
  // 取流/歌词/写歌单要的侧车（QQ 的 songmid、波点的 freeSign、酷狗的 variant…）跟着歌走。
  rememberSong(sourceId, track)
  return track
}

export function songsOf(songs, sourceId, texts) {
  if (!Array.isArray(songs)) return []
  return songs.map((song) => songOf(song, sourceId, texts)).filter((song) => song.id !== '')
}

/** 一页歌 → { songs, total, hasMore, nextOffset }。 */
export function songsPageOf(page, offset, sourceId, texts) {
  const items = Array.isArray(page?.items) ? page.items : []
  const songs = songsOf(items, sourceId, texts)
  return {
    songs,
    total: Number(page?.total ?? 0) || 0,
    hasMore: page?.hasMore === true,
    nextOffset: Number(page?.nextOffset ?? 0) || offset + items.length,
  }
}

/** 搜索页形状 { results, total, page, hasMore }。 */
export function searchPageOf(page, pageNumber, sourceId, texts) {
  const items = Array.isArray(page?.items) ? page.items : []
  return {
    results: songsOf(items, sourceId, texts),
    total: Number(page?.total ?? 0) || 0,
    page: pageNumber,
    hasMore: page?.hasMore === true,
  }
}

/** 一张歌单/专辑/歌手的卡片（搜索页与推荐行共用）。 */
export function playlistCardOf(collection, sourceId, texts) {
  const item = collection && typeof collection === 'object' ? collection : {}
  return {
    id: String(item.id ?? ''),
    name: textOf(texts, item.name),
    cover: String(item.coverUrl ?? ''),
    creator: item.creator?.nickname ? String(item.creator.nickname) : '',
    trackCount: Number(item.trackCount) || 0,
    playCount: Number(item.playCount) || 0,
    source: sourceId,
    type: item.type === 'album' ? 'album' : 'playlist',
    data: item.data && typeof item.data === 'object' ? item.data : {},
  }
}

/** 我的歌单行（shapePlaylist 形状）。 */
export function playlistRowOf(collection, sourceId, texts) {
  const item = collection && typeof collection === 'object' ? collection : {}
  const name = textOf(texts, item.name)
  const isOwned = item.isOwned === true
  const isLike = item.isLiked === true || /^我喜欢/.test(name)
  return {
    provider: sourceId,
    id: String(item.id ?? ''),
    name,
    cover: String(item.coverUrl ?? ''),
    trackCount: Number(item.trackCount) || 0,
    creator: item.creator?.nickname ? String(item.creator.nickname) : '',
    kind: isOwned ? 'own' : 'collect',
    isOwned,
    isLike,
    isDefault: isLike,
    addable: isOwned && !isLike,
    data: item.data && typeof item.data === 'object' ? item.data : {},
  }
}

export function albumCardOf(collection, sourceId, texts) {
  const item = collection && typeof collection === 'object' ? collection : {}
  return {
    id: String(item.id ?? ''),
    name: textOf(texts, item.name),
    cover: String(item.coverUrl ?? ''),
    artist: artistNames(item.artists),
    trackCount: Number(item.trackCount) || 0,
    publishTime: Number(item.publishedAt) || 0,
    source: sourceId,
    type: 'album',
    data: item.data && typeof item.data === 'object' ? item.data : {},
  }
}

export function artistCardOf(collection, sourceId, texts) {
  const item = collection && typeof collection === 'object' ? collection : {}
  const cover = String(item.coverUrl ?? '')
  return {
    id: String(item.id ?? ''),
    name: textOf(texts, item.name),
    cover,
    avatar: cover,
    description: textOf(texts, item.description),
    albumCount: Number(item.albumCount) || 0,
    source: sourceId,
    type: 'artist',
  }
}

export { textOf }
