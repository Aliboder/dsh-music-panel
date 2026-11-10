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
    h('div', { className: 'mp-brand' }, h('span', { className: 'mp-brand-dot' }, icon('note', 13)), t('nav.label')),
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
