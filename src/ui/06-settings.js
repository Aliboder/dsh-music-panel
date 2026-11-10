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
      if (tab !== 'cache' || props.open !== true) return undefined
      var cancelled = false
      getJson(API + 'online/cache')
        .then(function (body) {
          if (!cancelled) setCache(body)
        })
        .catch(function () {
          if (!cancelled) setCache(null)
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
      { style: { display: 'flex', gap: '4px' } },
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
        { key: provider, label: label, desc: info.loggedIn ? info.nickname || t('online.loggedIn') : t('online.loggedOut') },
        info.loggedIn
          ? h(Button, {
              variant: 'ghost',
              icon: 'logout',
              onClick: function () {
                void logoutProvider(provider)
              },
              children: t('online.logout'),
            })
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
    function setRootVisible(root, visible) {
      var next = hiddenRoots.slice()
      var at = next.indexOf(root)
      if (visible && at >= 0) next.splice(at, 1)
      if (!visible && at < 0) next.push(root)
      void saveConfig({ hiddenRoots: next })
    }
    return [
      h('h2', { key: 'h' }, t('v2.library')),
      roots.length === 0
        ? h('p', { key: 'empty', className: 'mp-set-desc' }, t('v2.noTracksHint'))
        : h(
            'div',
            { key: 'roots' },
            roots.map(function (root) {
              return h(
                SetRow,
                {
                  key: root,
                  label: root,
                  desc: hiddenRoots.indexOf(root) >= 0 ? t('v2.folderHidden') : t('v2.folderVisible'),
                },
                h(
                  'div',
                  { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
                  h(Switch, {
                    value: hiddenRoots.indexOf(root) < 0,
                    label: hiddenRoots.indexOf(root) >= 0 ? t('v2.folderHidden') : t('v2.folderVisible'),
                    onChange: function (visible) {
                      setRootVisible(root, visible)
                    },
                  }),
                  h(Button, {
                    variant: 'ghost',
                    icon: 'trash',
                    onClick: function () {
                      var next = roots.filter(function (item) {
                        return item !== root
                      })
                      void saveConfig({ roots: next })
                    },
                    children: t('page.delete'),
                  }),
                ),
              )
            }),
          ),
      h(
        'div',
        { key: 'add', style: { display: 'flex', gap: '8px', paddingTop: '12px' } },
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
        h(Button, { variant: 'ghost', icon: 'folder', onClick: function () { pushLayer('folderPicker') } }, t('v2.folderBrowse')),
        h(Button, {
          variant: 'primary',
          icon: 'plus',
          disabled: busy || rootDraft.trim() === '',
          onClick: addRoot,
          children: t('page.create'),
        }),
      ),
      h(
        SetRow,
        { key: 'depth', label: t('settings.depth'), desc: t('settings.depthHint') },
        h(
          'select',
          {
            value: String(config.depth || 4),
            onChange: function (event) {
              void saveConfig({ depth: Number(event.target.value) })
            },
          },
          [1, 2, 3, 4, 5, 6].map(function (n) {
            return h('option', { key: n, value: String(n) }, String(n))
          }),
        ),
      ),
      h(
        'div',
        { key: 'scan', style: { display: 'flex', justifyContent: 'flex-end', paddingTop: '12px' } },
        h(Button, {
          icon: 'refresh',
          disabled: busy,
          onClick: function () {
            void loadLibrary(true)
            showToast(t('page.scanning'))
          },
          children: t('page.refresh'),
        }),
      ),
      h(
        'div',
        { key: 'trash', style: { display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '10px' } },
        h('span', { className: 'mp-set-desc', style: { flex: '1' } }, t('v2.trashHint')),
        h(Button, { icon: 'trash', onClick: function () { pushLayer('trash', {}) } }, t('v2.trash')),
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
              : cacheTab()

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
