/**
 * online: NetEase / QQ / KuGou state.
 *
 * Only the client half lives here: the Host performs every provider request.
 */

var ONLINE_HISTORY_KEY = 'mu.onlineHistory'
var ONLINE_HISTORY_MAX = 50

function readOnlineHistory() {
  var list = storageGet(ONLINE_HISTORY_KEY, [])
  return Array.isArray(list) ? list : []
}

function writeOnlineHistory(list) {
  storageSet(ONLINE_HISTORY_KEY, list.slice(0, ONLINE_HISTORY_MAX))
}

function onlineHistoryOfProvider(provider) {
  return onlineStore.get().history.filter(function (item) {
    return item.provider === provider
  })
}

var onlineStore = createStore({
  provider: 'netease',
  phase: 'idle', // idle | searching | ready | error
  query: '',
  results: [],
  searchPage: 1,
  searchTotal: 0,
  searchLoadingMore: false,
  error: '',
  playlistsPhase: 'idle',
  playlistsProvider: '',
  playlistsRefreshing: false,
  playlists: [],
  authExpired: '',
  playlistId: '',
  playlistName: '',
  playlistSongs: [],
  playlistPhase: 'idle',
  playlistRefreshing: false,
  albumId: '',
  albumName: '',
  albumArtist: '',
  albumCover: '',
  albumProvider: '',
  albumSongs: [],
  albumPhase: 'idle',
  albumError: '',
  artistName: '',
  artistProvider: '',
  artistFrom: '',
  artistId: '',
  artistSongs: [],
  artistPhase: 'idle',
  artistError: '',
  history: readOnlineHistory(),
  liked: {},
  providers: {},
})

var onlineSearchToken = 0
var playlistLoadToken = 0
var playlistCache = new Map()
var playlistInflight = new Map()
var PLAYLIST_CACHE_TTL = 60 * 1000

async function searchOnline(text, page, append) {
  var query = String(text || '').trim()
  if (query === '') return
  var targetPage = Math.max(1, Number(page) || 1)
  var more = append === true && targetPage > 1
  var state = onlineStore.get()
  var provider = state.provider
  var token = (onlineSearchToken += 1)
  if (more) {
    onlineStore.set({ searchLoadingMore: true })
  } else {
    onlineStore.set({
      phase: 'searching',
      query: query,
      error: '',
      results: [],
      searchPage: 1,
      searchTotal: 0,
      searchLoadingMore: false,
    })
  }
  try {
    var body = await getJson(
      API +
        'online/search?provider=' +
        encodeURIComponent(provider) +
        '&q=' +
        encodeURIComponent(query) +
        '&page=' +
        String(targetPage),
    )
    if (token !== onlineSearchToken) return
    var incoming = Array.isArray(body.results) ? body.results : []
    var results = more ? (onlineStore.get().results || []).slice() : []
    incoming.forEach(function (item) {
      var path = 'online:' + provider + ':' + item.id
      if (!results.some(function (existing) { return 'online:' + provider + ':' + existing.id === path })) {
        results.push(item)
      }
    })
    onlineStore.set({
      phase: 'ready',
      results: results,
      searchPage: Number(body.page) || targetPage,
      searchTotal: Number(body.total) || results.length,
      searchLoadingMore: false,
    })
  } catch (error) {
    if (token !== onlineSearchToken) return
    if (more) {
      onlineStore.set({ searchLoadingMore: false })
      showToast(errorText(error))
    } else {
      onlineStore.set({ phase: 'error', error: errorText(error) })
    }
  }
}

function isAuthError(message) {
  return /20017|登录态|重新扫码|未登录|登录.*(失效|过期)|session|cookie|token|鉴权|401|403/i.test(
    String(message || ''),
  )
}

function mergePlaylists(previous, incoming) {
  var next = new Map()
  ;(incoming || []).forEach(function (item) {
    if (item && item.id !== undefined) next.set(String(item.id), item)
  })
  var merged = []
  ;(previous || []).forEach(function (item) {
    var fresh = next.get(String(item.id))
    if (fresh) {
      merged.push(Object.assign({}, item, fresh))
      next.delete(String(item.id))
    }
  })
  next.forEach(function (item) {
    merged.push(item)
  })
  return merged
}

async function loadMyPlaylists(provider) {
  var target = provider || onlineStore.get().provider
  var token = (playlistLoadToken += 1)
  var snapshot = onlineStore.get()
  var keep = snapshot.playlistsProvider === target && (snapshot.playlists || []).length > 0
  onlineStore.set(
    keep
      ? { playlistsPhase: 'ready', playlistsRefreshing: true, playlistsProvider: target, error: '' }
      : { playlistsPhase: 'loading', playlistsRefreshing: false, playlistsProvider: target, playlists: [] },
  )
  try {
    var body = await getJson(API + 'online/my-playlists?provider=' + encodeURIComponent(target))
    if (token !== playlistLoadToken) return
    var incoming = Array.isArray(body.playlists) ? body.playlists : []
    var current = onlineStore.get()
    onlineStore.set({
      playlistsPhase: 'ready',
      playlistsRefreshing: false,
      playlistsProvider: target,
      playlists: keep ? mergePlaylists(current.playlists, incoming) : incoming,
      error: '',
      authExpired: '',
    })
  } catch (error) {
    if (token !== playlistLoadToken) return
    var state = onlineStore.get()
    if (state.playlistsProvider === target && (state.playlists || []).length > 0) {
      // Stale-while-revalidate: keep the last good list visible.
      var message = errorText(error)
      onlineStore.set({
        playlistsPhase: 'ready',
        playlistsRefreshing: false,
        error: message,
        authExpired: isAuthError(message) ? target : '',
      })
    } else {
      onlineStore.set({
        playlistsPhase: 'error',
        playlistsRefreshing: false,
        playlistsProvider: target,
        playlists: [],
        error: errorText(error),
        authExpired: isAuthError(errorText(error)) ? target : '',
      })
    }
  }
}

/** Re-read the likes playlist after a cloud like/unlike from any surface. */
function refreshLikedPlaylist(delta) {
  var state = onlineStore.get()
  var liked = (state.playlists || []).find(function (item) {
    return item.isLike === true
  }) || (state.playlists || []).find(function (item) {
    return item.kind === 'default' || item.isDefault === true
  })
  if (liked) {
    var count = Math.max(0, (Number(liked.trackCount) || 0) + (Number(delta) || 0))
    var playlists = (state.playlists || []).map(function (item) {
      return String(item.id) === String(liked.id) ? Object.assign({}, item, { trackCount: count }) : item
    })
    onlineStore.set({ playlists: playlists, playlistsRefreshing: true })
    if (String(state.playlistId) === String(liked.id)) void openOnlinePlaylist(Object.assign({}, liked, { trackCount: count }), true)
  }
  void loadMyPlaylists(state.provider)
}

function resetOnlineAccountData() {
  playlistLoadToken += 1
  onlineSearchToken += 1
  artistLoadToken += 1
  playlistCache.clear()
  playlistInflight.clear()
  onlineStore.set({
    playlistsPhase: 'idle',
    playlistsRefreshing: false,
    playlistsProvider: '',
    playlists: [],
    playlistId: '',
    playlistName: '',
    playlistSongs: [],
    playlistPhase: 'idle',
    playlistRefreshing: false,
    albumId: '',
    albumName: '',
    albumArtist: '',
    albumCover: '',
    albumProvider: '',
    albumSongs: [],
    albumPhase: 'idle',
    albumError: '',
    artistName: '',
    artistProvider: '',
    artistFrom: '',
    artistSongs: [],
    artistPhase: 'idle',
    artistError: '',
    liked: {},
    error: '',
    authExpired: '',
  })
}

function playlistCacheKey(provider, id) {
  return String(provider || '') + ':' + String(id || '')
}

var albumLoadToken = 0
var artistLoadToken = 0

async function openOnlineAlbum(track) {
  if (!track || !track.album) return
  var provider = track.onlineProvider || onlineStore.get().provider
  // Providers without the albums capability have no album endpoint (Qishui's car API has
  // none); say so instead of opening a page that can only fail. Unknown capabilities
  // (providers not loaded yet, tests) do not block: the request decides then.
  var knownProvider = (onlineStore.get().providers || {})[provider]
  var caps = knownProvider && knownProvider.capabilities
  if (caps && caps.albums !== true) {
    showToast(t('online.albumUnsupported'))
    return
  }
  var token = (albumLoadToken += 1)
  onlineStore.set({
    albumId: String(track.albumId || ''),
    albumName: String(track.album || ''),
    albumArtist: String(track.artist || ''),
    albumCover: String(track.coverUrl || ''),
    albumProvider: provider,
    albumSongs: [],
    albumPhase: 'loading',
    albumError: '',
    // A search is sticky: the online views render the result list while a
    // query is active, and that check runs before every section branch. So a
    // row clicked under a search result would leave the panel on the search
    // list — the album view never gets a chance to render. Ending the search
    // here is what makes the click land, and it matches what opening an artist
    // already does.
    query: '',
    phase: 'idle',
    error: '',
  })
  setNav('album')
  try {
    var body = await getJson(
      API +
        'online/album?provider=' +
        encodeURIComponent(provider) +
        '&id=' +
        encodeURIComponent(track.albumId || '') +
        '&album=' +
        encodeURIComponent(track.album || '') +
        '&artist=' +
        encodeURIComponent(track.artist || ''),
    )
    if (token !== albumLoadToken) return
    onlineStore.set({
      albumName: body.name || track.album || '',
      albumArtist: body.artist || track.artist || '',
      albumCover: body.cover || track.coverUrl || '',
      albumSongs: Array.isArray(body.songs) ? body.songs : [],
      albumPhase: 'ready',
    })
  } catch (error) {
    if (token !== albumLoadToken) return
    onlineStore.set({
      albumSongs: [],
      albumPhase: 'error',
      albumError: errorText(error),
    })
  }
}

function closeOnlineAlbum() {
  albumLoadToken += 1
  onlineStore.set({
    albumId: '',
    albumName: '',
    albumArtist: '',
    albumCover: '',
    albumProvider: '',
    albumSongs: [],
    albumPhase: 'idle',
    albumError: '',
  })
}

/**
 * The artist a track points at: the id already carried by the row when there is
 * one, so the page can open on the provider's own artist endpoint.
 */
function onlineArtistTarget(track, artistOverride) {
  var names = trackArtistNames(track)
  var artist = String(artistOverride || (names.length > 0 ? names[0] : (track && track.artist)) || '').trim()
  if (artist === '') return null
  var provider = (track && track.onlineProvider) || onlineStore.get().provider
  var artistId = ''
  var detail = Array.isArray(track && track.artistsDetail) ? track.artistsDetail : []
  for (var detailIndex = 0; detailIndex < detail.length; detailIndex += 1) {
    var entry = detail[detailIndex] || {}
    if (String(entry.name || '').trim() === artist && entry.id) {
      artistId = String(entry.id)
      break
    }
  }
  if (artistId === '' && detail.length === 1 && detail[0] && detail[0].id) artistId = String(detail[0].id)
  return { artist: artist, provider: provider, artistId: artistId }
}

async function openOnlineArtist(track, artistOverride) {
  var names = trackArtistNames(track)
  var artist = String(artistOverride || (names.length > 0 ? names[0] : (track && track.artist)) || '').trim()
  if (artist === '') return
  var provider = (track && track.onlineProvider) || onlineStore.get().provider
  // Folia opens the artist page with the id the song already carries; a name-only
  // visit falls back to the Host resolving one.
  var artistId = ''
  var detail = Array.isArray(track && track.artistsDetail) ? track.artistsDetail : []
  for (var detailIndex = 0; detailIndex < detail.length; detailIndex += 1) {
    var entry = detail[detailIndex] || {}
    if (String(entry.name || '').trim() === artist && entry.id) {
      artistId = String(entry.id)
      break
    }
  }
  if (artistId === '' && detail.length === 1 && detail[0] && detail[0].id) artistId = String(detail[0].id)
  var state = onlineStore.get()
  // Folia keeps the artist resource in memory per key: going back to the same artist
  // in one session shows the list instead of fetching it again.
  if (
    String(state.artistProvider || '') === provider &&
    String(state.artistName || '') === artist &&
    Array.isArray(state.artistSongs) &&
    state.artistSongs.length > 0
  ) {
    setNav('artistSongs')
    return
  }
  var from = uiStore.get().nav
  var token = (artistLoadToken += 1)
  onlineStore.set({
    artistName: artist,
    artistProvider: provider,
    artistFrom: from,
    artistId: artistId,
    artistSongs: [],
    artistPhase: 'loading',
    artistError: '',
    query: '',
    phase: 'idle',
    error: '',
  })
  setNav('artistSongs')
  var base =
    API +
    'online/artist-songs?provider=' +
    encodeURIComponent(provider) +
    '&artist=' +
    encodeURIComponent(artist) +
    (artistId !== '' ? '&artistId=' + encodeURIComponent(artistId) : '')
  try {
    // Folia's artist page opens with ARTIST_TOP_SONG_LIMIT (10) songs: one small
    // request, first paint at once. The rest of the list fills in behind it.
    var head = await getJson(base + '&limit=10')
    if (token !== artistLoadToken) return
    var songs = Array.isArray(head.songs) ? head.songs : []
    onlineStore.set({ artistSongs: songs, artistPhase: 'ready' })
    // Only NetEase pages this endpoint today; the other providers answer the whole
    // list on the first request already.
    if (provider !== 'netease' || songs.length < 10) return
    var rest = await getJson(base + '&limit=200&offset=10')
    if (token !== artistLoadToken) return
    var more = Array.isArray(rest.songs) ? rest.songs : []
    if (more.length === 0) return
    var seen = {}
    songs.forEach(function (item) {
      seen[String(item.id)] = true
    })
    var merged = songs.concat(
      more.filter(function (item) {
        return seen[String(item.id)] !== true
      }),
    )
    onlineStore.set({ artistSongs: merged })
  } catch (error) {
    if (token !== artistLoadToken) return
    onlineStore.set({ artistSongs: [], artistPhase: 'error', artistError: errorText(error) })
  }
}

function closeOnlineArtist() {
  artistLoadToken += 1
  onlineStore.set({
    artistName: '',
    artistProvider: '',
    artistFrom: '',
    artistSongs: [],
    artistPhase: 'idle',
    artistError: '',
  })
}

function trimPlaylistCache() {
  if (playlistCache.size <= 24) return
  var old = []
  playlistCache.forEach(function (value, key) {
    old.push({ key: key, at: value.at || 0 })
  })
  old
    .sort(function (left, right) {
      return left.at - right.at
    })
    .slice(0, playlistCache.size - 24)
    .forEach(function (row) {
      playlistCache.delete(row.key)
    })
}

function fetchPlaylistSongs(provider, id, force) {
  var key = playlistCacheKey(provider, id)
  if (!force && playlistInflight.has(key)) return playlistInflight.get(key)
  var request = getJson(
    API +
      'online/playlist-songs?provider=' +
      encodeURIComponent(provider) +
      '&id=' +
      encodeURIComponent(id),
  )
    .then(function (body) {
      var songs = Array.isArray(body.songs) ? body.songs : []
      playlistCache.set(key, {
        songs: songs,
        name: body.name || '',
        at: Date.now(),
      })
      trimPlaylistCache()
      return { songs: songs, name: body.name || '' }
    })
    .finally(function () {
      if (playlistInflight.get(key) === request) playlistInflight.delete(key)
    })
  playlistInflight.set(key, request)
  return request
}

/** Warm the cache when the pointer/focus reaches a playlist nav item. */
function prefetchOnlinePlaylist(playlist) {
  if (!playlist || !playlist.id) return
  var provider = onlineStore.get().provider
  var key = playlistCacheKey(provider, playlist.id)
  var hit = playlistCache.get(key)
  if (hit && Date.now() - (hit.at || 0) < PLAYLIST_CACHE_TTL) return
  void fetchPlaylistSongs(provider, playlist.id, false).catch(function () {
    // Prefetch is best effort.
  })
}

async function openOnlinePlaylist(playlist, force) {
  if (!playlist || !playlist.id) return
  var provider = onlineStore.get().provider
  var key = playlistCacheKey(provider, playlist.id)
  var hit = playlistCache.get(key)
  var fresh = hit && Date.now() - (hit.at || 0) < PLAYLIST_CACHE_TTL
  onlineStore.set({
    playlistId: playlist.id,
    playlistName: playlist.name || (hit && hit.name) || '',
    playlistPhase: hit ? 'ready' : 'loading',
    playlistSongs: hit ? hit.songs : [],
    playlistRefreshing: false,
  })
  if (fresh && force !== true) return
  if (hit) onlineStore.set({ playlistRefreshing: true })
  try {
    var body = await fetchPlaylistSongs(provider, playlist.id, force === true)
    var state = onlineStore.get()
    if (String(state.playlistId) !== String(playlist.id) || state.provider !== provider) return
    onlineStore.set({
      playlistPhase: 'ready',
      playlistRefreshing: false,
      playlistName: body.name || playlist.name || '',
      playlistSongs: body.songs,
      error: '',
    })
  } catch (error) {
    var current = onlineStore.get()
    if (String(current.playlistId) !== String(playlist.id) || current.provider !== provider) return
    if (hit) {
      onlineStore.set({ playlistPhase: 'ready', playlistRefreshing: false, error: errorText(error) })
    } else {
      onlineStore.set({ playlistPhase: 'error', playlistRefreshing: false, playlistSongs: [], error: errorText(error) })
    }
  }
}

function closeOnlinePlaylist() {
  onlineStore.set({ playlistId: '', playlistName: '', playlistSongs: [], playlistPhase: 'idle' })
}

async function loadProviders() {
  try {
    var body = await getJson(API + 'online/providers')
    onlineStore.set({ providers: body.providers || {} })
  } catch (error) {
    // Provider status only drives labels.
  }
}

function rememberOnline(track) {
  var entry = {
    provider: track.onlineProvider,
    id: track.onlineId || '',
    title: track.title || '',
    artist: track.artist || '',
    album: track.album || '',
    albumId: track.albumId || '',
    durationSec: track.durationSec || 0,
    coverUrl: track.coverUrl || '',
    // Without this the recent list loses artwork for self-hosted tracks once
    // the entry round-trips through storage.
    coverArtId: track.coverArtId || '',
    qualityHint: track.qualityHint || '',
    playedAt: Date.now(),
  }
  if (!entry.provider || entry.id === '') return
  var state = onlineStore.get()
  var next = [entry].concat(
    state.history.filter(function (item) {
      return !(item.provider === entry.provider && item.id === entry.id)
    }),
  )
  onlineStore.set({ history: next })
  writeOnlineHistory(next)
}

function removeHistory(entry) {
  var state = onlineStore.get()
  var next = state.history.filter(function (item) {
    return !(item.provider === entry.provider && item.id === entry.id)
  })
  onlineStore.set({ history: next })
  writeOnlineHistory(next)
}

function playOnlineResults(results, index) {
  var list = Array.isArray(results) ? results : []
  var wanted = list[index]
  // Do not pre-block VIP-labelled rows: the platform decides whether this
  // account gets a full stream, a preview clip, or no stream at all.
  var playable = list.filter(function (item) {
    return item && item.id
  })
  if (playable.length === 0) return
  var at = 0
  if (wanted) {
    for (var i = 0; i < playable.length; i += 1) {
      if (playable[i].provider === wanted.provider && playable[i].id === wanted.id) {
        at = i
        break
      }
    }
  }
  var tracks = playable.map(onlineTrackOf)
  player.playList(tracks, at)
  rememberOnline(tracks[at])
}

function playHistoryEntry(entry) {
  var track = onlineTrackOf(entry)
  player.playList([track], 0)
  rememberOnline(track)
}

async function startProviderLogin(provider, mode) {
  var body = await postJson(API + 'online/login/start', { provider: provider, mode: mode })
  return body
}

async function checkProviderLogin(provider, key, mode) {
  var body = await getJson(
    API +
      'online/login/status?provider=' +
      encodeURIComponent(provider) +
      '&key=' +
      encodeURIComponent(key) +
      '&mode=' +
      encodeURIComponent(mode || 'qq'),
  )
  return body.status
}


async function getLoginSession(provider) {
  return getJson(API + 'online/login/session?provider=' + encodeURIComponent(provider))
}

async function logoutProvider(provider) {
  try {
    await postJson(API + 'online/logout', { provider: provider })
    resetOnlineAccountData()
    await loadProviders()
    showToast(t('online.logoutDone'))
  } catch (error) {
    showToast(errorText(error))
  }
}

/**
 * Navidrome credentials form state.
 *
 * The password never leaves this component except in the one POST that trades
 * it for a salted token; the Host stores only salt + token.
 */
function useNavidromeForm() {
  var serverPair = useState('')
  var userPair = useState('')
  var passPair = useState('')
  var phasePair = useState('idle') // idle | loading
  var errorPair = useState('')
  var noticePair = useState('')
  // Opt-in: keeping the password is what unlocks paging the whole library through
  // the native API; the Host otherwise stores only a salted token.
  var keepPair = useState(false)

  var setServer = serverPair[1]
  var setUsername = userPair[1]
  var setPassword = passPair[1]
  var setPhase = phasePair[1]
  var setError = errorPair[1]
  var setNotice = noticePair[1]
  var setKeepPassword = keepPair[1]

  function reset() {
    setServer('')
    setUsername('')
    setPassword('')
    setPhase('idle')
    setError('')
    setNotice('')
    setKeepPassword(false)
  }

  async function connect() {
    var server = String(serverPair[0] || '').trim()
    var username = String(userPair[0] || '').trim()
    var password = String(passPair[0] || '')
    setError('')
    setNotice('')
    if (!/^https?:\/\//i.test(server)) {
      setError(t('online.navidromeBadServer'))
      return
    }
    if (username === '' || password === '') {
      setError(t('online.accountHint'))
      return
    }
    setPhase('loading')
    try {
      var result = await postJson(API + 'online/navidrome/login', {
        server: server,
        username: username,
        password: password,
        storePassword: keepPair[0] === true,
      })
      setPassword('')
      setPhase('idle')
      setNotice(t('online.navidromeOk', { version: (result && result.serverVersion) || 'ok' }))
      await loadProviders()
      showToast(t('online.loginSuccess'))
    } catch (error) {
      setPhase('idle')
      setError(errorText(error))
    }
  }

  return {
    server: serverPair[0],
    username: userPair[0],
    password: passPair[0],
    phase: phasePair[0],
    error: errorPair[0],
    notice: noticePair[0],
    keepPassword: keepPair[0],
    setServer: setServer,
    setUsername: setUsername,
    setPassword: setPassword,
    setError: setError,
    setNotice: setNotice,
    setKeepPassword: setKeepPassword,
    connect: connect,
    reset: reset,
  }
}
