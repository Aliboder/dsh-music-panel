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
  error: '',
  playlistsPhase: 'idle',
  playlistsProvider: '',
  playlists: [],
  playlistId: '',
  playlistName: '',
  playlistSongs: [],
  playlistPhase: 'idle',
  history: readOnlineHistory(),
  liked: {},
  cache: {},
  progress: {},
  providers: {},
})

var onlineSearchToken = 0

async function searchOnline(text) {
  var query = String(text || '').trim()
  if (query === '') return
  var state = onlineStore.get()
  var provider = state.provider
  var token = (onlineSearchToken += 1)
  onlineStore.set({ phase: 'searching', query: query, error: '', results: [] })
  try {
    var body = await getJson(
      API +
        'online/search?provider=' +
        encodeURIComponent(provider) +
        '&q=' +
        encodeURIComponent(query),
    )
    if (token !== onlineSearchToken) return
    var results = Array.isArray(body.results) ? body.results : []
    onlineStore.set({ phase: 'ready', results: results })
    void refreshCacheStatus(provider, results.map(function (item) { return item.id }))
  } catch (error) {
    if (token !== onlineSearchToken) return
    onlineStore.set({ phase: 'error', error: errorText(error) })
  }
}

async function refreshCacheStatus(provider, ids) {
  var list = (ids || []).filter(Boolean).slice(0, 120)
  if (list.length === 0) return
  try {
    var body = await getJson(
      API +
        'online/cache/status?provider=' +
        encodeURIComponent(provider) +
        '&ids=' +
        encodeURIComponent(list.join(',')),
    )
    var state = onlineStore.get()
    onlineStore.set({
      cache: Object.assign({}, state.cache, body.cached || {}),
      progress: Object.assign({}, state.progress, body.progress || {}),
    })
  } catch (error) {
    // Cache badges are cosmetic.
  }
}

async function loadMyPlaylists(provider) {
  var target = provider || onlineStore.get().provider
  onlineStore.set({ playlistsPhase: 'loading', playlistsProvider: target, playlists: [] })
  try {
    var body = await getJson(API + 'online/my-playlists?provider=' + encodeURIComponent(target))
    onlineStore.set({
      playlistsPhase: 'ready',
      playlistsProvider: target,
      playlists: Array.isArray(body.playlists) ? body.playlists : [],
    })
  } catch (error) {
    onlineStore.set({ playlistsPhase: 'error', playlistsProvider: target, playlists: [], error: errorText(error) })
  }
}

async function openOnlinePlaylist(playlist) {
  if (!playlist || !playlist.id) return
  var provider = onlineStore.get().provider
  onlineStore.set({
    playlistId: playlist.id,
    playlistName: playlist.name || '',
    playlistPhase: 'loading',
    playlistSongs: [],
  })
  try {
    var body = await getJson(
      API +
        'online/playlist-songs?provider=' +
        encodeURIComponent(provider) +
        '&id=' +
        encodeURIComponent(playlist.id),
    )
    var songs = Array.isArray(body.songs) ? body.songs : []
    onlineStore.set({
      playlistPhase: 'ready',
      playlistName: body.name || playlist.name || '',
      playlistSongs: songs,
    })
    void refreshCacheStatus(provider, songs.map(function (item) { return item.id }))
  } catch (error) {
    onlineStore.set({ playlistPhase: 'error', playlistSongs: [], error: errorText(error) })
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
    durationSec: track.durationSec || 0,
    coverUrl: track.coverUrl || '',
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
  // Never pre-block VIP tracks on the client: whether a track is playable
  // depends on the signed-in account, and the Host resolves that with cookies.
  var playable = list.filter(function (item) {
    return item && item.id
  })
  if (playable.length === 0) {
    showToast(t('online.vipOnly'))
    return
  }
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
  if (tracks[at] && tracks[at].onlineProvider) {
    void refreshCacheStatus(tracks[at].onlineProvider, [tracks[at].onlineId])
  }
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

async function logoutProvider(provider) {
  try {
    await postJson(API + 'online/logout', { provider: provider })
    await loadProviders()
    showToast(t('online.logoutDone'))
  } catch (error) {
    showToast(errorText(error))
  }
}
