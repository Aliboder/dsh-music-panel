/**
 * track row / card: one renderer for local tracks, online results and queue
 * rows (the queue uses a compact variant in 05-queue).
 */

function trackTitleOf(track) {
  if (!track) return ''
  return track.title || stemOf(track.path || '') || basename(track.path || '')
}

function trackArtistOf(track) {
  if (!track) return ''
  return track.artist || t('page.unknownArtist')
}

function TrackRow(props) {
  var track = props.track
  var current = props.currentPath !== '' && props.currentPath === track.path
  var online = typeof track.onlineProvider === 'string' && track.onlineProvider !== ''
  var vip = track.qualityHint === 'VIP'
  var selecting = props.selectionMode === true
  var selected = props.selected === true

  function play() {
    if (props.onPlay) props.onPlay(track)
  }

  // Single click selects, double click plays (the old 0.11 interaction).
  // The checkbox / Ctrl-click is the additive path.
  function handleClick(event) {
    if (event && event.detail > 1) return
    if (props.onSelect) {
      props.onSelect(track, event ? event.ctrlKey || event.metaKey : false)
      return
    }
    if (selecting) {
      if (props.onToggleSelect) props.onToggleSelect(track.path)
      return
    }
    play()
  }

  return h(
    'div',
    {
      className: cx('mp-row', current && 'is-cur', selected && 'is-selected'),
      role: 'row',
      tabIndex: 0,
      'aria-selected': selected ? 'true' : 'false',
      'aria-label': trackTitleOf(track) + ' · ' + trackArtistOf(track),
      onClick: handleClick,
      onDoubleClick: play,
      onContextMenu: function (event) {
        event.preventDefault()
        if (props.onMenu) props.onMenu(track, event)
      },
      onKeyDown: function (event) {
        if (event.key === 'Enter') play()
      },
    },
    h(
      'div',
      { className: 'mp-row-cover' },
      h(Cover, { src: trackCoverSrc(track), iconSize: 15 }),
      h(
        'button',
        {
          type: 'button',
          className: 'mp-cover-play',
          title: t('page.play'),
          onClick: function (event) {
            event.stopPropagation()
            play()
          },
          onDoubleClick: function (event) {
            event.stopPropagation()
          },
        },
        icon('play', 15),
      ),
    ),
    h(
      'div',
      { className: 'mp-row-main' },
      h(
        'div',
        { className: 'mp-row-title' },
        trackTitleOf(track),
        vip ? h('span', { className: 'mp-badge is-vip' }, 'VIP') : null,
        online && props.cached === true
          ? h('span', { className: 'mp-badge is-cache', title: t('v2.cached') }, icon('download', 10))
          : null,
        current && props.playing === true
          ? h('span', { className: 'mp-eq' }, [h('i', { key: 1 }), h('i', { key: 2 }), h('i', { key: 3 })])
          : null,
      ),
      h(
        'div',
        { className: 'mp-row-sub' },
        props.onArtist && trackArtistNames(track).length > 0
          ? h(
              'span',
              { className: 'mp-artist-links' },
              trackArtistNames(track).map(function (name, index) {
                return h(
                  'span',
                  { key: name, className: 'mp-artist-piece' },
                  index > 0 ? h('span', { className: 'mp-artist-sep' }, ' / ') : null,
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'mp-artist-link',
                      title: name,
                      onClick: function (event) {
                        event.stopPropagation()
                        props.onArtist(track, name)
                      },
                      onDoubleClick: function (event) {
                        event.stopPropagation()
                      },
                    },
                    name,
                  ),
                )
              }),
            )
          : trackArtistOf(track),
        props.onAlbum && track.album
          ? h(
              'span',
              { className: 'mp-row-sub-album' },
              ' · ',
              h(
                'button',
                {
                  type: 'button',
                  className: 'mp-album-link',
                  title: track.album,
                  onClick: function (event) {
                    event.stopPropagation()
                    props.onAlbum(track)
                  },
                  onDoubleClick: function (event) {
                    event.stopPropagation()
                  },
                },
                track.album,
              ),
            )
          : null,
      ),
    ),
    h(
      'div',
      { className: 'mp-row-album' },
      props.onAlbum && track.album
        ? h(
            'button',
            {
              type: 'button',
              className: 'mp-album-link',
              title: track.album,
              onClick: function (event) {
                event.stopPropagation()
                props.onAlbum(track)
              },
              onDoubleClick: function (event) {
                event.stopPropagation()
              },
            },
            track.album,
          )
        : track.album || '',
    ),
    h('div', { className: 'mp-row-time' }, fmtTime(track.durationSec)),
    h(
      'div',
      { className: 'mp-row-acts' },
      h(IconButton, {
            icon: props.favorite === true ? 'heartFill' : 'heart',
            size: 15,
            className: 'mp-fav',
            active: props.favorite === true,
            title: props.favorite === true ? t('page.unfavorite') : t('page.favorite'),
            onClick: function (event) {
              event.stopPropagation()
              if (props.onToggleFavorite) props.onToggleFavorite(track)
            },
          }),
    ),
    h(
      'div',
      { className: 'mp-row-acts' },
      selecting
        ? h(
            'button',
            {
              type: 'button',
              className: cx('mp-row-check', selected && 'is-on'),
              title: t('page.select'),
              onClick: function (event) {
                event.stopPropagation()
                if (props.onToggleSelect) props.onToggleSelect(track.path)
              },
            },
            selected ? icon('check', 12) : null,
          )
        : h(IconButton, {
            icon: 'more',
            size: 15,
            title: t('page.more'),
            onClick: function (event) {
              event.stopPropagation()
              if (props.onMenu) props.onMenu(track, event)
            },
          }),
    ),
  )
}

var SCROLL_MEMORY = {}

function TrackListBody(props) {
  var key = props.resetKey || 'tracks'
  return h(VirtualList, {
    className: 'mp-scroll',
    items: props.items || [],
    rowHeight: 72,
    resetKey: key,
    focusPath: props.focusPath || '',
    initialScroll: SCROLL_MEMORY[key] || 0,
    onScrollTop: function (top) {
      SCROLL_MEMORY[key] = top
    },
    itemKey: function (track, index) {
      return track.path + ':' + index
    },
    empty: props.empty,
    renderRow: function (track) {
      return h(TrackRow, {
        track: track,
        currentPath: props.currentPath || '',
        playing: props.playing === true,
        favorite: props.favoriteSet ? props.favoriteSet[track.path] === true : false,
        cached: props.cachedOf ? props.cachedOf(track) === true : false,
        selectionMode: props.selectionMode === true,
        selected: props.selectedSet ? props.selectedSet[track.path] === true : false,
        onToggleSelect: props.onToggleSelect,
        onSelect: props.onSelect,
        onPlay: props.onPlay,
        onMenu: props.onMenu,
        onToggleFavorite: props.onToggleFavorite,
        onAlbum: props.onAlbum,
        onArtist: props.onArtist,
      })
    },
  })
}

function ScrollBox(props) {
  var key = props.resetKey || 'box'
  var ref = useRef(null)
  useEffect(
    function () {
      var element = ref.current
      if (element === null) return undefined
      element.scrollTop = SCROLL_MEMORY[key] || 0
      function onScroll() {
        SCROLL_MEMORY[key] = element.scrollTop
      }
      element.addEventListener('scroll', onScroll, { passive: true })
      return function () {
        element.removeEventListener('scroll', onScroll)
      }
    },
    [key],
  )
  return h('div', { className: 'mp-scroll', ref: ref }, props.children)
}









