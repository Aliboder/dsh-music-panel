/**
 * composer seats: the inline lyric line and the compact transport next to the
 * chat input. Both are optional and disappear when nothing is playing.
 */

var useComposerLayoutEffect =
  typeof React !== 'undefined' && typeof React.useLayoutEffect === 'function' ? React.useLayoutEffect : useEffect

function firstComposerTranslation(value) {
  var parts = String(value || '').split(/\r?\n/)
  for (var i = 0; i < parts.length; i += 1) {
    var text = parts[i].trim()
    if (text !== '') return text
  }
  return ''
}

/** The strip reads {time, text, translation}; Folia's lines carry the same data. */
function composerLyricRows(lines) {
  return (Array.isArray(lines) ? lines : []).map(function (line) {
    return {
      time: mpLineStart(line),
      text: String(line.fullText !== undefined ? line.fullText : line.text || ''),
      translation: typeof line.translation === 'string' ? line.translation : '',
    }
  })
}

function composerLyricContent(entry) {
  var translation = firstComposerTranslation(entry.translation)
  return [
    h('span', { key: 'main', className: 'mp-composer-lyric-main' }, entry.text),
    translation
      ? h('span', { key: 'trans', className: 'mp-composer-lyric-trans' }, translation)
      : null,
  ]
}

function ComposerLyricText(props) {
  var line = props.line
  var showTranslation = props.showTranslation === true
  var text = line ? line.text : props.fallback
  var translation = showTranslation && line ? firstComposerTranslation(line.translation) : ''
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
      var unsubscribe = MPLyricLoader.subscribe(trackPath, function (next) {
        if (cancelled || next.upgraded === undefined) return
        setLines(composerLyricRows(next.lyrics))
      })
      async function load() {
        try {
          // One resolved lyric for every surface: the strip follows the same source the
          // stage and the player card show, including a matched or imported online lyric.
          var loaded = await MPLyricLoader.load(active)
          if (cancelled) return
          setLines(composerLyricRows(loaded.lyrics))
        } catch (error) {
          if (!cancelled) setLines([])
        }
      }
      load()
      return function () {
        cancelled = true
        if (typeof unsubscribe === 'function') unsubscribe()
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
      showTranslation:
        prefs.composerTranslation !== false && prefs.showTranslation === true,
    }),
  )
}

/**
 * The composer seat is one control: the current track's queue button. It opens the queue
 * and nothing else — the bar has no room for a second target about the same song, and
 * pause/resume is already one row above in the sidebar transport, which is always visible.
 * The lyric strip above the input keeps its own switch.
 */
function ComposerCluster() {
  var prefs = usePrefs()
  var snap = usePlayerSnapshot()
  var ui = useStore(uiStore)
  var track = snap.queue[snap.index] || null
  var queueOpen = ui.queueOpen === true && ui.queueSource === 'composer'
  if (prefs.composerListButton === false || track === null) return null
  return h(
    'div',
    { className: 'mp-composer-cluster' },
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
