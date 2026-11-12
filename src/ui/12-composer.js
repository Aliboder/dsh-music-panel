/**
 * composer seats: the inline lyric line and the compact transport next to the
 * chat input. Both are optional and disappear when nothing is playing.
 */

var useComposerLayoutEffect =
  typeof React !== 'undefined' && typeof React.useLayoutEffect === 'function' ? React.useLayoutEffect : useEffect

function composerLyricContent(entry) {
  return [
    h('span', { key: 'main', className: 'mp-composer-lyric-main' }, entry.text),
    entry.translation
      ? h('span', { key: 'trans', className: 'mp-composer-lyric-trans' }, entry.translation)
      : null,
  ]
}

function ComposerLyricText(props) {
  var line = props.line
  var showTranslation = props.showTranslation === true
  var text = line ? line.text : props.fallback
  var translation = showTranslation && line && line.translation ? line.translation : ''
  var key = (props.index >= 0 ? props.index : 'fallback') + '|' + text + '|' + translation
  var pair = useState(function () {
    return { current: { key: key, text: text, translation: translation }, previous: null }
  })
  var view = pair[0]
  var setView = pair[1]
  useEffect(
    function () {
      setView(function (previous) {
        if (previous.current && previous.current.key === key) return previous
        return {
          current: { key: key, text: text, translation: translation },
          previous: previous.current,
        }
      })
    },
    [key, text, translation],
  )
  var current = view.current
  var leaving = view.previous
  return h(
    'span',
    { className: 'mp-composer-lyric-viewport' },
    leaving
      ? h(
          'span',
          { key: 'out-' + leaving.key, className: 'mp-composer-lyric-layer is-leaving', 'aria-hidden': 'true' },
          composerLyricContent(leaving),
        )
      : null,
    h(
      'span',
      { key: 'in-' + current.key, className: 'mp-composer-lyric-layer is-entering' },
      composerLyricContent(current),
    ),
  )
}

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
    h('span', { className: 'mp-composer-lyric-icon' }, icon('note', 12)),
    h(ComposerLyricText, {
      line: line,
      index: index,
      fallback: trackTitleOf(track),
      showTranslation: prefs.showTranslation === true,
    }),
  )
}

function ComposerCluster() {
  var snap = usePlayerSnapshot()
  var ui = useStore(uiStore)
  var track = snap.queue[snap.index] || null
  var queueOpen = ui.queueOpen === true && ui.queueSource === 'composer'
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
        className: cx('mp-cbtn', queueOpen && 'is-on'),
        'data-queue-toggle': 'true',
        title: t('page.queue'),
        onClick: function () {
          setUi({ queueOpen: !queueOpen, queueSource: 'composer' })
        },
      },
      icon('playlist', 14),
      h('span', null, trackTitleOf(track)),
    ),
  )
}

function GlobalQueueHost() {
  var state = useStore(uiStore)
  var open = state.queueOpen === true && state.queueSource === 'composer'
  var snap = usePlayerSnapshot()
  var posPair = useState(null)
  var pos = posPair[0]
  var setPos = posPair[1]
  useEffect(
    function () {
      function onKey(event) {
        if (event.key === 'Escape' && uiStore.get().queueOpen) {
          setUi({ queueOpen: false })
        }
      }
      window.addEventListener('keydown', onKey)
      return function () {
        window.removeEventListener('keydown', onKey)
      }
    },
    [],
  )
  useComposerLayoutEffect(
    function () {
      if (open !== true) {
        setPos(null)
        return undefined
      }
      function place() {
        var button = document.querySelector('.mp-composer-cluster [data-queue-toggle]')
        if (!button) {
          setPos({ left: 'auto', right: '24px', bottom: '96px', width: 'min(340px, calc(100vw - 16px))' })
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
    [open],
  )
  return h(QueuePopover, {
    open: open,
    snap: snap,
    style: pos || { visibility: 'hidden' },
    onClose: function () {
      setUi({ queueOpen: false })
    },
  })
}
