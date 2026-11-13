/**
 * online views: recent history, my playlists, one playlist, cache and search.
 */

/** Rows per page in the paged library view. */
var SONG_PAGE_SIZE = 100

function onlineEntriesForHistory(online, provider) {
  return (online.history || []).filter(function (entry) {
    return entry.provider === provider
  })
}

/**
 * Page numbers to draw: the first, the last, and a window around the current
 * page, with `null` marking a gap that the caller renders as an ellipsis.
 */
function pageWindow(current, total) {
  if (total <= 7) {
    var all = []
    for (var i = 1; i <= total; i += 1) all.push(i)
    return all
  }
  var out = [1]
  var from = Math.max(2, current - 1)
  var to = Math.min(total - 1, current + 1)
  if (from > 2) out.push(null)
  for (var p = from; p <= to; p += 1) out.push(p)
  if (to < total - 1) out.push(null)
  out.push(total)
  return out
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
  // Library-wide song list (Navidrome only; other providers return none).
  var songsPair = useState(null)
  var songsList = songsPair[0]
  var setSongsList = songsPair[1]
  var songsPhasePair = useState('idle')
  var songsPhase = songsPhasePair[0]
  var setSongsPhase = songsPhasePair[1]
  // Native (opt-in) mode pages the whole library, so the view tracks how many
  // rows the server has in total and whether another page exists.
  var songsTotalPair = useState(0)
  var songsTotal = songsTotalPair[0]
  var setSongsTotal = songsTotalPair[1]
  var songsNativePair = useState(false)
  var songsNative = songsNativePair[0]
  var setSongsNative = songsNativePair[1]
  // Native mode is page-numbered, one page in memory at a time.
  var songsPagePair = useState(1)
  var songsPage = songsPagePair[0]
  var setSongsPage = songsPagePair[1]
  // Artist / album cards. These are lists only — a row opens the shared album
  // view upstream already provides, so no detail state is kept here.
  var browsePhasePair = useState('idle')
  var browsePhase = browsePhasePair[0]
  var setBrowsePhase = browsePhasePair[1]
  var artistsPair = useState([])
  var artistsList = artistsPair[0]
  var setArtistsList = artistsPair[1]
  var albumsPair = useState([])
  var albumsList = albumsPair[0]
  var setAlbumsList = albumsPair[1]
  var artistDetailPair = useState(null)
  var artistDetail = artistDetailPair[0]
  var setArtistDetail = artistDetailPair[1]
  var artistAlbumsPair = useState([])
  var artistAlbumsList = artistAlbumsPair[0]
  var setArtistAlbumsList = artistAlbumsPair[1]
  var browseIdPair = useState('')
  var browseId = browseIdPair[0]
  var setBrowseId = browseIdPair[1]
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

  function reloginExpired() {
    void logoutProvider(provider).then(function () {
      // Navidrome signs in with a URL + credentials, not a QR code, so it must
      // reopen the credential dialog; the QR sheet would show an empty code the
      // user cannot scan and leave them stuck.
      var layer = provider === 'navidrome' ? 'navidrome' : 'login'
      pushLayer(layer, layer === 'navidrome' ? {} : { provider: provider, mode: 'qq' })
    })
  }
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

  function sortOnlineEntries(entries) {
    var list = entries || []
    var byPath = {}
    list.forEach(function (entry) {
      byPath['online:' + (entry.provider || provider) + ':' + entry.id] = entry
    })
    return sortOnlineTracks(list)
      .map(function (track) {
        return byPath[track.path]
      })
      .filter(Boolean)
  }

  function setPlayAll(entries) {
    currentEntries = sortOnlineEntries(entries)
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

  useEffect(
    function () {
      if (nav !== 'songs') {
        setSongsPhase('idle')
        return undefined
      }
      var cancelled = false
      setSongsPhase('loading')
      // Native mode orders on the server and returns one page at a time, so a
      // page is addressed purely by its offset and never appended to.
      var sort = String(prefs.sortBy || 'title')
      var order = prefs.sortDir === 'desc' ? 'desc' : 'asc'
      var offset = (songsPage - 1) * SONG_PAGE_SIZE
      getJson(
        API +
          'online/songs?provider=' +
          encodeURIComponent(provider) +
          '&size=' +
          String(SONG_PAGE_SIZE) +
          '&offset=' +
          String(offset) +
          '&sort=' +
          encodeURIComponent(sort) +
          '&order=' +
          encodeURIComponent(order),
      )
        .then(function (body) {
          if (cancelled) return
          setSongsList(Array.isArray(body.songs) ? body.songs : [])
          setSongsNative(body.native === true)
          setSongsTotal(Number(body.total) || 0)
          setSongsPhase('ready')
        })
        .catch(function () {
          if (cancelled) return
          setSongsList([])
          setSongsNative(false)
          setSongsTotal(0)
          setSongsPhase('error')
        })
      return function () {
        cancelled = true
      }
    },
    [nav, provider, prefs.sortBy, prefs.sortDir, songsPage],
  )

  // Any change of provider or ordering invalidates the page number.
  useEffect(
    function () {
      setSongsPage(1)
    },
    [provider, prefs.sortBy, prefs.sortDir],
  )

  function goToSongsPage(page) {
    var next = Math.max(1, Math.floor(Number(page) || 1))
    if (next === songsPage) return
    setSongsPage(next)
  }

  // Artist / album cards load their list once per view; the rows are static
  // until the user re-enters.
  useEffect(
    function () {
      if (nav !== 'artists' && nav !== 'albums' && nav !== 'artist') {
        setBrowsePhase('idle')
        return undefined
      }
      var cancelled = false
      setBrowsePhase('loading')
      var url = ''
      if (nav === 'artists') url = API + 'online/artists?provider=' + encodeURIComponent(provider)
      else if (nav === 'albums') url = API + 'online/albums?provider=' + encodeURIComponent(provider) + '&size=200'
      else url = API + 'online/artist?provider=' + encodeURIComponent(provider) + '&id=' + encodeURIComponent(browseId)
      getJson(url)
        .then(function (body) {
          if (cancelled) return
          if (nav === 'artists') setArtistsList(Array.isArray(body.artists) ? body.artists : [])
          else if (nav === 'albums') setAlbumsList(Array.isArray(body.albums) ? body.albums : [])
          else {
            setArtistDetail(body.artist || null)
            setArtistAlbumsList(Array.isArray(body.albums) ? body.albums : [])
          }
          setBrowsePhase('ready')
        })
        .catch(function () {
          if (cancelled) return
          if (nav === 'artists') setArtistsList([])
          else if (nav === 'albums') setAlbumsList([])
          else {
            setArtistDetail(null)
            setArtistAlbumsList([])
          }
          setBrowsePhase('error')
        })
      return function () {
        cancelled = true
      }
    },
    [nav, provider, browseId],
  )

  /** Open one album through the shared album view (upstream's own entry). */
  function openAlbumCard(album) {
    void openOnlineAlbum({
      album: album.name || '',
      albumId: album.id || '',
      artist: album.artist || '',
      onlineProvider: provider,
      coverUrl: '',
      coverArtId: album.coverArtId || '',
    })
  }

  function openArtistCard(artist) {
    setBrowseId(String(artist.id || ''))
    uiStore.set({ nav: 'artist', filter: null, query: '' })
  }

  function openArtist(track, artist) {
    void openOnlineArtist(track, artist)
  }

  var title = t('v2.recent')
  var count = 0
  var actions = null
  var backActions = []
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
        onAlbum: function (track) {
          void openOnlineAlbum(track)
        },
        onArtist: openArtist,
        empty: empty,
      })
      if ((online.searchTotal || 0) > results.length) {
        body = h(
          'div',
          { className: 'mp-songs-pane', key: 'search-pane' },
          body,
          h(
            'div',
            { className: 'mp-pager', key: 'pager' },
            h(
              Button,
              {
                icon: 'plus',
                disabled: online.searchLoadingMore === true,
                onClick: function () {
                  void searchOnline(online.query, (online.searchPage || 1) + 1, true)
                },
              },
              online.searchLoadingMore === true ? t('online.loadingMore') : t('online.loadMore'),
            ),
          ),
        )
      }
    }
  } else if (nav === 'album') {
    title = online.albumName || t('online.album')
    var albumSongs = Array.isArray(online.albumSongs) ? online.albumSongs : []
    count = albumSongs.length
    resetKey = 'online-album:' + online.albumProvider + ':' + online.albumId + ':' + online.albumName
    actions = [
      h(
        Button,
        {
          key: 'play',
          variant: 'primary',
          icon: 'play',
          onClick: function () {
            playOnlineResults(albumSongs, 0)
          },
        },
        t('page.playAll'),
      ),
    ]
    backActions = [
      h(
        Button,
        {
          key: 'back',
          variant: 'ghost',
          icon: 'chevronLeft',
          onClick: function () {
            closeOnlineAlbum()
            setNav('recent')
          },
        },
        t('v2.back'),
      ),
    ]
    if (online.albumPhase === 'loading') {
      body = h('div', { className: 'mp-empty' }, h(Spinner), h('span', null, t('v2.loading')))
    } else if (online.albumPhase === 'error') {
      body = h(Empty, { title: t('online.albumFailed'), hint: online.albumError, icon: 'disc' })
    } else if (albumSongs.length === 0) {
      body = h(Empty, { title: t('online.emptyResults'), icon: 'disc' })
    } else {
      // A self-hosted server is the one provider whose album endpoint reports a
      // meaningful disc/track sequence (and never reorders on relevance), so its
      // album keeps the server order. The four Chinese platforms behave exactly
      // as before — they still apply the user's sort preference — because
      // changing their output is not this branch's call to make.
      var albumOrder =
        online.albumProvider === 'navidrome'
          ? albumSongs.map(onlineTrackOf)
          : sortOnlineTracks(albumSongs)
      body = h(TrackListBody, {
        items: (setPlayAll(albumSongs), (onlineSelectionList = albumOrder)),
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
          var index = albumSongs.findIndex(function (item) {
            return 'online:' + item.provider + ':' + item.id === track.path
          })
          playOnlineResults(albumSongs, index < 0 ? 0 : index)
        },
        onMenu: function (track, event) {
          props.onMenu(track, event, { playSelected: playSelectedOnline })
        },
        onToggleFavorite: toggleOnlineFavorite,
        onArtist: openArtist,
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
    } else if (online.playlistsPhase === 'error') {
      body = h(Empty, {
        title: t('online.playlistsError'),
        hint: online.error || t('online.authExpiredHint'),
        icon: 'info',
      })
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
    backActions = [h(Button, { key: 'back', variant: 'ghost', icon: 'chevronLeft', onClick: function () {
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
        onAlbum: function (track) {
          void openOnlineAlbum(track)
        },
        onArtist: openArtist,
      })
    }
  } else if (nav === 'artistSongs') {
    var artistTracks = Array.isArray(online.artistSongs) ? online.artistSongs : []
    title = online.artistName || t('v2.artists')
    count = artistTracks.length
    resetKey = 'online-artist-songs:' + online.artistProvider + ':' + online.artistName
    backActions = [
      h(
        Button,
        {
          key: 'back',
          variant: 'ghost',
          icon: 'chevronLeft',
          onClick: function () {
            var from = online.artistFrom || 'recent'
            closeOnlineArtist()
            setNav(from)
          },
        },
        t('v2.back'),
      ),
    ]
    if (online.artistPhase === 'loading') {
      body = h('div', { className: 'mp-empty' }, h(Spinner), h('span', null, t('v2.loading')))
    } else if (online.artistPhase === 'error') {
      body = h(Empty, { title: t('online.networkError'), hint: online.artistError, icon: 'user' })
    } else if (artistTracks.length === 0) {
      body = h(Empty, { title: t('online.emptyResults'), icon: 'user' })
    } else {
      body = h(TrackListBody, {
        items: (setPlayAll(artistTracks), (onlineSelectionList = sortOnlineTracks(artistTracks))),
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
          var index = artistTracks.findIndex(function (item) {
            return 'online:' + item.provider + ':' + item.id === track.path
          })
          playOnlineResults(artistTracks, index < 0 ? 0 : index)
        },
        onMenu: function (track, event) {
          props.onMenu(track, event, { playSelected: playSelectedOnline })
        },
        onToggleFavorite: toggleOnlineFavorite,
        onAlbum: function (track) {
          void openOnlineAlbum(track)
        },
        onArtist: openArtist,
      })
    }
  } else if (nav === 'songs') {
    // Library-wide browse. Subsonic has no stable "all songs" index, so the
    // host returns getRandomSongs: a sample of the library, not a fixed list.
    title = t('v2.songs')
    var allSongs = songsList || []
    count = allSongs.length
    resetKey = 'online-songs:' + provider
    // Only blank the pane for the first page; "load more" keeps the rows on
    // screen while the next page is in flight.
    var firstPage = songsPhase === 'idle' || (songsPhase === 'loading' && allSongs.length === 0)
    if (firstPage) {
      body = h('div', { className: 'mp-empty' }, h(Spinner), h('span', null, t('v2.loading')))
    } else if (songsPhase === 'error' && allSongs.length === 0) {
      body = h(Empty, { title: t('online.networkError'), icon: 'info' })
    } else if (allSongs.length === 0) {
      body = h(Empty, { title: t('online.allSongsEmpty'), hint: t('online.allSongsEmptyHint'), icon: 'note' })
    } else {
      // Native pages arrive already ordered by the server, so re-sorting them
      // client-side would break the page boundaries; the random sample has no
      // such constraint and keeps honouring the sort preference.
      var songOrder = songsNative === true ? allSongs.map(onlineTrackOf) : sortOnlineTracks(allSongs)
      body = h(TrackListBody, {
        items: (setPlayAll(allSongs), (onlineSelectionList = songOrder)),
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
          var index = allSongs.findIndex(function (item) {
            return 'online:' + item.provider + ':' + item.id === track.path
          })
          playOnlineResults(allSongs, index < 0 ? 0 : index)
        },
        onMenu: function (track, event) {
          props.onMenu(track, event, { playSelected: playSelectedOnline })
        },
        onToggleFavorite: toggleOnlineFavorite,
        onArtist: openArtist,
        empty: empty,
      })
      // A real footer: the list keeps flex:1 and the pager sits below it, so
      // it stays visible without scrolling to the end of 3000 rows.
      var footer = null
      if (songsNative === true) {
        var pageCount = Math.max(1, Math.ceil(songsTotal / SONG_PAGE_SIZE))
        var numbers = pageWindow(songsPage, pageCount)
        var busy2 = songsPhase === 'loading'
        footer = h(
          'div',
          { className: 'mp-pager', key: 'pager' },
          h(
            Button,
            {
              key: 'prev',
              icon: 'chevronLeft',
              disabled: busy2 || songsPage <= 1,
              onClick: function () {
                goToSongsPage(songsPage - 1)
              },
            },
            '',
          ),
          numbers.map(function (number, index) {
            if (number === null) {
              return h('span', { key: 'gap' + index, className: 'mp-page-gap' }, '…')
            }
            return h(
              'button',
              {
                key: 'p' + number,
                type: 'button',
                className: 'mp-page-num' + (number === songsPage ? ' is-on' : ''),
                disabled: busy2,
                onClick: function () {
                  goToSongsPage(number)
                },
              },
              String(number),
            )
          }),
          h(
            Button,
            {
              key: 'next',
              icon: 'chevronRight',
              disabled: busy2 || songsPage >= pageCount,
              onClick: function () {
                goToSongsPage(songsPage + 1)
              },
            },
            '',
          ),
          h(
            'span',
            { className: 'mp-loaded-of' },
            t('online.pageOf', { page: songsPage, pages: pageCount, total: songsTotal }),
          ),
        )
      } else if (provider === 'navidrome') {
        // Explain why there is no pager instead of leaving a silent cap.
        footer = h(
          'div',
          { className: 'mp-pager is-hint', key: 'pager' },
          h('span', { className: 'mp-loaded-of' }, t('online.randomSample', { n: allSongs.length })),
          h(
            Button,
            {
              icon: 'settings',
              onClick: function () {
                pushLayer('navidrome')
              },
            },
            t('online.enableFullLibrary'),
          ),
        )
      }
      if (footer !== null) {
        body = h('div', { className: 'mp-songs-pane', key: 'songs-pane' }, body, footer)
      }
    }
  } else if (nav === 'artists' || nav === 'albums' || nav === 'artist') {
    // Card grids. Every row opens the shared album view, so these are purely
    // navigation surfaces over the provider's own catalogue.
    var isArtistList = nav === 'artists'
    var isAlbumList = nav === 'albums'
    var cards = isArtistList ? artistsList : isAlbumList ? albumsList : artistAlbumsList
    title = isArtistList
      ? t('v2.artists')
      : isAlbumList
        ? t('v2.albums')
        : (artistDetail && artistDetail.name) || t('v2.artists')
    count = cards.length
    resetKey = 'online-' + nav + ':' + provider + (nav === 'artist' ? ':' + browseId : '')
    if (browsePhase === 'loading' || browsePhase === 'idle') {
      body = h('div', { className: 'mp-empty' }, h(Spinner), h('span', null, t('v2.loading')))
    } else if (browsePhase === 'error') {
      body = h(Empty, { title: t('online.networkError'), icon: 'info' })
    } else if (cards.length === 0) {
      body = h(Empty, { title: t('page.noResults'), icon: isArtistList ? 'user' : 'disc' })
    } else {
      var openCard = isArtistList
        ? openArtistCard
        : function (card) {
            openAlbumCard(card)
          }
      body = h(
        ScrollBox,
        { resetKey: resetKey },
        h(
          'div',
          { className: 'mp-card-grid' },
          cards.map(function (card) {
            var cover = subsonicCoverUrl(card.coverArtId)
            return h(
              'button',
              {
                key: card.id,
                type: 'button',
                className: 'mp-card' + (isArtistList ? ' is-round' : ''),
                onClick: function () {
                  openCard(card)
                },
              },
              h(
                'div',
                { className: 'mp-card-art' },
                cover === ''
                  ? h('span', { className: 'mp-card-art-fallback' }, icon(isArtistList ? 'user' : 'disc', 22))
                  : h(Cover, { src: cover, iconSize: 22 }),
              ),
              h('div', { className: 'mp-card-title', title: card.name }, card.name || t('page.unknownAlbum')),
              h(
                'div',
                { className: 'mp-card-sub' },
                isArtistList
                  ? t('online.albumCount', { n: card.albumCount })
                  : isAlbumList
                    ? (card.artist || '') + (card.songCount > 0 ? ' · ' + t('page.trackCountUnit', { n: card.songCount }) : '')
                    : t('page.trackCountUnit', { n: card.songCount }),
              ),
            )
          }),
        ),
      )
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
        onAlbum: function (track) {
          void openOnlineAlbum(track)
        },
        onArtist: openArtist,
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
        onAlbum: function (track) {
          void openOnlineAlbum(track)
        },
        onArtist: openArtist,
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
    online.authExpired === provider
      ? h(
          'div',
          { className: 'mp-online-auth', key: 'auth', role: 'status' },
          h('span', { className: 'mp-online-auth-icon' }, icon('info', 16)),
          h(
            'div',
            { className: 'mp-online-auth-text' },
            h('div', { className: 'mp-online-auth-title' }, t('online.authExpired')),
            h('div', { className: 'mp-online-auth-hint' }, t('online.authExpiredHint')),
          ),
          h(
            'div',
            { className: 'mp-online-auth-actions' },
            h(
              'button',
              {
                type: 'button',
                className: 'mp-online-auth-btn',
                onClick: function () {
                  void loadMyPlaylists(provider)
                },
              },
              t('online.retry'),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'mp-online-auth-btn is-primary',
                onClick: reloginExpired,
              },
              t('online.relogin'),
            ),
          ),
        )
      : null,
    backActions.length > 0 || (actions && actions.length > 0)
      ? h(
          'div',
          { className: 'mp-toolbar', key: 'toolbar' },
          h('div', { className: 'mp-toolbar-left' }, backActions),
          actions && actions.length > 0
            ? h('div', { className: 'mp-toolbar-right' }, actions)
            : null,
        )
      : null,
    h('div', { className: 'mp-content-body', key: 'body', style: { display: 'contents' } }, body),
  ]
}





