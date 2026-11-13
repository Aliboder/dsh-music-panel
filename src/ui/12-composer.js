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

/**
 * Feed the note icon's concentric rings from the live analyser. Updating CSS
 * variables from one RAF avoids React re-rendering the whole composer line on
 * every audio frame.
 */
function useComposerWave(ref, playing, active) {
  useEffect(
    function () {
      var node = ref.current
      if (node === null) return undefined
      var reduced =
        typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
      function reset() {
        node.style.setProperty('--mp-wave-level', '0')
      }
      if (active !== true || playing !== true || reduced) {
        reset()
        return undefined
      }
      var raf = 0
      var last = 0
      var smooth = 0
      var previousLow = 0
      function tick(now) {
        raf = requestAnimationFrame(tick)
        if (now - last < 50) return
        last = now
        var data = player.getWave()
        var target = 0
        if (data !== null && data.length > 0) {
          var bass = 0
          var bassPeak = 0
          var bassCount = 0
          var mid = 0
          var midCount = 0
          for (var i = 1; i < Math.min(10, data.length); i += 1) {
            var sample = data[i]
            bass += sample
            if (sample > bassPeak) bassPeak = sample
            bassCount += 1
          }
          for (var j = 10; j < Math.min(36, data.length); j += 1) {
            mid += data[j]
            midCount += 1
          }
          var low = bassCount > 0 ? (bass / bassCount / 255) * 0.45 + (bassPeak / 255) * 0.55 : 0
          var middle = midCount > 0 ? mid / midCount / 255 : 0
          // A beat is a positive jump in low-frequency energy; the onset term
          // makes the rings open visibly even when the average bass is steady.
          var onset = Math.max(0, low - previousLow)
          previousLow = low
          target = clamp(low * 1.55 + onset * 7 + middle * 0.28, 0, 1)
          target = Math.pow(target, 0.72)
        } else {
          previousLow = 0
        }
        var attack = target > smooth ? 0.68 : 0.16
        smooth += (target - smooth) * attack
        node.style.setProperty('--mp-wave-level', smooth.toFixed(3))
      }
      raf = requestAnimationFrame(tick)
      return function () {
        cancelAnimationFrame(raf)
        reset()
      }
    },
    [ref, playing, active],
  )
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
  var waveRef = useRef(null)

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
            var lines = parseLrcText(body.lrc || '')
            if (body.translation) mergeLyricTranslation(lines, body.translation)
            if (!cancelled) setLines(lines)
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

  useComposerWave(waveRef, snap.playing, prefs.composerLyrics === true)

  if (prefs.composerLyrics !== true || track === null) return null
  var index = lyricActiveIndex(lines, time.currentTime)
  var line = index >= 0 ? lines[index] : null
  return h(
    'div',
    { className: 'mp-composer-lyrics', ref: waveRef },
    h(
      'span',
      { className: 'mp-composer-lyric-icon' },
      h(
        'span',
        { className: 'mp-composer-wave', 'aria-hidden': 'true' },
        h('i', { key: '1' }),
        h('i', { key: '2' }),
        h('i', { key: '3' }),
      ),
      icon('note', 12),
    ),
    h(ComposerLyricText, {
      line: line,
      index: index,
      fallback: trackTitleOf(track),
      showTranslation:
        prefs.composerTranslation !== false && prefs.showTranslation === true,
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
