/**
 * 门面 → 移植源的派工表。
 *
 * providers/index.js 里每个与酷狗有关的方法开头都有一行：
 *   if (provider === 'kugou') return kugouFacade('<方法名>', arguments)
 * 这样门面仍是一个函数一个签名，酷狗的实现却全部移到 sources/kugou-folia/ 下，且不用改任何既有分支。
 * 参数原样转发（arguments → 数组），各模块的签名与门面自己的一致。
 *
 * @module dsh-music-panel/sources/kugou-folia/dispatch
 */
import * as read from './read.js'
import * as library from './library.js'
import * as playback from './playback.js'
import * as account from './account.js'

/** 门面方法名 → 它现在由哪个模块的哪个导出实现。 */
const ROUTES = {
  // ── 搜索 / 目录 ──────────────────────────────────────────────────────
  search: [read, 'search'],
  searchPage: [read, 'searchPage'],
  searchAlbums: [read, 'searchAlbums'],
  searchPlaylists: [read, 'searchPlaylists'],
  artistSongs: [read, 'artistSongs'],
  albumSongs: [read, 'albumSongs'],
  artistAlbums: [read, 'artistAlbums'],
  songs: [read, 'songs'],
  nativeSongs: [read, 'nativeSongs'],
  artists: [read, 'artists'],
  albums: [read, 'albums'],
  // ── 推荐 / 云盘 / 排行 ───────────────────────────────────────────────
  dailySongs: [read, 'dailySongs'],
  recommendedCollections: [read, 'recommendedCollections'],
  personalFm: [read, 'personalFm'],
  cloudSongs: [read, 'cloudSongs'],
  listeningRank: [read, 'listeningRank'],
  historyDates: [read, 'historyDates'],
  historySongs: [read, 'historySongs'],
  // ── 歌单 / 喜欢 / 写入 ───────────────────────────────────────────────
  myPlaylists: [library, 'myPlaylists'],
  playlistSongs: [library, 'playlistSongs'],
  playlistSongsPage: [library, 'playlistSongsPage'],
  onlineLiked: [library, 'onlineLiked'],
  onlineLikedIds: [library, 'onlineLikedIds'],
  setOnlineLiked: [library, 'setOnlineLiked'],
  addOnlineSongToPlaylist: [library, 'addOnlineSongToPlaylist'],
  removeOnlineSongFromPlaylist: [library, 'removeOnlineSongFromPlaylist'],
  subscriptionStatus: [library, 'subscriptionStatus'],
  subscribeCollection: [library, 'subscribeCollection'],
  // ── 播放 / 歌词 ──────────────────────────────────────────────────────
  resolveStream: [playback, 'resolveStream'],
  resolveLegacyStream: [playback, 'resolveLegacyStream'],
  lyric: [playback, 'lyric'],
  chorus: [playback, 'chorus'],
  requiresVip: [playback, 'requiresVip'],
  // ── 登录 / 账号 ──────────────────────────────────────────────────────
  loginStart: [account, 'loginStart'],
  loginStatus: [account, 'loginStatus'],
  providerVip: [account, 'providerVip'],
  providerVipInfo: [account, 'providerVipInfo'],
  providerProfile: [account, 'providerProfile'],
  createKugouDevice: [account, 'createKugouDevice'],
  forgetProviderTokens: [account, 'forgetProviderTokens'],
  logout: [account, 'logout'],
}

/** 门面那一行调的东西：方法名 + 原样的 arguments。 */
export function kugouFacade(name, args) {
  const route = ROUTES[name]
  if (!route) throw new Error('kugouFacade: 没有登记的方法 ' + name)
  const [module, exportName] = route
  const fn = module[exportName]
  if (typeof fn !== 'function') throw new Error('kugouFacade: ' + name + ' 没有实现')
  return fn.apply(null, args && typeof args.length === 'number' ? Array.from(args) : [])
}

/** 这个方法是不是已经交给移植源了（测试与能力表用）。 */
export function kugouFacadeHas(name) {
  return Object.prototype.hasOwnProperty.call(ROUTES, name)
}

export const KUGOU_FACADE_METHODS = Object.keys(ROUTES)
