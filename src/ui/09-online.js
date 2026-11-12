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
  // Library-wide song list (Navidrome only; other providers return none).
  var songsPair = useState(null)
  var songsList = songsPair[0]
  var setSongsList = songsPair[1]
  var songsPhasePair = useState('idle')
  var songsPhase = songsPhasePair[0]
  var setSongsPhase = songsPhasePair[1]
  // Artists / albums browse (Navidrome only). One phase drives all four views;
  // the lists and the two detail payloads are separate so each render branch
  // reads only what it needs.
  var browsePhasePair = useState('idle')
  var browsePhase = browsePhasePair[0]
  var setBrowsePhase = browsePhasePair[1]
  var artistsPair = useState([])
  var artistsList = artistsPair[0]
  var setArtistsList = artistsPair[1]
  var albumsPair = useState([])
  var albumsList = albumsPair[0]
  var setAlbumsList = albumsPair[1]
  var albumPair = useState(null)
  var albumDetail = albumPair[0]
  var setAlbumDetail = albumPair[1]
  var albumSongsPair = useState([])
  var albumSongsList = albumSongsPair[0]
  var setAlbumSongsList = albumSongsPair[1]
  var artistPair = useState(null)
  var artistDetail = artistPair[0]
  var setArtistDetail = artistPair[1]
  var artistAlbumsPair = useState([])
  var artistAlbumsList = artistAlbumsPair[0]
  var setArtistAlbumsList = artistAlbumsPair[1]
  var browseId = online.browseId || ''
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
      pushLayer('login', { provider: provider, mode: 'qq' })
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
      getJson(API + 'online/songs?provider=' + encodeURIComponent(provider) + '&size=200')
        .then(function (body) {
          if (cancelled) return
          setSongsList(Array.isArray(body.songs) ? body.songs : [])
          setSongsPhase('ready')
        })
        .catch(function () {
          if (cancelled) return
          setSongsList([])
          setSongsPhase('error')
        })
      return function () {
        cancelled = true
      }
    },
    [nav, provider],
  )

  useEffect(
    function () {
      if (nav !== 'artists' && nav !== 'albums' && nav !== 'album' && nav !== 'artist') {
        setBrowsePhase('idle')
        return undefined
      }
      var cancelled = false
      setBrowsePhase('loading')

      var url = ''
      if (nav === 'artists') url = API + 'online/artists?provider=' + encodeURIComponent(provider)
      else if (nav === 'albums') url = API + 'online/albums?provider=' + encodeURIComponent(provider) + '&size=200'
      else if (nav === 'album') url = API + 'online/album?provider=' + encodeURIComponent(provider) + '&id=' + encodeURIComponent(browseId)
      else url = API + 'online/artist?provider=' + encodeURIComponent(provider) + '&id=' + encodeURIComponent(browseId)

      getJson(url)
        .then(function (body) {
          if (cancelled) return
          if (nav === 'artists') setArtistsList(Array.isArray(body.artists) ? body.artists : [])
          if (nav === 'albums') setAlbumsList(Array.isArray(body.albums) ? body.albums : [])
          if (nav === 'album') {
            setAlbumDetail(body.album || null)
            setAlbumSongsList(Array.isArray(body.songs) ? body.songs : [])
          }
          if (nav === 'artist') {
            setArtistDetail(body.artist || null)
            setArtistAlbumsList(Array.isArray(body.albums) ? body.albums : [])
          }
          setBrowsePhase('ready')
        })
        .catch(function () {
          if (cancelled) return
          if (nav === 'artists') setArtistsList([])
          if (nav === 'albums') setAlbumsList([])
          if (nav === 'album') {
            setAlbumDetail(null)
            setAlbumSongsList([])
          }
          if (nav === 'artist') {
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

  function openOnlineAlbum(album) {
    onlineStore.set({ browseId: String((album && album.id) || '') })
    uiStore.set({ nav: 'album', filter: null, query: '' })
  }

  function openOnlineArtist(artist) {
    onlineStore.set({ browseId: String((artist && artist.id) || '') })
    uiStore.set({ nav: 'artist', filter: null, query: '' })
  }

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
        onAlbum: function (track) {
          void openOnlineAlbum(track)
        },
        empty: empty,
      })
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
      body = h(TrackListBody, {
        items: (setPlayAll(albumSongs), (onlineSelectionList = sortOnlineTracks(albumSongs))),
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
        onAlbum: function (track) {
          void openOnlineAlbum(track)
        },
      })
    }
  } else if (nav === 'songs') {
    // Library-wide browse. Subsonic has no stable "all songs" index, so the
    // host returns getRandomSongs: a sample of the library, not a fixed list.
    title = t('v2.songs')
    var allSongs = songsList || []
    count = allSongs.length
    resetKey = 'online-songs:' + provider
    if (songsPhase === 'loading' || songsPhase === 'idle') {
      body = h('div', { className: 'mp-empty' }, h(Spinner), h('span', null, t('v2.loading')))
    } else if (songsPhase === 'error') {
      body = h(Empty, { title: t('online.networkError'), icon: 'info' })
    } else if (allSongs.length === 0) {
      body = h(Empty, { title: t('online.allSongsEmpty'), hint: t('online.allSongsEmptyHint'), icon: 'note' })
    } else {
      body = h(TrackListBody, {
        items: (setPlayAll(allSongs), (onlineSelectionList = sortOnlineTracks(allSongs))),
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
        empty: empty,
      })
    }
  } else if (nav === 'artists') {
    title = t('v2.artists')
    count = artistsList.length
    resetKey = 'online-artists:' + provider
    if (browsePhase === 'loading' || browsePhase === 'idle') {
      body = h('div', { className: 'mp-empty' }, h(Spinner), h('span', null, t('v2.loading')))
    } else if (browsePhase === 'error') {
      body = h(Empty, { title: t('online.networkError'), icon: 'info' })
    } else if (artistsList.length === 0) {
      body = h(Empty, { title: t('page.noResults'), icon: 'user' })
    } else {
      body = h(
        ScrollBox,
        { resetKey: resetKey },
        artistsList.map(function (artist) {
          var cover = subsonicCoverUrl(artist.coverArtId)
          return h(
            'button',
            {
              key: artist.id,
              type: 'button',
              className: 'mp-srow',
              onClick: function () {
                openOnlineArtist(artist)
              },
            },
            h(
              'div',
              { className: 'mp-srow-cover is-round' },
              cover === '' ? icon('user', 18) : h(Cover, { src: cover, iconSize: 18 }),
            ),
            h(
              'div',
              { className: 'mp-srow-main' },
              h('div', { className: 'mp-srow-title' }, artist.name || t('page.unknownArtist')),
              h('div', { className: 'mp-srow-sub' }, t('online.albumCount', { n: artist.albumCount })),
            ),
            h('div', { className: 'mp-srow-meta' }, String(artist.albumCount)),
            icon('chevronRight', 14),
          )
        }),
      )
    }
  } else if (nav === 'albums') {
    title = t('v2.albums')
    count = albumsList.length
    resetKey = 'online-albums:' + provider
    if (browsePhase === 'loading' || browsePhase === 'idle') {
      body = h('div', { className: 'mp-empty' }, h(Spinner), h('span', null, t('v2.loading')))
    } else if (browsePhase === 'error') {
      body = h(Empty, { title: t('online.networkError'), icon: 'info' })
    } else if (albumsList.length === 0) {
      body = h(Empty, { title: t('page.noResults'), icon: 'disc' })
    } else {
      body = h(
        ScrollBox,
        { resetKey: resetKey },
        albumsList.map(function (album) {
          var cover = subsonicCoverUrl(album.coverArtId)
          return h(
            'button',
            {
              key: album.id,
              type: 'button',
              className: 'mp-srow',
              onClick: function () {
                openOnlineAlbum(album)
              },
            },
            h('div', { className: 'mp-srow-cover' }, cover === '' ? icon('disc', 18) : h(Cover, { src: cover, iconSize: 18 })),
            h(
              'div',
              { className: 'mp-srow-main' },
              h('div', { className: 'mp-srow-title' }, album.name || t('page.unknownAlbum')),
              h('div', { className: 'mp-srow-sub' }, (album.artist || '') + ' · ' + t('page.trackCountUnit', { n: album.songCount })),
            ),
            h('div', { className: 'mp-srow-meta' }, String(album.songCount)),
            icon('chevronRight', 14),
          )
        }),
      )
    }
  } else if (nav === 'artist') {
    title = (artistDetail && artistDetail.name) || t('v2.artists')
    count = artistAlbumsList.length
    resetKey = 'online-artist:' + provider + ':' + browseId
    if (browsePhase === 'loading' || browsePhase === 'idle') {
      body = h('div', { className: 'mp-empty' }, h(Spinner), h('span', null, t('v2.loading')))
    } else if (browsePhase === 'error') {
      body = h(Empty, { title: t('online.networkError'), icon: 'info' })
    } else if (artistAlbumsList.length === 0) {
      body = h(Empty, { title: t('page.noResults'), icon: 'disc' })
    } else {
      body = h(
        ScrollBox,
        { resetKey: resetKey },
        artistAlbumsList.map(function (album) {
          var cover = subsonicCoverUrl(album.coverArtId)
          return h(
            'button',
            {
              key: album.id,
              type: 'button',
              className: 'mp-srow',
              onClick: function () {
                openOnlineAlbum(album)
              },
            },
            h('div', { className: 'mp-srow-cover' }, cover === '' ? icon('disc', 18) : h(Cover, { src: cover, iconSize: 18 })),
            h(
              'div',
              { className: 'mp-srow-main' },
              h('div', { className: 'mp-srow-title' }, album.name || t('page.unknownAlbum')),
              h('div', { className: 'mp-srow-sub' }, t('page.trackCountUnit', { n: album.songCount })),
            ),
            h('div', { className: 'mp-srow-meta' }, album.year > 0 ? String(album.year) : ''),
            icon('chevronRight', 14),
          )
        }),
      )
    }
  } else if (nav === 'album') {
    title = (albumDetail && albumDetail.name) || t('v2.albums')
    count = albumSongsList.length
    resetKey = 'online-album:' + provider + ':' + browseId
    if (browsePhase === 'loading' || browsePhase === 'idle') {
      body = h('div', { className: 'mp-empty' }, h(Spinner), h('span', null, t('v2.loading')))
    } else if (browsePhase === 'error') {
      body = h(Empty, { title: t('online.networkError'), icon: 'info' })
    } else if (albumSongsList.length === 0) {
      body = h(Empty, { title: t('page.noResults'), icon: 'note' })
    } else {
      // Keep the album's own running order. Navidrome returns tracks in
      // disc/track sequence, so re-applying the user's sort preference (title,
      // duration…) would scramble the album. Playback below uses the same
      // array, so the queue matches what is on screen.
      var albumOrder = albumSongsList.map(onlineTrackOf)
      body = h(TrackListBody, {
        items: (setPlayAll(albumSongsList), (onlineSelectionList = albumOrder)),
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
          var index = albumSongsList.findIndex(function (item) {
            return 'online:' + item.provider + ':' + item.id === track.path
          })
          playOnlineResults(albumSongsList, index < 0 ? 0 : index)
        },
        onMenu: function (track, event) {
          props.onMenu(track, event, { playSelected: playSelectedOnline })
        },
        onToggleFavorite: toggleOnlineFavorite,
        empty: empty,
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
        onAlbum: function (track) {
          void openOnlineAlbum(track)
        },
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
    actions && actions.length > 0
      ? h(
          'div',
          { className: 'mp-toolbar', key: 'toolbar' },
          h(
            'div',
            { style: { marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' } },
            actions,
          ),
        )
      : null,
    h('div', { className: 'mp-content-body', key: 'body', style: { display: 'contents' } }, body),
  ]
}





