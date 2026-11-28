/**
 * Source bootstrap.
 *
 * Registers every built-in source once, in one place. Adding a platform is a spec
 * in `ONLINE_SPECS` plus its protocol module — no route, no UI, and no `if
 * (provider === …)` anywhere else.
 *
 * @module dsh-music-panel/sources/index
 */

import { createOnlineAdapter } from './adapter.js'
import { createLocalSource } from './local.js'
import { createOmni } from './omni.js'
import { createRegistry } from './registry.js'
import { configureBodianFolia, createBodianFoliaSource } from './bodian-folia/index.js'
import { configureKugouFolia } from './kugou-folia/instance.js'
import { configureNeteaseFolia, createNeteaseFoliaSource } from './netease-folia/index.js'
import { configureQqFolia, createQqFoliaSource } from './qq-folia/index.js'
import { configureQishuiFolia, createQishuiFoliaSource } from './qishui-folia/index.js'

/** Everything the Chinese platforms are believed to support today. */
const CHINESE_CAPABILITIES = {
  search: true,
  searchPlaylists: true,
  playback: true,
  lyrics: true,
  userPlaylists: true,
  playlistSongs: true,
  likes: true,
  likeWrite: true,
  playlistAdd: true,
  artists: true,
  albums: true,
  qualityLevels: true,
  vip: true,
  loginQr: true,
}

/**
 * Per-platform declarations, the way Folia's registry carries a capability object
 * per provider. A platform only declares what its protocol module really does;
 * the extra flags are the surface the rest of the app checks instead of branching
 * on the platform id.
 */
const NETEASE_CAPABILITIES = {
  ...CHINESE_CAPABILITIES,
  searchAlbums: true,
  auth: true,
  userLibrary: true,
  wordByWordLyrics: true,
  userAlbums: true,
  mutations: true,
  listeningRank: true,
  playbackReports: true,
  recommendations: true,
  userCloud: true,
  historyRecommendations: true,
  playlistTrackMutations: true,
  playlistSubscription: true,
}
const QQ_CAPABILITIES = {
  ...CHINESE_CAPABILITIES,
  searchAlbums: true,
  auth: true,
  userLibrary: true,
  wordByWordLyrics: true,
  userAlbums: true,
  mutations: true,
  listeningRank: true,
  recommendations: true,
  userCloud: true,
  historyRecommendations: true,
  playlistTrackMutations: true,
  playlistSubscription: true,
}
const KUGOU_LITE_CAPABILITIES = {
  ...CHINESE_CAPABILITIES,
  auth: true,
  userLibrary: true,
  wordByWordLyrics: true,
  searchAlbums: true,
  recommendations: true,
  userCloud: true,
  historyRecommendations: true,
  // Likes write through the same cloudlist endpoint as the standard client.
  likeWrite: true,
  playlistAdd: true,
  // The concept client adds (playlist_tracks_add) and removes (playlist_tracks_del)
  // rows in the account's own lists; Folia's kugou provider declares the same pair.
  // Without these two flags the「从当前歌单移除」入口和 /online/playlist-remove 都会被
  // 能力门挡住，实现存在却永远跑不到。
  mutations: true,
  playlistTrackMutations: true,
  userAlbums: false,
}

/**
 * 酷狗的能力表：跟着移植源（KUGOU 模块的 9 个能力族）走，不是旧实现那一张。
 *
 * 上游实现了什么就声明什么：搜索（含专辑/歌单搜索）、取流、歌词（含逐字与副歌）、扫码登录、
 * 曲库（歌单/专辑/喜欢/云盘/排行）、目录（专辑/歌手/歌单详情）、推荐（每日/私人 FM/推荐卡/日推历史）、
 * 写入（红心/歌单增删）。上游的 playlist_add/del（订阅）与 explore@1、reports@1 它自己也没实现，
 * 所以这三项继续不声明。
 */
const KUGOU_CAPABILITIES = {
  search: true,
  searchPlaylists: true,
  searchAlbums: true,
  playback: true,
  lyrics: true,
  wordByWordLyrics: true,
  userPlaylists: true,
  playlistSongs: true,
  likes: true,
  likeWrite: true,
  playlistAdd: true,
  artists: true,
  albums: true,
  qualityLevels: true,
  vip: true,
  loginQr: true,
  auth: true,
  userLibrary: true,
  recommendations: true,
  mutations: true,
  playlistTrackMutations: true,
  historyRecommendations: true,
  userCloud: true,
  listeningRank: true,
  userAlbums: false,
  playlistSubscription: false,
}

/** Navidrome signs in with credentials, not a QR code. */
const NAVIDROME_CAPABILITIES = {
  search: true,
  searchAlbums: true,
  playback: true,
  lyrics: true,
  userPlaylists: true,
  playlistSongs: true,
  likes: true,
  likeWrite: true,
  playlistAdd: true,
  artists: true,
  albums: true,
  browseArtists: true,
  browseAlbums: true,
  loginPassword: true,
  auth: true,
  userLibrary: true,
  mutations: true,
}

/** What each provider can actually hand out, lowest first; `original` means no ladder. */
const FULL_QUALITY = ['standard', 'high', 'lossless', 'hires']
const KUGOU_QUALITY = ['standard', 'high', 'lossless']
const ORIGINAL_QUALITY = ['original']

/**
 * Platform list. `id` doubles as the wire provider id used by the existing
 * protocol layer, so nothing has to translate names.
 */
export const ONLINE_SPECS = [
  // 网易云改由 sources/netease-folia 注册（Folia 移植源），这里不再列。
  // QQ 改由 sources/qq-folia 注册（Folia 移植源），这里不再列。
  {
    // 客户端与存下来的数据仍是 kugouLite；映射写完时把 providerKey 打开，请求就交给移植源
    // （adapter.js:36 的 providerKey ?? spec.id，门面里每个酷狗方法开头那行 kugouFacade 只在
    // provider === 'kugou' 时生效）。
    id: 'kugouLite',
    providerKey: 'kugou',
    displayName: 'KuGou Music',
    capabilities: KUGOU_CAPABILITIES,
    qualityLevels: KUGOU_QUALITY,
  },
  {
    id: 'navidrome',
    displayName: 'Navidrome / Subsonic',
    capabilities: NAVIDROME_CAPABILITIES,
    qualityLevels: ORIGINAL_QUALITY,
  },
]

export const registry = createRegistry()
export const omni = createOmni(registry)

/** Idempotent: re-registering replaces the entry rather than duplicating it. */
export function registerOnlineSources() {
  for (const spec of ONLINE_SPECS) registry.register(createOnlineAdapter(spec))
  return registry.list().filter((source) => source.kind === 'online')
}

/**
 * The local library is registered separately because its `scan` comes from the
 * live settings/library instance, which only exists inside `apply()`.
 *
 * @param {{ scan: (options?: object) => Promise<{ tracks: object[] }> }} deps
 */
export function registerLocalSource(deps) {
  const source = createLocalSource(deps)
  registry.register(source)
  return source
}

/** Tests only. */
export function resetSources() {
  registry.clear()
}

// The platform list is static, so it is registered as soon as this module loads.
// `apply()` calls `registerOnlineSources()` again (idempotent) and clears the
// registry on unload; registering here keeps callers that build the routes
// directly — most importantly the tests — working without a second entry point.
registerOnlineSources()

/**
 * Bodian: the ported Folia source module.
 *
 * Starts its bundle instance (upstream main/client entries against the plugin's
 * host surfaces) and registers the source the bridge builds from its definition.
 *
 * @param {{ dir: string, language?: string }} options
 */
export function registerBodianFoliaSource(options) {
  configureBodianFolia({ dir: options.dir, language: options.language })
  const source = createBodianFoliaSource()
  registry.register(source)
  return source
}

/**
 * NetEase Cloud Music: the ported Folia source module.
 *
 * Its backend (the pinned API package) runs in a worker thread started by the upstream
 * main entry; disposeNeteaseFolia() (root index.js) ends it when the plugin unloads.
 *
 * @param {{ dir: string, language?: string }} options
 */
export function registerNeteaseFoliaSource(options) {
  configureNeteaseFolia({ dir: options.dir, language: options.language })
  const source = createNeteaseFoliaSource()
  registry.register(source)
  return source
}

/**
 * QQ Music: the ported Folia source module.
 *
 * The embedded qq-music-api backend starts on the first `status` ask, so registering this
 * starts nothing; dispose() closes it again when the plugin unloads.
 *
 * @param {{ dir: string, language?: string }} options
 */
export function registerQqFoliaSource(options) {
  configureQqFolia({ dir: options.dir, language: options.language })
  const source = createQqFoliaSource()
  registry.register(source)
  return source
}

/**
 * Qishui: the ported Folia source module (the ticket-guard renewal lives in qishui-folia/retry).
 *
 * @param {{ dir: string, language?: string }} options
 */
export function registerQishuiFoliaSource(options) {
  configureQishuiFolia({ dir: options.dir, language: options.language })
  const source = createQishuiFoliaSource()
  registry.register(source)
  return source
}

/**
 * KuGou: the ported Folia source module.
 *
 * The bundle (src/host/vendor/kugou-folia) runs the upstream main and client entries
 * against the plugin's host surfaces; here we only hand it the data directory and
 * re-register its spec, because the adapter is built from a plain table.
 *
 * @param {{ dir: string, language?: string }} options
 */
export function registerKugouSource(options) {
  configureKugouFolia({ dir: options.dir, language: options.language })
  const spec = ONLINE_SPECS.find((entry) => entry.id === 'kugouLite')
  if (spec !== undefined) registry.register(createOnlineAdapter(spec))
  return registry.get('kugouLite')
}
