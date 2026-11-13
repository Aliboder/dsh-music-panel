/**
 * local views: songs, albums, artists, folders, favorites, playlists, stats.
 *
 * One header + one toolbar + one scrolling body per view; the body is either
 * the shared virtual list or a plain scroll box for grids/statistics.
 */

function filterLabelOf(ui) {
  if (!ui.filter) return ''
  if (ui.filter.kind === 'album') return t('v2.albumFilter', { name: ui.filter.value })
  if (ui.filter.kind === 'artist') return t('v2.artistFilter', { name: ui.filter.value })
  return t('v2.folderFilter', { name: ui.filter.value })
}

function applyUiFilter(list, filter) {
  if (!filter) return list
  return list.filter(function (track) {
    if (filter.kind === 'album') return (track.album || t('page.unknownAlbum')) === filter.value
    if (filter.kind === 'artist') {
      var artistNames = trackArtistNames(track)
      if (artistNames.length === 0) artistNames = [t('page.unknownArtist')]
      return artistNames.indexOf(filter.value) >= 0
    }
    if (filter.kind === 'folder') return trackDirOf(track) === filter.value || track.folder === filter.value
    return true
  })
}

function groupTracks(list, keyOf) {
  var map = {}
  var order = []
  list.forEach(function (track) {
    var key = keyOf(track)
    if (!map[key]) {
      map[key] = { key: key, tracks: [] }
      order.push(key)
    }
    map[key].tracks.push(track)
  })
  return order.map(function (key) {
    return map[key]
  })
}

function playListFrom(list) {
  if (!list || list.length === 0) return
  player.playList(list, 0)
}

function shuffleListFrom(list) {
  if (!list || list.length === 0) return
  player.setOrder('random')
  player.playList(list, Math.floor(Math.random() * list.length))
}

function sortSelect(prefs) {
  return h(
    'select',
    {
      className: 'mp-chip',
      value: prefs.sortBy,
      title: t('page.sort'),
      'aria-label': t('page.sort'),
      onChange: function (event) {
        setPrefs({ sortBy: event.target.value })
      },
    },
    h('option', { value: 'title' }, t('v2.sortTitle')),
    h('option', { value: 'artist' }, t('v2.sortArtist')),
    h('option', { value: 'duration' }, t('v2.sortDuration')),
    h('option', { value: 'added' }, t('v2.sortAdded')),
    h('option', { value: 'recent' }, t('v2.sortRecent')),
  )
}

function LocalContent(props) {
  var ui = props.ui
  var library = props.library
  var prefs = props.prefs
  var favorites = props.favoriteSet
  var allTracks = library.tracks || []
  var visible = []
  var title = ''
  var count = 0
  var actions = null
  var toolbarExtras = []
  var body = null
  var empty = null
  var selectionList = []
  var playAll = null
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
  var duplicateGroups = useMemo(
    function () {
      if (ui.source !== 'local' || ui.nav !== 'songs' || ui.filter || ui.query !== '') return []
      return duplicateGroupsOf(library.tracks || [])
    },
    [ui.source, ui.nav, ui.filter, ui.query, library.tracks],
  )

  function selectTrack(track, additive) {
    selectTrackIn(selectionList, track, additive)
  }

  function listFor(view) {
    var base = allTracks
    if (view === 'favorites') {
      base = allTracks.filter(function (track) {
        return favorites[track.path] === true
      })
    } else if (view === 'playlist') {
      base = playlistTracks(playlistById(ui.playlistId))
    }
    base = applyUiFilter(base, ui.filter)
    return sortTracks(filterTracks(base, ui.query), prefs.sortBy, prefs.sortDir)
  }

  function trackBody(list, resetKey) {
    return h(TrackListBody, {
      items: list,
      resetKey: resetKey,
      focusPath: props.locatePath || '',
      currentPath: props.currentPath,
      playing: props.playing,
      favoriteSet: favorites,
      selectionMode: selecting,
      selectedSet: selectedSet,
      onToggleSelect: function (path) {
        toggleSelected(path)
      },
      onSelect: selectTrack,
      onPlay: function (track) {
        var index = list.indexOf(track)
        player.playList(list, index < 0 ? 0 : index)
      },
      onMenu: function (track, event) {
        props.onMenu(track, event, {
          visiblePaths: list.map(function (item) {
            return item.path
          }),
        })
      },
      onToggleFavorite: props.onToggleFavorite,
      onAlbum: function (track) {
        if (!track || !track.album) return
        setUi({ nav: 'songs', filter: { kind: 'album', value: track.album }, query: '' })
      },
      onArtist: function (track, artist) {
        if (!track || !String(artist || '').trim()) return
        setUi({ nav: 'songs', filter: { kind: 'artist', value: artist }, query: '' })
      },
      empty: empty,
    })
  }

  if (ui.nav === 'songs' || ui.nav === 'favorites' || ui.nav === 'playlist') {
    visible = listFor(ui.nav)
    selectionList = visible
    playAll = visible.length
      ? function () {
          playListFrom(visible)
        }
      : null
    title = ui.filter
      ? ui.filter.value
      : ui.nav === 'favorites'
        ? t('v2.favorites')
        : ui.nav === 'playlist'
          ? (playlistById(ui.playlistId) || {}).name || t('v2.playlists')
          : t('v2.allSongs')
    count = visible.length
    toolbarExtras = []
    if (ui.filter) {
      toolbarExtras.push(
        h(
          'button',
          {
            key: 'clear',
            type: 'button',
            className: 'mp-chip',
            onClick: function () {
              setUi({ filter: null })
            },
          },
          icon('x', 12),
          t('v2.clearFilter'),
        ),
      )
    }
    if (ui.query !== '') {
      toolbarExtras.push(
        h(
          'button',
          {
            key: 'clearq',
            type: 'button',
            className: 'mp-chip',
            onClick: function () {
              setUi({ query: '' })
            },
          },
          icon('x', 12),
          t('page.clearFilter') || t('v2.clearFilter'),
        ),
      )
    }
    if (duplicateGroups.length > 0 && !selecting) {
      toolbarExtras.push(
        h(
          'button',
          {
            key: 'dupes',
            type: 'button',
            className: 'mp-chip',
            onClick: function () {
              pushLayer('duplicates', { groups: duplicateGroups })
            },
          },
          icon('info', 13),
          t('page.duplicates', { n: duplicateGroups.length }),
        ),
      )
    }
    empty =
      ui.nav === 'favorites'
        ? h(Empty, { title: t('v2.noFavorites'), hint: t('v2.noFavoritesHint'), icon: 'heart' })
        : ui.nav === 'playlist'
          ? h(Empty, { title: t('v2.noPlaylistTracks'), hint: t('page.playlistNoTracksHint'), icon: 'list' })
          : ui.query !== '' || ui.filter
            ? h(Empty, { title: t('page.noResults'), hint: '', icon: 'search' })
            : h(Empty, { title: t('v2.noTracks'), hint: t('v2.noTracksHint'), icon: 'note' })
    body = trackBody(visible, [ui.source, ui.nav, ui.playlistId, ui.filter ? ui.filter.kind + ':' + ui.filter.value : '', ui.query].join('|'))
  } else if (ui.nav === 'albums') {
    var albums = groupTracks(filterTracks(applyUiFilter(allTracks, ui.filter), ui.query), function (track) {
      return track.album || t('page.unknownAlbum')
    })
    count = albums.length
    title = t('v2.albums')
    body = h(
      ScrollBox,
      { resetKey: 'albums:' + ui.query },
      albums.map(function (group) {
        var coverTrack = group.tracks.find(function (track) {
          return track.hasCover === true
        })
        return h(
          'button',
          {
            key: group.key,
            type: 'button',
            className: 'mp-srow',
            onClick: function () {
              setUi({ nav: 'songs', filter: { kind: 'album', value: group.key } })
            },
          },
          h(
            'div',
            { className: 'mp-srow-cover' },
            h(Cover, { src: coverTrack ? trackCoverSrc(coverTrack) : '', iconSize: 18 }),
          ),
          h(
            'div',
            { className: 'mp-srow-main' },
            h('div', { className: 'mp-srow-title' }, group.key),
            h('div', { className: 'mp-srow-sub' }, (group.tracks[0].artist || '') + ' · ' + group.tracks.length),
          ),
          h('div', { className: 'mp-srow-meta' }, String(group.tracks.length)),
          icon('chevronRight', 14),
        )
      }),
    )
    empty = h(Empty, { title: t('page.noResults'), icon: 'disc' })
  } else if (ui.nav === 'artists' || ui.nav === 'folders') {
    var isArtists = ui.nav === 'artists'
    var groupedTracks = filterTracks(allTracks, ui.query)
    var groups
    if (isArtists) {
      var artistGroups = {}
      groupedTracks.forEach(function (track) {
        var names = trackArtistNames(track)
        if (names.length === 0) names = [t('page.unknownArtist')]
        names.forEach(function (name) {
          if (!artistGroups[name]) artistGroups[name] = []
          artistGroups[name].push(track)
        })
      })
      groups = Object.keys(artistGroups).map(function (key) {
        return { key: key, tracks: artistGroups[key] }
      })
    } else {
      groups = groupTracks(groupedTracks, trackDirOf)
    }
    groups.sort(function (left, right) {
      return String(left.key).localeCompare(String(right.key), 'zh')
    })
    count = groups.length
    title = isArtists ? t('v2.artists') : t('v2.folders')
    if (!isArtists) {
      toolbarExtras = [
        h(
          Button,
          {
            key: 'add-folder',
            icon: 'plus',
            onClick: function () {
              pushLayer('folderPicker')
            },
          },
          t('v2.folderAdd'),
        ),
      ]
    }
    body = h(
      ScrollBox,
      { resetKey: ui.nav + ':' + ui.query },
      groups.map(function (group) {
        var coverTrack = group.tracks.find(function (track) {
          return track.hasCover === true
        })
        return h(
          'button',
          {
            key: group.key,
            type: 'button',
            className: 'mp-srow',
            onClick: function () {
              setUi({
                nav: 'songs',
                filter: isArtists ? { kind: 'artist', value: group.key } : { kind: 'folder', value: group.key },
              })
            },
          },
          isArtists
            ? h(
                'div',
                { className: 'mp-srow-cover is-round' },
                h(Cover, { src: coverTrack ? trackCoverSrc(coverTrack) : '', iconSize: 18 }),
              )
            : h('div', { className: 'mp-srow-cover' }, icon('folder', 18)),
          h(
            'div',
            { className: 'mp-srow-main' },
            h('div', { className: 'mp-srow-title' }, isArtists ? group.key : folderNameOf(group.key)),
            isArtists
              ? h('div', { className: 'mp-srow-sub' }, group.tracks.length + ' · ' + t('v2.songs'))
              : h('div', { className: 'mp-srow-sub' }, group.key),
          ),
          h('div', { className: 'mp-srow-meta' }, String(group.tracks.length)),
          icon('chevronRight', 14),
        )
      }),
    )
    empty = h(Empty, { title: t('page.noResults'), icon: isArtists ? 'user' : 'folder' })
  } else if (ui.nav === 'playlists') {
    var playlists = library.playlists || []
    count = playlists.length
    title = t('v2.playlists')
    actions = [
      h(
        Button,
        {
          key: 'new',
          variant: 'primary',
          icon: 'plus',
          onClick: function () {
            pushLayer('newPlaylist')
          },
        },
        t('v2.newPlaylist'),
      ),
    ]
    body = h(
      ScrollBox,
      { resetKey: 'playlists' },
      playlists.length === 0
        ? h(Empty, { title: t('v2.noPlaylists'), hint: t('page.playlistEmptyHint'), icon: 'list' })
        : playlists.map(function (playlist) {
            var coverTrack = (playlistTracks(playlist)[0] || null)
            return h(
              'div',
              {
                key: playlist.id,
                role: 'button',
                tabIndex: 0,
                className: 'mp-srow',
                onClick: function () {
                  openLocalPlaylist(playlist.id)
                },
                onKeyDown: function (event) {
                  if (event.key === 'Enter') openLocalPlaylist(playlist.id)
                },
              },
              h(
                'div',
                { className: 'mp-srow-cover' },
                coverTrack ? h(Cover, { src: trackCoverSrc(coverTrack), iconSize: 18 }) : icon('list', 18),
              ),
              h(
                'div',
                { className: 'mp-srow-main' },
                h('div', { className: 'mp-srow-title' }, playlist.name),
                h('div', { className: 'mp-srow-sub' }, (playlist.trackPaths || []).length + ' · ' + t('v2.songs')),
              ),
              h(
                'span',
                { className: 'mp-srow-meta' },
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'mp-iconbtn',
                    title: t('page.delete'),
                    onClick: function (event) {
                      event.stopPropagation()
                      pushLayer('confirm', {
                        title: t('page.delete'),
                        text: t('page.deleteConfirm', { name: playlist.name }),
                        onConfirm: function () {
                          void removePlaylist(playlist.id)
                        },
                      })
                    },
                  },
                  icon('trash', 14),
                ),
              ),
              icon('chevronRight', 14),
            )
          }),
    )
  } else if (ui.nav === 'stats') {
    title = t('v2.stats')
    count = 0
    var stats = library.stats || {}
    var entries = Object.keys(stats)
      .map(function (path) {
        var track = trackByPath(path)
        if (!track) return null
        var item = stats[path] || {}
        return { track: track, plays: item.plays || 0, seconds: item.playSeconds || 0 }
      })
      .filter(Boolean)
      .sort(function (left, right) {
        return right.seconds - left.seconds
      })
    var totalSeconds = entries.reduce(function (sum, entry) {
      return sum + entry.seconds
    }, 0)
    var totalPlays = entries.reduce(function (sum, entry) {
      return sum + entry.plays
    }, 0)
    var topSeconds = entries.length > 0 ? entries[0].seconds : 1
    toolbarExtras = [
      ['all', 'v2.rangeAll'],
      ['week', 'v2.rangeWeek'],
      ['month', 'v2.rangeMonth'],
    ].map(function (item) {
      return h(
        'button',
        {
          key: item[0],
          type: 'button',
          className: cx('mp-chip', library.statsRange === item[0] && 'is-on'),
          onClick: function () {
            void loadStats(item[0])
          },
        },
        t(item[1]),
      )
    })
    body = h(
      ScrollBox,
      { resetKey: 'stats:' + library.statsRange },
      h(
        'div',
        { className: 'mp-stat-cards' },
        h(
          'div',
          { className: 'mp-stat-card' },
          h('div', { className: 'mp-stat-k' }, t('v2.listenTime')),
          h('div', { className: 'mp-stat-v' }, Math.floor(totalSeconds / 3600) + ' h ' + Math.floor((totalSeconds % 3600) / 60) + ' m'),
        ),
        h(
          'div',
          { className: 'mp-stat-card' },
          h('div', { className: 'mp-stat-k' }, t('v2.totalPlays')),
          h('div', { className: 'mp-stat-v' }, String(totalPlays)),
        ),
        h(
          'div',
          { className: 'mp-stat-card' },
          h('div', { className: 'mp-stat-k' }, t('v2.trackedTracks')),
          h('div', { className: 'mp-stat-v' }, String(entries.length)),
        ),
      ),
      h(
        'div',
        { className: 'mp-rank' },
        entries.slice(0, 12).map(function (entry, index) {
          return h(
            'div',
            {
              key: entry.track.path,
              className: 'mp-rank-row',
              onClick: function () {
                player.playList(
                  entries.map(function (item) {
                    return item.track
                  }),
                  index,
                )
              },
            },
            h('div', { className: 'mp-rank-n' }, String(index + 1)),
            h('div', { className: 'mp-rank-c' }, h(Cover, { src: trackCoverSrc(entry.track), iconSize: 12 })),
            h(
              'div',
              { className: 'mp-rank-m' },
              h('div', { className: 'mp-row-title' }, trackTitleOf(entry.track)),
              h('div', { className: 'mp-row-sub' }, trackArtistOf(entry.track)),
            ),
            h(
              'div',
              { className: 'mp-rank-bar' },
              h('i', { style: { width: Math.round((entry.seconds / (topSeconds || 1)) * 100) + '%' } }),
            ),
            h('div', { className: 'mp-row-time' }, entry.plays + ' · ' + Math.floor(entry.seconds / 60) + 'm'),
          )
        }),
      ),
    )
  } else {
    title = t('v2.allSongs')
    body = h(Empty, { title: t('page.noResults'), icon: 'note' })
  }

  return [
    h(ContentHeader, {
      key: 'head',
      title: title,
      count: count,
      onAll: function () {
        selectAllIn(selectionList)
      },
      onNone: function () {
        setSelectionMode(false)
      },
      onRange: beginRangePick,
      onInvert: function () {
        invertSelectionIn(selectionList)
      },
      selecting: selecting,
      selectedCount: selection.paths.length,
    }),
    toolbarExtras.length > 0
      ? h(
          'div',
          { className: 'mp-toolbar', key: 'toolbar' },
          toolbarExtras,
        )
      : null,
    h('div', { className: 'mp-content-body', key: 'body', style: { display: 'contents' } }, body),
  ]
}







