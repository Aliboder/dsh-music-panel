/**
 * composer seats: the inline lyric line and the compact transport next to the
 * chat input. Both are optional and disappear when nothing is playing.
 */

var globalQueueStore = createStore({ open: false })

function ComposerLyrics() {
  var prefs = usePrefs()
  var snap = usePlayerSnapshot()
  var time = usePlayerTime()
  var track = snap.queue[snap.index] || null
  var trackPath = track ? track.path : ''
  var pair = useState([])
  var lines = pair[0]
  var setLines = pair[1]

  useEffect(
    function () {
      if (prefs.composerLyrics !== true || trackPath === '') {
        setLines([])
        return undefined
      }
      var cancelled = false
      var active = snap.queue[snap.index]
      if (!active) return undefined
      async function load() {
        try {
          if (active.onlineProvider) {
            var body = await getJson(
              API +
                'online/lyric?provider=' +
                encodeURIComponent(active.onlineProvider) +
                '&id=' +
                encodeURIComponent(active.onlineId || ''),
            )
            if (!cancelled) setLines(parseLrcText(body.lrc || ''))
            return
          }
          var local = await getJson(
            API + 'lyrics?path=' + encodeURIComponent(active.path) + '&order=embedded,lrc',
          )
          if (!cancelled) setLines(Array.isArray(local.lines) ? local.lines : [])
        } catch (error) {
          if (!cancelled) setLines([])
        }
      }
      load()
      return function () {
        cancelled = true
      }
    },
    [prefs.composerLyrics, trackPath],
  )

  if (prefs.composerLyrics !== true || track === null) return null
  var index = lyricActiveIndex(lines, time.currentTime)
  var line = index >= 0 ? lines[index] : null
  return h(
    'div',
    { className: 'mp-composer-lyrics' },
    icon('note', 12),
    h('span', null, line ? line.text : trackTitleOf(track)),
    prefs.showTranslation === true && line && line.translation
      ? h('span', { style: { opacity: 0.65 } }, '· ' + line.translation)
      : null,
  )
}

function ComposerCluster() {
  var snap = usePlayerSnapshot()
  var queueState = useStore(globalQueueStore)
  var track = snap.queue[snap.index] || null
  if (track === null) return null
  return h(
    'div',
    { className: 'mp-composer-cluster' },
    h(
      'button',
      {
        type: 'button',
        className: 'mp-cbtn',
        title: snap.playing ? t('page.pause') : t('page.play'),
        onClick: function () {
          player.toggle()
        },
      },
      icon(snap.playing ? 'pause' : 'play', 14),
    ),
    h(
      'button',
      {
        type: 'button',
        className: cx('mp-cbtn', queueState.open && 'is-on'),
        'data-queue-toggle': 'true',
        title: t('page.queue'),
        onClick: function () {
          globalQueueStore.set({ open: !queueState.open })
        },
      },
      icon('playlist', 14),
      h('span', null, trackTitleOf(track)),
    ),
  )
}

function GlobalQueueHost() {
  var state = useStore(globalQueueStore)
  var snap = usePlayerSnapshot()
  var posPair = useState(null)
  var pos = posPair[0]
  var setPos = posPair[1]
  useEffect(
    function () {
      function onKey(event) {
        if (event.key === 'Escape' && globalQueueStore.get().open) {
          globalQueueStore.set({ open: false })
        }
      }
      window.addEventListener('keydown', onKey)
      return function () {
        window.removeEventListener('keydown', onKey)
      }
    },
    [],
  )
  useEffect(
    function () {
      if (state.open !== true) {
        setPos(null)
        return undefined
      }
      function place() {
        var button = document.querySelector('.mp-composer-cluster [data-queue-toggle]')
        if (!button) {
          setPos(null)
          return
        }
        var rect = button.getBoundingClientRect()
        var width = Math.min(340, window.innerWidth - 16)
        var left = Math.max(8, Math.min(window.innerWidth - width - 8, rect.right - width))
        var below = rect.top < window.innerHeight * 0.5
        setPos(
          below
            ? { left: left + 'px', right: 'auto', top: rect.bottom + 10 + 'px', bottom: 'auto', width: width + 'px' }
            : { left: left + 'px', right: 'auto', top: 'auto', bottom: window.innerHeight - rect.top + 10 + 'px', width: width + 'px' },
        )
      }
      place()
      window.addEventListener('resize', place)
      window.addEventListener('scroll', place, true)
      return function () {
        window.removeEventListener('resize', place)
        window.removeEventListener('scroll', place, true)
      }
    },
    [state.open],
  )
  return h(QueuePopover, {
    open: state.open === true,
    snap: snap,
    style: pos || undefined,
    onClose: function () {
      globalQueueStore.set({ open: false })
    },
  })
}
