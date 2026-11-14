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

function useLyricAutoScroll(
  boxRef,
  innerRef,
  coverRef,
  rowRefs,
  active,
  lyrics,
  timed,
  open,
  showTranslation,
  lyricSize,
  lyricGap,
  translationScale,
  lyricAlign,
) {
  var MANUAL_RETURN_MS = 1500
  var stateRef = useRef(null)
  if (stateRef.current === null) {
    stateRef.current = {
      y: 0,
      target: 0,
      velocity: 0,
      frame: 0,
      last: 0,
      boxH: 0,
      contentH: 0,
      activeTop: 0,
      activeHeight: 0,
      settleUntil: 0,
      active: 0,
      focusShift: 0,
    }
  }
  var s = stateRef.current
  var activeRef = useRef(active)
  activeRef.current = active
  var timedRef = useRef(timed)
  timedRef.current = timed
  // Wheel scrolling pauses the follow animation; clicking a lyric line resumes
  // it at the clicked line. The player itself never changes on wheel.
  var manualRef = useRef(false)
  var manualPair = useState(-1)
  var manualIndex = manualPair[0]
  var setManualIndex = manualPair[1]
  var idleTimerRef = useRef(0)
  var lastRef = useRef({ initialized: false, lyrics: null, open: false, trans: false })

  function clock() {
    return typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now()
  }
  function raf(callback) {
    return typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame(callback)
      : setTimeout(function () {
          callback(clock())
        }, 16)
  }
  function caf(id) {
    if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(id)
    else clearTimeout(id)
  }
  function reduced() {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
  }
  function measure() {
    var box = boxRef.current
    var inner = innerRef.current
    if (box === null || inner === null) return false
    s.boxH = box.clientHeight
    s.contentH = inner.offsetHeight
    var row = rowRefs.current[s.active]
    if (!row || row.isConnected === false) {
      s.activeTop = 0
      s.activeHeight = 0
      return true
    }
    // Measure against the box while cancelling the current translate: offsetTop
    // excludes the lyrics box padding, which made the target drift by ~78px.
    var rowRect = row.getBoundingClientRect()
    var boxRect = box.getBoundingClientRect()
    s.activeTop = rowRect.top - boxRect.top + s.y
    s.activeHeight = rowRect.height
    // On the two-column layout, centre the active line on the cover's centre
    // instead of the lyrics viewport's centre. On stacked/narrow layouts the
    // cover sits above the lyrics, so the shift stays 0.
    s.focusShift = 0
    var cover = coverRef.current
    if (cover !== null) {
      var coverRect = cover.getBoundingClientRect()
      if (coverRect.bottom > boxRect.top && coverRect.top < boxRect.bottom) {
        var shift = coverRect.top + coverRect.height / 2 - (boxRect.top + s.boxH / 2)
        var limit = Math.max(0, s.boxH / 2 - s.activeHeight / 2 - 8)
        s.focusShift = Math.max(-limit, Math.min(limit, shift))
      }
    }
    return true
  }
  function targetFor() {
    // Always centre the active line, including the first and last one. On the
    // two-column layout the centre is the cover's centre, not the box centre.
    return s.activeTop - (s.boxH / 2 - s.activeHeight / 2) - s.focusShift
  }
  function write() {
    var inner = innerRef.current
    if (inner !== null) inner.style.transform = 'translate3d(0,' + -s.y + 'px,0)'
  }
  function stop() {
    if (s.frame !== 0) {
      caf(s.frame)
      s.frame = 0
    }
  }
  function clearReturnTimer() {
    if (idleTimerRef.current !== 0) {
      clearTimeout(idleTimerRef.current)
      idleTimerRef.current = 0
    }
  }
  function nearestRowIndex() {
    var box = boxRef.current
    var rows = rowRefs.current
    if (box === null || !Array.isArray(rows) || rows.length === 0) return -1
    var boxRect = box.getBoundingClientRect()
    var centerY = boxRect.top + boxRect.height / 2 + s.focusShift
    var best = -1
    var bestDiff = Infinity
    for (var i = 0; i < rows.length; i += 1) {
      var row = rows[i]
      if (!row || row.isConnected === false) continue
      var rowRect = row.getBoundingClientRect()
      var diff = Math.abs(rowRect.top + rowRect.height / 2 - centerY)
      if (diff < bestDiff) {
        best = i
        bestDiff = diff
      }
    }
    return best
  }
  function resumeFollow(index) {
    clearReturnTimer()
    manualRef.current = false
    setManualIndex(-1)
    if (timedRef.current !== true) return
    s.active = Number.isInteger(index) && index >= 0
      ? index
      : activeRef.current >= 0 ? activeRef.current : 0
    s.velocity = 0
    s.settleUntil = 0
    if (!measure()) return
    s.target = targetFor()
    kick()
  }
  function armReturnTimer() {
    clearReturnTimer()
    idleTimerRef.current = setTimeout(function () {
      idleTimerRef.current = 0
      if (manualRef.current) resumeFollow()
    }, MANUAL_RETURN_MS)
  }
  function frame(nowMs) {
    s.frame = 0
    var dt = s.last > 0 ? Math.min((nowMs - s.last) / 1000, 0.032) : 0.016
    s.last = nowMs
    if (nowMs < s.settleUntil) {
      // While the translation rows animate, pin the active line to the moving
      // target instead of letting the spring lag behind the reflow.
      if (measure()) s.target = targetFor()
      s.y = s.target
      s.velocity = 0
      write()
      s.frame = raf(frame)
      return
    }
    var stiffness = 240
    var damping = 34
    var force = -stiffness * (s.y - s.target) - damping * s.velocity
    s.velocity += force * dt
    s.y += s.velocity * dt
    var done = Math.abs(s.y - s.target) < 0.2 && Math.abs(s.velocity) < 0.2
    if (done) {
      s.y = s.target
      s.velocity = 0
    }
    write()
    if (done && nowMs >= s.settleUntil) {
      s.last = 0
      return
    }
    s.frame = raf(frame)
  }
  function kick() {
    if (reduced()) {
      stop()
      s.y = s.target
      s.velocity = 0
      write()
      return
    }
    if (s.frame === 0) {
      s.last = 0
      s.frame = raf(frame)
    }
  }
  function onResize() {
    var inner = innerRef.current
    if (inner === null) return
    if (timedRef.current !== true) {
      stop()
      inner.style.transform = ''
      return
    }
    if (manualRef.current) {
      measure()
      return
    }
    s.active = activeRef.current >= 0 ? activeRef.current : 0
    if (!measure()) return
    s.target = targetFor()
    kick()
  }

  useEffect(
    function () {
      var inner = innerRef.current
      var observer =
        typeof ResizeObserver === 'function' && inner !== null ? new ResizeObserver(onResize) : null
      if (observer !== null) {
        observer.observe(inner)
        var cover = coverRef.current
        if (cover !== null) observer.observe(cover)
      }
      window.addEventListener('resize', onResize)
      return function () {
        stop()
        if (observer !== null) observer.disconnect()
        window.removeEventListener('resize', onResize)
      }
    },
    [lyrics.length],
  )

  useEffect(
    function () {
      var box = boxRef.current
      var inner = innerRef.current
      if (box === null || inner === null) return undefined
      function onWheel(event) {
        if (timedRef.current !== true) return
        if (event.ctrlKey) return // leave browser zoom alone
        event.preventDefault()
        manualRef.current = true
        stop()
        s.velocity = 0
        s.boxH = box.clientHeight
        s.contentH = inner.offsetHeight
        measure()
        var delta = Number(event.deltaY) || 0
        if (event.deltaMode === 1) delta *= 16
        else if (event.deltaMode === 2) delta *= s.boxH
        var minY = -Math.max(40, s.boxH * 0.75)
        var maxY = Math.max(minY, s.contentH - s.boxH * 0.5)
        s.y = Math.max(minY, Math.min(maxY, s.y + delta))
        write()
        var focus = nearestRowIndex()
        if (focus >= 0) setManualIndex(focus)
        armReturnTimer()
      }
      box.addEventListener('wheel', onWheel, { passive: false })
      return function () {
        clearReturnTimer()
        box.removeEventListener('wheel', onWheel, { passive: false })
      }
    },
    [lyrics.length, open],
  )

  useLayoutEffect(
    function () {
      var inner = innerRef.current
      if (inner === null) return
      if (timed !== true || lyrics.length === 0) {
        manualRef.current = false
        clearReturnTimer()
        setManualIndex(-1)
        stop()
        s.y = 0
        s.target = 0
        s.velocity = 0
        inner.style.transform = ''
        return
      }
      var prev = lastRef.current
      var reset = prev.initialized !== true || prev.lyrics !== lyrics || (prev.open !== true && open === true)
      var settle = prev.initialized === true && prev.trans !== showTranslation
      lastRef.current = { initialized: true, lyrics: lyrics, open: open, trans: showTranslation }
      if (reset) {
        manualRef.current = false
        clearReturnTimer()
        setManualIndex(-1)
      }
      s.active = active >= 0 ? active : 0
      if (!measure()) return
      if (manualRef.current) return
      s.target = targetFor()
      if (reset || Math.abs(s.target - s.y) > s.boxH * 3) {
        stop()
        s.y = s.target
        s.velocity = 0
        write()
        return
      }
      if (settle) s.settleUntil = clock() + 480
      kick()
    },
    [active, lyrics, open, showTranslation, lyricSize, lyricGap, translationScale, lyricAlign, timed],
  )

  return {
    manualIndex: manualIndex,
    isManual: function () {
      return manualRef.current
    },
    resume: resumeFollow,
  }
}

function NpEditor(props) {
  var prefs = usePrefs()
  var cover = typeof props.cover === 'string' ? props.cover : ''
  var title = typeof props.title === 'string' ? props.title : ''
  var artist = typeof props.artist === 'string' ? props.artist : ''
  var resetPair = useState(false)
  var resetConfirm = resetPair[0]
  var setResetConfirm = resetPair[1]

  useEffect(
    function () {
      if (props.open !== true) return undefined
      function onKey(event) {
        if (event.key === 'Escape') props.onClose()
      }
      window.addEventListener('keydown', onKey)
      return function () {
        window.removeEventListener('keydown', onKey)
      }
    },
    [props.open],
  )

  useEffect(
    function () {
      if (props.open !== true) setResetConfirm(false)
    },
    [props.open],
  )

  if (props.open !== true) return null

  function chooseCover(style) {
    setPrefs({
      coverStyle: style,
      circularCover: style === 'vinyl',
      vinylRing: style === 'vinyl',
      coverSpin: style === 'vinyl',
    })
  }

  function resetDefaults() {
    setPrefs({
      coverStyle: 'square',
      circularCover: false,
      vinylRing: false,
      coverSpin: false,
      lyricSize: 35,
      lyricGap: 15,
      translationScale: 90,
      lyricAlign: 'left',
      lyricBlur: true,
      waveEnabled: true,
      showTranslation: true,
      lyricOrder: ['embedded', 'lrc'],
      npPaneGap: 60,
      npLyricWidth: 560,
      npFlowBg: true,
      npSmokeIntensity: 100,
      npSmokeSpeed: 100,
      npSmokeScale: 100,
      npSmokeBeat: 60,
      npBeatSpeed: 220,
      npBeatIntensity: 100,
      npBeatScale: 18,
      npBeatWarp: 120,
    })
  }

  function sectionHead(label) {
    return h(
      'div',
      { className: 'mp-npe-sec-head' },
      h('span', { className: 'mp-npe-sec-title' }, label),
      h('span', { className: 'mp-npe-sec-line' }),
    )
  }

  function coverPreview(style) {
    if (cover === '') return icon('note', 22)
    if (style === 'vinyl') return h('img', { src: cover, alt: '' })
    return h('img', { src: cover, alt: '' })
  }

  function coverCard(style, label) {
    var selected = style === 'vinyl' ? prefs.coverStyle === 'vinyl' : prefs.coverStyle !== 'vinyl'
    return h(
      'button',
      {
        type: 'button',
        className: cx('mp-npe-cover-card', selected && 'is-on'),
        'aria-pressed': selected ? 'true' : 'false',
        onClick: function () {
          chooseCover(style)
        },
      },
      h(
        'span',
        {
          className: cx(
            'mp-npe-cover-preview',
            style === 'vinyl' ? 'mp-npe-cover-vinyl' : 'mp-npe-cover-square',
          ),
        },
        coverPreview(style),
      ),
      h('span', { className: 'mp-npe-cover-label' }, label),
      selected ? h('span', { className: 'mp-npe-cover-check' }, icon('check', 12)) : null,
    )
  }

  function rangeRow(label, value, min, max, step, unit, apply, hint) {
    return h(
      'div',
      { className: 'mp-npe-row' },
      h(
        'div',
        { className: 'mp-npe-range-head' },
        h('span', null, label),
        h('span', { className: 'mp-npe-val' }, value + unit),
      ),
      h('input', {
        type: 'range',
        className: 'mp-range',
        min: min,
        max: max,
        step: step,
        value: value,
        'aria-label': label,
        onChange: function (event) {
          apply(Number(event.target.value))
        },
      }),
      hint ? h('div', { className: 'mp-npe-hint' }, hint) : null,
    )
  }

  function switchRow(label, value, apply, hint) {
    return h(
      'div',
      { className: 'mp-npe-switch-row' + (hint ? ' has-hint' : '') },
      h(
        'span',
        { className: 'mp-npe-switch-text' },
        h('span', null, label),
        hint ? h('span', { className: 'mp-npe-hint' }, hint) : null,
      ),
      h(Switch, { value: value, onChange: apply }),
    )
  }

  function previewCard() {
    var align = prefs.lyricAlign || 'left'
    var size = Number(prefs.lyricSize) || 35
    var scale = Math.max(0.5, Math.min(1, (Number(prefs.translationScale) || 100) / 100))
    var activeSize = Math.max(13, Math.round(size * 0.5))
    var sideSize = Math.max(12, Math.round(size * 0.42))
    var transSize = Math.max(11, Math.round(size * 0.42 * scale))
    return h(
      'div',
      { className: 'mp-npe-preview' + (prefs.lyricBlur === true ? ' is-blur' : '') },
      h(
        'div',
        { className: 'mp-npe-preview-stage' },
        cover !== '' ? h('img', { className: 'mp-npe-preview-bg', src: cover, alt: '' }) : null,
        h('span', { className: 'mp-npe-preview-label' }, t('editor.preview')),
        h(
          'div',
          { className: 'mp-npe-preview-body' },
          h(
            'div',
            {
              className:
                'mp-npe-preview-cover' + (prefs.coverStyle === 'vinyl' ? ' is-vinyl' : ''),
              style:
                cover !== ''
                  ? { '--mp-preview-cover': 'url("' + cover.replace(/"/g, '%22') + '")' }
                  : undefined,
            },
            cover !== '' ? h('img', { src: cover, alt: '' }) : icon('note', 26),
          ),
          h(
            'div',
            { className: 'mp-npe-preview-text', style: { textAlign: align } },
            h('div', { className: 'mp-npe-preview-title' }, title || t('editor.sampleTitle')),
            artist !== '' ? h('div', { className: 'mp-npe-preview-artist' }, artist) : null,
            h(
              'div',
              { className: 'mp-npe-preview-line', style: { fontSize: sideSize + 'px' } },
              t('editor.samplePrev'),
            ),
            h(
              'div',
              { className: 'mp-npe-preview-line is-active', style: { fontSize: activeSize + 'px' } },
              t('editor.sampleLyric'),
            ),
            prefs.showTranslation === true
              ? h(
                  'div',
                  { className: 'mp-npe-preview-trans', style: { fontSize: transSize + 'px' } },
                  t('editor.sampleTranslation'),
                )
              : null,
            h(
              'div',
              { className: 'mp-npe-preview-line', style: { fontSize: sideSize + 'px' } },
              t('editor.sampleNext'),
            ),
          ),
        ),
      ),
    )
  }

  return h(
    'div',
    {
      className: 'mp-npe',
      onClick: function (event) {
        if (event.target === event.currentTarget) props.onClose()
      },
    },
    h(
      'div',
      {
        className: 'mp-npe-panel',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-label': t('editor.title'),
      },
      h(
        'div',
        { className: 'mp-npe-head' },
        h(
          'div',
          { className: 'mp-npe-head-text' },
          h('div', { className: 'mp-npe-title' }, t('editor.title')),
          h('div', { className: 'mp-npe-sub' }, t('editor.subtitle')),
        ),
        h(
          'div',
          { className: 'mp-npe-head-actions' },
          h(
            'button',
            {
              type: 'button',
              className: 'mp-npe-close',
              title: t('editor.close'),
              'aria-label': t('editor.close'),
              onClick: props.onClose,
            },
            icon('x', 18),
          ),
        ),
      ),
      resetConfirm
        ? h(
            'div',
            { className: 'mp-npe-confirm' },
            h(
              'div',
              { className: 'mp-npe-confirm-text' },
              h('div', { className: 'mp-npe-confirm-title' }, t('editor.resetConfirm')),
              h('div', { className: 'mp-npe-confirm-hint' }, t('editor.resetHint')),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'mp-npe-confirm-btn',
                onClick: function () {
                  setResetConfirm(false)
                },
              },
              t('editor.cancel'),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'mp-npe-confirm-btn is-primary',
                onClick: function () {
                  resetDefaults()
                  setResetConfirm(false)
                },
              },
              t('editor.reset'),
            ),
          )
        : null,
      h(
        'div',
        { className: 'mp-npe-body' },
        previewCard(),
        h(
          'div',
          { className: 'mp-npe-section is-cover' },
          sectionHead(t('editor.cover')),
          h(
            'div',
            { className: 'mp-npe-cover-grid' },
            coverCard('square', t('v2.coverSquare')),
            coverCard('vinyl', t('v2.coverVinyl')),
          ),
        ),
        h(
          'div',
          { className: 'mp-npe-section is-type' },
          sectionHead(t('editor.type')),
          rangeRow(t('page.lyricSize'), prefs.lyricSize || 25, 14, 40, 1, ' px', function (value) {
            setPrefs({ lyricSize: value })
          }),
          rangeRow(t('page.lyricGap'), Number(prefs.lyricGap) || 10, 2, 16, 1, ' px', function (value) {
            setPrefs({ lyricGap: value })
          }),
          rangeRow(t('editor.paneGap'), Number(prefs.npPaneGap) || 60, 12, 96, 4, ' px', function (value) {
            setPrefs({ npPaneGap: value })
          }, t('editor.paneGapHint')),
          rangeRow(
            t('page.translationScale'),
            prefs.translationScale || 100,
            50,
            100,
            5,
            '%',
            function (value) {
              setPrefs({ translationScale: value })
            },
          ),
          h(
            'div',
            { className: 'mp-npe-row' },
            h('div', { className: 'mp-npe-range-head' }, h('span', null, t('settings.lyricAlign'))),
            h(
              'div',
              { className: 'mp-npe-seg' },
              [
                ['left', 'settings.alignLeft'],
                ['center', 'settings.alignCenter'],
                ['right', 'settings.alignRight'],
              ].map(function (item) {
                return h(
                  'button',
                  {
                    key: item[0],
                    type: 'button',
                    className: cx('mp-npe-seg-btn', (prefs.lyricAlign || 'left') === item[0] && 'is-on'),
                    onClick: function () {
                      setPrefs({ lyricAlign: item[0] })
                    },
                  },
                  t(item[1]),
                )
              }),
            ),
          ),
        ),
        h(
          'div',
          { className: 'mp-npe-section is-display' },
          sectionHead(t('editor.display')),
          switchRow(t('page.translation'), prefs.showTranslation === true, function (value) {
            setPrefs({ showTranslation: value })
          }),
          switchRow(t('page.lyricBlur'), prefs.lyricBlur === true, function (value) {
            setPrefs({ lyricBlur: value })
          }),
          switchRow(t('editor.wave'), prefs.waveEnabled !== false, function (value) {
            setPrefs({ waveEnabled: value })
          }),
          switchRow(t('editor.flow'), prefs.npFlowBg !== false, function (value) {
            setPrefs({ npFlowBg: value })
          }, t('editor.flowHint')),
        ),
        h(
          'div',
          { className: 'mp-npe-section is-smoke' },
          sectionHead(t('editor.smoke')),
          h(
            'div',
            { className: 'mp-npe-smoke-grid' },
            rangeRow(t('editor.smokeIntensity'), Number(prefs.npSmokeIntensity) || 100, 30, 180, 5, '%', function (value) {
              setPrefs({ npSmokeIntensity: value })
            }),
            rangeRow(t('editor.smokeSpeed'), Number(prefs.npSmokeSpeed) || 100, 30, 250, 5, '%', function (value) {
              setPrefs({ npSmokeSpeed: value })
            }),
            rangeRow(t('editor.smokeScale'), Number(prefs.npSmokeScale) || 100, 50, 200, 5, '%', function (value) {
              setPrefs({ npSmokeScale: value })
            }),
            rangeRow(t('editor.smokeBeat'), Number(prefs.npSmokeBeat) || 0, 0, 100, 5, '%', function (value) {
              setPrefs({ npSmokeBeat: value })
            }, t('editor.smokeBeatHint')),
          ),
        ),
        h(
          'div',
          { className: 'mp-npe-section is-beat' },
          sectionHead(t('editor.beat')),
          h(
            'div',
            { className: 'mp-npe-smoke-grid' },
            rangeRow(t('editor.beatSpeed'), Number(prefs.npBeatSpeed) || 220, 0, 300, 10, '%', function (value) {
              setPrefs({ npBeatSpeed: value })
            }),
            rangeRow(t('editor.beatIntensity'), Number(prefs.npBeatIntensity) || 100, 0, 300, 10, '%', function (value) {
              setPrefs({ npBeatIntensity: value })
            }),
            rangeRow(t('editor.beatScale'), Number(prefs.npBeatScale) || 18, 0, 50, 2, '%', function (value) {
              setPrefs({ npBeatScale: value })
            }),
            rangeRow(t('editor.beatWarp'), Number(prefs.npBeatWarp) || 120, 0, 300, 10, '%', function (value) {
              setPrefs({ npBeatWarp: value })
            }),
          ),
        ),
      ),
      h(
        'div',
        { className: 'mp-npe-foot' },
        h(
          'button',
          {
            type: 'button',
            className: 'mp-npe-btn is-ghost',
            onClick: function () {
              setResetConfirm(true)
            },
          },
          t('editor.reset'),
        ),
        h(
          'button',
          { type: 'button', className: 'mp-npe-btn is-primary', onClick: props.onClose },
          t('editor.done'),
        ),
      ),
    ),
  )
}

function fallbackCoverAccent() {
  var h = 40
  var sat = 12
  var light = 70
  return {
    h: h,
    s: sat,
    l: light,
    palette: [
      { h: 28, s: 10, l: 62 },
      { h: h, s: sat, l: light },
      { h: 52, s: 14, l: 78 },
    ],
  }
}

function rgbToHslColor(red, green, blue) {
  var r = red / 255
  var g = green / 255
  var b = blue / 255
  var max = Math.max(r, g, b)
  var min = Math.min(r, g, b)
  var d = max - min
  var l = (max + min) / 2
  var s = 0
  var h = 0
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  return { h: h, s: s, l: l }
}

function coverAccentFromUrl(url, image) {
  return new Promise(function (resolve) {
    if (!url) {
      resolve(fallbackCoverAccent())
      return
    }
    var img = image || new Image()
    img.onload = function () {
      try {
        var canvas = document.createElement('canvas')
        canvas.width = 24
        canvas.height = 24
        var ctx = canvas.getContext('2d', { willReadFrequently: true })
        ctx.drawImage(img, 0, 0, 24, 24)
        var data = ctx.getImageData(0, 0, 24, 24).data
        var buckets = new Map()
        for (var i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 128) continue
          var red = data[i]
          var green = data[i + 1]
          var blue = data[i + 2]
          var key = (red >> 4) + ',' + (green >> 4) + ',' + (blue >> 4)
          var entry = buckets.get(key)
          if (entry === undefined) {
            entry = { count: 0, r: 0, g: 0, b: 0 }
            buckets.set(key, entry)
          }
          entry.count += 1
          entry.r += red
          entry.g += green
          entry.b += blue
        }
        var colors = []
        buckets.forEach(function (entry) {
          var color = rgbToHslColor(entry.r / entry.count, entry.g / entry.count, entry.b / entry.count)
          colors.push({ h: color.h, s: color.s, l: color.l, count: entry.count })
        })
        colors.sort(function (a, b) {
          return b.count - a.count
        })
        var picked = []
        for (var c = 0; c < colors.length && picked.length < 3; c += 1) {
          var candidate = colors[c]
          var distinct = true
          for (var p = 0; p < picked.length; p += 1) {
            var other = picked[p]
            var hueGap = Math.min(
              Math.abs(candidate.h - other.h),
              360 - Math.abs(candidate.h - other.h),
            ) / 360
            var distance = Math.hypot(hueGap, candidate.s - other.s, candidate.l - other.l)
            if (distance < 0.16) {
              distinct = false
              break
            }
          }
          if (distinct) picked.push(candidate)
        }
        if (picked.length === 0) {
          resolve(fallbackCoverAccent())
          return
        }
        while (picked.length < 3) {
          var base = picked[0]
          picked.push({
            h: (base.h + (picked.length === 1 ? 32 : 328)) % 360,
            s: base.s,
            l: Math.min(0.8, Math.max(0.38, base.l + (picked.length === 1 ? 0.08 : -0.06))),
            count: 0,
          })
        }
        if (colors.length === 0) {
          resolve(fallbackCoverAccent())
          return
        }
        // Signature colour: among reasonably saturated clusters, prefer area
        // times saturation. This ignores both a large cream background and a
        // tiny saturated JPEG fringe (which used to win and turn the wave blue).
        var maxCount = colors.reduce(function (max, color) {
          return Math.max(max, color.count || 1)
        }, 1)
        var minCount = Math.max(3, Math.floor(maxCount * 0.02))
        var saturated = colors.filter(function (color) {
          return (
            color.s > 0.3 &&
            color.l > 0.06 &&
            color.l < 0.92 &&
            Math.max(1, color.count || 1) >= minCount
          )
        })
        var pool = saturated.length > 0 ? saturated : colors
        var base = pool.reduce(function (best, color) {
          var score = Math.max(1, color.count || 1) * (0.35 + color.s)
          var bestScore = Math.max(1, best.count || 1) * (0.35 + best.s)
          return score > bestScore ? color : best
        }, pool[0])
        var feature = []
        function addFeature(source) {
          var candidate = {
            h: Math.round(source.h),
            s: Math.round(Math.min(1, Math.max(0.16, source.s)) * 100),
            l: Math.round(Math.min(0.82, Math.max(0.38, source.l)) * 100),
          }
          for (var f = 0; f < feature.length; f += 1) {
            var other = feature[f]
            var hueGap = Math.min(
              Math.abs(candidate.h - other.h),
              360 - Math.abs(candidate.h - other.h),
            ) / 360
            if (Math.hypot(hueGap, (candidate.s - other.s) / 100, (candidate.l - other.l) / 100) < 0.16) {
              return
            }
          }
          feature.push(candidate)
        }
        addFeature(base)
        for (var f = 0; f < picked.length; f += 1) addFeature(picked[f])
        // Hard bound the fallback loop. addFeature() may reject a generated
        // neighbour as too similar, so looping on it can spin forever on
        // low-colour artwork and freeze the panel while extracting the cover.
        var featureGuard = 0
        while (feature.length < 3 && featureGuard < 12) {
          var anchor = feature[0] || { h: 40, s: 16, l: 70 }
          var angle = (featureGuard + 1) * 30
          feature.push({
            h: (anchor.h + angle) % 360,
            s: Math.max(16, anchor.s),
            l: Math.min(82, Math.max(38, anchor.l + (featureGuard % 2 === 0 ? 8 : -6))),
          })
          featureGuard += 1
        }
        feature = feature.slice(0, 4).sort(function (a, b) {
          return a.h - b.h
        })
        resolve({
          h: Math.round(base.h),
          s: Math.round(Math.min(1, Math.max(0.16, base.s)) * 100),
          l: Math.round(Math.min(0.82, Math.max(0.38, base.l)) * 100),
          palette: feature,
        })
      } catch (error) {
        resolve(fallbackCoverAccent())
      }
    }
    img.onerror = function () {
      resolve(fallbackCoverAccent())
    }
    if (image) {
      if (img.complete) {
        if (img.naturalWidth > 0) img.onload()
        else img.onerror()
      }
    } else {
      img.src = url
    }
  })
}

function useCoverAccent(url, imageRef) {
  var pair = useState(fallbackCoverAccent())
  var accent = pair[0]
  var setAccent = pair[1]
  useEffect(
    function () {
      var cancelled = false
      var timer = null
      var tries = 0
      function attempt() {
        if (cancelled) return
        if (url === '') {
          setAccent(fallbackCoverAccent())
          return
        }
        var image = imageRef && imageRef.current ? imageRef.current : null
        // The <img> element is reused across tracks. Wait until it actually
        // shows the requested cover and has decoded, otherwise we would sample
        // the previous artwork and keep the old accent after switching songs.
        var shown = image === null ? '' : image.getAttribute('src') || ''
        var ready = image !== null && shown === url && image.complete && image.naturalWidth > 0
        if (!ready) {
          if (tries < 40) {
            tries += 1
            timer = setTimeout(attempt, 50)
            return
          }
          setAccent(fallbackCoverAccent())
          return
        }
        // Sample only the <img> already rendered by the player. Online covers
        // are served from the Host's local cache; this never makes a second
        // request.
        coverAccentFromUrl(url, image).then(function (next) {
          if (!cancelled) setAccent(next)
        })
      }
      attempt()
      return function () {
        cancelled = true
        if (timer !== null) clearTimeout(timer)
      }
    },
    [url, imageRef],
  )
  return accent
}

function createBlurredBackdrop(url) {
  return new Promise(function (resolve) {
    if (!url) {
      resolve('')
      return
    }
    var img = new Image()
    img.onload = function () {
      try {
        var size = 64
        var canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        var ctx = canvas.getContext('2d')
        if (ctx === null) {
          resolve('')
          return
        }
        // Blur once at 64x64 instead of applying a 110px blur to a full-screen
        // image on every raster. Upscaling this texture is visually close and
        // orders of magnitude cheaper.
        if (typeof ctx.filter === 'string') {
          ctx.filter = 'blur(4px) saturate(1.6) brightness(.68)'
        }
        ctx.drawImage(img, 0, 0, size, size)
        if (typeof ctx.filter === 'string') ctx.filter = 'none'
        resolve(canvas.toDataURL('image/jpeg', 0.82))
      } catch (error) {
        resolve('')
      }
    }
    img.onerror = function () {
      resolve('')
    }
    img.src = url
  })
}


var SMOKE_VERTEX = 'attribute vec2 aPos;void main(){gl_Position=vec4(aPos,0.0,1.0);}'
var SMOKE_FRAGMENT = [
  'precision mediump float;',
  'uniform vec2 uRes;',
  'uniform float uTime;',
  'uniform vec3 uA;',
  'uniform vec3 uB;',
  'uniform vec3 uC;',
  'uniform float uSpeed;',
  'uniform float uIntensity;',
  'uniform float uScale;',
  'uniform float uBeat;',
  'uniform float uBass;',
  'uniform float uMid;',
  'uniform float uTreble;',
  'float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}',
  'float noise(vec2 p){',
  '  vec2 i=floor(p);vec2 f=fract(p);vec2 u=f*f*(3.0-2.0*f);',
  '  float a=hash(i);float b=hash(i+vec2(1.0,0.0));float c=hash(i+vec2(0.0,1.0));float d=hash(i+vec2(1.0,1.0));',
  '  return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);',
  '}',
  'mat2 rot(float a){float c=cos(a);float s=sin(a);return mat2(c,-s,s,c);}',
  'float fbm(vec2 p){',
  '  float v=0.0;float amp=0.5;',
  '  for(int i=0;i<4;i++){v+=amp*noise(p);p=rot(0.5)*p*2.03+vec2(1.7,9.2);amp*=0.5;}',
  '  return v;',
  '}',
  'void main(){',
  '  vec2 uv=gl_FragCoord.xy/uRes;',
  '  float aspect=uRes.x/uRes.y;',
  '  vec2 p=(uv-0.5)*vec2(aspect,1.0)*2.6*uScale;',
  '  p+=vec2(uBass*0.42,-uBass*0.26);',
  '  float t=uTime*0.13*uSpeed;',
  '  vec2 q=vec2(fbm(p+vec2(0.0,t)),fbm(p+vec2(5.2,1.3)-t*0.7));',
  '  float warp=1.0+uBeat*0.5+uMid*0.35;',
  '  vec2 r=vec2(fbm(p+3.2*q*warp+vec2(1.7,9.2)+t*0.55),fbm(p+3.2*q*warp+vec2(8.3,2.8)-t*0.45));',
  '  float f1=fbm(p+2.4*r);',
  '  float f2=fbm(p*1.6+vec2(4.3,7.1)+t*0.35);',
  '  float f=0.55*f1+0.45*f2;',
  '  float smoke=smoothstep(0.3,0.86,f);',
  '  vec3 col=mix(uA,uB,smoothstep(0.2,0.8,r.x));',
  '  col=mix(col,uC,smoothstep(0.4,0.95,q.y));',
  '  col*=0.8+0.3*f+uTreble*0.12;',
  '  float alpha=(0.16+0.5*smoke)*uIntensity;',
  '  gl_FragColor=vec4(col,alpha);',
  '}',
].join('\n')

function hslToRgb01(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360
  s = Math.min(1, Math.max(0, s / 100))
  l = Math.min(1, Math.max(0, l / 100))
  function hue(p, q, t) {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  if (s === 0) return [l, l, l]
  var q = l < 0.5 ? l * (1 + s) : l + s - l * s
  var p = 2 * l - q
  return [hue(p, q, h + 1 / 3), hue(p, q, h), hue(p, q, h - 1 / 3)]
}

function smokePalette(accent) {
  var base = accent !== null && typeof accent === 'object' ? accent : {}
  var hue = Number(base.h)
  if (!isFinite(hue)) hue = 40
  var sat = Number(base.s)
  if (!isFinite(sat) || sat < 0) sat = 30
  if (sat > 0 && sat <= 1) sat *= 100
  sat = Math.min(94, Math.max(58, sat))
  var light = Number(base.l)
  if (!isFinite(light) || light < 0) light = 55
  if (light > 0 && light <= 1) light *= 100
  light = Math.min(82, Math.max(52, light))
  function tone(shift, satScale, lightShift) {
    return hslToRgb01(hue + shift, Math.min(96, Math.max(58, sat * satScale)), light + lightShift)
  }
  return [tone(-34, 1.15, 4), tone(8, 1.05, -2), tone(44, 0.95, -8)]
}

function SmokeFlow(props) {
  var canvasRef = useRef(null)
  var targetRef = useRef(props.colors)
  var pausedRef = useRef(props.paused === true)
  var controlRef = useRef(null)
  var speedRef = useRef(Number(props.speed) || 1)
  var intensityRef = useRef(Number(props.intensity) || 1)
  var scaleRef = useRef(Number(props.scale) || 1)
  var playingRef = useRef(props.playing === true)
  var beatRef = useRef(Number(props.beat) || 0)
  var gainSpeedRef = useRef(Number(props.beatSpeed) || 2.2)
  var gainIntensityRef = useRef(Number(props.beatIntensity) || 1)
  var gainScaleRef = useRef(Number(props.beatScale) || 0.18)
  var gainWarpRef = useRef(Number(props.beatWarp) || 1.2)
  useEffect(
    function () {
      targetRef.current = props.colors
    },
    [props.colors],
  )
  useEffect(
    function () {
      speedRef.current = Number(props.speed) || 1
      intensityRef.current = Number(props.intensity) || 1
      scaleRef.current = Number(props.scale) || 1
      playingRef.current = props.playing === true
      beatRef.current = Number(props.beat) || 0
      gainSpeedRef.current = Number(props.beatSpeed) || 2.2
      gainIntensityRef.current = Number(props.beatIntensity) || 1
      gainScaleRef.current = Number(props.beatScale) || 0.18
      gainWarpRef.current = Number(props.beatWarp) || 1.2
    },
    [props.speed, props.intensity, props.scale, props.playing, props.beat, props.beatSpeed, props.beatIntensity, props.beatScale, props.beatWarp],
  )
  useEffect(
    function () {
      pausedRef.current = props.paused === true
      var control = controlRef.current
      if (control !== null) control.sync()
    },
    [props.paused],
  )
  useEffect(
    function () {
      var canvas = canvasRef.current
      if (canvas === null) return undefined
      var gl = canvas.getContext('webgl', {
        alpha: true,
        antialias: false,
        premultipliedAlpha: false,
        powerPreference: 'low-power',
      })
      if (gl === null) return undefined
      function compile(type, source) {
        var shader = gl.createShader(type)
        gl.shaderSource(shader, source)
        gl.compileShader(shader)
        if (gl.getShaderParameter(shader, gl.COMPILE_STATUS) !== true) {
          gl.deleteShader(shader)
          return null
        }
        return shader
      }
      var vs = compile(gl.VERTEX_SHADER, SMOKE_VERTEX)
      var fs = compile(gl.FRAGMENT_SHADER, SMOKE_FRAGMENT)
      if (vs === null || fs === null) return undefined
      var program = gl.createProgram()
      gl.attachShader(program, vs)
      gl.attachShader(program, fs)
      gl.linkProgram(program)
      gl.deleteShader(vs)
      gl.deleteShader(fs)
      if (gl.getProgramParameter(program, gl.LINK_STATUS) !== true) {
        gl.deleteProgram(program)
        return undefined
      }
      gl.useProgram(program)
      var buffer = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
      var aPos = gl.getAttribLocation(program, 'aPos')
      gl.enableVertexAttribArray(aPos)
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)
      var uRes = gl.getUniformLocation(program, 'uRes')
      var uTime = gl.getUniformLocation(program, 'uTime')
      var uA = gl.getUniformLocation(program, 'uA')
      var uB = gl.getUniformLocation(program, 'uB')
      var uC = gl.getUniformLocation(program, 'uC')
      var uSpeed = gl.getUniformLocation(program, 'uSpeed')
      var uIntensity = gl.getUniformLocation(program, 'uIntensity')
      var uScale = gl.getUniformLocation(program, 'uScale')
      var uBeat = gl.getUniformLocation(program, 'uBeat')
      var uBass = gl.getUniformLocation(program, 'uBass')
      var uMid = gl.getUniformLocation(program, 'uMid')
      var uTreble = gl.getUniformLocation(program, 'uTreble')
      var beatTracker = createBeatTracker()
      var bands = { bass: 0, mid: 0, treble: 0 }
      function updateBands(wave) {
        if (wave === null || wave === undefined || wave.length === 0) {
          bands.bass *= 0.9
          bands.mid *= 0.9
          bands.treble *= 0.9
          return
        }
        var size = wave.length
        function average(from, to) {
          var start = Math.floor(size * from)
          var end = Math.max(start + 1, Math.floor(size * to))
          var sum = 0
          for (var i = start; i < end && i < size; i += 1) sum += wave[i]
          return sum / (end - start) / 255
        }
        function ease(current, target) {
          return current + (target - current) * (target > current ? 0.55 : 0.14)
        }
        bands.bass = ease(bands.bass, average(0, 0.08))
        bands.mid = ease(bands.mid, average(0.08, 0.35))
        bands.treble = ease(bands.treble, average(0.35, 0.75))
      }
      var current = (targetRef.current || [[1, 1, 1]]).map(function (color) {
        return color.slice()
      })
      function lerpTo(target) {
        for (var i = 0; i < current.length && i < target.length; i += 1) {
          for (var j = 0; j < 3; j += 1) {
            current[i][j] += (target[i][j] - current[i][j]) * 0.08
          }
        }
      }
      var reduced =
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      var raf = 0
      var last = 0
      var start = 0
      function resize() {
        var width = Math.max(320, Math.min(960, Math.round(canvas.clientWidth * 0.55)))
        var height = Math.max(180, Math.round(width * (canvas.clientHeight || canvas.clientWidth) / (canvas.clientWidth || 1)))
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width
          canvas.height = height
          gl.viewport(0, 0, width, height)
          gl.uniform2f(uRes, width, height)
        }
      }
      function paint(now) {
        resize()
        lerpTo(targetRef.current || current)
        gl.uniform3f(uA, current[0][0], current[0][1], current[0][2])
        gl.uniform3f(uB, current[1][0], current[1][1], current[1][2])
        gl.uniform3f(uC, current[2][0], current[2][1], current[2][2])
        gl.uniform1f(uTime, ((now || 0) - start) / 1000)
        var wave =
          typeof player !== 'undefined' && player !== null && typeof player.getWave === 'function'
            ? player.getWave()
            : null
        updateBands(wave)
        var beat = beatTracker.update(wave, playingRef.current) * beatRef.current
        gl.uniform1f(uSpeed, speedRef.current * (1 + beat * gainSpeedRef.current))
        gl.uniform1f(uIntensity, intensityRef.current * (1 + beat * gainIntensityRef.current))
        gl.uniform1f(uScale, scaleRef.current * (1 - beat * gainScaleRef.current))
        gl.uniform1f(uBeat, beat * gainWarpRef.current)
        gl.uniform1f(uBass, bands.bass)
        gl.uniform1f(uMid, bands.mid)
        gl.uniform1f(uTreble, bands.treble)
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      }
      function frame(now) {
        raf = requestAnimationFrame(frame)
        if (pausedRef.current === true || document.visibilityState === 'hidden') return
        if (now - last < 33) return
        last = now
        paint(now)
      }
      function startLoop() {
        if (raf !== 0) return
        start = performance.now() - last
        raf = requestAnimationFrame(frame)
      }
      function stopLoop() {
        if (raf !== 0) cancelAnimationFrame(raf)
        raf = 0
      }
      resize()
      start = performance.now()
      if (reduced === true || pausedRef.current === true || document.visibilityState === 'hidden') {
        paint(start)
      } else {
        startLoop()
      }
      function sync() {
        if (reduced === true) {
          paint(performance.now())
          return
        }
        if (pausedRef.current === true || document.visibilityState === 'hidden') stopLoop()
        else startLoop()
      }
      controlRef.current = { sync: sync }
      document.addEventListener('visibilitychange', sync)
      var observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null
      if (observer !== null) observer.observe(canvas)
      return function () {
        stopLoop()
        document.removeEventListener('visibilitychange', sync)
        if (observer !== null) observer.disconnect()
        controlRef.current = null
        gl.deleteProgram(program)
        gl.deleteBuffer(buffer)
        var lose = gl.getExtension('WEBGL_lose_context')
        if (lose !== null) lose.loseContext()
      }
    },
    [],
  )
  return h('canvas', { ref: canvasRef, className: 'mp-np-smoke', 'aria-hidden': 'true' })
}

function CoverReflectWave(props) {
  var accent = useCoverAccent(props.cover || '', props.imageRef)
  var gainsRef = useRef({
    beat: Number(props.beat) || 0,
    speed: Number(props.beatSpeed) || 2.2,
    intensity: Number(props.beatIntensity) || 1,
    scale: Number(props.beatScale) || 0.18,
    warp: Number(props.beatWarp) || 1.2,
  })
  useEffect(
    function () {
      gainsRef.current = {
        beat: Number(props.beat) || 0,
        speed: Number(props.beatSpeed) || 2.2,
        intensity: Number(props.beatIntensity) || 1,
        scale: Number(props.beatScale) || 0.18,
        warp: Number(props.beatWarp) || 1.2,
      }
    },
    [props.beat, props.beatSpeed, props.beatIntensity, props.beatScale, props.beatWarp],
  )
  var playing = props.playing === true
  var active = props.active !== false
  var ref = useRef(null)
  useEffect(
    function () {
      var canvas = ref.current
      if (canvas === null) return undefined
      var ctx = canvas.getContext('2d')
      if (ctx === null) return undefined
      if (playing !== true || active !== true) {
        // Keep the last painted frame while CSS scales/fades the canvas out.
        var clearTimer = setTimeout(function () {
          var node = ref.current
          if (node === null) return
          var clearCtx = node.getContext('2d')
          if (clearCtx !== null) clearCtx.clearRect(0, 0, node.width, node.height)
        }, 420)
        return function () {
          clearTimeout(clearTimer)
        }
      }
      var dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1)
      var beatTracker = createBeatTracker()
      var phase = 0
      var lastPhaseAt = 0
      var frame = 0
      var last = 0
      var levels = []
      var bands = 32
      var spectrumBands = 16
      function resize() {
        // clientWidth/Height use the layout box, not the CSS fade transform.
        // Measuring getBoundingClientRect() while is-fading scales the canvas
        // to 12% and makes the backing store permanently too small on resume.
        canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr))
        canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr))
      }
      resize()
      var observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null
      if (observer !== null) observer.observe(canvas)
      window.addEventListener('resize', resize)
      function colorOf(c, alpha) {
        return 'hsla(' + c.h + ',' + c.s + '%,' + c.l + '%,' + alpha + ')'
      }
      var palette = wavePalette(accent)
      function draw(now) {
        frame = 0
        if (now - last < 33) {
          frame = requestAnimationFrame(draw)
          return
        }
        last = now
        var w = canvas.width / dpr
        var h = canvas.height / dpr
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.clearRect(0, 0, w, h)
        var data = playing ? player.getWave() : null
        var gains = gainsRef.current
        var beat = beatTracker.update(data, playing) * gains.beat
        var beatSpeedGain = gains.speed
        var beatIntensityGain = gains.intensity
        var beatScaleGain = gains.scale
        var beatWarpGain = gains.warp
        var raw = []
        if (data !== null && data.length > 0) {
          for (var band = 0; band < spectrumBands; band += 1) {
            var start = Math.floor(Math.pow(band / spectrumBands, 1.6) * data.length)
            var end = Math.max(start + 1, Math.floor(Math.pow((band + 1) / spectrumBands, 1.6) * data.length))
            end = Math.min(end, data.length)
            var sum = 0
            for (var i = start; i < end; i += 1) sum += data[i]
            raw.push((sum / Math.max(1, end - start)) / 255)
          }
        } else {
          for (var z = 0; z < spectrumBands; z += 1) raw.push(0)
        }
        var peak = 0.4
        for (var p = 0; p < raw.length; p += 1) peak = Math.max(peak, raw[p])
        var barW = Math.max(1, (w / bands) * 0.58 * (1 - beat * Math.min(0.35, beatScaleGain * 0.5)))
        var gap = w / bands
        function mixFeature(list, t) {
          if (!list.length) return accent
          if (list.length === 1) return list[0]
          var scaled = (((t % 1) + 1) % 1) * list.length
          var from = Math.floor(scaled) % list.length
          var to = (from + 1) % list.length
          var frac = scaled - Math.floor(scaled)
          var a = list[from]
          var b = list[to]
          var hueDelta = ((b.h - a.h + 540) % 360) - 180
          return {
            h: (a.h + hueDelta * frac + 360) % 360,
            s: a.s + (b.s - a.s) * frac,
            l: a.l + (b.l - a.l) * frac,
          }
        }
        var phaseDelta = Math.min(0.1, (now - lastPhaseAt) / 1000)
        lastPhaseAt = now
        phase = (phase + phaseDelta * 0.0625 * (1 + beat * beatSpeedGain)) % 1
        ctx.globalAlpha = 0.92 + beat * 0.08
        var mid = (bands - 1) / 2
        for (var k = 0; k < bands; k += 1) {
          var dist = Math.abs(k - mid) / mid
          var bandIndex = Math.min(spectrumBands - 1, Math.round(dist * (spectrumBands - 1)))
          var level = Math.pow(Math.max(0, raw[bandIndex]) / peak, 1.5)
          level = 0.02 + Math.min(1, level) * 0.98
          var prev = levels[k] || 0
          levels[k] = level > prev ? level : prev * 0.45 + level * 0.55
          var half = ((levels[k] * h) / 2) * (1 + beat * beatIntensityGain)
          if (half > h * 0.5) half = h * 0.5
          if (half < 1) continue
          ctx.fillStyle = colorOf(mixFeature(palette, phase + dist * 0.72 * (1 + beat * beatWarpGain)), 0.95)
          var x = k * gap + (gap - barW) / 2
          var radius = Math.min(barW / 2, 4, half)
          if (typeof ctx.roundRect === 'function') {
            ctx.beginPath()
            ctx.roundRect(x, h / 2 - half, barW, half * 2, [radius, radius, radius, radius])
            ctx.fill()
          } else {
            ctx.fillRect(x, h / 2 - half, barW, half * 2)
          }
        }
        ctx.globalAlpha = 1
        if (playing) frame = requestAnimationFrame(draw)
      }
      frame = requestAnimationFrame(draw)
      return function () {
        if (frame !== 0) cancelAnimationFrame(frame)
        if (observer !== null) observer.disconnect()
        window.removeEventListener('resize', resize)
      }
    },
    [accent, playing, active],
  )
  return h('canvas', {
    ref: ref,
    className: cx('mp-np-reflect-wave', (playing !== true || active !== true) && 'is-fading'),
    'aria-hidden': 'true',
  })
}

function NowPlaying(props) {
  var snap = usePlayerSnapshot()
  var time = usePlayerTime()
  var prefs = usePrefs()
  var track = snap.queue[snap.index] || null
  var trackPath = track ? track.path : ''
  // Fade the incoming cover/title/artist only. Removing the outgoing node with
  // a zero-length animation keeps rapid next/previous clicks responsive; the
  // old implementation kept it on screen for the whole fade and felt blocked.
  function incomingFade(el, action) {
    if (action !== 'add') return new KeyframeEffect(el, [], { duration: 0 })
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return new KeyframeEffect(el, [], { duration: 0 })
    }
    return new KeyframeEffect(
      el,
      [
        { opacity: 0.25, transform: 'scale(.985)' },
        { opacity: 1, transform: 'scale(1)' },
      ],
      { duration: 170, easing: 'ease-out', fill: 'both' },
    )
  }
  var coverMotion = useAutoAnimate(incomingFade)
  var metaMotion = useAutoAnimate(incomingFade)
  var coverMotionRef = coverMotion[0]
  var metaMotionRef = metaMotion[0]
  var pair = useState([])
  var lyrics = pair[0]
  var setLyrics = pair[1]
  var loadingPair = useState(false)
  var lyricsLoading = loadingPair[0]
  var setLyricsLoading = loadingPair[1]
  var errorPair = useState('')
  var lyricError = errorPair[0]
  var setLyricError = errorPair[1]
  var settingsPair = useState(false)
  var editorPair = useState(false)
  var editorOpen = editorPair[0]
  var setEditorOpen = editorPair[1]
  var fsPair = useState(false)
  var isFullscreen = fsPair[0]
  var setIsFullscreen = fsPair[1]
  var settingsOpen = settingsPair[0]
  var setSettingsOpen = settingsPair[1]
  var settingsRef = useRef(null)
  var settingsBtnRef = useRef(null)
  var npRef = useRef(null)
  var coverImgRef = useRef(null)
  var settingsPosPair = useState(null)
  var settingsPos = settingsPosPair[0]
  var setSettingsPos = settingsPosPair[1]
  var extraPair = useState('')
  var extraPanel = extraPair[0]
  var setExtraPanel = extraPair[1]
  var sleepCustomPair = useState('')
  var sleepCustom = sleepCustomPair[0]
  var setSleepCustom = sleepCustomPair[1]
  var sleepRemaining = useCountdown(extraPanel === 'sleep' ? prefs.sleepDeadline : 0)
  var sleepRef = useRef(null)
  var audioRef = useRef(null)
  // Lyrics column width, dragged by the splitter on the right of the lyrics.
  var lyricWidthPair = useState(clamp(Number(prefs.npLyricWidth) || 560, 360, 900))
  var lyricWidth = lyricWidthPair[0]
  var setLyricWidth = lyricWidthPair[1]
  var paneGap = clamp(Number(prefs.npPaneGap) || 60, 12, 96)

  function applyLyricWidth(value, persist) {
    var next = clamp(Math.round(Number(value) || 560), 360, 900)
    setLyricWidth(next)
    if (persist === true) setPrefs({ npLyricWidth: next })
  }

  function beginLyricResize(event, side) {
    if (event.button !== undefined && event.button !== 0) return
    event.preventDefault()
    var handle = event.currentTarget
    if (handle && handle.classList) handle.classList.add('is-dragging')
    var startX = event.clientX
    // The rendered column may be narrower than the stored preference when the
    // window is small, so drag from what is actually on screen.
    var pane = document.querySelector('.mp-np-right')
    var startWidth = pane === null ? lyricWidth : pane.getBoundingClientRect().width
    var latest = Math.round(startWidth)
    // Never persist a width the current interface cannot fit; the CSS formula
    // caps it the same way.
    var fitMax = 900
    var body = document.querySelector('.mp-np-body')
    var cover = document.querySelector('.mp-np-left')
    if (body !== null && cover !== null) {
      var styles = window.getComputedStyle(body)
      var contentWidth =
        body.getBoundingClientRect().width -
        (parseFloat(styles.paddingLeft) || 0) -
        (parseFloat(styles.paddingRight) || 0)
      var leftSplit = document.querySelector('.mp-np-split[data-side="left"]')
      var rightSplit = document.querySelector('.mp-np-split[data-side="right"]')
      var gapWidth = leftSplit === null ? 24 : leftSplit.getBoundingClientRect().width
      var splitWidth = rightSplit === null ? 24 : rightSplit.getBoundingClientRect().width
      fitMax = Math.min(900, (contentWidth - 0.5 * cover.getBoundingClientRect().width - gapWidth - 2 * splitWidth) / 1.5)
    }
    document.body.style.userSelect = 'none'
    function move(moveEvent) {
      // The layout pins the midpoint of the two column centre lines to the
      // interface centre: the left boundary moves -1/4 and the right boundary
      // +3/4 of a width change, so each handle needs its own ratio to track the
      // pointer exactly.
      var dx = moveEvent.clientX - startX
      latest = clamp(side === 'left' ? startWidth - 4 * dx : startWidth + (4 * dx) / 3, 360, fitMax)
      setLyricWidth(latest)
    }
    function finish() {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', finish)
      if (handle && handle.classList) handle.classList.remove('is-dragging')
      document.body.style.userSelect = ''
      setPrefs({ npLyricWidth: Math.round(latest) })
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', finish)
  }

  function onLyricSplitKey(event) {
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      applyLyricWidth(lyricWidth - 24, true)
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      applyLyricWidth(lyricWidth + 24, true)
    } else if (event.key === 'Home') {
      event.preventDefault()
      applyLyricWidth(560, true)
    }
  }
  var sourcePair = useState('')
  var lyricSource = sourcePair[0]
  var setLyricSource = sourcePair[1]
  var offsetPair = useState(0)
  var offsetMs = offsetPair[0]
  var setOffsetMs = offsetPair[1]
  var reloadPair = useState(0)
  var lyricReload = reloadPair[0]
  var setLyricReload = reloadPair[1]
  var boxRef = useRef(null)
  var innerRef = useRef(null)
  var discWrapRef = useRef(null)
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
  useEffect(
    function () {
      if (extraPanel === '') return undefined
      function onDown(event) {
        if (sleepRef.current && sleepRef.current.contains(event.target)) return
        if (audioRef.current && audioRef.current.contains(event.target)) return
        setExtraPanel('')
      }
      function onKey(event) {
        if (event.key === 'Escape') setExtraPanel('')
      }
      document.addEventListener('pointerdown', onDown, true)
      window.addEventListener('keydown', onKey)
      return function () {
        document.removeEventListener('pointerdown', onDown, true)
        window.removeEventListener('keydown', onKey)
      }
    },
    [extraPanel],
  )
  var cover = track ? trackCoverSrc(track) : ''
  var flowAccent = useCoverAccent(cover, coverImgRef)
  var pageHiddenPair = useState(false)
  var pageHidden = pageHiddenPair[0]
  var setPageHidden = pageHiddenPair[1]
  useEffect(function () {
    function sync() {
      setPageHidden(document.visibilityState === 'hidden')
    }
    sync()
    document.addEventListener('visibilitychange', sync)
    return function () {
      document.removeEventListener('visibilitychange', sync)
    }
  }, [])
  var smokeColors = smokePalette(flowAccent)
  var bgPair = useState({ current: '', previous: '' })
  var bg = bgPair[0]
  var setBg = bgPair[1]

  useEffect(
    function () {
      var cancelled = false
      if (cover === '') {
        setBg({ current: '', previous: '' })
        return undefined
      }
      createBlurredBackdrop(cover).then(function (texture) {
        if (cancelled || texture === '') return
        setBg(function (prev) {
          if (prev.current === texture) return prev
          return { current: texture, previous: prev.current }
        })
      })
      return function () {
        cancelled = true
      }
    },
    [cover],
  )

  // Cached online streams carry real codec/sample-rate/bitrate facts; probe the
  // cache after playback starts and merge them into the current queue track.
  useEffect(
    function () {
      if (!track || !track.onlineProvider || !track.onlineId) return undefined
      var provider = track.onlineProvider
      var id = track.onlineId
      var path = track.path
      var cancelled = false
      var attempts = 0
      var timer = null
      function ask() {
        if (cancelled) return
        getJson(
          API +
            'online/info?provider=' +
            encodeURIComponent(provider) +
            '&id=' +
            encodeURIComponent(id),
        )
          .then(function (body) {
            if (cancelled) return
            var info = body && body.cached ? body.info : null
            if (info && (info.codec || info.sampleRate || info.bitrate)) {
              player.updateTrack(path, {
                codec: info.codec || '',
                sampleRate: Number(info.sampleRate) || 0,
                bitrate: Number(info.bitrate) || 0,
                size: Number(info.size) || 0,
              })
              return
            }
            if (attempts < 30) {
              attempts += 1
              timer = setTimeout(ask, 600)
            }
          })
          .catch(function () {
            if (cancelled) return
            if (attempts < 15) {
              attempts += 1
              timer = setTimeout(ask, 900)
            }
          })
      }
      ask()
      return function () {
        cancelled = true
        if (timer !== null) clearTimeout(timer)
      }
    },
    [trackPath, track && track.onlineProvider, track && track.onlineId],
  )
  var circular = prefs.coverStyle === 'vinyl'
  var stagedPair = useState(false)
  var staged = stagedPair[0]
  var setStaged = stagedPair[1]
  useEffect(
    function () {
      if (props.open !== true) {
        setStaged(false)
        return undefined
      }
      // Let the 320ms slide-in finish before starting the vinyl spin and the
      // wave rAF. Starting both on the same frame competes with the entrance
      // paint and makes the page feel heavier than it is.
      var timer = setTimeout(function () {
        setStaged(true)
      }, 360)
      return function () {
        clearTimeout(timer)
      }
    },
    [props.open],
  )
  var spinning = circular && snap.playing && staged
  var vinyl = circular
  var lyricSize = prefs.lyricSize || 18
  var translationSize = Math.round((lyricSize * (prefs.translationScale || 80)) / 100)
  var lyricsTimed = lyrics.length > 0 && lyrics[0].time >= 0
  var lyricOrderKey = Array.isArray(prefs.lyricOrder) ? prefs.lyricOrder.join(',') : 'embedded,lrc'

  useEffect(
    function () {
      if (props.open !== true || trackPath === '') return undefined
      var cancelled = false
      setLyrics([])
      setLyricSource('')
      setLyricError('')
      setLyricsLoading(true)
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
              setLyricSource('ONLINE')
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
            setLyricSource(String(local.source || ''))
            setOffsetMs(Number(local.offsetMs) || 0)
          }
        } catch (error) {
          if (!cancelled) setLyricError(errorText(error))
        } finally {
          if (!cancelled) setLyricsLoading(false)
        }
      }
      load()
      return function () {
        cancelled = true
      }
    },
    [props.open, trackPath, lyricReload, lyricOrderKey],
  )

  var active = lyricActiveIndex(lyrics, time.currentTime - offsetMs / 1000)
  var duration = time.duration > 0 ? time.duration : track ? track.durationSec || 0 : 0
  var favorite = track !== null && props.favoriteSet[track.path] === true

  var lyricScroll = useLyricAutoScroll(
    boxRef,
    innerRef,
    discWrapRef,
    rowRefs,
    active,
    lyrics,
    lyricsTimed,
    props.open === true,
    prefs.showTranslation === true,
    lyricSize,
    Number(prefs.lyricGap) || 6,
    prefs.translationScale || 80,
    prefs.lyricAlign || 'center',
  )
  // While the user browses with the wheel, sharpness follows the line at the
  // cover centre, not the (possibly off-screen) playing line.
  var lyricFocus = lyricScroll.manualIndex >= 0 ? lyricScroll.manualIndex : active

  function seekLine(line, index) {
    if (!line || line.time < 0) return
    // Clicking is the explicit "follow this line" gesture; wheel browsing alone
    // must not resume the auto-scroll spring.
    lyricScroll.resume(index)
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

  function setSleep(minutes) {
    var value = Number(minutes) || 0
    setPrefs({
      sleepTimerMinutes: value,
      sleepDeadline: value > 0 ? Date.now() + value * 60000 : 0,
    })
    setExtraPanel('')
  }

  function toggleFullscreen() {
    var node = npRef.current
    if (node === null) return
    if (document.fullscreenElement === node) {
      void document.exitFullscreen()
      return
    }
    if (typeof node.requestFullscreen !== 'function') {
      showToast(t('page.fullscreenFailed'))
      return
    }
    try {
      var result = node.requestFullscreen()
      if (result && typeof result.catch === 'function') {
        result.catch(function () {
          showToast(t('page.fullscreenFailed'))
        })
      }
    } catch (error) {
      showToast(t('page.fullscreenFailed'))
    }
  }

  function applySleepCustom() {
    var value = Math.round(Number(sleepCustom))
    if (!Number.isFinite(value) || value < 1 || value > 720) return
    setSleep(value)
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

  useEffect(
    function () {
      if (props.open !== true) setEditorOpen(false)
    },
    [props.open],
  )

  useEffect(
    function () {
      function onChange() {
        setIsFullscreen(typeof document !== 'undefined' && document.fullscreenElement === npRef.current)
      }
      onChange()
      document.addEventListener('fullscreenchange', onChange)
      return function () {
        document.removeEventListener('fullscreenchange', onChange)
        if (document.fullscreenElement === npRef.current) void document.exitFullscreen()
      }
    },
    [],
  )

  useEffect(
    function () {
      if (props.open !== true && document.fullscreenElement === npRef.current) {
        void document.exitFullscreen()
      }
    },
    [props.open],
  )

  function toggleLyricSettings() {
    if (settingsOpen) {
      setSettingsOpen(false)
      return
    }
    var np = npRef.current
    var btn = settingsBtnRef.current
    if (np !== null && btn !== null) {
      var nr = np.getBoundingClientRect()
      var br = btn.getBoundingClientRect()
      var width = Math.min(320, Math.max(240, nr.width - 24))
      var left = Math.max(12, Math.min(br.left - nr.left, nr.width - width - 12))
      var bottom = Math.max(12, nr.bottom - br.top + 10)
      setSettingsPos({ left: left, bottom: bottom, width: width })
    }
    setSettingsOpen(true)
  }

  return h(
    'div',
    {
      className: cx(
        'mp-np',
        props.open === true && 'is-open',
        isFullscreen && 'is-fs',
        prefs.lyricBlur === true && 'is-blur',
        prefs.showTranslation === true && 'is-trans',
        prefs.coverStyle === 'vinyl' && 'is-vinyl',
        'mp-align-' + (prefs.lyricAlign || 'center'),
      ),
      ref: npRef,
      role: 'dialog',
      'aria-label': t('page.openPlayer'),
      'aria-hidden': props.open === true ? 'false' : 'true',
      style: {
        '--mp-lyric-size': lyricSize + 'px',
        '--mp-lyric-trans': translationSize + 'px',
        '--mp-line-gap': (Number(prefs.lyricGap) || 6) + 'px',
        '--mp-lyric-w': lyricWidth + 'px',
        '--mp-pane-gap-w': paneGap + 'px',
      },
    },
    prefs.npFlowBg === false && (bg.current !== '' || bg.previous !== '')
      ? h(
          'div',
          { className: 'mp-np-bg' },
          bg.previous !== ''
            ? h('img', { key: 'prev:' + bg.previous, src: bg.previous, alt: '', className: 'is-prev' })
            : null,
          bg.current !== ''
            ? h('img', { key: 'cur:' + bg.current, src: bg.current, alt: '', className: 'is-cur' })
            : null,
        )
      : null,

    prefs.npFlowBg !== false
      ? h(
          'div',
          {
            className: cx('mp-np-flow', (pageHidden || props.open === false) && 'is-paused'),
            'aria-hidden': 'true',
          },
          h(SmokeFlow, {
            colors: smokeColors,
            paused: pageHidden || props.open === false,
            playing: snap.playing === true,
            beat: clamp((Number(prefs.npSmokeBeat) || 0) / 100, 0, 1),
            beatSpeed: clamp((Number(prefs.npBeatSpeed) || 220) / 100, 0, 3),
            beatIntensity: clamp((Number(prefs.npBeatIntensity) || 100) / 100, 0, 3),
            beatScale: clamp((Number(prefs.npBeatScale) || 18) / 100, 0, 0.5),
            beatWarp: clamp((Number(prefs.npBeatWarp) || 120) / 100, 0, 3),
            speed: clamp((Number(prefs.npSmokeSpeed) || 100) / 100, 0.3, 2.5),
            intensity: clamp((Number(prefs.npSmokeIntensity) || 100) / 100, 0.3, 1.8),
            scale: clamp((Number(prefs.npSmokeScale) || 100) / 100, 0.5, 2),
          }),
        )
      : null,
    h('div', { className: 'mp-np-shade' }),
    h(
      'div',
      { className: 'mp-np-head' },
      h(IconButton, { icon: 'chevronDown', size: 20, title: t('page.closePlayer'), onClick: props.onClose }),
    ),
    h(
      'div',
      { className: 'mp-np-fs' },
      h(IconButton, {
        icon: isFullscreen ? 'minimize' : 'maximize',
        size: 18,
        title: isFullscreen ? t('page.exitFullscreen') : t('page.fullscreen'),
        onClick: toggleFullscreen,
      }),
    ),
    settingsOpen
      ? h(
          'div',
          {
            className: 'mp-np-settings',
            ref: settingsRef,
            style: settingsPos
              ? { left: settingsPos.left + 'px', bottom: settingsPos.bottom + 'px', width: settingsPos.width + 'px', right: 'auto', top: 'auto' }
              : undefined,
          },
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
              h('span', null, t('page.lyricGap')),
              h('span', { className: 'mp-set-val' }, (Number(prefs.lyricGap) || 6) + ' px'),
            ),
            h('input', {
              type: 'range',
              className: 'mp-range',
              min: 2,
              max: 16,
              step: 1,
              value: Number(prefs.lyricGap) || 6,
              onChange: function (event) {
                setPrefs({ lyricGap: Number(event.target.value) })
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
            'div',
            { className: 'mp-np-setting' },
            h('div', { className: 'mp-np-setting-head' }, h('span', null, t('settings.lyricAlign'))),
            h(
              'div',
              { className: 'mp-np-align-row' },
              [
                ['left', 'settings.alignLeft'],
                ['center', 'settings.alignCenter'],
                ['right', 'settings.alignRight'],
              ].map(function (item) {
                return h(
                  'button',
                  {
                    key: item[0],
                    type: 'button',
                    className: cx(
                      'mp-chip',
                      (prefs.lyricAlign || 'left') === item[0] && 'is-on',
                    ),
                    onClick: function () {
                      setPrefs({ lyricAlign: item[0] })
                    },
                  },
                  t(item[1]),
                )
              }),
            ),
          ),
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
          { className: 'mp-np-meta', ref: metaMotionRef },
          h(
            'div',
            { key: 'title:' + trackPath, className: 'mp-np-title' },
            track ? trackTitleOf(track) : '—',
          ),
          h(
            'div',
            { key: 'artist:' + trackPath, className: 'mp-np-artist-row' },
            h('div', { className: 'mp-np-artist' }, track ? trackArtistOf(track) : ''),
            h(IconButton, {
              className: 'mp-np-meta-audio',
              icon: snap.muted ? 'mute' : 'volume',
              size: 20,
              active: snap.muted === true,
              title: t('page.volume'),
              onClick: function () {
                player.setMuted(!snap.muted)
              },
            }),
          ),
        ),
        h(
          'div',
          { className: cx('mp-np-cover-stage', vinyl && 'is-vinyl'), ref: coverMotionRef },
          h(
            'div',
            { key: 'cover:' + trackPath, className: cx('mp-np-disc-wrap', vinyl && 'is-vinyl'), ref: discWrapRef },
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
              cover !== ''
                ? h('img', { src: cover, alt: '', draggable: false, ref: coverImgRef })
                : icon('note', 96),
            ),
          ),
        ),
        ),
        h(
          'div',
          { className: 'mp-np-quality' },
          h('span', { className: 'mp-np-quality-name' }, 'AudioTrack'),
          track && track.codec ? h('span', null, track.codec) : null,
          track && track.sampleRate ? h('span', null, fmtKhz(track.sampleRate)) : null,
          track && track.bitrate ? h('span', null, fmtKbps(track.bitrate)) : null,
          track && track.qualityHint ? h('span', null, track.qualityHint) : null,
        ),
        h(
          'div',
          { className: 'mp-np-progress' },
          prefs.waveEnabled !== false
            ? h(CoverReflectWave, {
            cover: cover,
            playing: snap.playing,
            imageRef: coverImgRef,
            active: staged,
            beat: clamp((Number(prefs.npSmokeBeat) || 0) / 100, 0, 1),
            beatSpeed: clamp((Number(prefs.npBeatSpeed) || 220) / 100, 0, 3),
            beatIntensity: clamp((Number(prefs.npBeatIntensity) || 100) / 100, 0, 3),
            beatScale: clamp((Number(prefs.npBeatScale) || 18) / 100, 0, 0.5),
            beatWarp: clamp((Number(prefs.npBeatWarp) || 120) / 100, 0, 3),
          })
            : null,
          h(SeekBar, { fallbackDuration: track ? track.durationSec || 0 : 0 }),
        ),
        h(
          'div',
          { className: 'mp-np-times' },
          h('span', null, fmtClock(time.currentTime)),
          h('span', null, fmtClock(duration)),
        ),
        h(
          'div',
          { className: 'mp-np-transport' },
          h(IconButton, {
            icon: 'prev',
            size: 28,
            title: t('page.prev'),
            tooltip: false,
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
            icon(snap.playing ? 'pause' : 'play', 38),
          ),
          h(IconButton, {
            icon: 'next',
            size: 28,
            title: t('page.next'),
            tooltip: false,
            onClick: function () {
              player.next()
            },
          }),
        ),
        h(
          'div',
          { className: 'mp-np-secondary' },
          h(
            'div',
            { className: 'mp-np-extra-item', ref: sleepRef },
            h(IconButton, {
              icon: 'clock',
              size: 22,
              active: extraPanel === 'sleep',
              title: t('settings.sleepTimer'),
              onClick: function () {
                setExtraPanel(extraPanel === 'sleep' ? '' : 'sleep')
              },
            }),
            extraPanel === 'sleep'
              ? h(
                  'div',
                  { className: 'mp-np-extra-pop is-sleep' },
                  h(
                    'div',
                    { className: 'mp-np-sleep-head' },
                    h('span', { className: 'mp-np-sleep-head-icon' }, icon('clock', 14)),
                    h(
                      'div',
                      { className: 'mp-np-sleep-title-wrap' },
                      h('div', { className: 'mp-np-sleep-title' }, t('settings.sleepTimer')),
                      h(
                        'div',
                        { className: 'mp-np-sleep-hint' },
                        sleepRemaining > 0
                          ? t('sleep.remaining', { time: fmtClock(sleepRemaining / 1000) })
                          : t('sleep.hint'),
                      ),
                    ),
                    h(
                      'button',
                      {
                        type: 'button',
                        className: 'mp-np-sleep-close',
                        title: t('editor.close'),
                        onClick: function () {
                          setExtraPanel('')
                        },
                      },
                      icon('x', 14),
                    ),
                  ),
                  h('div', { className: 'mp-np-sleep-label' }, t('sleep.presets')),
                  h(
                    'div',
                    { className: 'mp-np-sleep-grid' },
                    [15, 30, 45, 60, 90].map(function (minutes) {
                      var on = sleepRemaining > 0 && prefs.sleepTimerMinutes === minutes
                      return h(
                        'button',
                        {
                          key: minutes,
                          type: 'button',
                          className: cx('mp-np-sleep-chip', on && 'is-on'),
                          onClick: function () {
                            setSleep(minutes)
                          },
                        },
                        minutes,
                        h('span', null, t('sleep.minutes')),
                      )
                    }),
                  ),
                  h('div', { className: 'mp-np-sleep-label' }, t('sleep.custom')),
                  h(
                    'div',
                    { className: 'mp-np-sleep-custom' },
                    h('input', {
                      type: 'text',
                      inputMode: 'numeric',
                      maxLength: 3,
                      className: 'mp-np-sleep-input',
                      placeholder: t('sleep.placeholder'),
                      'aria-label': t('sleep.placeholder'),
                      value: sleepCustom,
                      onChange: function (event) {
                        setSleepCustom(event.target.value.replace(/[^0-9]/g, '').slice(0, 3))
                      },
                      onKeyDown: function (event) {
                        if (event.key === 'Enter') applySleepCustom()
                      },
                    }),
                    h('span', { className: 'mp-np-sleep-unit' }, t('sleep.minutes')),
                    h(
                      'button',
                      {
                        type: 'button',
                        className: 'mp-np-sleep-set',
                        disabled: !(Number(sleepCustom) >= 1 && Number(sleepCustom) <= 720),
                        onClick: applySleepCustom,
                      },
                      t('sleep.set'),
                    ),
                  ),
                  sleepCustom !== '' && !(Number(sleepCustom) >= 1 && Number(sleepCustom) <= 720)
                    ? h('div', { className: 'mp-np-sleep-error' }, t('sleep.invalid'))
                    : null,
                  sleepRemaining > 0
                    ? h(
                        'button',
                        {
                          type: 'button',
                          className: 'mp-np-sleep-off',
                          onClick: function () {
                            setSleep(0)
                          },
                        },
                        t('settings.sleepOff'),
                      )
                    : null,
                )
              : null,
          ),
          h(IconButton, {
            icon: playModeIcon(playModeOf(snap)),
            size: 22,
            title: t('page.loopAll'),
            onClick: function () {
              cyclePlayMode(snap)
            },
          }),
          h(
            'div',
            { className: 'mp-np-extra-item', ref: audioRef },
            h(IconButton, {
              icon: 'equalizer',
              size: 22,
              active: extraPanel === 'audio' || extraPanel === 'eq',
              title: t('page.audioEffects'),
              onClick: function () {
                var effectsOpen =
                  extraPanel === 'audio' || extraPanel === 'eq'
                setExtraPanel(effectsOpen ? '' : 'audio')
              },
            }),
            extraPanel === 'audio' || extraPanel === 'eq'
              ? h(AudioEffectsPanel, {
                  view: extraPanel,
                  onView: setExtraPanel,
                  snap: snap,
                  prefs: prefs,
                  track: track,
                })
              : null,
          ),
          h(
            'div',
            { className: 'mp-pb-queue-wrap' },
            h(IconButton, {
              icon: 'playlist',
              size: 22,
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
          h(IconButton, {
            icon: 'more',
            size: 22,
            title: t('editor.title'),
            onClick: function () {
              setSettingsOpen(false)
              setEditorOpen(true)
            },
          }),
        ),
      ),
      h('div', {
        className: 'mp-np-split',
        'data-side': 'left',
        role: 'separator',
        'aria-orientation': 'vertical',
        'aria-label': t('page.lyricWidth'),
        'aria-valuemin': 360,
        'aria-valuemax': 900,
        'aria-valuenow': lyricWidth,
        title: t('page.lyricWidth'),
        tabIndex: 0,
        onPointerDown: function (event) {
          beginLyricResize(event, 'left')
        },
        onKeyDown: onLyricSplitKey,
        onDoubleClick: function () {
          applyLyricWidth(560, true)
        },
      }),
      h(
        'div',
        { className: 'mp-np-right' },
        h(
          'div',
          { className: 'mp-np-lyrics' + (lyricsTimed ? '' : ' is-static'), ref: boxRef },
          lyrics.length === 0
            ? null
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
                        (index === lyricFocus ? ' is-focus' : '') +
                        (active >= 0 && index < active ? ' is-past' : ''),
                      style: {
                        '--mp-line-stagger': String(
                          lyricFocus >= 0 ? Math.min(Math.abs(index - lyricFocus), 8) : 0,
                        ),
                        '--mp-trans': line.translation ? '1' : '0',
                      },
                      onClick: function () {
                        seekLine(line, index)
                      },
                    },
                    h(
                      'div',
                      { className: 'mp-np-line-text' },
                      line.text,
                      lyricScroll.manualIndex === index && index === active && line.time >= 0
                        ? h('span', { className: 'mp-np-line-time' }, fmtClock(line.time))
                        : null,
                    ),
                    h(
                      'div',
                      {
                        className: 'mp-np-line-trans',
                        'aria-hidden':
                          prefs.showTranslation === true && line.translation ? 'false' : 'true',
                      },
                      h(
                        'span',
                        { className: 'mp-np-line-trans-inner' },
                        line.translation
                          ? line.translation.split('\n').map(function (part, partIndex) {
                              return h(
                                'span',
                                { key: 'translation-' + partIndex, className: 'mp-np-line-trans-text' },
                                part,
                              )
                            })
                          : null,
                      ),
                    ),
                  )
                }),
              ),
        ),
        lyrics.length === 0 && lyricsLoading !== true
          ? h(
              'div',
              { className: 'mp-np-lyrics-empty', 'aria-live': 'polite' },
              h('div', { className: 'mp-np-lyrics-empty-icon' }, icon('lyrics', 34)),
              h(
                'div',
                { className: 'mp-np-lyrics-empty-text' },
                lyricError !== '' ? lyricError : t('page.noLyrics'),
              ),
            )
          : null,
        h(
          'div',
          { className: 'mp-np-lyric-foot' },
          h(
            'span',
            { className: 'mp-np-lyric-tag' },
            h(
              'button',
              {
                type: 'button',
                className: cx('mp-np-lyric-tag-badge', 'is-btn', prefs.showTranslation === true && 'is-on'),
                title: t('page.translation'),
                onClick: function () {
                  setPrefs({ showTranslation: prefs.showTranslation !== true })
                },
              },
              '译',
            ),
            h(
              'button',
              {
                type: 'button',
                ref: settingsBtnRef,
                className: cx('mp-np-lyric-tag-badge', 'is-btn', settingsOpen && 'is-on'),
                title: t('v2.lyricSettings'),
                'aria-label': t('v2.lyricSettings'),
                onClick: toggleLyricSettings,
              },
              '词',
            ),
            lyricSource !== '' ? h('span', { className: 'mp-np-lyric-source' }, lyricSource.toUpperCase()) : null,
          ),
        ),
      ),
      h('div', {
        className: 'mp-np-split',
        'data-side': 'right',
        role: 'separator',
        'aria-orientation': 'vertical',
        'aria-label': t('page.lyricWidth'),
        'aria-valuemin': 360,
        'aria-valuemax': 900,
        'aria-valuenow': lyricWidth,
        title: t('page.lyricWidth'),
        tabIndex: 0,
        onPointerDown: function (event) {
          beginLyricResize(event, 'right')
        },
        onKeyDown: onLyricSplitKey,
        onDoubleClick: function () {
          applyLyricWidth(560, true)
        },
      }),
    ),
    editorOpen
      ? h(NpEditor, {
          open: true,
          cover: cover,
          title: track ? trackTitleOf(track) : '',
          artist: track ? trackArtistOf(track) : '',
          onClose: function () {
            setEditorOpen(false)
          },
        })
      : null,

  )
}
