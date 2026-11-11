/**
 * now playing: the 0.11.1 full-panel player (square/circular disc, blurred
 * cover backdrop, floating transport panel) rebuilt on the v2 state layer.
 */

function lyricActiveIndex(lines, seconds) {
  if (!Array.isArray(lines) || lines.length === 0) return -1
  if (lines[0].time < 0) return -1
  var low = 0
  var high = lines.length - 1
  var found = -1
  while (low <= high) {
    var mid = (low + high) >> 1
    if (lines[mid].time <= seconds + 0.05) {
      found = mid
      low = mid + 1
    } else {
      high = mid - 1
    }
  }
  return found
}

function NowPlaying(props) {
  var snap = usePlayerSnapshot()
  var time = usePlayerTime()
  var prefs = usePrefs()
  var track = snap.queue[snap.index] || null
  var trackPath = track ? track.path : ''
  var pair = useState([])
  var lyrics = pair[0]
  var setLyrics = pair[1]
  var errorPair = useState('')
  var lyricError = errorPair[0]
  var setLyricError = errorPair[1]
  var settingsPair = useState(false)
  var settingsOpen = settingsPair[0]
  var setSettingsOpen = settingsPair[1]
  var settingsRef = useRef(null)
  var settingsBtnRef = useRef(null)
  var offsetPair = useState(0)
  var offsetMs = offsetPair[0]
  var setOffsetMs = offsetPair[1]
  var reloadPair = useState(0)
  var lyricReload = reloadPair[0]
  var setLyricReload = reloadPair[1]
  var boxRef = useRef(null)
  var innerRef = useRef(null)
  var rowRefs = useRef([])

  useEffect(
    function () {
      if (!settingsOpen) return undefined
      function onDown(event) {
        var target = event.target
        if (settingsRef.current && settingsRef.current.contains(target)) return
        if (settingsBtnRef.current && settingsBtnRef.current.contains(target)) return
        setSettingsOpen(false)
      }
      function onKey(event) {
        if (event.key === 'Escape') setSettingsOpen(false)
      }
      document.addEventListener('pointerdown', onDown, true)
      window.addEventListener('keydown', onKey)
      return function () {
        document.removeEventListener('pointerdown', onDown, true)
        window.removeEventListener('keydown', onKey)
      }
    },
    [settingsOpen],
  )
  var cover = track ? trackCoverSrc(track) : ''
  var circular = prefs.circularCover === true
  var spinning = circular && prefs.coverSpin === true && snap.playing
  var vinyl = prefs.vinylRing === true && circular
  var lyricSize = prefs.lyricSize || 18
  var translationSize = Math.round((lyricSize * (prefs.translationScale || 80)) / 100)
  var lyricsTimed = lyrics.length > 0 && lyrics[0].time >= 0

  useEffect(
    function () {
      if (props.open !== true || trackPath === '') return undefined
      var cancelled = false
      setLyrics([])
      setLyricError('')
      var current = snap.queue[snap.index]
      async function load() {
        try {
          if (current.onlineProvider) {
            var body = await getJson(
              API +
                'online/lyric?provider=' +
                encodeURIComponent(current.onlineProvider) +
                '&id=' +
                encodeURIComponent(current.onlineId || ''),
            )
            var lines = parseLrcText(body.lrc || '')
            if (body.translation) mergeLyricTranslation(lines, body.translation)
            if (!cancelled) {
              setLyrics(lines)
              setOffsetMs(0)
            }
            return
          }
          var order = Array.isArray(prefs.lyricOrder) ? prefs.lyricOrder.join(',') : 'embedded,lrc'
          var local = await getJson(
            API + 'lyrics?path=' + encodeURIComponent(current.path) + '&order=' + encodeURIComponent(order),
          )
          if (!cancelled) {
            setLyrics(Array.isArray(local.lines) ? local.lines : [])
            setOffsetMs(Number(local.offsetMs) || 0)
          }
        } catch (error) {
          if (!cancelled) setLyricError(errorText(error))
        }
      }
      load()
      return function () {
        cancelled = true
      }
    },
    [props.open, trackPath, lyricReload],
  )

  var active = lyricActiveIndex(lyrics, time.currentTime - offsetMs / 1000)
  var duration = time.duration > 0 ? time.duration : track ? track.durationSec || 0 : 0
  var favorite = track !== null && props.favoriteSet[track.path] === true

  // Keep the active line vertically centred, using real row heights.
  useEffect(
    function () {
      var box = boxRef.current
      var inner = innerRef.current
      if (box === null || inner === null) return
      if (lyrics.length === 0 || !lyricsTimed) {
        inner.style.transform = ''
        return
      }
      var index = active >= 0 ? active : 0
      var row = rowRefs.current[index]
      if (!row) return
      var offset = row.offsetTop - (box.clientHeight / 2 - row.offsetHeight / 2)
      inner.style.transform = 'translateY(' + -offset + 'px)'
    },
    [active, lyrics],
  )

  function seekLine(line) {
    if (!line || line.time < 0) return
    player.seek(line.time + offsetMs / 1000)
  }

  function applyOffset(delta) {
    if (!track || track.onlineProvider) return
    var next = Math.max(-60000, Math.min(60000, offsetMs + delta))
    setOffsetMs(next)
    postJson(API + 'lyrics/calibrate', { path: track.path, offsetMs: next }).catch(function (error) {
      setLyricError(errorText(error))
    })
  }

  function writeLyricsBack() {
    if (!track || track.onlineProvider) return
    postJson(API + 'lyrics/calibrate', { path: track.path, offsetMs: offsetMs, write: true })
      .then(function () {
        setLyricReload(function (value) {
          return value + 1
        })
        showToast(t('page.lyricsSaved'))
      })
      .catch(function (error) {
        setLyricError(errorText(error))
      })
  }

  function openOnlineLyric() {
    if (!track || track.onlineProvider) return
    pushLayer('onlineLyric', {
      track: { path: track.path, title: trackTitleOf(track), artist: trackArtistOf(track) },
      onApply: function (lrc) {
        postJson(API + 'lyrics/save', { path: track.path, lrc: lrc })
          .then(function () {
            setLyricReload(function (value) {
              return value + 1
            })
            showToast(t('page.lyricsSaved'))
          })
          .catch(function (error) {
            showToast(errorText(error))
          })
      },
    })
  }

  return h(
    'div',
    {
      className: cx(
        'mp-np',
        props.open === true && 'is-open',
        prefs.lyricBlur === true && 'is-blur',
        'mp-align-' + (prefs.lyricAlign || 'center'),
      ),
      role: 'dialog',
      'aria-label': t('page.openPlayer'),
      'aria-hidden': props.open === true ? 'false' : 'true',
      style: {
        '--mp-lyric-size': lyricSize + 'px',
        '--mp-lyric-weight': String(prefs.lyricWeight || 500),
        '--mp-lyric-trans': translationSize + 'px',
      },
    },
    cover !== '' ? h('div', { className: 'mp-np-bg' }, h('img', { src: cover, alt: '' })) : null,
    h('div', { className: 'mp-np-shade' }),
    h(
      'div',
      { className: 'mp-np-head' },
      h(IconButton, { icon: 'chevronDown', size: 20, title: t('page.closePlayer'), onClick: props.onClose }),
      h('div', { className: 'mp-np-head-title' }, track ? trackTitleOf(track) : t('page.noTrack')),
      h(
        'div',
        { className: 'mp-np-head-actions' },
        h(
          'button',
          {
            type: 'button',
            ref: settingsBtnRef,
            className: cx('mp-iconbtn', 'mp-trans-toggle', settingsOpen && 'is-on'),
            title: t('v2.lyricSettings'),
            onClick: function () {
              setSettingsOpen(!settingsOpen)
            },
          },
          'Aa',
        ),
        h(
          'button',
          {
            type: 'button',
            className: cx('mp-iconbtn', 'mp-trans-toggle', prefs.showTranslation === true && 'is-on'),
            title: t('page.translation'),
            onClick: function () {
              setPrefs({ showTranslation: prefs.showTranslation !== true })
            },
          },
          '译',
        ),
      ),
    ),
    settingsOpen
      ? h(
          'div',
          { className: 'mp-np-settings', ref: settingsRef },
          h(
            'div',
            { className: 'mp-np-setting' },
            h(
              'div',
              { className: 'mp-np-setting-head' },
              h('span', null, t('page.lyricSize')),
              h('span', { className: 'mp-set-val' }, lyricSize + ' px'),
            ),
            h('input', {
              type: 'range',
              className: 'mp-range',
              min: 14,
              max: 40,
              step: 1,
              value: lyricSize,
              onChange: function (event) {
                setPrefs({ lyricSize: Number(event.target.value) })
              },
            }),
          ),
          h(
            'div',
            { className: 'mp-np-setting' },
            h(
              'div',
              { className: 'mp-np-setting-head' },
              h('span', null, t('page.lyricWeight')),
              h('span', { className: 'mp-set-val' }, String(prefs.lyricWeight || 500)),
            ),
            h('input', {
              type: 'range',
              className: 'mp-range',
              min: 300,
              max: 800,
              step: 100,
              value: prefs.lyricWeight || 500,
              onChange: function (event) {
                setPrefs({ lyricWeight: Number(event.target.value) })
              },
            }),
          ),
          h(
            'div',
            { className: 'mp-np-setting-head' },
            h('span', { style: { fontSize: '12px', color: 'var(--dsw-alias-label-secondary,#a1a1aa)' } }, t('page.translationScale')),
            h('span', { className: 'mp-set-val' }, String(prefs.translationScale || 80) + '%'),
          ),
          h('input', {
            type: 'range',
            className: 'mp-range',
            min: 50,
            max: 100,
            step: 5,
            value: prefs.translationScale || 80,
            onChange: function (event) {
              setPrefs({ translationScale: Number(event.target.value) })
            },
          }),
          h(
            SetRow,
            { label: t('page.lyricBlur') },
            h(Switch, {
              value: prefs.lyricBlur === true,
              onChange: function (value) {
                setPrefs({ lyricBlur: value })
              },
            }),
          ),
          h(
            SetRow,
            { label: t('page.translation') },
            h(Switch, {
              value: prefs.showTranslation === true,
              onChange: function (value) {
                setPrefs({ showTranslation: value })
              },
            }),
          ),
          track && !track.onlineProvider
            ? h(
                'div',
                { className: 'mp-np-setting' },
                h(
                  'div',
                  { className: 'mp-np-setting-head' },
                  h('span', null, t('page.lyricOffset')),
                  h('span', { className: 'mp-set-val' }, (offsetMs / 1000).toFixed(1) + ' s'),
                ),
                h(
                  'div',
                  { className: 'mp-np-offset-actions' },
                  h(
                    Button,
                    {
                      variant: 'ghost',
                      onClick: function () {
                        applyOffset(-500)
                      },
                    },
                    '−0.5s',
                  ),
                  h(
                    Button,
                    {
                      variant: 'ghost',
                      onClick: function () {
                        applyOffset(500)
                      },
                    },
                    '+0.5s',
                  ),
                  h(Button, { onClick: writeLyricsBack }, t('page.writeLyrics')),
                ),
                h('div', { className: 'mp-np-setting-hint' }, t('page.lyricOffsetHint')),
              )
            : null,
          track && !track.onlineProvider
            ? h(Button, { icon: 'search', onClick: openOnlineLyric }, t('page.onlineLyrics'))
            : null,
        )
      : null,
    h(
      'div',
      { className: 'mp-np-body' },
      h(
        'div',
        { className: 'mp-np-left' },
        h(
          'div',
          { className: 'mp-np-disc-wrap' },
          h(
            'div',
            {
              className: cx(
                'mp-np-disc',
                circular ? 'is-circle' : 'is-square',
                spinning && 'is-playing',
                vinyl && 'is-vinyl',
              ),
            },
            vinyl ? h('div', { className: 'mp-np-vinyl' }) : null,
            h(
              'div',
              { className: 'mp-np-art' },
              cover !== '' ? h('img', { src: cover, alt: '', draggable: false }) : icon('note', 96),
            ),
          ),
        ),
        h(
          'div',
          { className: 'mp-np-meta' },
          h('div', { className: 'mp-np-title' }, track ? trackTitleOf(track) : '—'),
          h('div', { className: 'mp-np-artist' }, track ? trackArtistOf(track) : ''),
        ),
      ),
      h(
        'div',
        { className: 'mp-np-right' },
        h(
          'div',
          { className: 'mp-np-lyrics' + (lyricsTimed ? '' : ' is-static'), ref: boxRef },
          lyrics.length === 0
            ? h('div', { className: 'mp-np-lyrics-empty' }, lyricError !== '' ? lyricError : t('page.noLyrics'))
            : h(
                'div',
                { className: 'mp-np-lyrics-inner', ref: innerRef },
                lyrics.map(function (line, index) {
                  return h(
                    'div',
                    {
                      key: String(index),
                      ref: function (element) {
                        rowRefs.current[index] = element
                      },
                      className:
                        'mp-np-line' +
                        (index === active ? ' is-active' : '') +
                        (active >= 0 && index < active ? ' is-past' : ''),
                      style: {
                        '--mp-line-stagger': String(active >= 0 ? Math.min(Math.abs(index - active), 8) : 0),
                      },
                      onClick: function () {
                        seekLine(line)
                      },
                    },
                    h('div', { className: 'mp-np-line-text' }, line.text),
                    prefs.showTranslation === true && line.translation
                      ? line.translation.split('\n').map(function (part, partIndex) {
                          return h(
                            'div',
                            { key: 'translation-' + partIndex, className: 'mp-np-line-trans' },
                            part,
                          )
                        })
                      : null,
                  )
                }),
              ),
        ),
      ),
    ),
    h(
      'div',
      { className: 'mp-np-bottom' },
      h('div', { className: 'mp-np-progress' }, h(SeekBar, { fallbackDuration: track ? track.durationSec || 0 : 0 })),
      h(
        'div',
        { className: 'mp-np-bar' },
        h(
          'div',
          { className: 'mp-np-time' },
          h('span', null, fmtClock(time.currentTime)),
          h('span', { className: 'mp-np-time-sep' }, ' / '),
          h('span', null, fmtClock(duration)),
        ),
        h(
          'div',
          { className: 'mp-np-controls' },
          h(IconButton, {
            icon: playModeIcon(playModeOf(snap)),
            size: 17,
            title: t('page.loopAll'),
            onClick: function () {
              cyclePlayMode(snap)
            },
          }),
          h(IconButton, {
            icon: 'prev',
            size: 18,
            title: t('page.prev'),
            onClick: function () {
              player.prev()
            },
          }),
          h(
            'button',
            {
              type: 'button',
              className: 'mp-pb-play',
              title: snap.playing ? t('page.pause') : t('page.play'),
              onClick: function () {
                player.toggle()
              },
            },
            icon(snap.playing ? 'pause' : 'play', 18),
          ),
          h(IconButton, {
            icon: 'next',
            size: 18,
            title: t('page.next'),
            onClick: function () {
              player.next()
            },
          }),
          h(
            'div',
            { className: 'mp-pb-queue-wrap' },
            h(IconButton, {
              icon: 'playlist',
              size: 17,
              active: props.queueOpen,
              title: t('page.queue'),
              onClick: props.onToggleQueue,
            }),
            props.queueOpen
              ? h(QueuePopover, {
                  open: true,
                  anchored: true,
                  snap: snap,
                  onClose: props.onToggleQueue,
                })
              : null,
          ),
        ),
        h(
          'div',
          { className: 'mp-np-vol' },
          track && track.sampleRate ? h('span', { className: 'mp-quality' }, fmtKhz(track.sampleRate)) : null,
          track && !track.onlineProvider
            ? h(IconButton, {
                icon: 'heart',
                size: 18,
                active: favorite,
                title: favorite ? t('page.unfavorite') : t('page.favorite'),
                onClick: function () {
                  if (props.onToggleFavorite) props.onToggleFavorite(track)
                },
              })
            : null,
        ),
      ),
    ),
  )
}
