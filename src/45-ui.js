/**
 * ui state: source, section, filter, query and the two panel-level toggles.
 *
 * Persisted subset: source / nav / playlistId (localStorage `music.ui.v2`),
 * migrated once from the 0.11 keys `mu.source` and `mu.view`.
 */

var UI_KEY = 'music.ui.v2'
var LEGACY_UI_KEYS = ['mu.source', 'mu.view']

function isOnlineSource(source) {
  return source === 'netease' || source === 'qq' || source === 'kugou'
}

function sourceLabelOf(source) {
  if (source === 'netease') return t('online.providerNetease')
  if (source === 'qq') return t('online.providerQq')
  if (source === 'kugou') return t('online.providerKugou')
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
    var source = ['local', 'netease', 'qq', 'kugou'].indexOf(legacySource) >= 0 ? legacySource : 'local'
    var nav = 'songs'
    if (source !== 'local') nav = 'recent'
    else if (['songs', 'albums', 'artists', 'folders', 'favorites', 'playlists', 'stats'].indexOf(legacyView) >= 0) {
      nav = legacyView
    }
    return { source: source, nav: nav, playlistId: '' }
  }
  var source = ['local', 'netease', 'qq', 'kugou'].indexOf(saved.source) >= 0 ? saved.source : 'local'
  var nav = typeof saved.nav === 'string' && saved.nav !== '' ? saved.nav : 'songs'
  var playlistId = typeof saved.playlistId === 'string' ? saved.playlistId : ''
  if (nav === 'playlists') nav = source === 'local' ? 'songs' : 'recent'
  if (nav === 'playlist' && (source !== 'local' || playlistId === '')) nav = source === 'local' ? 'songs' : 'recent'
  return { source: source, nav: nav, playlistId: playlistId }
}

var uiStore = createStore(
  Object.assign(
    {
      filter: null,
      query: '',
      queueOpen: false,
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
function navGroupsFor(source, favoritesCount) {
  var library = libraryStore.get()
  if (isOnlineSource(source)) {
    var online = onlineStore.get()
    var playlists = online.playlists || []
    var signedIn = (online.providers[source] || {}).loggedIn === true
    var groups = [
      {
        label: t('v2.sectionOnline'),
        items: [
          { key: 'recent', label: t('v2.recent'), icon: 'clock', count: null },
          { key: 'cache', label: t('v2.cache'), icon: 'download', count: null },
        ],
      },
    ]
    if (signedIn) {
      groups.push({
        label: t('v2.playlists'),
        showLabel: true,
        items: playlists.map(function (playlist) {
          return {
            key: 'online-playlist:' + playlist.id,
            label: playlist.name || '',
            icon: 'list',
            count: playlist.trackCount || 0,
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
    nav: isOnlineSource(source) ? 'recent' : 'songs',
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
