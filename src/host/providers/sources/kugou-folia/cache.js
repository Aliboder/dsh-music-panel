/**
 * 门面的字符串参数 ↔ 上游要的完整对象。
 *
 * 上游的 catalog/mutations 有几种方法收「集合」或「歌」的完整对象（collection data 侧车、
 * song.data 里的 fileId），而门面与路由只传来 id 字符串。这个文件保存读到的完整对象，
 * 按 id 找回；找不回时就按 id 造一个最小的（上游对缺侧车的处理它自己有一份）。
 *
 * 只活在本次运行里：与上游宿主把「读到过的行」留在内存里同一个取舍，丢了就重新读一次。
 *
 * @module dsh-music-panel/sources/kugou-folia/cache
 */

const collections = new Map()
const songs = new Map()

/** 存一个上游集合（歌单 / 专辑 / 歌手 / 排行 / 云盘）。 */
export function rememberCollection(collection) {
  if (!collection || typeof collection !== 'object' || collection.id === undefined) return collection
  collections.set(String(collection.type ?? 'playlist') + ':' + String(collection.id), collection)
  return collection
}

export function rememberCollections(list) {
  if (Array.isArray(list)) for (const item of list) rememberCollection(item)
  return list
}

/** 按 id（可带类型）找回集合；没有就给一个最小的，类型缺省 playlist。 */
export function collectionOf(id, type = 'playlist') {
  const key = String(type) + ':' + String(id)
  const found = collections.get(key)
  if (found) return found
  // 歌单 id 的三种形态在酷狗是同一个东西的不同写法：先按 playlist 找一遍。
  if (type !== 'playlist') {
    const anyPlaylist = collections.get('playlist:' + String(id))
    if (anyPlaylist) return anyPlaylist
  }
  return { id: String(id), type, name: '', data: {} }
}

/** 存一首上游的歌（拿到完整 song 对象时调）。 */
export function rememberSong(song) {
  if (!song || typeof song !== 'object') return song
  const id = String(song.id ?? song.data?.hash ?? '').toLowerCase()
  if (id !== '') songs.set(id, song)
  return song
}

/**
 * 门面的歌（shape() 形状，带 data 侧车）→ 上游要的 song。
 * 上游取流与点赞只读 id / data / lyricIds / variant 这几项，其余留空不影响它。
 */
export function foliaSongOf(song) {
  const item = song && typeof song === 'object' ? song : { id: String(song ?? '') }
  const id = String(item.id ?? '').toLowerCase()
  const known = songs.get(id)
  if (known) return known
  const data = item.data && typeof item.data === 'object' ? item.data : {}
  return {
    id,
    title: String(item.title ?? ''),
    artists: [],
    durationMs: Number(item.durationMs) || (Number(item.durationSec) || 0) * 1000,
    ...(item.coverUrl ? { coverUrl: String(item.coverUrl) } : {}),
    ...(item.variant ? { variant: String(item.variant) } : {}),
    ...(item.lyricIds && typeof item.lyricIds === 'object' ? { lyricIds: item.lyricIds } : {}),
    data: { ...data, hash: String(data.hash ?? id) },
  }
}

/** 测试用。 */
export function resetKugouFoliaCaches() {
  collections.clear()
  songs.clear()
}
