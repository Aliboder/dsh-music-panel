/**
 * panel: the single composition point (top bar, workspace, player bar, layers).
 */

class MusicBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch() {
    // A broken render must never take the host UI down with it.
  }

  render() {
    if (this.state.failed) return null
    return this.props.children
  }
}

class SilentBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch() {}

  render() {
    if (this.state.failed) return null
    return this.props.children
  }
}

function TopBar(props) {
  var ui = props.ui
  var online = props.online
  var inputRef = useRef(null)
  var textPair = useState(ui.source === 'local' ? ui.query : '')
  var text = textPair[0]
  var setText = textPair[1]

  useEffect(
    function () {
      setText(ui.source === 'local' ? ui.query : '')
    },
    [ui.source],
  )

  useEffect(
    function () {
      function onKey(event) {
        var tag = event.target && event.target.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
        if (event.key === '/') {
          event.preventDefault()
          if (inputRef.current) inputRef.current.focus()
        }
      }
      window.addEventListener('keydown', onKey)
      return function () {
        window.removeEventListener('keydown', onKey)
      }
    },
    [],
  )

  function submit() {
    if (isOnlineSource(ui.source)) {
      void searchOnline(text)
    }
  }

  var providerInfo = isOnlineSource(ui.source) ? (online.providers[ui.source] || {}) : null

  return h(
    'header',
    { className: 'mp-topbar' },
    h('div', { className: 'mp-brand' }, h('span', { className: 'mp-brand-dot' }, h('img', { className: 'mp-brand-logo', src: BRAND_LOGO, alt: '' })), t('nav.label')),
    h(
      'div',
      { className: 'mp-src-tabs', role: 'tablist' },
      [
        ['local', t('page.tabLocal')],
        ['netease', t('online.providerNetease')],
        ['qq', t('online.providerQq')],
        ['kugou', t('online.providerKugou')],
      ].map(function (entry) {
        return h(
          'button',
          {
            key: entry[0],
            type: 'button',
            role: 'tab',
            'aria-selected': ui.source === entry[0],
            className: cx('mp-src-tab', ui.source === entry[0] && 'is-on'),
            onClick: function () {
              setSource(entry[0])
            },
          },
          entry[1],
        )
      }),
    ),
    h(
      'div',
      { className: 'mp-search' },
      icon('search', 14),
      h('input', {
        ref: inputRef,
        className: 'mp-search-input',
        type: 'search',
        value: text,
        placeholder: isOnlineSource(ui.source) ? t('online.searchPlaceholder') : t('page.searchPlaceholder'),
        onChange: function (event) {
          var value = event.target.value
          setText(value)
          if (!isOnlineSource(ui.source)) {
            setUi({ query: value })
          } else if (value === '') {
            onlineStore.set({ query: '', results: [], phase: 'idle', error: '' })
          }
        },
        onKeyDown: function (event) {
          if (event.key === 'Enter') submit()
        },
      }),
    ),
    providerInfo !== null
      ? h(
          'div',
          { className: 'mp-userchip is-on' },
          h('span', { className: 'mp-userchip-dot' }),
          h('span', null, providerInfo.loggedIn ? providerInfo.nickname || t('online.loggedIn') : t('online.loggedOut')),
          providerInfo.loggedIn
            ? h(
                'span',
                {
                  className: 'mp-userchip-out',
                  role: 'button',
                  tabIndex: 0,
                  onClick: function () {
                    void logoutProvider(ui.source)
                  },
                },
                t('online.logout'),
              )
            : h(
                'span',
                {
                  className: 'mp-userchip-out',
                  role: 'button',
                  tabIndex: 0,
                  onClick: function () {
                    pushLayer('login', { provider: ui.source, mode: 'qq' })
                  },
                },
                t('online.login'),
              ),
        )
      : null,
    h(IconButton, {
      icon: 'refresh',
      title: t('page.refresh'),
      onClick: function () {
        if (isOnlineSource(ui.source)) {
          void loadProviders()
          void loadMyPlaylists(ui.source)
          showToast(t('online.refresh'))
        } else {
          void loadLibrary(true)
          showToast(t('page.scanning'))
        }
      },
    }),
    h(IconButton, {
      icon: 'settings',
      title: t('page.settings'),
      onClick: function () {
        pushLayer('settings')
      },
    }),
  )
}

function ContentArea(props) {
  if (isOnlineSource(props.ui.source)) return h(OnlineContent, props)
  return h(LocalContent, props)
}

function AudioHost() {
  var ref = useRef(null)
  useEffect(function () {
    player.attachAudio(ref.current)
    player.tryRestore()
    return function () {
      player.attachAudio(null)
    }
  }, [])
  return h('audio', { ref: ref, className: 'mp-audio-host', preload: 'metadata', 'aria-hidden': 'true' })
}

function applyControlAction(action) {
  if (!action || typeof action.action !== 'string') return
  if (action.action === 'pause') {
    player.pause()
    return
  }
  if (action.action === 'next') {
    player.next()
    return
  }
  if (action.action === 'previous' || action.action === 'prev') {
    player.prev()
    return
  }
  if (action.action !== 'play') return
  var query = String(action.query || '').trim()
  if (query === '') return
  var source =
    action.source === 'netease' || action.source === 'qq' || action.source === 'kugou'
      ? action.source
      : 'local'
  if (source === 'local') {
    var tracks = libraryStore.get().tracks
    var needle = query.toLowerCase()
    var hit = null
    for (var i = 0; i < tracks.length; i += 1) {
      var hay = (String(tracks[i].title || '') + ' ' + String(tracks[i].artist || '')).toLowerCase()
      if (hay.indexOf(needle) >= 0) {
        hit = tracks[i]
        break
      }
    }
    if (hit !== null) player.playList([hit], 0)
    return
  }
  getJson(API + 'online/search?provider=' + encodeURIComponent(source) + '&q=' + encodeURIComponent(query))
    .then(function (body) {
      var results = Array.isArray(body.results) ? body.results : []
      if (results.length > 0) playOnlineResults(results, 0)
    })
    .catch(function () {
      // The model action is best effort.
    })
}

function OverlayRoot() {
  var overlay = useStore(overlayStore)
  var layers = overlay.layers || []
  return layers.map(function (layer) {
    if (layer.kind === 'menu') return h(ContextMenu, { key: 'menu', layer: layer })
    if (layer.kind === 'login') return h(LoginDialog, { key: 'login', layer: layer })
    if (layer.kind === 'tag') return h(TagDialog, { key: 'tag', layer: layer })
    if (layer.kind === 'addTo') return h(AddToPlaylistDialog, { key: 'addTo', layer: layer })
    if (layer.kind === 'batchEdit') return h(BatchEditDialog, { key: 'batchEdit', layer: layer })
    if (layer.kind === 'duplicates') return h(DuplicatesDialog, { key: 'duplicates', layer: layer })
    if (layer.kind === 'onlineLyric') return h(OnlineLyricDialog, { key: 'onlineLyric', layer: layer })
    if (layer.kind === 'trash') return h(TrashDialog, { key: 'trash', layer: layer })
    if (layer.kind === 'confirm') return h(ConfirmDialog, { key: 'confirm', layer: layer })
    if (layer.kind === 'newPlaylist') return h(NewPlaylistDialog, { key: 'newPlaylist', layer: layer })
    if (layer.kind === 'folderPicker') return h(FolderPickerDialog, { key: 'folderPicker', layer: layer })
    if (layer.kind === 'onlineAddTo') return h(OnlineAddToDialog, { key: 'onlineAddTo', layer: layer })
    if (layer.kind === 'settings') {
      return h(SettingsSheet, {
        key: 'settings',
        open: true,
        onClose: function () {
          removeLayer('settings')
        },
      })
    }
    return null
  })
}

var BRAND_LOGO = 'data:image/webp;base64,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'

function Panel() {
  var ui = useStore(uiStore)
  var library = useStore(libraryStore)
  var online = useStore(onlineStore)
  var prefs = usePrefs()
  var snap = usePlayerSnapshot()
  var locatePair = useState('')
  var locatePath = locatePair[0]
  var setLocatePath = locatePair[1]
  var current = snap.queue[snap.index] || null
  var favorites = useMemo(function () {
    return favoriteSet()
  }, [library.favorites])
  var favoriteCount = library.favorites.length

  useEffect(
    function () {
      var deadline = Number(prefs.sleepDeadline) || 0
      var minutes = Number(prefs.sleepTimerMinutes) || 0
      if (deadline <= 0 && minutes > 0) {
        // Older prefs only stored minutes; turn them into a deadline once.
        setPrefs({ sleepDeadline: Date.now() + minutes * 60000 })
        return undefined
      }
      if (deadline <= 0) return undefined
      var delay = deadline - Date.now()
      if (delay <= 0) {
        player.pause()
        setPrefs({ sleepTimerMinutes: 0, sleepDeadline: 0 })
        showToast(t('settings.sleepTimerDone'))
        return undefined
      }
      var timer = setTimeout(function () {
        player.pause()
        setPrefs({ sleepTimerMinutes: 0, sleepDeadline: 0 })
        showToast(t('settings.sleepTimerDone'))
      }, delay)
      return function () {
        clearTimeout(timer)
      }
    },
    [prefs.sleepDeadline, prefs.sleepTimerMinutes],
  )

  useEffect(function () {
    void loadLibrary(false)
    void loadFavorites()
    void loadPlaylists()
    void loadConfig()
    void loadProviders()
  }, [])

  useEffect(
    function () {
      if (isOnlineSource(ui.source)) {
        onlineStore.set({ provider: ui.source })
        void loadProviders()
      }
    },
    [ui.source],
  )

  useEffect(function () {
    var timer = setInterval(function () {
      getJson(API + 'control/pending')
        .then(function (body) {
          ;(body.actions || []).forEach(applyControlAction)
        })
        .catch(function () {
          // The queue endpoint is optional.
        })
    }, 2000)
    return function () {
      clearInterval(timer)
    }
  }, [])

  useEffect(
    function () {
      if (current === null || !current.onlineProvider) return undefined
      var provider = current.onlineProvider
      var id = current.onlineId
      var timer = setInterval(function () {
        void refreshCacheStatus(provider, [id])
      }, 3000)
      return function () {
        clearInterval(timer)
      }
    },
    [current ? current.path : ''],
  )

  useEffect(function () {
    function onKey(event) {
      var tag = event.target && event.target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        if (event.key === 'Escape' && event.target.blur) event.target.blur()
        return
      }
      if (event.key === 'Escape') {
        if (typeof document !== 'undefined') {
          var hostModal = document.querySelector('[role="dialog"][aria-modal="true"]')
          if (hostModal !== null && hostModal.closest('.mp-root') === null) return
        }
        if (isRangePicking()) {
          cancelRangePick()
          return
        }
        if (popLayer()) return
        if (selectionStore.get().active === true) {
          setSelectionMode(false)
          return
        }
        if (uiStore.get().queueOpen) {
          uiStore.set({ queueOpen: false })
          return
        }
        if (uiStore.get().npOpen) uiStore.set({ npOpen: false })
        return
      }
      if (event.code === 'Space') {
        event.preventDefault()
        player.toggle()
        return
      }
      if ((event.ctrlKey || event.metaKey) && event.key === 'ArrowRight') {
        event.preventDefault()
        player.next()
        return
      }
      if ((event.ctrlKey || event.metaKey) && event.key === 'ArrowLeft') {
        event.preventDefault()
        player.prev()
      }
    }
    window.addEventListener('keydown', onKey)
    return function () {
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  function openTrackMenu(track, event, extra) {
    pushLayer('menu', {
      track: track,
      x: event ? event.clientX : 20,
      y: event ? event.clientY : 20,
      visiblePaths: extra && Array.isArray(extra.visiblePaths) ? extra.visiblePaths : null,
      playSelected: extra && typeof extra.playSelected === 'function' ? extra.playSelected : null,
      onRemove: extra && typeof extra.onRemove === 'function' ? extra.onRemove : null,
    })
  }

  function locateCurrent() {
    if (current === null) {
      showToast(t('page.noTrack'))
      return
    }
    if (current.onlineProvider) {
      setSource(current.onlineProvider)
      setUi({ nav: 'recent', filter: null, query: '' })
    } else {
      setSource('local')
      setUi({ nav: 'songs', filter: null, query: '' })
    }
    setLocatePath(current.path)
    setTimeout(function () {
      setLocatePath('')
    }, 1200)
  }

  var contentProps = {
    ui: ui,
    library: library,
    online: online,
    prefs: prefs,
    currentPath: current ? current.path : '',
    playing: snap.playing,
    favoriteSet: favorites,
    locatePath: locatePath,
    onMenu: openTrackMenu,
    onToggleFavorite: function (track) {
      void toggleFavorite(track.path)
    },
  }

  return h(
    'div',
    { className: cx('mp-root', prefs.layout === 'top' && 'is-top') },
    h(TopBar, { ui: ui, online: online, prefs: prefs }),
    h(
      'div',
      { className: 'mp-workspace' },
      h(NavRail, { source: ui.source, nav: ui.nav, favoritesCount: favoriteCount }),
      h(
        'div',
        { className: 'mp-content' },
        h(SectionBar, { source: ui.source, nav: ui.nav, favoritesCount: favoriteCount }),
        h(ContentArea, contentProps),
      ),
    ),
    h(PlayerBar, {
      favoriteSet: favorites,
      queueOpen: ui.queueOpen,
      onToggleQueue: function () {
        setUi({ queueOpen: !ui.queueOpen })
      },
      onOpenNowPlaying: function () {
        setUi({ npOpen: true })
      },
      onLocate: locateCurrent,
      onToggleFavorite: function (track) {
        void toggleFavorite(track.path)
      },
    }),
    h(NowPlaying, {
      open: ui.npOpen === true,
      favoriteSet: favorites,
      onClose: function () {
        setUi({ npOpen: false })
      },
      onQueue: function () {
        setUi({ npOpen: false, queueOpen: true })
      },
      onToggleFavorite: function (track) {
        void toggleFavorite(track.path)
      },
    }),
    h(OverlayRoot),
    h(Toast),
  )
}
