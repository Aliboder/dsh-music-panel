/**
 * composer seats: the inline lyric line and the single queue button next to the chat
 * input. Both are optional and disappear when nothing is playing.
 */

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
  var offsetPair = useState(0)
  var lyricOffsetMs = offsetPair[0]
  var setLyricOffsetMs = offsetPair[1]
  // The parsed document the strip's lines came from: a change of the line filters re-runs
  // the display pass on it, exactly as the player page does.
  var docRef = useRef(null)
  var lyricRulesKey = mpLyricRulesKey()
  // The same source settings the player page reloads for: the strip follows the same lyric.
  var lyricSourceKey = (prefs.lyricLocalPriority === 'online' ? 'online' : 'local')
    + '\u0000' + String(prefs.lyricPreferredSource || '')
    + '\u0000' + (prefs.lyricKeepProviderWordTiming !== false ? 'keep-own' : 'all-sources')
    + '\u0000' + (Array.isArray(prefs.lyricFormatOrder) ? prefs.lyricFormatOrder.join(',') : '')
  var lastSourceKeyRef = useRef(null)
  var reloadPair = useState(0)
  var lyricReload = reloadPair[0]
  var setLyricReload = reloadPair[1]

  useEffect(
    function () {
      function onLyricsCleared() {
        setLyricReload(function (value) {
          return value + 1
        })
      }
      window.addEventListener('dsh-music:lyrics-cleared', onLyricsCleared)
      return function () {
        window.removeEventListener('dsh-music:lyrics-cleared', onLyricsCleared)
      }
    },
    [],
  )

  useEffect(
    function () {
      if (prefs.composerLyrics !== true || trackPath === '') {
        setLines([])
        setLyricOffsetMs(0)
        docRef.current = null
        return undefined
      }
      var cancelled = false
      // A changed source setting invalidates the shared load before reading it again.
      if (lastSourceKeyRef.current !== null && lastSourceKeyRef.current !== lyricSourceKey) {
        MPLyricLoader.invalidate(trackPath)
      }
      lastSourceKeyRef.current = lyricSourceKey
      var active = snap.queue[snap.index]
      if (!active) return undefined
      var unsubscribe = MPLyricLoader.subscribe(trackPath, function (next) {
        if (cancelled || next.upgraded === undefined) return
        docRef.current = next.document === null
          ? null
          : { document: next.document, chorusRanges: next.chorusRanges }
        setLyricOffsetMs(Number(next.offsetMs) || 0)
        setLines(composerLyricRows(next.lyrics))
      })
      async function load() {
        try {
          // One resolved lyric for every surface: the strip follows the same source the
          // stage and the player card show, including a matched or imported online lyric.
          var loaded = await MPLyricLoader.load(active)
          if (cancelled) return
          docRef.current = loaded.document === null
            ? null
            : { document: loaded.document, chorusRanges: loaded.chorusRanges }
          setLyricOffsetMs(Number(loaded.offsetMs) || 0)
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
    [prefs.composerLyrics, trackPath, lyricSourceKey, lyricReload],
  )

  // A changed line filter re-bakes the strip from the same document (no new request).
  useEffect(
    function () {
      var saved = docRef.current
      if (saved === null || trackPath === '') return
      setLines(composerLyricRows(mpPrepareLyrics(saved.document, trackPath, saved.chorusRanges).lyrics))
    },
    [lyricRulesKey],
  )

  if (prefs.composerLyrics !== true || track === null) return null
  // Same clock as the player page: the lyric record's per-song offset plus the global one.
  var index = lyricActiveIndex(
    lines,
    lyricClock(time.currentTime, lyricOffsetMs, prefs.lyricGlobalOffsetMs),
  )
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
  var queueOpen = useStore(p3QueueStore).open
  var track = snap.queue[snap.index] || null
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
          p3OpenQueue()
        },
      },
      icon('playlist', 14),
      h('span', null, trackTitleOf(track)),
    ),
  )
}

