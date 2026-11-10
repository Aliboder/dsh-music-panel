/**
 * plugin: seat registration and lifecycle.
 */

function MusicSideIcon() {
  var snap = usePlayerSnapshot()
  return h(
    'span',
    { className: 'mp-side-icon' },
    icon('note', 16),
    snap.queue.length > 0 ? h('span', { className: 'mp-side-dot' }) : null,
  )
}

function NewPlaylistDialog(props) {
  var pair = useState('')
  var name = pair[0]
  var setName = pair[1]
  var busyPair = useState(false)
  var busy = busyPair[0]
  var setBusy = busyPair[1]

  function create() {
    var value = name.trim()
    if (value === '' || busy) return
    setBusy(true)
    createPlaylist(value).then(function (created) {
      setBusy(false)
      if (created) {
        popLayer()
        openLocalPlaylist(created.id)
      }
    })
  }

  return h(
    'div',
    { className: 'mp-overlay is-on' },
    h('div', { className: 'mp-scrim', onClick: function () { popLayer() } }),
    h(
      'div',
      { className: 'mp-dialog is-sm', role: 'dialog', 'aria-label': t('v2.newPlaylist') },
      h(
        'div',
        { className: 'mp-d-head' },
        h('div', { className: 'mp-d-title' }, t('v2.newPlaylist')),
        h('div', { className: 'mp-spacer' }),
        h(IconButton, { icon: 'x', title: t('v2.close'), onClick: function () { popLayer() } }),
      ),
      h(
        'div',
        { className: 'mp-d-body' },
        h('input', {
          type: 'text',
          value: name,
          placeholder: t('v2.playlistName'),
          autoFocus: true,
          style: {
            height: '32px',
            padding: '0 10px',
            borderRadius: '8px',
            border: '1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07))',
            background: 'var(--dsw-alias-bg-layer-2,rgba(255,255,255,.04))',
            color: 'inherit',
            font: 'inherit',
            outline: 'none',
          },
          onChange: function (event) {
            setName(event.target.value)
          },
          onKeyDown: function (event) {
            if (event.key === 'Enter') create()
          },
        }),
      ),
      h(
        'div',
        { className: 'mp-d-foot' },
        h(Button, { variant: 'ghost', onClick: function () { popLayer() } }, t('page.cancel')),
        h(Button, { variant: 'primary', disabled: busy, onClick: create }, t('page.create')),
      ),
    ),
  )
}

function apply(ctx) {
  try {
    if (typeof console !== 'undefined' && console.info) {
      console.info('[dsh-music-panel] host UI kit:', hostUi ? 'native' : 'fallback')
    }
  } catch (error) {
    // Logging is best-effort.
  }
  try {
    var htmlLang = document.documentElement.getAttribute('lang') || ''
    if (htmlLang !== '') LANG = String(htmlLang).toLowerCase().indexOf('zh') === 0 ? 'zh' : 'en'
  } catch (error) {
    // Keep the initial guess.
  }

  var locale = ctx.locale
  if (
    locale !== null &&
    locale !== undefined &&
    typeof locale.register === 'function' &&
    typeof locale.bind === 'function'
  ) {
    ctx.effect(function () {
      var dispose = locale.register('dsh-music-panel', DICTS)
      return function () {
        if (typeof dispose === 'function') dispose()
      }
    })
    try {
      var bound = locale.bind('dsh-music-panel')
      if (typeof bound === 'function') localeTranslate = bound
    } catch (error) {
      localeTranslate = null
    }
  }

  ctx.effect(function () {
    var style = document.createElement('style')
    style.dataset.plugin = 'dsh-music-panel'
    style.textContent = THEME_TEXT
    document.head.appendChild(style)
    return function () {
      style.remove()
    }
  })

  ctx.effect(function () {
    return function () {
      player.suspend()
    }
  })

  ctx.effect(function () {
    function onVisibility() {
      if (document.visibilityState === 'hidden') player.flushOnHide()
    }
    function onUnload() {
      player.flushOnHide()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('beforeunload', onUnload)
    return function () {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('beforeunload', onUnload)
    }
  })

  ctx.effect(function () {
    try {
      if (
        typeof navigator === 'undefined' ||
        navigator.locks === undefined ||
        typeof navigator.locks.request !== 'function'
      ) {
        return
      }
      if (window.__dshMusicLeaderBound === true) return
      window.__dshMusicLeaderBound = true
      var LOCK = 'dsh-music-panel.player'
      function hold() {
        return new Promise(function () {})
      }
      function becomeLeader() {
        player.setLeader(true)
        return hold()
      }
      navigator.locks
        .request(LOCK, { mode: 'exclusive', ifAvailable: true }, function (lock) {
          if (lock !== null && lock !== undefined) return becomeLeader()
          player.setLeader(false)
          return navigator.locks.request(LOCK, becomeLeader)
        })
        .catch(function () {
          player.setLeader(true)
        })
    } catch (error) {
      player.setLeader(true)
    }
  })

  function mount(name, registration, component) {
    ctx.effect(function () {
      var dispose = ctx.slots.inject(name, function () {
        return ctx.slots.register(registration, component)
      })
      return function () {
        if (typeof dispose === 'function') dispose()
      }
    })
  }

  mount('shell.overlay', { name: 'shell.overlay', id: 'music-player', order: 15 }, AudioHost)
  mount('shell.overlay', { name: 'shell.overlay', id: 'music-queue', order: 16 }, GlobalQueueHost)
  mount(
    'sidebar.panellist',
    {
      name: 'sidebar.panellist',
      id: PANEL_ID,
      order: 20,
      label: function () {
        return t('nav.label')
      },
    },
    MusicSideIcon,
  )
  mount('main', { name: 'main', key: PANEL_ID }, function () {
    return h(MusicBoundary, null, h(Panel))
  })
  mount('conversation.input.dock', { name: 'conversation.input.dock', id: 'music-lyrics-above' }, function () {
    return h(SilentBoundary, null, h(ComposerLyrics))
  })
  mount(
    'conversation.input.right',
    { name: 'conversation.input.right', id: 'music-composer-cluster', order: 10 },
    function () {
      return h(SilentBoundary, null, h(ComposerCluster))
    },
  )
}
