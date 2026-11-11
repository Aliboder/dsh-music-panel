/**
 * settings: one full-height sheet with six tabs.
 *
 * The layout switch lives here (Appearance → Layout) because the user asked for
 * a single, discoverable place to change it.
 */

var SETTINGS_TABS = [
  { key: 'appearance', label: 'v2.appearance' },
  { key: 'lyrics', label: 'v2.lyrics' },
  { key: 'playback', label: 'v2.playback' },
  { key: 'online', label: 'v2.online' },
  { key: 'library', label: 'v2.library' },
  { key: 'cache', label: 'v2.cacheTab' },
  { key: 'about', label: 'v2.about' },
]

function SettingsSheet(props) {
  var prefs = usePrefs()
  var sleepRemaining = useCountdown(prefs.sleepDeadline)
  var library = useStore(libraryStore)
  var online = useStore(onlineStore)
  var tabPair = useState('appearance')
  var tab = tabPair[0]
  var setTab = tabPair[1]
  var cachePair = useState(null)
  var cacheSongsPair = useState(null)
  var cacheSongs = cacheSongsPair[0]
  var setCacheSongs = cacheSongsPair[1]
  var builtinLoudness =
    typeof window !== 'undefined' &&
    (typeof window.OfflineAudioContext !== 'undefined' ||
      typeof window.webkitOfflineAudioContext !== 'undefined')
  var cache = cachePair[0]
  var setCache = cachePair[1]
  var pathPair = useState('')
  var rootDraft = pathPair[0]
  var setRootDraft = pathPair[1]
  var busyPair = useState(false)
  var busy = busyPair[0]
  var setBusy = busyPair[1]

  useEffect(
    function () {
      if (tab !== 'online' || props.open !== true) return undefined
      void loadProviders()
      return undefined
    },
    [tab, props.open],
  )

  useEffect(
    function () {
      if (tab !== 'cache' || props.open !== true) return undefined
      var cancelled = false
      getJson(API + 'online/cache')
        .then(function (body) {
          if (!cancelled) setCache(body)
        })
        .catch(function () {
          if (!cancelled) setCache(null)
        })
      getJson(API + 'online/cache/list')
        .then(function (body) {
          if (!cancelled) setCacheSongs(Array.isArray(body.songs) ? body.songs : [])
        })
        .catch(function () {
          if (!cancelled) setCacheSongs([])
        })
      return function () {
        cancelled = true
      }
    },
    [tab, props.open],
  )

  if (props.open !== true) return null

  function patchPrefs(patch) {
    setPrefs(patch)
  }

  function layoutChoices() {
    return h(
      'div',
      { className: 'mp-set-choice-row' },
      h(
        'button',
        {
          type: 'button',
          className: cx('mp-chip', prefs.layout === 'top' && 'is-on'),
          onClick: function () {
            patchPrefs({ layout: 'top' })
          },
        },
        icon('list', 13),
        t('v2.layoutTop'),
      ),
      h(
        'button',
        {
          type: 'button',
          className: cx('mp-chip', prefs.layout === 'rail' && 'is-on'),
          onClick: function () {
            patchPrefs({ layout: 'rail' })
          },
        },
        icon('list', 13),
        t('v2.layoutRail'),
      ),
    )
  }

  function appearanceTab() {
    return [
      h('h2', { key: 'h' }, t('v2.appearance')),
      h(
        SetRow,
        { key: 'layout', label: t('v2.layout'), desc: t('v2.layoutHint') },
        layoutChoices(),
      ),
      h(
        SetRow,
        { key: 'spin', label: t('v2.spin'), desc: t('v2.spinDesc') },
        h(Switch, {
          value: prefs.coverSpin === true,
          label: t('v2.spin'),
          onChange: function (value) {
            patchPrefs({ coverSpin: value })
          },
        }),
      ),
      h(
        SetRow,
        { key: 'round', label: t('v2.roundCover'), desc: t('v2.roundCoverDesc') },
        h(Switch, {
          value: prefs.circularCover === true,
          label: t('v2.roundCover'),
          onChange: function (value) {
            patchPrefs({ circularCover: value })
          },
        }),
      ),
      h(
        SetRow,
        { key: 'vinyl', label: t('v2.vinylRing'), desc: t('v2.vinylRingDesc') },
        h(Switch, {
          value: prefs.vinylRing === true,
          label: t('v2.vinylRing'),
          onChange: function (value) {
            patchPrefs({ vinylRing: value })
          },
        }),
      ),
      h(
        SetRow,
        { key: 'hostkit', label: t('v2.hostKit'), desc: t('v2.hostKitDesc') },
        h(
          'span',
          { className: 'mp-chip', style: { cursor: 'default' } },
          hostUi ? t('v2.hostKitNative') : t('v2.hostKitFallback'),
        ),
      ),
    ]
  }

  function lyricsTab() {
    return [
      h('h2', { key: 'h' }, t('v2.lyrics')),
      h(
        SetRow,
        { key: 'tr', label: t('page.translation') },
        h(Switch, {
          value: prefs.showTranslation === true,
          onChange: function (value) {
            patchPrefs({ showTranslation: value })
          },
        }),
      ),
      h(
        SetRow,
        { key: 'size', label: t('page.lyricSize') },
        h('input', {
          type: 'range',
          className: 'mp-range',
          min: 14,
          max: 26,
          step: 1,
          value: prefs.lyricSize,
          onChange: function (event) {
            patchPrefs({ lyricSize: Number(event.target.value) })
          },
        }),
        h('span', { className: 'mp-set-val' }, String(prefs.lyricSize) + ' px'),
      ),
      h(
        SetRow,
        { key: 'scale', label: t('page.translationScale') },
        h('input', {
          type: 'range',
          className: 'mp-range',
          min: 60,
          max: 100,
          step: 5,
          value: prefs.translationScale,
          onChange: function (event) {
            patchPrefs({ translationScale: Number(event.target.value) })
          },
        }),
        h('span', { className: 'mp-set-val' }, String(prefs.translationScale) + '%'),
      ),
      h(
        SetRow,
        { key: 'order', label: t('settings.lyricOrder') },
        h(
          'select',
          {
            value: (prefs.lyricOrder || []).join(','),
            onChange: function (event) {
              patchPrefs({ lyricOrder: event.target.value.split(',') })
            },
          },
          h('option', { value: 'embedded,lrc' }, t('settings.lyricSourceEmbedded') + ' → LRC'),
          h('option', { value: 'lrc,embedded' }, 'LRC → ' + t('settings.lyricSourceEmbedded')),
        ),
      ),
      h(
        SetRow,
        { key: 'align', label: t('settings.lyricAlign') },
        h(
          'select',
          {
            value: prefs.lyricAlign || 'center',
            onChange: function (event) {
              patchPrefs({ lyricAlign: event.target.value })
            },
          },
          h('option', { value: 'center' }, t('settings.alignCenter')),
          h('option', { value: 'left' }, t('settings.alignLeft')),
          h('option', { value: 'right' }, t('settings.alignRight')),
        ),
      ),
    ]
  }

  function playbackTab() {
    return [
      h('h2', { key: 'h' }, t('v2.playback')),
      h(
        SetRow,
        { key: 'resume', label: t('settings.resumeOnStart') },
        h(Switch, {
          value: prefs.resumeOnStart === true,
          onChange: function (value) {
            patchPrefs({ resumeOnStart: value })
          },
        }),
      ),
      h(
        SetRow,
        { key: 'auto', label: t('settings.autoResume') },
        h(Switch, {
          value: prefs.autoResume === true,
          onChange: function (value) {
            patchPrefs({ autoResume: value })
          },
        }),
      ),
      h(
        SetRow,
        { key: 'per', label: t('settings.rememberPerTrack') },
        h(Switch, {
          value: prefs.rememberPerTrack === true,
          onChange: function (value) {
            patchPrefs({ rememberPerTrack: value })
          },
        }),
      ),
      h(
        SetRow,
        {
          key: 'normalize',
          label: t('settings.volumeNormalize'),
          desc: t('settings.volumeNormalizeHint'),
        },
        h(Switch, {
          value: prefs.normalizeVolume !== false,
          onChange: function (value) {
            patchPrefs({ normalizeVolume: value })
            if (player.setNormalize) player.setNormalize(value)
          },
        }),
      ),
      h(
        'div',
        {
          key: 'normalize-status',
          className: cx(
            'mp-set-status',
            prefs.normalizeVolume === false ? 'is-off' : builtinLoudness ? 'is-on' : 'is-bad',
          ),
        },
        h('i'),
        h(
          'span',
          null,
          prefs.normalizeVolume === false
            ? t('settings.volumeNormalizeOff')
            : builtinLoudness
              ? t('settings.volumeNormalizeReady')
              : t('settings.volumeNormalizeMissing'),
        ),
        prefs.normalizeVolume !== false && !builtinLoudness
          ? h('span', { className: 'mp-set-status-hint' }, t('settings.volumeNormalizeMissingHint'))
          : null,
      ),
      h(
        SetRow,
        { key: 'sleep', label: t('settings.sleepTimer') },
        h(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
          h(
            'select',
            {
              value: String(prefs.sleepTimerMinutes || 0),
              onChange: function (event) {
                var minutes = Number(event.target.value) || 0
                patchPrefs({
                  sleepTimerMinutes: minutes,
                  sleepDeadline: minutes > 0 ? Date.now() + minutes * 60000 : 0,
                })
              },
            },
            [0, 15, 30, 60, 90].map(function (minutes) {
              return h(
                'option',
                { key: minutes, value: String(minutes) },
                minutes === 0 ? t('settings.sleepOff') : t('v2.minutes', { n: minutes }),
              )
            }),
          ),
          sleepRemaining > 0
            ? h('span', { className: 'mp-set-val' }, t('v2.sleepRemaining', { time: fmtClock(sleepRemaining / 1000) }))
            : null,
          sleepRemaining > 0
            ? h(
                Button,
                {
                  variant: 'ghost',
                  onClick: function () {
                    patchPrefs({ sleepTimerMinutes: 0, sleepDeadline: 0 })
                  },
                },
                t('v2.sleepCancel'),
              )
            : null,
        ),
      ),
    ]
  }

  function accountAvatar(info) {
    if (info.avatarUrl) {
      return h('img', {
        className: 'mp-account-avatar',
        src: API + 'online/cover?url=' + encodeURIComponent(info.avatarUrl),
        alt: '',
      })
    }
    return h('span', { className: 'mp-account-avatar is-fallback' }, (info.nickname || '?').slice(0, 1))
  }

  function onlineTab() {
    var providers = online.providers || {}
    var rows = ['netease', 'qq', 'kugou'].map(function (provider) {
      var info = providers[provider] || {}
      var label =
        provider === 'netease'
          ? t('online.providerNetease')
          : provider === 'qq'
            ? t('online.providerQq')
            : t('online.providerKugou')
      return h(
        SetRow,
        {
          key: provider,
          label: h(
            'span',
            { className: 'mp-provider-name' },
            h('span', { className: 'mp-provider-icon' }, providerLogo(provider, 20)),
            h('span', null, label),
          ),
          desc: info.loggedIn
            ? info.nickname || (provider === 'qq' ? t('online.qqAccount') : t('online.loggedIn'))
            : t('online.loggedOut'),
        },
        info.loggedIn
          ? h(
              'div',
              { className: 'mp-account' },
              accountAvatar(info),
              h(Button, {
                variant: 'ghost',
                icon: 'logout',
                onClick: function () {
                  void logoutProvider(provider)
                },
                children: t('online.logout'),
              }),
            )
          : h(Button, {
              variant: 'primary',
              icon: 'qr',
              onClick: function () {
                pushLayer('login', { provider: provider, mode: 'qq' })
              },
              children: t('online.login'),
            }),
      )
    })
    rows.unshift(h('h2', { key: 'h' }, t('v2.online')))
    rows.push(
      h(
        'p',
        { key: 'hint', className: 'mp-set-desc' },
        t('online.settingsHint'),
      ),
    )
    return rows
  }

  function libraryTab() {
    var config = library.config || { roots: [], hiddenRoots: [], depth: 4 }
    var roots = Array.isArray(config.roots) ? config.roots : []
    var hiddenRoots = Array.isArray(config.hiddenRoots) ? config.hiddenRoots : []
    var scanning = library.phase === 'loading'
    function setRootVisible(root, visible) {
      var next = hiddenRoots.slice()
      var at = next.indexOf(root)
      if (visible && at >= 0) next.splice(at, 1)
      if (!visible && at < 0) next.push(root)
      void saveConfig({ hiddenRoots: next })
    }
    function removeRoot(root) {
      pushLayer('confirm', {
        title: t('page.delete'),
        text: t('settings.removeConfirm'),
        onConfirm: function () {
          var next = roots.filter(function (item) {
            return item !== root
          })
          void saveConfig({ roots: next })
        },
      })
    }
    function rescan() {
      if (scanning) return
      void loadLibrary(true)
      showToast(t('page.scanning'))
    }
    var folderRows =
      roots.length === 0
        ? [h('div', { key: 'empty', className: 'mp-set-empty-card' }, t('v2.noTracksHint'))]
        : roots.map(function (root) {
            var hidden = hiddenRoots.indexOf(root) >= 0
            return h(
              'div',
              { key: root, className: cx('mp-root-row', hidden && 'is-hidden') },
              h('span', { className: 'mp-root-icon' }, icon('folder', 16)),
              h(
                'div',
                { className: 'mp-root-main' },
                h('div', { className: 'mp-root-path', title: root }, root),
                h('div', { className: 'mp-root-state' }, hidden ? t('v2.folderHidden') : t('v2.folderVisible')),
              ),
              h(
                'div',
                { className: 'mp-root-actions' },
                h(Switch, {
                  value: !hidden,
                  label: hidden ? t('v2.folderHidden') : t('v2.folderVisible'),
                  onChange: function (visible) {
                    setRootVisible(root, visible)
                  },
                }),
                h(IconButton, {
                  icon: 'trash',
                  size: 15,
                  title: t('page.delete'),
                  onClick: function () {
                    removeRoot(root)
                  },
                }),
              ),
            )
          })
    return [
      h(
        'div',
        { key: 'head', className: 'mp-set-page-head' },
        h('h2', null, t('v2.library')),
        h(
          'span',
          { className: 'mp-set-page-meta' },
          t('settings.scannedTracks', { n: (library.tracks || []).length }),
          (library.warnings || []).length > 0
            ? ' · ' + t('settings.scanWarnings', { n: library.warnings.length })
            : '',
        ),
      ),
      h(
        'section',
        { key: 'folders', className: 'mp-set-card' },
        h(
          'div',
          { className: 'mp-set-card-head' },
          h('div', { className: 'mp-set-card-title' }, icon('folder', 13), t('settings.foldersTitle')),
          h(Button, {
            variant: 'ghost',
            icon: 'refresh',
            disabled: scanning,
            onClick: rescan,
            children: scanning ? t('page.scanning') : t('page.refresh'),
          }),
        ),
        h('div', { className: 'mp-set-card-body' }, folderRows),
        h(
          'div',
          { className: 'mp-root-add' },
          h('input', {
            type: 'text',
            className: 'mp-kit-input',
            value: rootDraft,
            placeholder: 'D:\\Music',
            onChange: function (event) {
              setRootDraft(event.target.value)
            },
            onKeyDown: function (event) {
              if (event.key === 'Enter') addRoot()
            },
          }),
          h(
            Button,
            { variant: 'ghost', icon: 'folder', onClick: function () { pushLayer('folderPicker') } },
            t('v2.folderBrowse'),
          ),
          h(Button, {
            variant: 'primary',
            icon: 'plus',
            disabled: busy || rootDraft.trim() === '',
            onClick: addRoot,
            children: t('page.create'),
          }),
        ),
      ),
      h(
        'section',
        { key: 'scan', className: 'mp-set-card' },
        h(
          'div',
          { className: 'mp-set-card-head' },
          h('div', { className: 'mp-set-card-title' }, icon('settings', 13), t('settings.scanSettings')),
        ),
        h(
          'div',
          { className: 'mp-set-card-body' },
          h(
            SetRow,
            { key: 'depth', label: t('settings.depth'), desc: t('settings.depthHint') },
            h(
              'select',
              {
                value: String(config.depth === undefined ? 4 : config.depth),
                onChange: function (event) {
                  void saveConfig({ depth: Number(event.target.value) })
                },
              },
              [0, 1, 2, 3, 4, 5, 6].map(function (n) {
                return h('option', { key: n, value: String(n) }, String(n))
              }),
            ),
          ),
          h('div', { className: 'mp-set-hint-line' }, t('settings.formatsHint')),
        ),
      ),
      h(
        'section',
        { key: 'trash', className: 'mp-set-card' },
        h(
          'div',
          { className: 'mp-set-card-head' },
          h('div', { className: 'mp-set-card-title' }, icon('trash', 13), t('v2.trash')),
          h(Button, { variant: 'ghost', icon: 'trash', onClick: function () { pushLayer('trash', {}) } }, t('settings.openTrash')),
        ),
        h('div', { className: 'mp-set-card-body' }, h('p', { className: 'mp-set-desc' }, t('v2.trashHint'))),
      ),
    ]
  }

  function addRoot() {
    var value = rootDraft.trim()
    if (value === '' || busy) return
    var config = library.config || { roots: [] }
    var roots = Array.isArray(config.roots) ? config.roots.slice() : []
    if (roots.indexOf(value) >= 0) return
    roots.push(value)
    setBusy(true)
    saveConfig({ roots: roots }).then(function (ok) {
      setBusy(false)
      if (ok) {
        setRootDraft('')
        showToast(t('page.addedCount', { n: roots.length }))
      }
    })
  }

  function cacheTab() {
    var stats = cache || { files: 0, bytes: 0, maxBytes: 0 }
    return [
      h('h2', { key: 'h' }, t('v2.cacheTab')),
      h(
        SetRow,
        { key: 'size', label: t('online.cacheSize', { files: stats.files || 0, n: fmtBytes(stats.bytes || 0) }), desc: t('online.cacheList') },
        h(Button, {
          variant: 'ghost',
          icon: 'trash',
          onClick: function () {
            postJson(API + 'online/cache', {})
              .then(function () {
                setCache({ files: 0, bytes: 0, maxBytes: stats.maxBytes || 0 })
                setCacheSongs([])
                showToast(t('online.cacheCleared'))
              })
              .catch(function (error) {
                showToast(errorText(error))
              })
          },
          children: t('online.clearCache'),
        }),
      ),
      h(
        'p',
        { key: 'hint', className: 'mp-set-desc' },
        'Cached audio is reused by the stream route; deleting it only costs a refetch.',
      ),
      h(
        'div',
        { key: 'songs', className: 'mp-cache-block' },
        h('div', { className: 'mp-cache-heading' }, t('online.cacheSongs'), h('span', null, String((cacheSongs || []).length))),
        (cacheSongs || []).length === 0
          ? h('div', { className: 'mp-cache-empty' }, t('online.cacheNoSongs'))
          : h(
              'div',
              { className: 'mp-cache-list' },
              cacheSongs.map(function (song) {
                return h(
                  'div',
                  { key: song.provider + ':' + song.id, className: 'mp-cache-row' },
                  h('span', { className: 'mp-cache-provider' }, providerLogo(song.provider, 18)),
                  h(
                    'div',
                    { className: 'mp-cache-main' },
                    h('div', { className: 'mp-cache-title' }, song.title || song.id),
                    h(
                      'div',
                      { className: 'mp-cache-sub' },
                      [song.artist, song.album].filter(Boolean).join(' · ') || t('page.unknownArtist'),
                    ),
                  ),
                  h('span', { className: 'mp-cache-time' }, fmtTime(song.durationSec)),
                  h('span', { className: 'mp-cache-size' }, fmtBytes(song.size || 0)),
                  song.hasLyric ? h('span', { className: 'mp-cache-tag' }, 'LRC') : null,
                )
              }),
            ),
      ),
    ]
  }

  function aboutTab() {
    return [
      h('h2', { key: 'h' }, t('v2.about')),
      h(
        'div',
        { key: 'card', className: 'mp-about-card' },
        h('img', { className: 'mp-about-logo', src: BRAND_LOGO, alt: '' }),
        h(
          'div',
          { className: 'mp-about-main' },
          h('div', { className: 'mp-about-name' }, 'dsh-music-panel'),
          h('div', { className: 'mp-about-version' }, t('about.version') + ' ' + APP_VERSION),
          h('div', { className: 'mp-about-tagline' }, t('about.tagline')),
        ),
      ),
      h(
        'div',
        { key: 'meta', className: 'mp-about-rows' },
        h('div', { className: 'mp-about-row' }, h('span', null, t('about.project')), h('strong', null, 'DeepSeek Harness Music Panel')),
        h('div', { className: 'mp-about-row' }, h('span', null, t('about.license')), h('strong', null, 'MIT')),
        h('div', { className: 'mp-about-row' }, h('span', null, t('about.author')), h('strong', null, 'Aliboder')),
        h(
          'div',
          { className: 'mp-about-row' },
          h('span', null, t('about.feedback')),
          h(
            'a',
            { href: 'https://github.com/Aliboder/dsh-music-panel/issues', target: '_blank', rel: 'noreferrer' },
            'GitHub Issues',
          ),
        ),
      ),
      h(
        'div',
        { key: 'links', className: 'mp-about-links' },
        h(
          'a',
          { href: 'https://github.com/Aliboder/dsh-music-panel', target: '_blank', rel: 'noreferrer' },
          t('about.source'),
        ),
        h(
          'a',
          { href: 'https://www.npmjs.com/package/dsh-music-panel', target: '_blank', rel: 'noreferrer' },
          t('about.npm'),
        ),
      ),
      h('p', { key: 'desc', className: 'mp-set-desc' }, t('about.description')),
    ]
  }

  var body =
    tab === 'appearance'
      ? appearanceTab()
      : tab === 'lyrics'
        ? lyricsTab()
        : tab === 'playback'
          ? playbackTab()
          : tab === 'online'
            ? onlineTab()
            : tab === 'library'
              ? libraryTab()
              : tab === 'cache'
                ? cacheTab()
                : aboutTab()

  return h(
    KitModal,
    { headless: true, onClose: props.onClose, className: 'mp-kit-sheet' },
    h(
      'div',
      { className: 'mp-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('page.settings') },
      h(
        'div',
        { className: 'mp-sheet-nav' },
        h('div', { className: 'mp-sheet-title' }, t('page.settings')),
        SETTINGS_TABS.map(function (item) {
          return h(
            'button',
            {
              key: item.key,
              type: 'button',
              className: cx('mp-sheet-tab', tab === item.key && 'is-on'),
              onClick: function () {
                setTab(item.key)
              },
            },
            t(item.label),
          )
        }),
        h(
          'div',
          { style: { marginTop: 'auto' } },
          h('button', { type: 'button', className: 'mp-sheet-tab', onClick: props.onClose }, t('v2.close')),
        ),
      ),
      h('div', { className: 'mp-sheet-body' }, body),
    ),
  )
}

