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
