/**
 * online views: recent history, my playlists, one playlist, cache and search.
 */

function onlineEntriesForHistory(online, provider) {
  return (online.history || []).filter(function (entry) {
    return entry.provider === provider
  })
}

function OnlineContent(props) {
  var ui = props.ui
  var online = props.online
  var provider = online.provider
  var nav = ui.nav
  var showingSearch = online.query !== '' && (online.phase === 'searching' || online.phase === 'ready' || online.phase === 'error')
  var cachePair = useState(null)
  var cacheList = cachePair[0]
  var setCacheList = cachePair[1]
  var cachePhasePair = useState('idle')
  var cachePhase = cachePhasePair[0]
  var setCachePhase = cachePhasePair[1]
  var prefs = usePrefs()
  var selection = useStore(selectionStore)
  var selecting = selection.active === true
  var selectedSet = useMemo(
    function () {
      var set = {}
      selection.paths.forEach(function (path) {
        set[path] = true
      })
      return set
    },
    [selection.paths],
  )
  var onlineSelectionList = []
  var currentEntries = []
  var likedSet = online.liked || {}

  function toggleOnlineFavorite(track) {
    var path = track.path
    var next = likedSet[path] !== true
    postJson(API + 'online/like', { provider: track.onlineProvider, song: track, on: next })
      .then(function () {
        var map = Object.assign({}, onlineStore.get().liked)
        if (next) map[path] = true
        else delete map[path]
        onlineStore.set({ liked: map })
        refreshLikedPlaylist(next ? 1 : -1)
        showToast(next ? t('page.favorite') : t('page.unfavorite'))
      })
      .catch(function (error) {
        showToast(errorText(error))
      })
  }

  useEffect(
    function () {
      var cancelled = false
      getJson(API + 'online/liked-ids?provider=' + encodeURIComponent(provider))
        .then(function (body) {
          if (cancelled) return
          var map = {}
          ;(Array.isArray(body.ids) ? body.ids : []).forEach(function (path) {
            map[path] = true
          })
          onlineStore.set({ liked: map })
        })
        .catch(function () {
          // Not signed in: every heart stays neutral.
        })
      return function () {
        cancelled = true
      }
    },
    [provider, (online.providers[provider] || {}).loggedIn],
  )
  var playAll = null

  function sortOnlineTracks(entries) {
    return sortTracks((entries || []).map(onlineTrackOf), prefs.sortBy, prefs.sortDir)
  }

  function playSelectedOnline() {
    var picked = {}
    selection.paths.forEach(function (path) {
      picked[path] = true
    })
    var chosen = (currentEntries || []).filter(function (entry) {
      return picked['online:' + (entry.provider || provider) + ':' + entry.id] === true
    })
    if (chosen.length > 0) {
      playOnlineResults(chosen, 0)
      return
    }
    var tracks = onlineSelectionList.filter(function (track) {
      return picked[track.path] === true
    })
    if (tracks.length > 0) player.playList(tracks, 0)
  }

  function setPlayAll(entries) {
    currentEntries = entries || []
    playAll = currentEntries.length > 0
      ? function () {
          playOnlineResults(currentEntries, 0)
        }
      : null
  }

  useEffect(
    function () {
      if (online.playlistsPhase === 'idle' || online.playlistsProvider !== provider) {
        void loadMyPlaylists(provider)
      }
    },
    [provider, online.playlistsPhase, online.playlistsProvider],
  )

  useEffect(
    function () {
      if (nav !== 'cache') {
        setCachePhase('idle')
        return undefined
      }
      var cancelled = false
      setCachePhase('loading')
      getJson(API + 'online/cache/list?provider=' + encodeURIComponent(provider))
        .then(function (body) {
          if (cancelled) return
          setCacheList(Array.isArray(body.songs) ? body.songs : [])
          setCachePhase('ready')
        })
        .catch(function () {
          if (cancelled) return
          setCacheList([])
          setCachePhase('error')
        })
      return function () {
        cancelled = true
      }
    },
    [nav, provider],
  )

  var title = t('v2.recent')
  var count = 0
  var actions = null
  var body = null
  var resetKey = ''
  var empty = null

  if (showingSearch) {
    title = t('online.searchResults')
    var results = online.results || []
    count = results.length
    resetKey = 'search:' + provider + ':' + online.query

    if (online.phase === 'searching') {
      body = h('div', { className: 'mp-empty' }, h(Spinner), h('span', null, t('online.searching')))
    } else if (online.phase === 'error') {
      body = h(Empty, { title: t('online.networkError'), hint: online.error, icon: 'info' })
    } else if (results.length === 0) {
      body = h(Empty, { title: t('online.emptyResults'), hint: '', icon: 'search' })
    } else {
      body = h(TrackListBody, {
        items: (setPlayAll(results), (onlineSelectionList = sortOnlineTracks(results))),
        resetKey: resetKey,
        selectionMode: selecting,
        selectedSet: selectedSet,
        onToggleSelect: toggleSelected,
        onSelect: function (track, additive) {
          selectTrackIn(onlineSelectionList, track, additive)
        },
        focusPath: props.locatePath || '',
        currentPath: props.currentPath,
        playing: props.playing,
        favoriteSet: likedSet,
        cachedOf: function (track) {
          return online.cache[track.onlineId] === true
        },
        onPlay: function (track) {
          var index = results.findIndex(function (item) {
            return 'online:' + item.provider + ':' + item.id === track.path
          })
          playOnlineResults(results, index < 0 ? 0 : index)
        },
        onMenu: function (track, event) {
          props.onMenu(track, event, { playSelected: playSelectedOnline })
        },
        onToggleFavorite: toggleOnlineFavorite,
        empty: empty,
      })
    }
  } else if (nav === 'playlists') {
    title = t('online.myPlaylists')
    var playlists = online.playlists || []
    count = playlists.length
    resetKey = 'online-playlists'
    var signedIn = (online.providers[provider] || {}).loggedIn === true
    if (!signedIn && online.playlistsPhase !== 'loading') {
      body = h(
        Empty,
        {
          title: t('v2.loginNeeded'),
          hint: t('online.playlistsHint'),
          icon: 'user',
        },
      )
      actions = [
        h(
          Button,
          {
            key: 'login',
            variant: 'primary',
            icon: 'qr',
            onClick: function () {
              pushLayer('login', { provider: provider, mode: 'qq' })
            },
          },
          t('online.login'),
        ),
      ]
    } else if (online.playlistsPhase === 'loading') {
      body = h('div', { className: 'mp-empty' }, h(Spinner), h('span', null, t('v2.loading')))
    } else if (playlists.length === 0) {
      body = h(Empty, { title: t('v2.noPlaylists'), icon: 'list' })
    } else {
      body = h(
        ScrollBox,
        { resetKey: resetKey },
        playlists.map(function (playlist) {
          return h(
            'button',
            {
              key: playlist.id,
              type: 'button',
              className: 'mp-srow',
              onClick: function () {
                void openOnlinePlaylist(playlist)
              },
            },
            h(
              'div',
              { className: 'mp-srow-cover' },
              playlist.cover
                ? h(Cover, { src: onlineCoverSrc({ coverUrl: playlist.cover }), iconSize: 18 })
                : icon('list', 18),
            ),
            h(
              'div',
              { className: 'mp-srow-main' },
              h('div', { className: 'mp-srow-title' }, playlist.name || ''),
              h('div', { className: 'mp-srow-sub' }, (playlist.trackCount || 0) + ' · ' + t('v2.songs')),
            ),
            icon('chevronRight', 14),
          )
        }),
      )
    }
  } else if (nav === 'playlist') {
    title = online.playlistName || t('online.myPlaylists')
    var songs = online.playlistSongs || []
    count = songs.length
    resetKey = 'online-playlist:' + online.playlistId
    actions = [h(Button, { key: 'back', variant: 'ghost', icon: 'chevronLeft', onClick: function () {
                closeOnlinePlaylist()
                setNav('recent')
              } }, t('v2.back'))]
    if (online.playlistPhase === 'loading') {
      body = h('div', { className: 'mp-empty' }, h(Spinner), h('span', null, t('v2.loading')))
    } else if (songs.length === 0) {
      body = h(Empty, { title: t('online.emptyResults'), icon: 'list' })
    } else {
      body = h(TrackListBody, {
        items: (setPlayAll(songs), (onlineSelectionList = sortOnlineTracks(songs))),
        resetKey: resetKey,
        selectionMode: selecting,
        selectedSet: selectedSet,
        onToggleSelect: toggleSelected,
        onSelect: function (track, additive) {
          selectTrackIn(onlineSelectionList, track, additive)
        },
        focusPath: props.locatePath || '',
        currentPath: props.currentPath,
        playing: props.playing,
        favoriteSet: likedSet,
        cachedOf: function (track) {
          return online.cache[track.onlineId] === true
        },
        onPlay: function (track) {
          var index = songs.findIndex(function (item) {
            return 'online:' + item.provider + ':' + item.id === track.path
          })
          playOnlineResults(songs, index < 0 ? 0 : index)
        },
        onMenu: function (track, event) {
          props.onMenu(track, event, { playSelected: playSelectedOnline })
        },
        onToggleFavorite: toggleOnlineFavorite,
      })
    }
  } else if (nav === 'cache') {
    title = t('v2.cache')
    var entries = cacheList || []
    count = entries.length
    resetKey = 'online-cache'
    if (cachePhase === 'loading') {
      body = h('div', { className: 'mp-empty' }, h(Spinner), h('span', null, t('v2.loading')))
    } else if (entries.length === 0) {
      body = h(Empty, { title: t('online.cacheEmpty'), icon: 'download' })
    } else {
      body = h(TrackListBody, {
        items: (setPlayAll(entries), (onlineSelectionList = sortOnlineTracks(entries))),
        resetKey: resetKey,
        selectionMode: selecting,
        selectedSet: selectedSet,
        onToggleSelect: toggleSelected,
        onSelect: function (track, additive) {
          selectTrackIn(onlineSelectionList, track, additive)
        },
        focusPath: props.locatePath || '',
        currentPath: props.currentPath,
        playing: props.playing,
        favoriteSet: likedSet,
        onToggleFavorite: toggleOnlineFavorite,
        cachedOf: function () {
          return true
        },
        onPlay: function (track) {
          var index = entries.findIndex(function (item) {
            return 'online:' + item.provider + ':' + item.id === track.path
          })
          playOnlineResults(entries, index < 0 ? 0 : index)
        },
      })
    }
  } else {
    var history = onlineEntriesForHistory(online, provider)
    title = t('v2.recent')
    count = history.length
    resetKey = 'online-recent:' + provider

    if (history.length === 0) {
      body = h(Empty, { title: t('v2.noHistory'), hint: t('v2.noHistoryHint'), icon: 'clock' })
    } else {
      body = h(TrackListBody, {
        items: (setPlayAll(history), (onlineSelectionList = sortOnlineTracks(history))),
        resetKey: resetKey,
        selectionMode: selecting,
        selectedSet: selectedSet,
        onToggleSelect: toggleSelected,
        onSelect: function (track, additive) {
          selectTrackIn(onlineSelectionList, track, additive)
        },
        focusPath: props.locatePath || '',
        currentPath: props.currentPath,
        playing: props.playing,
        favoriteSet: likedSet,
        onPlay: function (track) {
          var index = history.findIndex(function (item) {
            return 'online:' + item.provider + ':' + item.id === track.path
          })
          playOnlineResults(history, index < 0 ? 0 : index)
        },
        onMenu: function (track, event) {
          props.onMenu(track, event, {
            playSelected: playSelectedOnline,
            onRemove: function () {
              var match = /^online:([^:]+):(.+)$/.exec(track.path)
              if (match === null) return
              removeHistory({ provider: match[1], id: match[2] })
              showToast(t('online.removedFromHistory'))
            },
          })
        },
        onToggleFavorite: toggleOnlineFavorite,
      })
    }
  }

  return [
    h(ContentHeader, {
      key: 'head',
      title: title,
      count: count,
      onAll: function () {
        selectAllIn(onlineSelectionList)
      },
      onNone: function () {
        setSelectionMode(false)
      },
      onRange: beginRangePick,
      onInvert: function () {
        invertSelectionIn(onlineSelectionList)
      },
      selecting: selecting,
      selectedCount: selection.paths.length,
    }),
    h(
      'div',
      { className: 'mp-toolbar', key: 'toolbar' },
      h(PlayModePills),
      h(
        'div',
        { style: { marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' } },
        playAll
          ? h(
              'button',
              { type: 'button', className: 'mp-chip', onClick: playAll },
              icon('play', 13),
              t('page.playAll'),
            )
          : null,
        actions || [],
      ),
    ),
    h('div', { className: 'mp-content-body', key: 'body', style: { display: 'contents' } }, body),
  ]
}





