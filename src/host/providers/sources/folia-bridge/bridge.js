/**
 * 一个 Folia 音源定义 → 本插件的在线源对象（四个平台共用）。
 *
 * 上游定义的能力族是「有什么就实现什么」；这里逐族接成本插件的 source 契约，缺的方法不出现，
 * 能力表也就跟着是 false（声明与实现同源，不会出现「声明了但没有入口」）。
 * 平台差异只留在三处：sourceId、质量档、以及各平台自己的 DTO 字段名（已在上游归一化过）。
 *
 * @module dsh-music-panel/sources/folia-bridge/bridge
 */
import { capabilities as buildCapabilities } from '../../../services/core/contract.js'
import { MusicError } from '../../../services/core/errors.js'
import { albumCardOf, artistCardOf, playlistCardOf, playlistRowOf, searchPageOf, songOf, songsOf, songsPageOf } from './dto.js'
import { foliaError, hasMethod } from './errors.js'
import { resolveSourceLyrics } from '../../../services/lyrics/folia-lyrics-source.js'

const PAGE_SIZE = 100
const MAX_PAGES = 200

const unavailable = (sourceId, what) => {
  throw new MusicError('这个音源不支持 ' + what, { code: 'unavailable', sourceId })
}

export function createFoliaSource(options) {
  const { definition, sourceId, texts } = options
  const caps = definition?.capabilities ?? {}
  const search = caps['search@1']
  const songsFamily = caps['songs@1']
  const playback = caps['playback.audio@1']
  const lyrics = caps['lyrics@1']
  const auth = caps['auth@1']
  const library = caps['library@1']
  const catalog = caps['catalog@1']
  const recommendations = caps['recommendations@1']
  const mutations = caps['mutations@1']
  const reports = caps['reports@1']

  // 集合的完整对象（上游有些方法要它带着 data 侧车），读到就记下来。
  const collections = new Map()
  const rememberCollection = (collection) => {
    if (collection && typeof collection === 'object' && collection.id !== undefined) {
      collections.set(String(collection.id), collection)
    }
    return collection
  }
  const collectionOf = (id) => collections.get(String(id)) ?? { id: String(id), type: 'playlist', name: '', data: {} }

  // 只有拿到过歌对象时才有 data 侧车（取流要它）；没有就按 id 造一个最小的。
  const foliaSongOf = (song) => {
    const item = song && typeof song === 'object' ? song : { id: String(song ?? '') }
    return {
      id: String(item.id ?? item.publicId ?? ''),
      title: String(item.title ?? ''),
      artists: [],
      durationMs: Number(item.durationMs) || (Number(item.durationSec) || 0) * 1000,
      ...(item.coverUrl ? { coverUrl: String(item.coverUrl) } : {}),
      ...(item.variant ? { variant: String(item.variant) } : {}),
      ...(item.lyricIds && typeof item.lyricIds === 'object' ? { lyricIds: item.lyricIds } : {}),
      data: item.data && typeof item.data === 'object' ? item.data : {},
    }
  }

  // 账号 id：登录/读账号后记住，避免每次请求都问一次。
  let accountId = ''
  const rememberAccount = (user) => {
    if (user && user.id !== undefined) accountId = String(user.id)
    return user
  }

  async function allPages(read, key = 'items') {
    const out = []
    let offset = 0
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const answered = await read(PAGE_SIZE, offset)
      const items = Array.isArray(answered?.[key]) ? answered[key] : []
      out.push(...items)
      if (answered?.hasMore !== true) return { items: out, hasMore: false, total: Number(answered?.total) || out.length }
      const next = Number(answered?.nextOffset)
      offset = Number.isFinite(next) && next > offset ? next : offset + items.length
      if (items.length === 0) return { items: out, hasMore: false, total: Number(answered?.total) || out.length }
    }
    return { items: out, hasMore: true, total: out.length }
  }

  const declared = {
    search: hasMethod(search, 'searchSongs'),
    searchAlbums: hasMethod(search, 'searchAlbums'),
    searchPlaylists: hasMethod(search, 'searchPlaylists'),
    playback: hasMethod(playback, 'getAudioSource'),
    lyrics: hasMethod(lyrics, 'getLyrics'),
    userPlaylists: hasMethod(library, 'getUserPlaylists'),
    playlistSongs: hasMethod(catalog, 'getPlaylistTracks'),
    likes: hasMethod(library, 'getLikedSongIds'),
    likeWrite: hasMethod(mutations, 'likeSong'),
    playlistAdd: hasMethod(mutations, 'updatePlaylistTracks'),
    artists: hasMethod(catalog, 'getArtistDetail') || hasMethod(catalog, 'getArtistSongs'),
    albums: hasMethod(catalog, 'getAlbumDetail') || hasMethod(catalog, 'getAlbumTracks'),
    qualityLevels: true,
    vip: hasMethod(auth, 'getLoginStatus'),
    loginQr: hasMethod(auth, 'startLogin') && hasMethod(auth, 'checkLogin'),
    auth: hasMethod(auth, 'getLoginStatus'),
    userLibrary: hasMethod(library, 'getUserPlaylists'),
    recommendations: hasMethod(recommendations, 'getDailySongs') || hasMethod(recommendations, 'getPersonalFm'),
    wordByWordLyrics: hasMethod(lyrics, 'getLyrics'),
    userAlbums: hasMethod(library, 'getUserAlbums'),
    mutations: hasMethod(mutations, 'likeSong') || hasMethod(mutations, 'updatePlaylistTracks'),
    playlistTrackMutations: hasMethod(mutations, 'updatePlaylistTracks'),
    playlistSubscription: hasMethod(catalog, 'getSubscriptionStatus') || hasMethod(mutations, 'subscribePlaylist'),
    userCloud: hasMethod(catalog, 'getCloudTracks'),
    listeningRank: hasMethod(catalog, 'getListeningRankTracks'),
    historyRecommendations: hasMethod(recommendations, 'getHistoryDates') && hasMethod(recommendations, 'getHistorySongs'),
    // 听歌上报：只有实现了 report 的平台才声明（网易云有，酷狗/波点/汽水都没有）。
    playbackReports: hasMethod(reports, 'report'),
  }

  const source = {
    id: sourceId,
    kind: 'online',
    // 标记：登录态在这个移植源自己的存储里，不在旧 sessions.json 里（/online/providers 据此核对）。
    folia: true,
    displayName: options.displayName ?? definition?.displayName ?? sourceId,
    capabilities: buildCapabilities(declared),
    qualityLevels: Array.isArray(options.qualityLevels) ? options.qualityLevels.slice() : ['original'],
    loginMethods: declared.loginQr ? ['qr'] : [],
    availability: () => (typeof definition?.getAvailability === 'function' ? definition.getAvailability() : { configured: true }),
    requiresAccount: false,
    requiresVip: () => null,
  }

  // ── 搜索与目录 ─────────────────────────────────────────────────────────
  if (declared.search) {
    source.search = async (query) => {
      const text = String(query ?? '').trim()
      if (text === '') return []
      try {
        const page = await search.searchSongs(text, PAGE_SIZE, 0)
        return songsOf(page?.items, sourceId, texts)
      } catch (error) { throw foliaError(error, sourceId) }
    }
    source.searchPage = async (query, ctx, page = 1) => {
      const text = String(query ?? '').trim()
      const pageNumber = Math.max(1, Number(page) || 1)
      if (text === '') return { results: [], total: 0, page: pageNumber, hasMore: false }
      try {
        const answered = await search.searchSongs(text, PAGE_SIZE, (pageNumber - 1) * PAGE_SIZE)
        return searchPageOf(answered, pageNumber, sourceId, texts)
      } catch (error) { throw foliaError(error, sourceId) }
    }
  }
  if (declared.searchAlbums) {
    source.searchAlbums = async (query, ctx, page = 1) => {
      const pageNumber = Math.max(1, Number(page) || 1)
      try {
        const answered = await search.searchAlbums(String(query ?? ''), PAGE_SIZE, (pageNumber - 1) * PAGE_SIZE)
        return { items: (answered?.items ?? []).map((item) => albumCardOf(item, sourceId, texts)), total: Number(answered?.total) || 0, page: pageNumber }
      } catch (error) { throw foliaError(error, sourceId) }
    }
  }
  if (declared.searchPlaylists) {
    source.searchPlaylists = async (query, ctx, page = 1) => {
      const pageNumber = Math.max(1, Number(page) || 1)
      try {
        const answered = await search.searchPlaylists(String(query ?? ''), PAGE_SIZE, (pageNumber - 1) * PAGE_SIZE)
        return { items: (answered?.items ?? []).map((item) => playlistCardOf(item, sourceId, texts)), total: Number(answered?.total) || 0, page: pageNumber }
      } catch (error) { throw foliaError(error, sourceId) }
    }
  }
  source.songs = () => []
  source.nativeSongs = () => ({ songs: [], total: 0, offset: 0 })
  source.artists = () => []
  source.albums = () => []

  if (hasMethod(catalog, 'getArtistSongs')) {
    source.artistSongs = async (artist, ctx = {}) => {
      try {
        // 歌手的全部歌曲一次读齐，按路由的页形状交出去（{songs,total,hasMore,nextOffset}）：
        // 上游给的是 FoliumSourceSong，必须先过 DTO，否则客户端拿到的是上游字段名。
        const answered = await allPages((limit, offset) => catalog.getArtistSongs(ctx.artistId || String(artist ?? ''), limit, offset))
        const songs = songsOf(answered.items, sourceId, texts)
        return {
          songs,
          total: Number(answered.total) || songs.length,
          hasMore: false,
          nextOffset: songs.length,
        }
      } catch (error) { throw foliaError(error, sourceId) }
    }
  }
  if (hasMethod(catalog, 'getArtistAlbums')) {
    source.artistAlbums = async (id) => {
      try {
        const [artist, albums] = await Promise.all([
          hasMethod(catalog, 'getArtistDetail') ? catalog.getArtistDetail(String(id)) : null,
          allPages((limit, offset) => catalog.getArtistAlbums(String(id), limit, offset)),
        ])
        return {
          artist: artist ? artistCardOf(artist, sourceId, texts) : { id: String(id), name: '', source: sourceId, type: 'artist', cover: '' },
          albums: (albums.items ?? []).map((item) => albumCardOf(item, sourceId, texts)),
        }
      } catch (error) { throw foliaError(error, sourceId) }
    }
  }
  if (hasMethod(catalog, 'getAlbumTracks')) {
    source.albumSongs = async (id, ctx, hint = {}) => {
      try {
        const album = hasMethod(catalog, 'getAlbumDetail') ? rememberCollection(await catalog.getAlbumDetail(String(id))) : null
        const answered = await allPages((limit, offset) => catalog.getAlbumTracks(String(id), limit, offset, album ?? undefined))
        return {
          id: String(id),
          name: album?.name ? texts.resolveText(album.name) : String(hint.name ?? ''),
          cover: String(album?.coverUrl ?? ''),
          artist: Array.isArray(album?.artists) ? album.artists.map((entry) => entry.name).join(' / ') : String(hint.artist ?? ''),
          songs: songsOf(answered.items, sourceId, texts),
        }
      } catch (error) { throw foliaError(error, sourceId) }
    }
  }

  // ── 歌单与喜欢 ─────────────────────────────────────────────────────────
  if (declared.userPlaylists) {
    source.myPlaylists = async () => {
      try {
        const answered = await allPages((limit, offset) => library.getUserPlaylists(accountId || undefined, limit, offset))
        for (const item of answered.items) rememberCollection(item)
        return answered.items.map((item) => playlistRowOf(item, sourceId, texts))
      } catch (error) { throw foliaError(error, sourceId) }
    }
  }
  if (declared.playlistSongs) {
    source.playlistSongsPage = async (id, ctx, page = {}) => {
      const limit = Number(page.limit) || PAGE_SIZE
      const offset = Number(page.offset) || 0
      const collection = collectionOf(id)
      try {
        let detail = collection
        if (hasMethod(catalog, 'getPlaylistDetail') && (collection.name === '' || collection.trackCount === undefined)) {
          detail = rememberCollection(await catalog.getPlaylistDetail(String(id), collection)) ?? collection
        }
        const answered = await catalog.getPlaylistTracks(String(id), limit, offset, detail)
        const pageOfSongs = songsPageOf(answered, offset, sourceId, texts)
        return {
          name: detail?.name ? texts.resolveText(detail.name) : '',
          cover: String(detail?.coverUrl ?? ''),
          trackCount: Number(detail?.trackCount) || pageOfSongs.total,
          songs: pageOfSongs.songs,
          hasMore: pageOfSongs.hasMore,
          nextOffset: pageOfSongs.nextOffset,
        }
      } catch (error) { throw foliaError(error, sourceId) }
    }
    source.playlistSongs = async (id, ctx) => {
      const first = await source.playlistSongsPage(id, ctx, { limit: PAGE_SIZE, offset: 0 })
      return { name: first.name, cover: first.cover, trackCount: first.trackCount, songs: first.songs }
    }
  }
  if (declared.likes) {
    source.likedIds = async () => {
      try {
        const answered = await library.getLikedSongIds(accountId || undefined)
        const ids = Array.isArray(answered) ? answered : (Array.isArray(answered?.ids) ? answered.ids : [])
        return ids.map((id) => 'online:' + sourceId + ':' + String(id))
      } catch (error) { throw foliaError(error, sourceId) }
    }
    source.liked = async (id) => {
      const ids = await source.likedIds()
      return ids.includes('online:' + sourceId + ':' + String(id))
    }
  }
  if (declared.likeWrite) {
    source.setLiked = async (song, on) => {
      try {
        await mutations.likeSong(foliaSongOf(song), on === true)
        return true
      } catch (error) { throw foliaError(error, sourceId) }
    }
  }
  if (declared.playlistAdd) {
    source.addToPlaylist = async (song, playlistId) => {
      try {
        await mutations.updatePlaylistTracks('add', collectionOf(playlistId), [foliaSongOf(song)])
        return true
      } catch (error) { throw foliaError(error, sourceId) }
    }
  }
  if (declared.playlistTrackMutations) {
    source.removeFromPlaylist = async (song, playlistId) => {
      try {
        await mutations.updatePlaylistTracks('del', collectionOf(playlistId), [foliaSongOf(song)])
        return true
      } catch (error) { throw foliaError(error, sourceId) }
    }
  }
  if (hasMethod(catalog, 'getSubscriptionStatus')) {
    source.subscriptionStatus = async (type, id) => {
      try { return (await catalog.getSubscriptionStatus(type, String(id), collectionOf(id))) === true } catch { return false }
    }
  }
  if (hasMethod(mutations, 'subscribePlaylist') || hasMethod(mutations, 'subscribeAlbum')) {
    source.subscribeCollection = async (type, id, subscribed) => {
      try {
        if (type === 'album' && hasMethod(mutations, 'subscribeAlbum')) {
          await mutations.subscribeAlbum(String(id), subscribed === true)
        } else if (hasMethod(mutations, 'subscribePlaylist')) {
          await mutations.subscribePlaylist(collectionOf(id), subscribed === true)
        } else {
          unavailable(sourceId, '订阅')
        }
        return true
      } catch (error) { throw foliaError(error, sourceId) }
    }
  }

  // ── 推荐 / 云盘 / 排行 ─────────────────────────────────────────────────
  if (hasMethod(recommendations, 'getDailySongs')) {
    source.dailySongs = async () => {
      try { return songsOf(await recommendations.getDailySongs(), sourceId, texts) } catch (error) { throw foliaError(error, sourceId) }
    }
  }
  if (hasMethod(recommendations, 'getRecommendedCollections')) {
    source.recommendedCollections = async (ctx, limit = 30) => {
      try {
        const list = await recommendations.getRecommendedCollections(limit)
        for (const item of list ?? []) rememberCollection(item)
        return (list ?? []).map((item) => playlistCardOf(item, sourceId, texts))
      } catch (error) { throw foliaError(error, sourceId) }
    }
  }
  if (hasMethod(recommendations, 'getPersonalFm')) {
    source.personalFm = async () => {
      try { return songsOf(await recommendations.getPersonalFm(), sourceId, texts) } catch (error) { throw foliaError(error, sourceId) }
    }
  }
  if (declared.historyRecommendations) {
    source.historyDates = async () => {
      try {
        const dates = await recommendations.getHistoryDates()
        return (Array.isArray(dates) ? dates : []).map((date) => String(date ?? '').trim()).filter(Boolean)
      } catch (error) { throw foliaError(error, sourceId) }
    }
    source.historySongs = async (ctx, date) => {
      const wanted = String(date ?? '').trim()
      if (wanted === '') return []
      try {
        const answered = await recommendations.getHistorySongs(wanted)
        return songsOf(answered?.items ?? answered, sourceId, texts)
      } catch (error) { throw foliaError(error, sourceId) }
    }
  }
  if (declared.userCloud) {
    source.cloudSongs = async (ctx, page = 1) => {
      const pageNumber = Math.max(1, Number(page) || 1)
      try {
        const answered = await catalog.getCloudTracks(PAGE_SIZE, (pageNumber - 1) * PAGE_SIZE)
        return songsOf(answered?.items, sourceId, texts).map((song) => ({ ...song, variant: 'cloud' }))
      } catch (error) { throw foliaError(error, sourceId) }
    }
  }
  if (declared.listeningRank) {
    source.listeningRank = async (range) => {
      try {
        const answered = await catalog.getListeningRankTracks(range === 'week' ? 'week' : 'all', 500, 0)
        return songsOf(answered?.items, sourceId, texts).map((song) => ({
          ...song,
          listenCount: Number(song.popularity) || 0,
        }))
      } catch (error) { throw foliaError(error, sourceId) }
    }
  }

  if (declared.playbackReports) {
    // 上游的 reports@1：canReport 先判「这首歌值不值得报」（云盘、非数字 id 不报），report 真正上报。
    source.reportPlayback = async (song, report) => {
      const target = foliaSongOf(song)
      try {
        if (hasMethod(reports, 'canReport') && reports.canReport(target) !== true) return false
        await reports.report(target, report)
        return true
      } catch (error) { throw foliaError(error, sourceId) }
    }
  }

  // ── 播放与歌词 ─────────────────────────────────────────────────────────
  if (declared.playback) {
    source.stream = async (id, ctx, quality = 'high') => {
      try {
        const answered = await playback.getAudioSource(foliaSongOf({ id }), quality)
        if (!answered || typeof answered.url !== 'string' || answered.url === '') {
          return { url: '', quality: '', replayGain: null }
        }
        return {
          url: answered.url,
          quality: answered.quality ?? quality,
          replayGain: answered.replayGain ?? null,
          ...(answered.preview === true ? { preview: true } : {}),
        }
      } catch (error) { throw foliaError(error, sourceId) }
    }
  }
  if (declared.lyrics) {
    // 上游 lyrics@1 交回的是 { main: { format, text }, wordByWord: { format, text } }（原始文本 + 格式）。
    // 解析走移植的 Folia 宿主步骤（mods/folium/lyricsSource.ts），这里只换成插件源对象的形状。
    source.lyric = async (id) => {
      try {
        const answered = await lyrics.getLyrics(foliaSongOf({ id }))
        const resolved = await resolveSourceLyrics(answered, sourceId)
        return {
          lrc: resolved.lrc,
          lines: resolved.lines,
          wordLevel: resolved.wordLevel,
          ...(resolved.pureMusic === true ? { pureMusic: true } : {}),
          raw: { ...(resolved.raw || {}) },
          translation: resolved.translation || '',
          romaji: resolved.romaji || '',
        }
      } catch (error) { throw foliaError(error, sourceId) }
    }
  }
  if (hasMethod(lyrics, 'getChorusRanges')) {
    source.chorus = async (id) => {
      try { return await lyrics.getChorusRanges(String(id)) } catch { return null }
    }
  }

  // ── 登录与账号 ─────────────────────────────────────────────────────────
  if (hasMethod(auth, 'getLoginStatus')) {
    const statusOfState = { expired: 'expired', waiting: 'waiting', scanned: 'scanned', confirmed: 'success', error: 'failed' }
    source.profile = async () => {
      try {
        const user = rememberAccount(await auth.getLoginStatus())
        if (!user) return null
        return {
          nickname: String(user.nickname ?? ''),
          avatarUrl: String(user.avatarUrl ?? ''),
          accountId: String(user.id ?? ''),
          vipType: Number(user.vipType) || 0,
        }
      } catch (error) {
        const translated = foliaError(error, sourceId)
        if (translated.code === 'auth-required') return null
        throw translated
      }
    }
    source.vip = async () => {
      const profile = await source.profile()
      return profile === null ? null : Number(profile.vipType) > 0
    }
    source.vipInfo = async () => {
      const profile = await source.profile()
      return { vip: profile !== null && Number(profile.vipType) > 0, expiresAt: 0 }
    }
    if (declared.loginQr) {
      source.loginStart = async () => {
        try {
          const key = await auth.startLogin()
          const image = await auth.createQr(key)
          const value = String(image ?? '')
          return {
            key: String(key ?? ''),
            imageDataUrl: value.startsWith('data:') || value === '' ? value : (/^https?:/i.test(value) ? '' : 'data:image/png;base64,' + value),
            url: /^https?:/i.test(value) ? value : '',
          }
        } catch (error) { throw foliaError(error, sourceId) }
      }
      source.loginStatus = async (key) => {
        try {
          const answered = await auth.checkLogin(String(key))
          const state = String(answered?.state ?? 'error')
          const status = statusOfState[state] ?? 'failed'
          if (status !== 'success') {
            return { status, message: String(answered?.message ?? ''), ...(answered?.failure ? { case: String(answered.failure) } : {}) }
          }
          const user = await source.profile()
          return {
            status: 'success',
            message: '',
            userid: user?.accountId ?? '',
            nickname: user?.nickname ?? '',
            avatarUrl: user?.avatarUrl ?? '',
            vipType: user?.vipType ?? 0,
            platform: sourceId,
          }
        } catch (error) { throw foliaError(error, sourceId) }
      }
    }
    if (hasMethod(auth, 'logout')) {
      source.logout = async () => {
        try { await auth.logout(); accountId = ''; return true } catch (error) { throw foliaError(error, sourceId) }
      }
    }
    source.forgetTokens = () => true
  }

  // 平台自己的失败说法（Folia 音源定义的 describeFailure）：宿主据此分情况提示。
  if (typeof definition.describeFailure === 'function') {
    source.describeFailure = (operation, error) => {
      try { return definition.describeFailure(operation, error) ?? null } catch { return null }
    }
  }

  return source
}

export { PAGE_SIZE }