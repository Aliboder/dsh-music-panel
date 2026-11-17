/**
 * 播放页（重写版）— Folia 的结构，不保留旧的三栏布局。
 *
 *   PlayerShell
 *     backdrop  封面模糊 + 流光（保留的视觉资产）
 *     stage     当前歌词样式的渲染器（注册表，见 src/render/）
 *     topBar    返回 + 曲名/歌手 + 音质
 *     bottomBar 播放胶囊：上一个/播放/下一个 + 进度 + 时间
 *
 * 歌词、进度、样式全部走现有 store 与注册表；旧的 DOM 三栏已删除。
 */

function PlayerPage(props) {
  var snap = usePlayerSnapshot()
  var time = usePlayerTime()
  var prefs = usePrefs()
  var track = snap.queue[snap.index] || null
  var trackPath = track ? track.path : ''
  var cover = track ? trackCoverSrc(track) : ''
  var duration = Number(time.duration) || (track ? Number(track.durationSec) || 0 : 0)

  var pair = useState([])
  var lyrics = pair[0]
  var setLyrics = pair[1]
  var offsetPair = useState(0)
  var offsetMs = offsetPair[0]
  var setOffsetMs = offsetPair[1]
  var openPair = useState(false)
  var queueOpen = openPair[0]
  var setQueueOpen = openPair[1]

  useEffect(
    function () {
      if (trackPath === '') return undefined
      var cancelled = false
      // The stage reads the same resolved lyric every surface gets — an online song
      // through the platform (or its borrowed/imported lyric), a local file through the
      // Host's pick. Before this, an online track had no lyric here at all: `/lyrics` only
      // accepts a file path, and `online:<provider>:<id>` is not one.
      setLyrics([])
      // The loader may replace the first lyric with a better-timed one after playback
      // starts; the stage follows it, as Folia's setter does.
      var unsubscribe = MPLyricLoader.subscribe(trackPath, function (next) {
        if (cancelled || next.upgraded === undefined) return
        setLyrics(next.document === null ? legacyLinesToFolia(next.lyrics) : next.lyrics)
      })
      MPLyricLoader.load(track)
        .then(function (loaded) {
          if (cancelled) return
          setLyrics(loaded.document === null ? legacyLinesToFolia(loaded.lyrics) : loaded.lyrics)
          setOffsetMs(Number(loaded.offsetMs) || 0)
        })
        .catch(function () {
          if (!cancelled) setLyrics([])
        })
      return function () {
        cancelled = true
        if (typeof unsubscribe === 'function') unsubscribe()
      }
    },
    [props.open, trackPath],
  )

  var now = (Number(time.currentTime) || 0) - offsetMs / 1000
  var active = -1
  for (var index = 0; index < lyrics.length; index += 1) {
    if (mpLineStart(lyrics[index]) <= now) active = index
    else break
  }

  var backdrop = h(
    'div',
    { className: 'mp-page-backdrop' },
    cover !== ''
      ? h('img', { className: 'mp-page-bg', src: cover, alt: '', 'aria-hidden': 'true' })
      : null,
    h('div', { className: 'mp-page-wash', 'aria-hidden': 'true' }),
  )

  var lyricStyleId = mpResolveLyricStyle(prefs.lyricStyle, {
    seed: trackPath,
    time: Number(time.currentTime) || 0,
    duration: duration,
  })
  var stage =
    lyrics.length === 0
      ? null
      : h(LyricStage, {
    lines: lyrics,
    offsetMs: offsetMs,
    active: active,
    focus: active,
    now: now,
    timed: lyrics.length > 0 && mpLineStart(lyrics[0]) >= 0,
    prefs: prefs,
    rowRefs: [],
    wordSpans: wordSpans,
    onSeekLine: function (line) {
      var start = mpLineStart(line)
      if (line && isFinite(start) && start >= 0) player.seek(start + offsetMs / 1000)
    },
    manualIndex: -1,
    formatClock: fmtClock,
    stylePref: lyricStyleId,
    title: track ? trackTitleOf(track) : '',
    artist: track ? trackArtistOf(track) : '',
    album: track ? track.album || '' : '',
    coverUrl: cover,
    duration: track ? Number(track.durationSec) || 0 : 0,
    seed: track && track.path ? track.path : '',
    seed: trackPath,
    accent: '',
  })

  var topBar = h(
    'div',
    { className: 'mp-page-top' },
    h(IconButton, { icon: 'chevronDown', size: 20, title: t('page.closePlayer'), onClick: props.onClose }),
    h(
      'div',
      { className: 'mp-page-meta' },
      h('div', { className: 'mp-page-title' }, track ? trackTitleOf(track) : ''),
      h('div', { className: 'mp-page-artist' }, track ? trackArtistOf(track) : ''),
    ),
    h(
      'button',
      {
        type: 'button',
        className: 'mp-page-style',
        title: t('sheet.lyricStyle'),
        onClick: function () {
          var list = mpStyleCatalog()
          if (list.length === 0) return
          var current = mpStyleIdOf(prefs.lyricStyle)
          var at = 0
          for (var index = 0; index < list.length; index += 1) {
            if (list[index].id === current) at = index
          }
          var next = list[(at + 1) % list.length]
          setPrefs({ lyricStyle: next.id })
          if (typeof showToast === 'function') showToast(t('sheet.lyricStyle') + ': ' + t(next.labelKey))
        },
      },
      t('sheet.lyricStyle'),
    ),
    h(
      'div',
      { className: 'mp-page-quality' },
      track && track.codec ? h('span', null, track.codec) : null,
      track && track.sampleRate ? h('span', null, fmtKhz(track.sampleRate)) : null,
      track && track.bitrate ? h('span', null, fmtKbps(track.bitrate)) : null,
    ),
  )

  var bottomBar = h(
    'div',
    { className: 'mp-page-pill' },
    h(IconButton, { icon: 'prev', size: 22, title: t('page.prev'), onClick: function () { player.prev() } }),
    h(
      'button',
      {
        type: 'button',
        className: 'mp-page-play',
        title: snap.playing ? t('page.pause') : t('page.play'),
        onClick: function () {
          player.toggle()
        },
      },
      icon(snap.playing ? 'pause' : 'play', 26),
    ),
    h(IconButton, { icon: 'next', size: 22, title: t('page.next'), onClick: function () { player.next() } }),
    h(
      'div',
      { className: 'mp-page-progress' },
      h(WaveSeekBar, {
        cover: cover,
        playing: snap.playing,
        wave: prefs.waveEnabled !== false,
        fallbackDuration: track ? Number(track.durationSec) || 0 : 0,
      }),
    ),
    h('span', { className: 'mp-page-time' }, fmtClock(time.currentTime || 0) + ' / ' + fmtClock(duration)),
    h(IconButton, {
      icon: 'list',
      size: 20,
      title: t('page.queue'),
      active: queueOpen,
      onClick: function () {
        setQueueOpen(!queueOpen)
      },
    }),
  )

  // Closed page renders nothing: this shell is absolutely positioned and would
  // otherwise sit on top of the library.
  if (props.open !== true) return null

  return h(PlayerShell, {
    backdrop: backdrop,
    stage: stage,
    topBar: topBar,
    bottomBar: bottomBar,
    overlay: queueOpen ? h(QueuePanel, { snap: snap }) : null,
  })
}
