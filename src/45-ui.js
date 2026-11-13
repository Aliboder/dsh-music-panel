/**
 * ui state: source, section, filter, query and the two panel-level toggles.
 *
 * Persisted subset: source / nav / playlistId (localStorage `music.ui.v2`),
 * migrated once from the 0.11 keys `mu.source` and `mu.view`.
 */

var UI_KEY = 'music.ui.v2'
var LEGACY_UI_KEYS = ['mu.source', 'mu.view']

/** Every selectable playback source, in tab order. */
var UI_SOURCES = ['local', 'netease', 'qq', 'kugou', 'kugouLite', 'navidrome']

function isOnlineSource(source) {
  return source === 'netease' || source === 'qq' || source === 'kugou' || source === 'kugouLite' || source === 'navidrome'
}

function sourceLabelOf(source) {
  if (source === 'netease') return t('online.providerNetease')
  if (source === 'qq') return t('online.providerQq')
  if (source === 'kugou') return t('online.providerKugou')
  if (source === 'kugouLite') return t('online.providerKugouLite')
  if (source === 'navidrome') return t('online.providerNavidrome')
  return t('page.tabLocal')
}

function rawStorageGet(key, fallback) {
  try {
    var value = window.localStorage.getItem(key)
    return value === null || value === undefined ? fallback : String(value)
  } catch (error) {
    return fallback
  }
}

function readUiState() {
  var saved = storageGet(UI_KEY, null)
  if (saved === null || typeof saved !== 'object') {
    // Migrate the 0.11 keys once so the panel opens where it was left.
    var legacySource = rawStorageGet(LEGACY_UI_KEYS[0], '')
    var legacyView = rawStorageGet(LEGACY_UI_KEYS[1], '')
    var source = UI_SOURCES.indexOf(legacySource) >= 0 ? legacySource : 'local'
    var nav = 'songs'
    if (source !== 'local') nav = 'recent'
    else if (['songs', 'albums', 'artists', 'folders', 'favorites', 'playlists', 'stats'].indexOf(legacyView) >= 0) {
      nav = legacyView
    }
    return { source: source, nav: nav, playlistId: '' }
  }
  var source = UI_SOURCES.indexOf(saved.source) >= 0 ? saved.source : 'local'
  var nav = typeof saved.nav === 'string' && saved.nav !== '' ? saved.nav : 'songs'
  var playlistId = typeof saved.playlistId === 'string' ? saved.playlistId : ''
  if (nav === 'playlists') nav = source === 'local' ? 'songs' : 'recent'
  if (nav === 'playlist' && (source !== 'local' || playlistId === '')) nav = source === 'local' ? 'songs' : 'recent'
  // The album view is keyed by a provider album id that only lives in memory,
  // so a reload cannot restore it; fall back to the search/recent list rather
  // than reopening an empty album page.
  if (nav === 'album') nav = source === 'local' ? 'songs' : 'recent'
  if (nav === 'artist') nav = source === 'local' ? 'songs' : 'recent'
  // `artists` / `albums` are local-library views; an online source has neither.
  if (source !== 'local' && (nav === 'artists' || nav === 'albums')) nav = 'recent'
  return { source: source, nav: nav, playlistId: playlistId }
}

var uiStore = createStore(
  Object.assign(
    {
      filter: null,
      query: '',
      queueOpen: false,
      queueSource: '',
      npOpen: false,
    },
    readUiState(),
  ),
)

function setUi(patch) {
  return uiStore.set(patch)
}

function isLocalNav(nav) {
  return ['songs', 'albums', 'artists', 'folders', 'favorites', 'playlists', 'playlist', 'stats'].indexOf(nav) >= 0
}

/** Section groups for the current source (rail or top bar). */
/** Online playlist ordering is local-only; the platform order is kept as "source". */
function onlinePlaylistSortMode() {
  var mode = prefsStore.get().onlinePlaylistSort
  return mode === 'name' || mode === 'count' ? mode : 'source'
}

function onlinePlaylistSortLabel(mode) {
  if (mode === 'name') return t('v2.sortName')
  if (mode === 'count') return t('v2.sortCount')
  return t('v2.sortSource')
}

function sortOnlinePlaylists(list) {
  var mode = onlinePlaylistSortMode()
  var copy = (list || []).slice()
  if (mode === 'name') {
    copy.sort(function (left, right) {
      return String(left.name || '').localeCompare(String(right.name || ''), 'zh')
    })
  } else if (mode === 'count') {
    copy.sort(function (left, right) {
      var delta = (Number(right.trackCount) || 0) - (Number(left.trackCount) || 0)
      return delta !== 0
        ? delta
        : String(left.name || '').localeCompare(String(right.name || ''), 'zh')
    })
  }
  return copy
}

function cycleOnlinePlaylistSort() {
  var mode = onlinePlaylistSortMode()
  var next = mode === 'source' ? 'name' : mode === 'name' ? 'count' : 'source'
  setPrefs({ onlinePlaylistSort: next })
}

function navGroupsFor(source, favoritesCount) {
  var library = libraryStore.get()
  if (isOnlineSource(source)) {
    var online = onlineStore.get()
    var playlists = sortOnlinePlaylists(online.playlists || [])
    var signedIn = (online.providers[source] || {}).loggedIn === true
    // Navidrome can enumerate a whole library, so it gets a song list the
    // search-only platforms cannot offer. Albums and artists are not listed
    // here: a track's album name opens the shared album view instead, the same
    // path the Chinese platforms use.
    var browse =
      source === 'navidrome' ? [{ key: 'songs', label: t('v2.songs'), icon: 'note', count: null }] : []
    var groups = [
      {
        label: t('v2.sectionOnline'),
        items: browse.concat([
          { key: 'recent', label: t('v2.recent'), icon: 'clock', count: null },
          { key: 'cache', label: t('v2.cache'), icon: 'download', count: null },
        ]),
      },
    ]
    if (signedIn) {
      groups.push({
        label: t('v2.playlists'),
        showLabel: true,
        action: {
          icon: 'sort',
          title: t('v2.playlistSort') + ': ' + onlinePlaylistSortLabel(onlinePlaylistSortMode()),
          run: cycleOnlinePlaylistSort,
        },
        items: playlists.map(function (playlist) {
          return {
            key: 'online-playlist:' + playlist.id,
            label: playlist.name || '',
            icon: 'list',
            count: playlist.trackCount || 0,
            coverSrc: playlist.cover ? onlineCoverSrc({ coverUrl: playlist.cover }) : '',
            onlinePlaylist: playlist,
          }
        }),
      })
    }
    return groups
  }
  return [
    {
      label: t('v2.sectionLibrary'),
      items: [
        { key: 'songs', label: t('v2.songs'), icon: 'note', count: library.tracks.length },
        { key: 'albums', label: t('v2.albums'), icon: 'disc', count: null },
        { key: 'artists', label: t('v2.artists'), icon: 'user', count: null },
        { key: 'folders', label: t('v2.folders'), icon: 'folder', count: null },
      ],
    },
    {
      label: t('v2.sectionCollection'),
      items: [
        { key: 'favorites', label: t('v2.favorites'), icon: 'heart', count: favoritesCount },
        { key: 'stats', label: t('v2.stats'), icon: 'chart', count: null },
      ],
    },
    {
      label: t('v2.playlists'),
      showLabel: true,
      action: {
        icon: 'plus',
        title: t('v2.newPlaylist'),
        run: function () {
          pushLayer('newPlaylist')
        },
      },
      items: (library.playlists || []).map(function (playlist) {
        return {
          key: 'local-playlist:' + playlist.id,
          label: playlist.name || '',
          icon: 'list',
          count: (playlist.trackPaths || []).length,
          coverSrc: trackCoverSrc(playlistTracks(playlist)[0] || null),
          localPlaylistId: playlist.id,
          playlist: playlist,
        }
      }),
    },
  ]
}

/** One click path for every nav shape: plain sections, local/online playlists. */
function activateNavItem(item) {
  if (item.localPlaylistId) {
    openLocalPlaylist(item.localPlaylistId)
    return
  }
  if (item.onlinePlaylist) {
    void openOnlinePlaylist(item.onlinePlaylist)
    setNav('playlist')
    return
  }
  setNav(item.key)
}

function activeNavKey(nav) {
  var ui = uiStore.get()
  if (nav === 'playlist') {
    if (isOnlineSource(ui.source)) return 'online-playlist:' + (onlineStore.get().playlistId || '')
    return 'local-playlist:' + (ui.playlistId || '')
  }
  return nav
}

function sectionTitleOf(ui) {
  switch (ui.nav) {
    case 'songs':
      return t('v2.allSongs')
    case 'albums':
      return t('v2.albums')
    case 'artists':
      return t('v2.artists')
    case 'folders':
      return t('v2.folders')
    case 'favorites':
      return t('v2.favorites')
    case 'playlists':
      return t('v2.playlists')
    case 'playlist':
      return (playlistById(ui.playlistId) || {}).name || t('v2.playlists')
    case 'stats':
      return t('v2.stats')
    case 'recent':
      return t('v2.recent')
    case 'album':
      return onlineStore.get().albumName || t('online.album')
    case 'cache':
      return t('v2.cache')
    default:
      return t('v2.songs')
  }
}

function setSource(source) {
  var ui = uiStore.get()
  if (ui.source === source) return
  selectionStore.set({ active: false, paths: [] })
  uiStore.set({
    source: source,
    // Navidrome opens on the library list; the Chinese platforms are
    // search-driven and have nothing to show until the user types.
    nav: !isOnlineSource(source) ? 'songs' : source === 'navidrome' ? 'songs' : 'recent',
    filter: null,
    query: '',
    playlistId: '',
  })
  onlineStore.set({
    provider: isOnlineSource(source) ? source : onlineStore.get().provider,
    playlists: [],
    playlistsPhase: 'idle',
    playlistsProvider: '',
    liked: {},
    playlistId: '',
    playlistName: '',
    playlistSongs: [],
    playlistPhase: 'idle',
    query: '',
    results: [],
    phase: 'idle',
    error: '',
  })
  if (isOnlineSource(source)) void loadProviders()
}

function setNav(nav) {
  selectionStore.set({ active: false, paths: [] })
  uiStore.set({ nav: nav, filter: null, playlistId: nav === 'playlist' ? uiStore.get().playlistId : '' })
}

function openLocalPlaylist(id) {
  selectionStore.set({ active: false, paths: [] })
  uiStore.set({ nav: 'playlist', playlistId: id, filter: null, query: '' })
}

function openOnlineSection(nav) {
  closeOnlinePlaylist()
  uiStore.set({ nav: nav, filter: null })
}

uiStore.subscribe(function (state) {
  storageSet(UI_KEY, {
    source: state.source,
    nav: state.nav,
    playlistId: state.playlistId,
  })
})
