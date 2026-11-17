/**
 * settings: one full-height sheet with six tabs.
 *
 * The layout switch lives here (Appearance → Layout) because the user asked for
 * a single, discoverable place to change it.
 */

var SETTINGS_TABS = [
  { key: 'appearance', label: 'v2.appearance', glyph: 'settings' },
  { key: 'lyrics', label: 'v2.lyrics', glyph: 'note' },
  { key: 'playback', label: 'v2.playback', glyph: 'equalizer' },
  { key: 'online', label: 'v2.online', glyph: 'refresh' },
  { key: 'library', label: 'v2.library', glyph: 'folder' },
  { key: 'cache', label: 'v2.dataTab', glyph: 'trash' },
  { key: 'about', label: 'v2.about', glyph: 'info' },
]



function SettingsSheet(props) {
  var prefs = usePrefs()
  var sleepRemaining = useCountdown(prefs.sleepDeadline)
  var library = useStore(libraryStore)
  var online = useStore(onlineStore)
  var tabPair = useState(props.initialTab || 'appearance')
  var tab = tabPair[0]
  var setTab = tabPair[1]
  // Opening the sheet from a specific entry (e.g. the Navidrome connect chip) lands on
  // that tab even when the sheet was already mounted.
  useEffect(
    function () {
      if (props.initialTab) setTab(props.initialTab)
    },
    [props.initialTab],
  )
  // Component test page: a full view inside the same sheet, so it shares the sheet's
  // modal layer instead of opening a second one.
  var galleryPair = useState(false)
  var galleryOpen = galleryPair[0]
  var setGalleryOpen = galleryPair[1]
  var cachePair = useState(null)
  var builtinLoudness =
    typeof window !== 'undefined' &&
    (typeof window.OfflineAudioContext !== 'undefined' ||
      typeof window.webkitOfflineAudioContext !== 'undefined')
  var cache = cachePair[0]
  var setCache = cachePair[1]
  var dataPair = useState(null)
  var data = dataPair[0]
  var setData = dataPair[1]
  var resetPair = useState(0)
  var resetStage = resetPair[0]
  var setResetStage = resetPair[1]
  var resetBusyPair = useState(false)
  var resetBusy = resetBusyPair[0]
  var setResetBusy = resetBusyPair[1]
  var pathPair = useState('')
  var rootDraft = pathPair[0]
  var setRootDraft = pathPair[1]
  var busyPair = useState(false)
  var busy = busyPair[0]
  var setBusy = busyPair[1]
  // Navidrome credential form. Every hook in this component must run on each
  // render, so it lives here rather than inside the tab/card render helpers.
  var navForm = useNavidromeForm()
  var outputPair = useState([])
  var outputDevices = outputPair[0]
  var setOutputDevices = outputPair[1]
  var sinkSupported =
    typeof window !== 'undefined' &&
    typeof window.AudioContext !== 'undefined' &&
    typeof window.AudioContext.prototype.setSinkId === 'function'

  useEffect(
    function () {
      if (tab !== 'playback' || props.open !== true || !sinkSupported) return undefined
      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices ||
        typeof navigator.mediaDevices.enumerateDevices !== 'function'
      ) {
        return undefined
      }
      var cancelled = false
      navigator.mediaDevices
        .enumerateDevices()
        .then(function (devices) {
          if (cancelled) return
          setOutputDevices(
            devices
              .filter(function (device) {
                return device.kind === 'audiooutput'
              })
              .map(function (device, index) {
                return {
                  id: device.deviceId,
                  label: device.label || t('settings.outputDeviceN', { n: index + 1 }),
                }
              }),
          )
        })
        .catch(function () {
          if (!cancelled) setOutputDevices([])
        })
      return function () {
        cancelled = true
      }
    },
    [tab, props.open, sinkSupported],
  )

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
      getJson(API + 'data')
        .then(function (body) {
          if (!cancelled) setData(body)
        })
        .catch(function () {
          if (!cancelled) setData(null)
        })
      return function () {
        cancelled = true
      }
    },
    [tab, props.open],
  )

  if (props.open !== true) return null

  function clearPluginLocalStorage() {
    try {
      var prefixes = ['music.', 'dsh-music', 'mu.', 'lyric_', 'visualizer_', 'url_background_', 'folia.dev.']
      var suffixes = ['_tuning']
      var keys = []
      for (var index = 0; index < window.localStorage.length; index += 1) {
        var key = window.localStorage.key(index)
        if (key === null) continue
        var owned = prefixes.some(function (prefix) {
          return key.indexOf(prefix) === 0
        })
        if (!owned) {
          owned = suffixes.some(function (suffix) {
            return key.length >= suffix.length && key.slice(-suffix.length) === suffix
          })
        }
        if (owned) keys.push(key)
      }
      keys.forEach(function (key) {
        window.localStorage.removeItem(key)
      })
    } catch (error) {
      /* Private mode / quota errors must not block the host reset. */
    }
  }

  function clearAllData() {
    if (resetBusy) return
    setResetBusy(true)
    postJson(API + 'data/clear', { confirm: 'clear-all' })
      .then(function () {
        clearPluginLocalStorage()
        setResetBusy(false)
        setResetStage(0)
        showToast(t('data.resetDone'))
        if (typeof window !== 'undefined' && typeof window.location?.reload === 'function') {
          window.setTimeout(function () {
            window.location.reload()
          }, 260)
        }
      })
      .catch(function (error) {
        setResetBusy(false)
        setResetStage(0)
        showToast(errorText(error))
      })
  }

  function resetDialog() {
    if (resetStage === 0) return null
    var final = resetStage === 2
    return h(
      KitModal,
      {
        key: 'data-reset',
        title: final ? t('data.resetTitleFinal') : t('data.resetTitle'),
        small: true,
        onClose: function () {
          if (!resetBusy) setResetStage(0)
        },
        footer: [
          h(
            Button,
            {
              key: 'cancel',
              variant: 'ghost',
              disabled: resetBusy,
              onClick: function () {
                if (!resetBusy) setResetStage(0)
              },
            },
            t('page.cancel'),
          ),
          h(
            Button,
            {
              key: final ? 'confirm' : 'continue',
              variant: 'primary',
              className: final ? 'mp-data-danger-btn' : undefined,
              disabled: resetBusy,
              onClick: function () {
                if (resetBusy) return
                if (final) clearAllData()
                else setResetStage(2)
              },
            },
            resetBusy ? t('data.resetting') : final ? t('data.resetConfirm') : t('data.resetContinue'),
          ),
        ],
      },
      h('p', { className: 'mp-kit-text' }, final ? t('data.resetHintFinal') : t('data.resetHint')),
    )
  }

  function patchPrefs(patch) {
    setPrefs(patch)
  }

  // Lyric line filters (Folia's lyricLineRules): the two ready-made presets plus
  // free words; the player turns them into rules for the parse-time document.
  function lyricFilterPresets() {
    return Array.isArray(prefs.lyricFilterPresets) ? prefs.lyricFilterPresets.slice() : []
  }

  function toggleLyricFilterPreset(id, on) {
    var next = lyricFilterPresets().filter(function (item) {
      return item !== id
    })
    if (on) next.push(id)
    patchPrefs({ lyricFilterPresets: next })
  }

  function layoutChoices() {
    return h(KitSegmented, {
      id: 'mp-layout-choice',
      value: prefs.layout === 'rail' ? 'rail' : 'top',
      label: t('v2.layout'),
      options: [
        { value: 'top', label: t('v2.layoutTop') },
        { value: 'rail', label: t('v2.layoutRail') },
      ],
      onChange: function (value) {
        patchPrefs({ layout: value })
      },
    })
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
        { key: 'coverStyle', label: t('v2.coverStyle'), desc: t('v2.coverStyleDesc') },
        h(KitSegmented, {
          id: 'mp-cover-style',
          value: prefs.coverStyle === 'vinyl' ? 'vinyl' : 'square',
          label: t('v2.coverStyle'),
          options: [
            { value: 'square', label: t('v2.coverSquare') },
            { value: 'vinyl', label: t('v2.coverVinyl') },
          ],
          onChange: function (value) {
            if (value === 'vinyl') {
              patchPrefs({ coverStyle: 'vinyl', circularCover: true, vinylRing: true, coverSpin: true })
            } else {
              patchPrefs({ coverStyle: 'square', circularCover: false, vinylRing: false, coverSpin: false })
            }
          },
        }),
      ),
      h(
        SetRow,
        { key: 'hostkit', label: t('v2.hostKit'), desc: t('v2.hostKitDesc') },
        h(KitTag, { tone: hostUi ? 'info' : 'neutral' }, hostUi ? t('v2.hostKitNative') : t('v2.hostKitFallback')),
      ),
    ]
  }

  /** The sidecar lyric formats, reorderable: the first one wins when a track has several. */
  function lyricFormatOrderList() {
    var fallback = ['lrc', 'vtt', 'ttml', 'qrc', 'yrc', 'krc']
    var order = Array.isArray(prefs.lyricFormatOrder) && prefs.lyricFormatOrder.length > 0
      ? prefs.lyricFormatOrder.slice()
      : fallback.slice()
    for (var index = 0; index < fallback.length; index += 1) {
      if (order.indexOf(fallback[index]) < 0) order.push(fallback[index])
    }
    function move(from, delta) {
      var target = from + delta
      if (from < 0 || target < 0 || from >= order.length || target >= order.length) return
      var next = order.slice()
      var item = next.splice(from, 1)[0]
      next.splice(target, 0, item)
      patchPrefs({ lyricFormatOrder: next })
    }
    return h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
      order.map(function (format, index) {
        return h(
          'div',
          { key: format, style: { display: 'flex', alignItems: 'center', gap: '6px' } },
          h('span', { style: { minWidth: '56px', fontSize: '12px', opacity: '.8' } }, format.toUpperCase()),
          index > 0 ? mpSmallButton('\u2191', function () { move(index, -1) }) : null,
          index < order.length - 1 ? mpSmallButton('\u2193', function () { move(index, 1) }) : null,
        )
      }),
    )
  }

  function lyricsTab() {
    return [      h('h2', { key: 'h' }, t('v2.lyrics')),
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
        {
          key: 'subtitle-bg',
          label: t('settings.subtitleOverlayBackground'),
          desc: t('settings.subtitleOverlayBackgroundDesc'),
        },
        h(Switch, {
          value: prefs.subtitleOverlayBackground !== false,
          onChange: function (value) {
            patchPrefs({ subtitleOverlayBackground: value })
          },
        }),
      ),
      h(
        SetRow,
        { key: 'composer-lyrics', label: t('settings.composerLyrics') },
        h(Switch, {
          value: prefs.composerLyrics === true,
          onChange: function (value) {
            patchPrefs({ composerLyrics: value })
          },
        }),
      ),
      h(
        SetRow,
        {
          key: 'composer-translation',
          label: t('settings.composerTranslation'),
          desc: t('settings.composerTranslationDesc'),
        },
        h(Switch, {
          value: prefs.composerTranslation !== false,
          onChange: function (value) {
            patchPrefs({ composerTranslation: value })
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
          max: 40,
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
        { key: 'gap', label: t('page.lyricGap') },
        h('input', {
          type: 'range',
          className: 'mp-range',
          min: 2,
          max: 16,
          step: 1,
          value: Number(prefs.lyricGap) || 6,
          onChange: function (event) {
            patchPrefs({ lyricGap: Number(event.target.value) })
          },
        }),
        h('span', { className: 'mp-set-val' }, (Number(prefs.lyricGap) || 6) + ' px'),
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
        { key: 'local-priority', label: t('settings.lyricLocalPriority'), desc: t('settings.lyricLocalPriorityDesc') },
        h(KitSelect, {
          value: prefs.lyricLocalPriority === 'online' ? 'online' : 'local',
          label: t('settings.lyricLocalPriority'),
          options: [
            { value: 'local', label: t('settings.lyricLocalPriorityLocal') },
            { value: 'online', label: t('settings.lyricLocalPriorityOnline') },
          ],
          onChange: function (value) {
            patchPrefs({ lyricLocalPriority: String(value) })
          },
        }),
      ),
      h(
        SetRow,
        { key: 'preferred-source', label: t('settings.lyricPreferredSource'), desc: t('settings.lyricPreferredSourceDesc') },
        h(KitSelect, {
          value: prefs.lyricPreferredSource || 'qq',
          label: t('settings.lyricPreferredSource'),
          options: [
            { value: 'qq', label: 'QQ Music' },
            { value: 'netease', label: 'NetEase Cloud Music' },
            { value: 'amll', label: 'AMLLDB' },
            { value: 'kugouLite', label: 'KuGou' },
            { value: 'qishui', label: 'Qishui' },
          ],
          onChange: function (value) {
            patchPrefs({ lyricPreferredSource: String(value) })
          },
        }),
      ),
      h(
        'div',
        {
          key: 'format-order',
          style: { display: 'flex', flexDirection: 'column', gap: '6px', padding: '6px 0 4px' },
        },
        h('div', { className: 'mp-set-label' }, t('settings.lyricFormatOrder')),
        h('div', { className: 'mp-set-desc' }, t('settings.lyricFormatOrderDesc')),
        lyricFormatOrderList(),
      ),
      h(
        SetRow,
        { key: 'blur', label: t('page.lyricBlur') },
        h(Switch, {
          value: prefs.lyricBlur === true,
          onChange: function (value) {
            patchPrefs({ lyricBlur: value })
          },
        }),
      ),
      h(
        SetRow,
        { key: 'align', label: t('settings.lyricAlign') },
        h(KitSelect, {
          value: prefs.lyricAlign || 'center',
          label: t('settings.lyricAlign'),
          options: [
            { value: 'center', label: t('settings.alignCenter') },
            { value: 'left', label: t('settings.alignLeft') },
            { value: 'right', label: t('settings.alignRight') },
          ],
          onChange: function (value) {
            patchPrefs({ lyricAlign: String(value) })
          },
        }),
      ),
      h(
        SetRow,
        { key: 'filter-copyright', label: t('settings.lyricFilterCopyright'), desc: t('settings.lyricFilterCopyrightDesc') },
        h(Switch, {
          value: lyricFilterPresets().indexOf('copyright') >= 0,
          onChange: function (value) {
            toggleLyricFilterPreset('copyright', value)
          },
        }),
      ),
      h(
        SetRow,
        { key: 'filter-source', label: t('settings.lyricFilterSource') },
        h(Switch, {
          value: lyricFilterPresets().indexOf('lyricSource') >= 0,
          onChange: function (value) {
            toggleLyricFilterPreset('lyricSource', value)
          },
        }),
      ),
      h(
        SetRow,
        { key: 'filter-words', label: t('settings.lyricFilterWords'), desc: t('settings.lyricFilterWordsDesc') },
        h(KitInput, {
          value: String(prefs.lyricFilterWords || ''),
          placeholder: t('settings.lyricFilterWordsPlaceholder'),
          label: t('settings.lyricFilterWords'),
          onChange: function (value) {
            patchPrefs({ lyricFilterWords: value })
          },
        }),
      ),
      h(
        SetRow,
        {
          key: 'auto-best-lyric',
          label: t('settings.lyricAutoBest'),
          desc: t(prefs.autoUseBestLyric === false ? 'settings.lyricAutoBestOff' : 'settings.lyricAutoBestDesc'),
        },
        h(Switch, {
          value: prefs.autoUseBestLyric !== false,
          onChange: function (value) {
            patchPrefs({ autoUseBestLyric: value })
          },
        }),
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
          key: 'replayGain',
          label: t('settings.replayGain'),
          desc: t('settings.replayGainHint'),
        },
        h(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
          h(KitSelect, {
            value: prefs.replayGainMode === 'off' || prefs.replayGainMode === 'track' || prefs.replayGainMode === 'album'
              ? prefs.replayGainMode
              : prefs.normalizeVolume === false
                ? 'off'
                : 'auto',
            label: t('settings.replayGain'),
            options: [
              { value: 'off', label: t('settings.replayGainOff') },
              { value: 'auto', label: t('settings.replayGainAuto') },
              { value: 'track', label: t('settings.replayGainTrack') },
              { value: 'album', label: t('settings.replayGainAlbum') },
            ],
            onChange: function (value) {
              var next = String(value)
              // 'off' also switches the loudness analysis off; the tag modes leave it
              // off too, since they read the file's own gain.
              patchPrefs({
                replayGainMode: next,
                normalizeVolume: next === 'off' ? false : true,
              })
              if (player.setNormalize) player.setNormalize(next === 'auto')
              if (player.setReplayGain) player.setReplayGain(0)
            },
          }),
        ),
      ),
      h(
        'div',
        { className: 'mp-set-hint' },
        t('settings.replayGainStatus'),
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
        {
          key: 'crossfade',
          label: t('settings.crossfade'),
          desc: t('settings.crossfadeHint'),
        },
        h(Switch, {
          value: crossfadeFadeSeconds(prefs) > 0,
          onChange: function (value) {
            patchPrefs({ crossfadeSeconds: value ? CROSSFADE_MAX_SECONDS : 0 })
          },
        }),
      ),
      h(
        SetRow,
        {
          key: 'playback-fade',
          label: t('settings.playbackFade'),
          desc: t('settings.playbackFadeHint'),
        },
        h(Switch, {
          value: prefs.playbackFade !== false,
          onChange: function (value) {
            patchPrefs({ playbackFade: value })
            player.setPlaybackFade(value)
          },
        }),
      ),
      h(
        SetRow,
        {
          key: 'playback-reports',
          label: t('settings.playbackReports'),
          desc: t('settings.playbackReportsHint'),
        },
        h(Switch, {
          value: prefs.playbackReports === true,
          onChange: function (value) {
            patchPrefs({ playbackReports: value })
          },
        }),
      ),
      sinkSupported && outputDevices.length > 0
        ? h(
            SetRow,
            {
              key: 'output-device',
              label: t('settings.outputDevice'),
              desc: t('settings.outputDeviceHint'),
            },
            h(KitSelect, {
              value: prefs.audioOutputDeviceId || '',
              label: t('settings.outputDevice'),
              options: [{ value: '', label: t('settings.outputDefault') }].concat(
                outputDevices.map(function (device) {
                  return { value: device.id, label: device.label }
                }),
              ),
              onChange: function (value) {
                var next = String(value || '')
                patchPrefs({ audioOutputDeviceId: next })
                player.setOutputDevice(next)
              },
            }),
          )
        : null,
      h(
        SetRow,
        { key: 'sleep', label: t('settings.sleepTimer') },
        h(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
          h(KitSelect, {
            value: String(prefs.sleepTimerMinutes || 0),
            label: t('settings.sleepTimer'),
            options: [0, 15, 30, 60, 90].map(function (minutes) {
              return {
                value: String(minutes),
                label: minutes === 0 ? t('settings.sleepOff') : t('v2.minutes', { n: minutes }),
              }
            }),
            onChange: function (value) {
              var minutes = Number(value) || 0
              patchPrefs({
                sleepTimerMinutes: minutes,
                sleepDeadline: minutes > 0 ? Date.now() + minutes * 60000 : 0,
              })
            },
          }),
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
    // Only platforms that declare a sign-in flow get a card here; the list comes
    // from whatever the host registered, so a new platform needs no client edit.
    var ids = availableSources().filter(function (provider) {
      return provider !== 'local' && (supports(provider, 'loginQr') || supports(provider, 'loginPassword'))
    })
    var logged = ids.filter(function (provider) {
      return providers[provider] && providers[provider].loggedIn === true
    }).length
    function providerLabel(provider) {
      return sourceLabelOf(provider)
    }
    /**
     * Navidrome / Subsonic: a URL + credential form instead of a QR flow.
     * The password only travels once, to be traded for a salted token.
     */
    function navidromeCard(info, form) {
      var busy = form.phase === 'loading'
      return h(
        'div',
        { key: 'navidrome', className: cx('mp-online-card', 'is-navidrome', info.loggedIn === true && 'is-logged') },
        h(
          'div',
          { className: 'mp-online-card-head' },
          // Official logo, verbatim and unmodified (navidrome.org/brand allows
          // it for a server-connection screen). Sized to match the other
          // provider logos rather than above them, as the guidelines require.
          h('span', { className: 'mp-online-logo', title: 'Navidrome' }, providerLogo('navidrome', 38)),
          h(
            'div',
            { className: 'mp-online-title' },
            h('div', { className: 'mp-online-name' }, t('online.providerNavidrome')),
            h(
              'div',
              { className: 'mp-online-state' },
              info.loggedIn === true ? t('online.loggedIn') : t('online.loggedOut'),
            ),
          ),
        ),
        info.loggedIn === true
          ? h(
              'div',
              { className: 'mp-online-body' },
              h(
                'div',
                { className: 'mp-online-meta' },
                h('strong', { className: 'mp-online-nick' }, info.nickname || info.username || t('online.loggedIn')),
                info.server ? h('span', { className: 'mp-online-hint-text' }, info.server) : null,
              ),
              h(IconButton, {
                icon: 'logout',
                size: 15,
                title: t('online.logout'),
                onClick: function () {
                  form.reset()
                  void logoutProvider('navidrome')
                },
              }),
            )
          : h(
              'div',
              { className: 'mp-online-body is-out mp-navidrome-body' },
              h('span', { className: 'mp-online-hint-text' }, t('online.navidromeHint')),
              h(KitInput, {
                type: 'url',
                placeholder: t('online.navidromeServerPlaceholder'),
                label: t('online.navidromeServerPlaceholder'),
                value: form.server,
                disabled: busy,
                onChange: function (value) {
                  form.setServer(value)
                },
              }),
              h(KitInput, {
                type: 'text',
                placeholder: t('online.navidromeUser'),
                label: t('online.navidromeUser'),
                value: form.username,
                disabled: busy,
                onChange: function (value) {
                  form.setUsername(value)
                },
              }),
              h(KitInput, {
                type: 'password',
                placeholder: t('online.navidromePassword'),
                label: t('online.navidromePassword'),
                value: form.password,
                disabled: busy,
                onChange: function (value) {
                  form.setPassword(value)
                },
              }),
              h(
                'div',
                {
                  className: 'mp-online-hint-text',
                  style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' },
                },
                h('span', null, t('online.navidromeKeep')),
                h(Switch, {
                  value: form.keepPassword === true,
                  label: t('online.navidromeKeep'),
                  disabled: busy,
                  onChange: function (next) {
                    form.setKeepPassword(next === true)
                  },
                }),
              ),
              form.keepPassword === true
                ? h('span', { className: 'mp-online-hint-text' }, t('online.navidromeKeepWarn'))
                : null,
              form.error !== ''
                ? h('span', { className: 'mp-online-error' }, form.error)
                : form.notice !== ''
                  ? h('span', { className: 'mp-online-ok' }, form.notice)
                  : null,
              h(Button, {
                variant: 'primary',
                icon: 'checkCircle',
                disabled: busy,
                onClick: function () {
                  void form.connect()
                },
                children: busy ? t('online.navidromeConnecting') : t('online.navidromeConnect'),
              }),
            ),
      )
    }

    function card(provider) {
      var info = providers[provider] || {}
      // Navidrome signs in with credentials, not a QR code, so it gets its own
      // body instead of the shared "scan to sign in" branch below.
      if (provider === 'navidrome') return navidromeCard(info, navForm)
      return h(
        'div',
        { key: provider, className: cx('mp-online-card', 'is-' + provider, info.loggedIn === true && 'is-logged') },
        h(
          'div',
          { className: 'mp-online-card-head' },
          h('span', { className: 'mp-online-logo' }, providerLogo(provider, 38)),
          h(
            'div',
            { className: 'mp-online-title' },
            h('div', { className: 'mp-online-name' }, providerLabel(provider)),
            h(
              'div',
              { className: 'mp-online-state' },
              info.loggedIn === true ? t('online.loggedIn') : t('online.loggedOut'),
            ),
          ),
        ),
        info.loggedIn
          ? h(
              'div',
              { className: 'mp-online-body' },
              accountAvatar(info),
              h(
                'div',
                { className: 'mp-online-meta' },
                h('strong', { className: 'mp-online-nick' }, info.nickname || (provider === 'qq' ? t('online.qqAccount') : t('online.loggedIn'))),
                info.accountId ? h('span', { className: 'mp-online-id' }, 'ID ' + info.accountId) : null,
                info.vip === true ? h('span', { className: 'mp-online-vip' }, 'VIP') : null,
              ),
              h(IconButton, {
                icon: 'logout',
                size: 15,
                title: t('online.logout'),
                onClick: function () {
                  void logoutProvider(provider)
                },
              }),
            )
          : h(
              'div',
              { className: 'mp-online-body is-out' },
              h('span', { className: 'mp-online-hint-text' }, t('online.accountHint')),
              h(Button, {
                variant: 'primary',
                icon: 'qr',
                onClick: function () {
                  pushLayer('login', { provider: provider })
                },
                children: t('online.login'),
              }),
            ),
      )
    }
    return [
      h(
        'div',
        { key: 'head', className: 'mp-online-head' },
        h('h2', null, t('v2.online')),
        h('span', { className: 'mp-online-count' }, t('online.loggedCount', { n: logged, total: ids.length })),
      ),
      h('div', { key: 'grid', className: 'mp-online-grid' }, ids.map(card)),
      h(
        'div',
        { key: 'hint', className: 'mp-online-foot' },
        icon('info', 13),
        h('span', null, t('online.settingsHint')),
      ),
    ]
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
          library.truncated === true ? ' · ' + t('page.truncated') : '',
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
          h(KitInput, {
            value: rootDraft,
            placeholder: 'D:\\Music',
            label: t('settings.addFolder'),
            onChange: function (value) {
              setRootDraft(value)
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
            h(KitSelect, {
              value: String(config.depth === undefined ? 4 : config.depth),
              label: t('settings.depth'),
              options: [0, 1, 2, 3, 4, 5, 6].map(function (n) {
                return { value: String(n), label: String(n) }
              }),
              onChange: function (value) {
                void saveConfig({ depth: Number(value) })
              },
            }),
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
    var stats = cache || { songs: 0, files: 0, bytes: 0, categories: { audio: { files: 0, bytes: 0 }, cover: { files: 0, bytes: 0 } } }
    var dataStats = data || { files: 0, bytes: 0, categories: [] }
    var categories = Array.isArray(dataStats.categories) ? dataStats.categories : []
    var cacheCategories = [
      { key: 'audio', label: t('data.cacheAudio'), meta: fmtBytes((stats.categories && stats.categories.audio && stats.categories.audio.bytes) || 0) },
      { key: 'cover', label: t('data.cacheCovers'), meta: fmtBytes((stats.categories && stats.categories.cover && stats.categories.cover.bytes) || 0) },
      { key: 'lyrics', label: t('data.cacheLyrics'), meta: '' },
    ]
    var limitOptions = [
      { value: '1', label: '1 GB' },
      { value: '2', label: '2 GB' },
      { value: '5', label: '5 GB' },
      { value: '10', label: '10 GB' },
      { value: '20', label: '20 GB' },
      { value: '50', label: '50 GB' },
      { value: '0', label: t('data.cacheNoLimit') },
    ]
    var limitGb = prefs.onlineCacheLimitGb === undefined ? 5 : Number(prefs.onlineCacheLimitGb)
    function clearCategory(category) {
      postJson(API + 'online/cache', { category: category })
        .then(function () {
          showToast(t('online.cacheCleared'))
          return getJson(API + 'online/cache').then(function (body) {
            setCache(body)
          })
        })
        .catch(function (error) {
          showToast(errorText(error))
        })
    }
    return [
      h('h2', { key: 'h' }, t('v2.dataTab')),
      h(
        SetRow,
        { key: 'cache-enable', label: t('data.cacheEnable'), desc: t('data.cacheEnableDesc') },
        h(Switch, {
          value: prefs.onlineCacheEnabled === true,
          onChange: function (value) {
            patchPrefs({ onlineCacheEnabled: value })
          },
        }),
      ),
      h(
        SetRow,
        { key: 'cache-limit', label: t('data.cacheLimit'), desc: t('data.cacheLimitDesc') },
        mpSegment(limitOptions, String(limitGb), function (value) {
          patchPrefs({ onlineCacheLimitGb: Number(value) })
        }),
      ),
      h(
        'div',
        { key: 'cache-usage', className: 'mp-data-total' },
        h('span', { className: 'mp-data-total-label' }, t('data.cacheUsageLabel')),
        h(
          'strong',
          null,
          t('data.cacheUsage', { songs: stats.songs || 0, size: fmtBytes(stats.bytes || 0) }),
        ),
      ),
      h(
        'div',
        { key: 'cache-rows', className: 'mp-data-rows' },
        cacheCategories.map(function (category) {
          return h(
            'div',
            { key: category.key, className: 'mp-data-row' },
            h('span', { className: 'mp-data-row-label' }, category.label),
            h('span', { className: 'mp-data-row-meta' }, category.meta),
            h(
              Button,
              {
                variant: 'ghost',
                icon: 'trash',
                onClick: function () {
                  clearCategory(category.key)
                },
              },
              t('data.cacheClear'),
            ),
          )
        }),
      ),
      h('p', { key: 'cache-hint', className: 'mp-set-desc' }, t('data.cacheHint')),
      h(
        'div',
        { key: 'data-total', className: 'mp-data-total' },
        h('span', { className: 'mp-data-total-label' }, t('data.total')),
        h('strong', null, t('data.files', { n: dataStats.files || 0, size: fmtBytes(dataStats.bytes || 0) })),
      ),
      categories.length === 0
        ? null
        : h(
            'div',
            { key: 'data-rows', className: 'mp-data-rows' },
            categories.map(function (category) {
              return h(
                'div',
                { key: category.id, className: 'mp-data-row' },
                h('span', { className: 'mp-data-row-label' }, t('data.category.' + category.id)),
                h(
                  'span',
                  { className: 'mp-data-row-meta' },
                  t('data.files', { n: category.files || 0, size: fmtBytes(category.bytes || 0) }),
                ),
              )
            }),
          ),
      h('p', { key: 'data-hint', className: 'mp-set-desc' }, t('data.hint')),
      h(
        'div',
        { key: 'danger', className: 'mp-data-danger' },
        h('div', { className: 'mp-data-danger-title' }, t('data.resetTitle')),
        h('p', { className: 'mp-data-danger-desc' }, t('data.resetHint')),
        h(
          Button,
          {
            variant: 'primary',
            className: 'mp-data-danger-btn',
            onClick: function () {
              setResetStage(1)
            },
          },
          t('data.resetAction'),
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
      h(
        SetRow,
        { key: 'gallery', label: t('about.componentTest'), desc: t('about.componentTestDesc') },
        h(Button, { icon: 'list', onClick: function () { setGalleryOpen(true) } }, t('about.componentTestOpen')),
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
      galleryOpen
        ? h(ComponentGallery, {
            key: 'gallery',
            onClose: function () {
              setGalleryOpen(false)
            },
          })
        : [
            h(
              'div',
              { key: 'nav', className: 'mp-sheet-nav' },
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
                  icon(item.glyph, 15),
                  h('span', { className: 'mp-sheet-tab-label' }, t(item.label)),
                )
              }),
            ),
            h(
              'button',
              {
                key: 'close',
                type: 'button',
                className: 'mp-sheet-close',
                title: t('v2.close'),
                'aria-label': t('v2.close'),
                onClick: props.onClose,
              },
              icon('x', 16),
            ),
            h('div', { key: 'body', className: 'mp-sheet-body' }, body, resetDialog()),
          ],
    ),
  )
}


