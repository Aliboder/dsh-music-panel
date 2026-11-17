/**
 * now playing: the 0.11.1 full-panel player (square/circular disc, blurred
 * cover backdrop, floating transport panel) rebuilt on the v2 state layer.
 */

function lyricActiveIndex(lines, seconds) {
  if (!Array.isArray(lines) || lines.length === 0) return -1
  if (mpLineStart(lines[0]) < 0) return -1
  var low = 0
  var high = lines.length - 1
  var found = -1
  while (low <= high) {
    var mid = (low + high) >> 1
    if (mpLineStart(lines[mid]) <= seconds + 0.05) {
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
      lyricLocalPriority: 'local',
      lyricPreferredSource: 'qq',
      npPaneGap: 60,
      npLyricWidth: 560,
      npFlowBg: true,
      npAmbientOn: true,
      npAmbientDrift: 300,
      npAmbientSpeed: 400,
      npBeatSensitivity: 200,
      npBeatAmount: 300,
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


/**
 * Ambient backdrop motion: CSS handles the slow drift, and this cheap loop
 * only raises a CSS variable with the beat so the blurred cover can pulse.
 */
function useAmbientBeat(ref, enabled, playing, sensitivity, amount, ready) {
  var stateRef = useRef({
    enabled: enabled === true,
    playing: playing === true,
    sensitivity: Number(sensitivity) || 0.6,
    amount: Number(amount) || 0.6,
  })
  useEffect(
    function () {
      stateRef.current = {
        enabled: enabled === true,
        playing: playing === true,
        sensitivity: Number(sensitivity) || 0.6,
        amount: Number(amount) || 0.6,
      }
    },
    [enabled, playing, sensitivity, amount],
  )
  useEffect(function () {
    if (ready !== true) return undefined
    var node = ref.current
    if (node === null) return undefined
    var tracker = createBeatTracker()
    var raf = 0
    var last = 0
    function frame(now) {
      raf = requestAnimationFrame(frame)
      var state = stateRef.current
      if (state.enabled !== true || state.playing !== true || document.visibilityState === 'hidden') {
        node.style.setProperty('--mp-beat-scale', '1')
        return
      }
      if (now - last < 50) return
      last = now
      var wave =
        typeof player !== 'undefined' && player !== null && typeof player.getWave === 'function'
          ? player.getWave()
          : null
      var beat = tracker.update(wave, true, state.sensitivity) * state.amount
      node.style.setProperty('--mp-beat-scale', (1 + beat * 0.24).toFixed(4))
    }
    raf = requestAnimationFrame(frame)
    return function () {
      cancelAnimationFrame(raf)
      if (node.style) node.style.removeProperty('--mp-beat-scale')
    }
  }, [ready])
}

function WaveSeekBar(props) {
  var accent = useCoverAccent(props.cover || '', props.imageRef)
  var time = usePlayerTime()
  var seekPair = useState(null)
  var seeking = seekPair[0]
  var setSeeking = seekPair[1]
  var seekingRef = useRef(null)
  var hoverRef = useRef(null)
  var duration = time.duration > 0 ? time.duration : props.fallbackDuration || 0
  var position = seeking !== null ? seeking : Math.min(time.currentTime, duration || 0)
  var progress = duration > 0 ? clamp(position / duration, 0, 1) : 0
  var buffered = duration > 0 ? Math.min(duration, Math.max(0, Number(time.buffered) || 0)) : 0
  var progressRef = useRef(progress)
  var durationRef = useRef(duration)
  var bufferedRef = useRef(buffered)
  var morphRef = useRef(props.wave === false ? 0 : 1)
  var targetMorphRef = useRef(props.wave === false ? 0 : 1)
  var canvasRef = useRef(null)
  var drawRef = useRef(null)
  var startRef = useRef(null)
  var playing = props.playing === true
  var active = props.active !== false
  var playingRef = useRef(playing)
  playingRef.current = playing
  progressRef.current = progress
  durationRef.current = duration
  bufferedRef.current = buffered

  function choose(value) {
    seekingRef.current = value
    setSeeking(value)
  }
  function commit() {
    var value = seekingRef.current
    if (value === null) return
    if (duration > 0) player.seek(value)
    seekingRef.current = null
    setSeeking(null)
  }

  function toneOf(source) {
    var h = Number(source && source.h)
    if (!isFinite(h)) h = 0
    var sat = Number(source && source.s)
    if (!isFinite(sat) || sat < 0) sat = 0
    if (sat > 0 && sat <= 1) sat *= 100
    var light = Number(source && source.l)
    if (!isFinite(light) || light < 0) light = 60
    if (light > 0 && light <= 1) light *= 100
    // Neutral covers must not gain a hue; muted colours keep their own tone.
    if (sat < 20) sat = 0
    return {
      h: ((h % 360) + 360) % 360,
      s: Math.min(80, Math.max(0, sat)),
      l: Math.min(78, Math.max(52, light)),
    }
  }

  useEffect(
    function () {
      targetMorphRef.current = props.wave === false ? 0 : 1
      if (drawRef.current !== null) drawRef.current(performance.now())
      if (startRef.current !== null) startRef.current()
    },
    [props.wave],
  )

  useEffect(
    function () {
      if (props.playing === true && startRef.current !== null) {
        drawRef.current(performance.now())
        startRef.current()
      }
    },
    [props.playing],
  )

  useEffect(
    function () {
      var canvas = canvasRef.current
      if (canvas === null) return undefined
      var ctx = canvas.getContext('2d')
      if (ctx === null) return undefined
      if (active !== true) {
        var clearTimer = setTimeout(function () {
          var node = canvasRef.current
          if (node === null) return
          var clearCtx = node.getContext('2d')
          if (clearCtx !== null) clearCtx.clearRect(0, 0, node.width, node.height)
        }, 420)
        return function () {
          clearTimeout(clearTimer)
        }
      }
      var dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1)
      var levels = []
      var bands = 32
      var spectrumBands = 16
      var raf = 0
      var last = 0
      var tone = toneOf(accent)

      function resize() {
        var width = Math.max(1, Math.round(canvas.clientWidth * dpr))
        var height = Math.max(1, Math.round(canvas.clientHeight * dpr))
        if (width === canvas.width && height === canvas.height) return
        canvas.width = width
        canvas.height = height
        // Assigning width/height clears the bitmap; repaint when idle.
        if (drawRef.current !== null) drawRef.current(performance.now())
      }
      resize()
      var observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null
      if (observer !== null) observer.observe(canvas)
      window.addEventListener('resize', resize)

      function shouldAnimate() {
        if (Math.abs(morphRef.current - targetMorphRef.current) > 0.005) return true
        if (targetMorphRef.current === 0) return false
        return playingRef.current === true
      }

      function draw(now) {
        var w = canvas.width / dpr
        var h = canvas.height / dpr
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.clearRect(0, 0, w, h)
        ctx.globalAlpha = 1
        var morph = morphRef.current
        var target = targetMorphRef.current
        morph += (target - morph) * 0.18
        if (Math.abs(morph - target) < 0.003) morph = target
        morphRef.current = morph

        if (morph < 0.02 && target === 0) {
          var trackH = 4
          var trackY = h / 2
          function rail(x, width, color) {
            if (width <= 0) return
            ctx.fillStyle = color
            if (typeof ctx.roundRect === 'function') {
              ctx.beginPath()
              ctx.roundRect(x, trackY - trackH / 2, width, trackH, trackH / 2)
              ctx.fill()
            } else {
              ctx.fillRect(x, trackY - trackH / 2, width, trackH)
            }
          }
          rail(0, w, '#26262c')
          if (durationRef.current > 0 && bufferedRef.current > 0) {
            rail(0, Math.min(1, bufferedRef.current / durationRef.current) * w, '#3a3a43')
          }
          var playedWidth = progressRef.current * w
          rail(0, playedWidth, 'hsla(' + tone.h + ',' + tone.s + '%,' + tone.l + '%,1)')
          ctx.fillStyle = '#f7f7f8'
          ctx.beginPath()
          ctx.arc(Math.max(5, Math.min(w - 5, playedWidth)), trackY, 5, 0, Math.PI * 2)
          ctx.fill()
          if (hoverRef.current !== null) {
            ctx.fillStyle = 'rgba(255,255,255,.3)'
            ctx.fillRect(Math.max(0, Math.min(w - 1, hoverRef.current * w)), 0, 1, h)
          }
          return
        }

        var data = playingRef.current ? player.getWave() : null
        var raw = []
        if (data !== null && data.length > 0) {
          for (var band = 0; band < spectrumBands; band += 1) {
            var from = Math.floor(Math.pow(band / spectrumBands, 1.6) * data.length)
            var to = Math.max(from + 1, Math.floor(Math.pow((band + 1) / spectrumBands, 1.6) * data.length))
            to = Math.min(to, data.length)
            var sum = 0
            for (var i = from; i < to; i += 1) sum += data[i]
            raw.push(sum / Math.max(1, to - from) / 255)
          }
        } else {
          for (var z = 0; z < spectrumBands; z += 1) raw.push(0)
        }
        var peak = 0.4
        for (var p = 0; p < raw.length; p += 1) peak = Math.max(peak, raw[p])
        var gap = w / bands
        var mid = (bands - 1) / 2
        var bufferedRatio =
          durationRef.current > 0 ? Math.min(1, bufferedRef.current / durationRef.current) : 0
        for (var k = 0; k < bands; k += 1) {
          var dist = Math.abs(k - mid) / mid
          var bandIndex = Math.min(spectrumBands - 1, Math.round(dist * (spectrumBands - 1)))
          var level = Math.pow(Math.max(0, raw[bandIndex]) / peak, 1.5)
          level = 0.02 + Math.min(1, level) * 0.98
          var previous = levels[k] || 0
          levels[k] = level > previous ? level : previous * 0.45 + level * 0.55
          var targetHalf = Math.max(2, (levels[k] * h) / 2)
          var half = 2 + (targetHalf - 2) * morph
          var barW = gap * (1 - 0.42 * morph)
          var x = k * gap + (gap - barW) / 2
          var center = (k + 0.5) / bands
          var played = center <= progressRef.current
          var bufferedBar = center <= bufferedRatio
          ctx.fillStyle = played
            ? 'hsla(' + tone.h + ',' + tone.s + '%,' + tone.l + '%,0.96)'
            : bufferedBar
              ? 'rgba(255,255,255,.32)'
              : 'rgba(255,255,255,' + (0.18 + 0.14 * morph).toFixed(3) + ')'
          var radius = Math.min(barW / 2, 4, half) * Math.min(1, morph * 2)
          if (morph < 0.05 && (k === 0 || k === bands - 1)) radius = Math.min(2, half)
          if (typeof ctx.roundRect === 'function') {
            ctx.beginPath()
            ctx.roundRect(x, h / 2 - half, barW, half * 2, [radius, radius, radius, radius])
            ctx.fill()
          } else {
            ctx.fillRect(x, h / 2 - half, barW, half * 2)
          }
        }
        if (durationRef.current > 0) {
          var head = progressRef.current * w
          if (morph > 0.08) {
            ctx.fillStyle = 'rgba(255,255,255,' + (0.22 + 0.68 * morph).toFixed(3) + ')'
            ctx.fillRect(Math.max(0, Math.min(w - 1.5, head - 0.75)), 2, 1.5, h - 4)
          }
          ctx.fillStyle = '#f7f7f8'
          ctx.beginPath()
          ctx.arc(Math.max(5, Math.min(w - 5, head)), h / 2, 5 - 2 * morph, 0, Math.PI * 2)
          ctx.fill()
        }
        if (hoverRef.current !== null) {
          ctx.fillStyle = 'rgba(255,255,255,.3)'
          ctx.fillRect(Math.max(0, Math.min(w - 1, hoverRef.current * w)), 0, 1, h)
        }
      }

      function frame(now) {
        raf = 0
        if (now - last < 33) {
          raf = requestAnimationFrame(frame)
          return
        }
        last = now
        draw(now)
        if (shouldAnimate()) raf = requestAnimationFrame(frame)
      }
      function start() {
        if (raf === 0 && shouldAnimate()) raf = requestAnimationFrame(frame)
      }
      drawRef.current = draw
      startRef.current = start
      draw(performance.now())
      start()
      return function () {
        if (raf !== 0) cancelAnimationFrame(raf)
        if (observer !== null) observer.disconnect()
        window.removeEventListener('resize', resize)
        drawRef.current = null
        startRef.current = null
      }
    },
    [accent, active],
  )

  useEffect(
    function () {
      if (drawRef.current !== null) drawRef.current(performance.now())
      if (startRef.current !== null) startRef.current()
    },
    [progress, duration, seeking],
  )

  return h(
    'div',
    { className: 'mp-wave-seek' },
    h('canvas', {
      ref: canvasRef,
      className: cx('mp-np-reflect-wave', active !== true && 'is-fading', props.wave === false && 'is-rail'),
      'aria-hidden': 'true',
    }),
    h('input', {
      type: 'range',
      className: 'mp-wave-seek-input',
      min: 0,
      max: duration > 0 ? duration : 1,
      step: 0.5,
      value: position,
      disabled: duration <= 0,
      'aria-label': t('page.duration'),
      onChange: function (event) {
        choose(Number(event.target.value))
      },
      onPointerUp: commit,
      onKeyUp: commit,
      onBlur: commit,
      onPointerMove: function (event) {
        var rect = event.currentTarget.getBoundingClientRect()
        hoverRef.current = clamp((event.clientX - rect.left) / Math.max(1, rect.width), 0, 1)
        if (drawRef.current !== null) drawRef.current(performance.now())
      },
      onPointerLeave: function () {
        hoverRef.current = null
        if (drawRef.current !== null) drawRef.current(performance.now())
      },
    }),
  )
}

/**
 * 播放页底部的 Folia 式播放胶囊：播放/暂停、曲名、进度与时间、循环模式、队列。
 *
 * Folia 的胶囊是页面自己的 transport（`FloatingPlayerControls`）；这个插件在
 * `is-visualizer` 布局下会隐藏左侧栏，所以这里补一份页面级 transport。进度用
 * 全局 `SeekBar`，队列沿用 `QueuePopover`，状态全部来自现有 player / props。
 */
function NowPlayingCapsule(props) {
  var snap = usePlayerSnapshot()
  var time = usePlayerTime()
  var track = snap.queue[snap.index] || null
  var duration = Number(time.duration) > 0
    ? Number(time.duration)
    : track
      ? Number(track.durationSec) || 0
      : 0
  var position = Math.min(Number(time.currentTime) || 0, duration || 0)
  var mode = playModeOf(snap)
  return h(
    'div',
    { className: 'mp-cap' },
    h(
      'div',
      { className: 'mp-cap-inner' },
      h(
        'div',
        { className: 'mp-cap-transport' },
        h(
          'button',
          {
            type: 'button',
            className: 'mp-cap-skip',
            disabled: track === null,
            title: t('page.prev'),
            'aria-label': t('page.prev'),
            onClick: function () {
              player.prev()
            },
          },
          icon('prev', 18),
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'mp-cap-play',
            disabled: track === null,
            title: snap.playing ? t('page.pause') : t('page.play'),
            'aria-label': snap.playing ? t('page.pause') : t('page.play'),
            onClick: function () {
              player.toggle()
            },
          },
          icon(snap.playing ? 'pause' : 'play', 20),
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'mp-cap-skip',
            disabled: track === null,
            title: t('page.next'),
            'aria-label': t('page.next'),
            onClick: function () {
              player.next()
            },
          },
          icon('next', 18),
        ),
      ),
      h(
        'div',
        { className: 'mp-cap-body' },
        h('div', { className: 'mp-cap-title', title: track ? trackTitleOf(track) : '' }, track ? trackTitleOf(track) : t('page.noTrack')),
        h(
          'div',
          { className: 'mp-cap-seek' },
          h('span', { className: 'mp-cap-time' }, fmtClock(position)),
          h(SeekBar, { fallbackDuration: track ? Number(track.durationSec) || 0 : 0 }),
          h('span', { className: 'mp-cap-time' }, fmtClock(duration)),
        ),
      ),
      h(
        'div',
        { className: 'mp-cap-actions' },
        h(IconButton, {
          icon: playModeIcon(mode),
          size: 20,
          title: playModeLabel(mode),
          onClick: function () {
            cyclePlayMode(snap)
          },
        }),
        h(
          'div',
          { className: 'mp-pb-queue-wrap mp-cap-queue' },
          h(IconButton, {
            icon: 'playlist',
            size: 20,
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
    ),
  )
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
  var setLyricsLoading = loadingPair[1]
  var errorPair = useState('')
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
  // Chorus windows from the provider still feed the lyric pipeline (hook lines and
  // their styling); there is no seek control for them.
  var sourcePair = useState('')
  var lyricSource = sourcePair[0]
  var setLyricSource = sourcePair[1]
  // Bottom sheet (cover / local / controls / queue / quality), opened from "词".
  var sheetPair = useState(false)
  var sheetOpen = sheetPair[0]
  var setSheetOpen = sheetPair[1]
  // Where the "词" control sits, so the card opens beside it (Folia anchors its panel
  // to the round handle the same way). -1 means "use the default corner".
  var anchorPair = useState({ right: -1, bottom: -1 })
  var sheetAnchor = anchorPair[0]
  var setSheetAnchor = anchorPair[1]
  var wordBtnRef = useRef(null)
  // Folia's player chrome auto-hides: the transport capsule and the bottom-right
  // handle fade out after 3 s without pointer activity and come back on the next move.
  // Any open panel keeps them visible.
  var chromePair = useState(true)
  var chromeVisible = chromePair[0]
  var setChromeVisible = chromePair[1]
  var chromePinned =
    sheetOpen || editorOpen || settingsOpen || extraPanel !== '' || props.queueOpen === true
  useEffect(
    function () {
      if (props.open !== true) return undefined
      var timer = null
      function clear() {
        if (timer !== null) {
          clearTimeout(timer)
          timer = null
        }
      }
      function arm() {
        clear()
        if (chromePinned) return
        timer = setTimeout(function () {
          setChromeVisible(false)
        }, 3000)
      }
      function wake() {
        setChromeVisible(true)
        arm()
      }
      var root = npRef.current
      if (root === null) return undefined
      root.addEventListener('pointermove', wake, { passive: true })
      root.addEventListener('pointerdown', wake, { passive: true })
      root.addEventListener('keydown', wake)
      if (chromePinned) {
        setChromeVisible(true)
        clear()
      } else {
        wake()
      }
      return function () {
        clear()
        root.removeEventListener('pointermove', wake)
        root.removeEventListener('pointerdown', wake)
        root.removeEventListener('keydown', wake)
      }
    },
    [props.open, chromePinned],
  )
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
  // Local theme source: generate once per song, entirely on this machine. The sheet's
  // "generate" button forces a fresh variation; this effect only fills the cache.
  useEffect(function () {
    if (props.open !== true || prefs.themeSource !== 'cover') return undefined
    if (trackPath === '' || typeof mpEnsureLocalTheme !== 'function') return undefined
    var text = lyrics.map(function (line) {
      if (!line) return ''
      return typeof line.fullText === 'string' ? line.fullText : typeof line.text === 'string' ? line.text : ''
    }).join('\n')
    mpEnsureLocalTheme({
      key: trackPath,
      cover: cover,
      lyricsText: text,
      songTitle: track ? trackTitleOf(track) : '',
      variation: 0,
    })
    return undefined
  }, [props.open, prefs.themeSource, trackPath, cover, lyrics])
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
  // The player page's backdrop is Folia's shell background (src/render/styles/folia-backdrop.js);
  // the old blurred-cover/ambient layer is gone from the page.
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
  var lyricsTimed = lyrics.length > 0 && mpLineStart(lyrics[0]) >= 0
  // ReplayGain values from the file's tags, and which lyric sources it has.
  var gainPair = useState(null)
  // The song's tag gain goes to the player, which uses it when the balance has no reading.
  useEffect(
    function () {
      if (player.setTagGain) player.setTagGain(gainInfo)
    },
    [gainInfo, trackPath],
  )
  var gainInfo = gainPair[0]
  var setGainInfo = gainPair[1]
  var sourceInfoPair = useState(null)
  var sourceInfo = sourceInfoPair[0]
  var setSourceInfo = sourceInfoPair[1]
  var balance = useStore(balanceStore)
  var gainMode = prefs.replayGainMode === 'off' || prefs.replayGainMode === 'track' || prefs.replayGainMode === 'album' ? prefs.replayGainMode : 'auto'

  useEffect(
    function () {
      setGainInfo(null)
      if (trackPath === '') return undefined
      if (track !== null && track.onlineProvider && track.onlineProvider !== 'navidrome') return undefined
      var cancelled = false
      // Navidrome reports its gain through OpenSubsonic; the file route only knows local paths.
      var gainUrl =
        track !== null && track.onlineProvider === 'navidrome'
          ? API +
            'online/replaygain?provider=navidrome&id=' +
            encodeURIComponent(track.onlineId || '')
          : API + 'replaygain?path=' + encodeURIComponent(trackPath)
      getJson(gainUrl)
        .then(function (body) {
          if (!cancelled) setGainInfo({ trackGain: body.trackGain, albumGain: body.albumGain })
        })
        .catch(function () {
          if (!cancelled) setGainInfo({ trackGain: null, albumGain: null })
        })
      return function () {
        cancelled = true
      }
    },
    [trackPath],
  )

  // The local lyric pick depends on these two settings; a change re-reads the track.
  // Declared before the effects that use it: a `var` below them would still be undefined
  // when their dependency arrays are built.
  var lyricPriorityKey = (prefs.lyricLocalPriority === 'online' ? 'online' : 'local')
    + '\u0000' + String(prefs.lyricPreferredSource || '')

  useEffect(
    function () {
      setSourceInfo(null)
      if (trackPath === '') return undefined
      var cancelled = false
      if (track !== null && track.onlineProvider) {
        // A platform song has no file lyric: its record says "the platform's own" or
        // "the imported one" (Folia's SourceTab for an online track).
        getJson(
          API +
            'online/lyric-state?provider=' +
            encodeURIComponent(track.onlineProvider) +
            '&id=' +
            encodeURIComponent(track.onlineId || ''),
        )
          .then(function (body) {
            if (cancelled) return
            setSourceInfo({
              embedded: false,
              local: false,
              online: true,
              imported: String(body.imported || '') !== '',
              active: body.source === 'imported' ? 'imported' : 'online',
              source: body.source === undefined ? null : body.source,
              markedPureMusic: body.pureMusic === true,
            })
          })
          .catch(function () {
            if (!cancelled) {
              setSourceInfo({ embedded: false, local: false, online: true, imported: false, active: 'online', source: null, markedPureMusic: false })
            }
          })
        return function () {
          cancelled = true
        }
      }
      getJson(API + 'lyrics/sources?path=' + encodeURIComponent(trackPath) + '&priority=' + (prefs.lyricLocalPriority === 'online' ? 'online' : 'local'))
        .then(function (body) {
          if (!cancelled) setSourceInfo(body)
        })
        .catch(function () {
          if (!cancelled) setSourceInfo(null)
        })
      return function () {
        cancelled = true
      }
    },
    [trackPath, lyricReload, lyricPriorityKey],
  )

  // off / auto / track / album — auto is the measured loudness trim, the two tag
  // modes use the file's own gains, and off disables both.
  useEffect(
    function () {
      if (!player.setReplayGain || !player.setNormalize) return
      if (gainMode === 'off') {
        player.setReplayGain(0)
        player.setNormalize(false)
        return
      }
      if (gainMode === 'auto') {
        player.setReplayGain(0)
        player.setNormalize(true)
        return
      }
      var db = gainInfo === null ? null : gainMode === 'album' ? gainInfo.albumGain ?? gainInfo.trackGain : gainInfo.trackGain
      if (typeof db === 'number' && Number.isFinite(db)) {
        player.setNormalize(false)
        player.setReplayGain(db)
      } else {
        player.setReplayGain(0)
        player.setNormalize(true)
      }
    },
    [gainMode, gainInfo, trackPath],
  )
  // 本地 tab: the timeline offset, the lyric source's name, the lyric text to export.
  var lyricSourceLabel =
    lyricSource === 'embedded'
      ? t('sheet.srcEmbedded')
      : lyricSource === 'lrc' || lyricSource === 'local'
        ? t('sheet.srcLocal')
        : lyricSource === 'online'
          ? t('sheet.srcOnline')
          : lyricSource === 'imported'
            ? t('sheet.srcImported')
            : lyricSource === 'pure'
              ? t('sheet.srcPureMusic')
              : ''
  var lyricsText = lyrics
    .map(function (line) {
      var total = mpLineStart(line) || 0
      var minutes = Math.floor(total / 60)
      var seconds = total % 60
      var stamp =
        '[' + (minutes < 10 ? '0' : '') + String(minutes) + ':' + (seconds < 10 ? '0' : '') + seconds.toFixed(2) + ']'
      var text = stamp + String(line.fullText !== undefined ? line.fullText : line.text || '')
      if (line.translation) text += '\n' + stamp + String(line.translation)
      return text
    })
    .join('\n')

  // The parsed document the lines on screen came from, before the display-time pass:
  // a change of the listener's line rules re-runs that pass on it (Folia's setter does
  // the same, and its `lyricsBeforeRules` keeps the pre-rule lines for exactly this).
  var lyricDocRef = useRef(null)
  // Which priority/preferred-source pair the shared loader was filled with: a change means
  // the resolved lyrics on record may differ now, so its cache is dropped once.
  var lyricPrefsKeyRef = useRef(lyricPriorityKey)
  var lyricRulesKey = mpLyricRulesKey()
  // Folia loads icu-folia's engines lazily and re-bakes the shown lyrics when they land.
  // Armed with the first document that can carry a split; the reload is a module-level
  // one-shot (a per-run flag would re-arm every pass and loop: see the note in CHANGELOG).
  function armIcuFolia() {
    ensureIcuFoliaData().then(function (ready) {
      if (!ready || icuFoliaRebaked) return
      icuFoliaRebaked = true
      setLyricReload(function (value) {
        return value + 1
      })
    })
  }

  useEffect(
    function () {
      if (props.open !== true || trackPath === '') return undefined
      var cancelled = false
      if (lyricPrefsKeyRef.current !== lyricPriorityKey) {
        lyricPrefsKeyRef.current = lyricPriorityKey
        MPLyricLoader.invalidate()
      }
      lyricDocRef.current = null
      setLyrics([])
      setLyricSource('')
      setLyricError('')
      setLyricsLoading(true)
      var current = snap.queue[snap.index]
      // Folia's `autoUseBestLyric` runs in the shared loader once the first lyric is on its
      // way; this is where its replacement lands. The listener is also the diagnostics
      // point: an upgrade is a second lyric load, told apart from the platform's own.
      var unsubscribe = MPLyricLoader.subscribe(trackPath, function (next) {
        if (cancelled || next.upgraded === undefined) return
        setLyrics(next.document === null ? legacyLinesToFolia(next.lyrics) : next.lyrics)
        lyricDocRef.current = next.document === null
          ? null
          : { path: trackPath, document: next.document, chorusRanges: next.chorusRanges }
        if (typeof console !== 'undefined' && typeof console.info === 'function') {
          console.info(
            '[dsh-music] lyric upgrade',
            String((current && current.onlineProvider) || '') + '/' + String((current && current.onlineId) || ''),
            'from=' + String(next.upgraded.source || '') + '/' + String(next.upgraded.id || ''),
            'wordLevel=' + String(next.upgraded.wordLevel === true),
          )
        }
        if (typeof postJson === 'function' && typeof API === 'string') {
          void postJson(API + 'debug/report', {
            kind: 'lyric-upgrade',
            provider: String((current && current.onlineProvider) || ''),
            id: String((current && current.onlineId) || ''),
            from: String(next.upgraded.source || ''),
            fromId: String(next.upgraded.id || ''),
            hadRaw: next.document !== null,
            lines: next.lyrics.length,
          }).catch(function () {})
        }
        if (typeof showToast === 'function') {
          // Folia can settle on a line-level match too (the preferred source's translation,
          // say); only say "word-by-word" when it really is.
          showToast(
            t(next.upgraded.wordLevel === true ? 'sheet.lyricUpgraded' : 'sheet.lyricSwitched', {
              source: mpLyricSourceLabel(next.upgraded.source),
            }),
          )
        }
      })
      async function load() {
        try {
          // One load per song, shared with the player's start gate. Folia resolves the
          // lyric where playback starts, so this asks the same module the gate already
          // did instead of fetching a second copy.
          var loaded = await MPLyricLoader.load(current)
          var lyricsNow = loaded.lyrics
          var usedFolia = loaded.document !== null
          if (current.onlineProvider) {
            // One line of diagnostics per lyric load: if a word-by-word effect is missing,
            // this says whether the client ever received word timings at all.
            if (typeof console !== 'undefined' && typeof console.info === 'function') {
              console.info(
                '[dsh-music] lyric',
                String(current.onlineProvider || '') + '/' + String(current.onlineId || ''),
                'style=' + String(prefs.lyricStyle || ''),
                'lines=' + String(lyricsNow.length),
                'wordLevel=' + String(
                  lyricsNow.filter(function (line) {
                    return line && Array.isArray(line.words) && line.words.length > 1
                  }).length,
                ),
                usedFolia ? '(folia)' : '(legacy)',
              )
            }
            if (typeof postJson === 'function' && typeof API === 'string') {
              void postJson(API + 'debug/report', {
                kind: 'lyric',
                provider: String(current.onlineProvider || ''),
                id: String(current.onlineId || ''),
                style: String((typeof prefs !== 'undefined' && prefs && prefs.lyricStyle) || ''),
                usedFolia: usedFolia,
                hasFolia: typeof MPFoliaLyrics !== 'undefined' && MPFoliaLyrics !== null,
                hasRaw: loaded.document !== null,
                appVersion: typeof APP_VERSION === 'string' ? APP_VERSION : '',
                lines: lyricsNow.length,
                wordLevel: lyricsNow.filter(function (line) {
                  return line && Array.isArray(line.words) && line.words.length > 1
                }).length,
                first: lyricsNow[0]
                  ? {
                      start: mpLineStart(lyricsNow[0]),
                      end: mpLineEnd(lyricsNow[0]),
                      words: Array.isArray(lyricsNow[0].words) ? lyricsNow[0].words.length : 0,
                      text: String((lyricsNow[0].fullText !== undefined ? lyricsNow[0].fullText : lyricsNow[0].text) || '').slice(0, 40),
                    }
                  : null,
              }).catch(function () {})
            }
          }
          // Keep the parsed document: the display-time pass below, and again whenever the
          // listener's line rules change, runs on this rather than a new fetch.
          lyricDocRef.current = loaded.document === null
            ? null
            : { path: trackPath, document: loaded.document, chorusRanges: loaded.chorusRanges }
          // A lyric that is only the pure-music notice, or the song's stored instrumental
          // verdict, is no lyric at all: Folia does not auto-match over it either.
          if (loaded.pureMusic === true) {
            if (!cancelled) {
              setLyrics([])
              setLyricSource('pure')
              setOffsetMs(loaded.offsetMs)
            }
            return
          }
          // icu-folia's engines are armed here so their split lands on this surface too.
          armIcuFolia()
          if (!cancelled) {
            setLyrics(lyricsNow)
            // Folia's SourceTab names the imported lyric separately from the platform's.
            setLyricSource(String(loaded.source || ''))
            setOffsetMs(loaded.offsetMs)
          }
          // The auto-match wrote a new record: refresh the source switcher's data.
          if (loaded.matchedUpdated === true && !cancelled) {
            getJson(
              API +
                'lyrics/sources?path=' +
                encodeURIComponent(current.path) +
                '&priority=' +
                encodeURIComponent(prefs.lyricLocalPriority === 'online' ? 'online' : 'local'),
            )
              .then(function (body) {
                if (!cancelled) setSourceInfo(body)
              })
              .catch(function () {})
          }
          // The loader already asked the other sources for better timing (Folia's
          // `autoUseBestLyric`); a match arrives through the subscription above.
        } catch (error) {
          if (!cancelled) setLyricError(errorText(error))
        } finally {
          if (!cancelled) setLyricsLoading(false)
        }
      }
      load()
      return function () {
        cancelled = true
        // Stops the upgrade notification from reaching this song's UI.
        if (typeof unsubscribe === 'function') unsubscribe()
      }
    },
    [props.open, trackPath, lyricReload, lyricPriorityKey],
  )

  // A change of the listener's line rules re-runs the display pass on the document the
  // lines on screen came from. Folia's setter does the same: the rules run on the
  // pre-rule lines, so changing one never needs another fetch or another parse.
  useEffect(
    function () {
      var saved = lyricDocRef.current
      if (saved === null || saved.path !== trackPath) return
      setLyrics(mpPrepareLyrics(saved.document, saved.path, saved.chorusRanges).lyrics)
    },
    [lyricRulesKey],
  )

  var lyricNow = time.currentTime - offsetMs / 1000
  var active = lyricActiveIndex(lyrics, lyricNow)
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
    if (!line || mpLineStart(line) < 0) return
    // Clicking is the explicit "follow this line" gesture; wheel browsing alone
    // must not resume the auto-scroll spring.
    lyricScroll.resume(index)
    player.seek(mpLineStart(line) + offsetMs / 1000)
  }

  function applyOffset(delta) {
    if (!track) return
    var next = Math.max(-60000, Math.min(60000, offsetMs + delta))
    setOffsetMs(next)
    // Remembered per song, exactly as Folia's lyricOffsetMemory does for every track.
    rememberLyricOffset(trackPath, next)
    // Local tracks also keep the host-side offset (and can write it into the file).
    if (track.onlineProvider) return
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

  var lyricSegCount = mpSegmentationLineCount(lyrics, trackPath)

  /**
   * Bake (or drop) this song's saved word split over the lines on screen. A reset goes back
   * to the parsed document so the default split (icu-folia / Intl.Segmenter) returns: the
   * baked boundaries cannot be removed from an already-prepared copy.
   */
  function applyLyricSegmentation(record) {
    if (typeof MPFoliaLyrics === 'undefined' || MPFoliaLyrics === null) return
    if (!Array.isArray(lyrics) || lyrics.length === 0) return
    if (record === null) {
      var saved = lyricDocRef.current
      if (saved !== null && saved.path === trackPath) {
        setLyrics(mpPrepareLyrics(saved.document, saved.path, saved.chorusRanges).lyrics)
        return
      }
      setLyrics(
        lyrics.map(function (line) {
          var copy = Object.assign({}, line)
          delete copy.wordSegments
          return copy
        }),
      )
      return
    }
    var next = MPFoliaLyrics.applyLyricWordSegmentation({ lines: lyrics }, record)
    if (next && Array.isArray(next.lines)) setLyrics(next.lines)
  }

  function openLyricSegmentation() {
    if (!Array.isArray(lyrics) || lyrics.length === 0) {
      if (typeof showToast === 'function') showToast(t('sheet.lyricSegNoLyrics'))
      return
    }
    pushLayer('lyricSeg', { songKey: trackPath, lyrics: lyrics, onSaved: applyLyricSegmentation })
  }

  function openOnlineLyric() {
    if (!track) return
    // Folia's match window: the pick goes onto the song's record (lyrics) and, if asked,
    // into the file's tags (metadata and cover). An online song has no file, so the same
    // window keeps only the lyric half (`OnlineSongLyricMatch`).
    pushLayer('lyricMatch', {
      track: {
        path: track.path,
        title: trackTitleOf(track),
        artist: trackArtistOf(track),
        album: track.album || '',
        durationSec: Number(track.durationSec) || 0,
        onlineProvider: track.onlineProvider || '',
        onlineId: track.onlineId || '',
      },
      online: Boolean(track.onlineProvider),
      applyToRecord: true,
      onSaved: function () {
        MPLyricLoader.invalidate(track.path)
        setLyricReload(function (value) {
          return value + 1
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

  // Folia puts the player panel behind one round button at the page's bottom-right.
  // The old "词" badge next to the translation toggle was the same panel; this is the
  // same trigger, moved out of the lyrics column so it is always reachable.
  function togglePlayerSheet() {
    if (sheetOpen) {
      setSheetOpen(false)
      return
    }
    var element = wordBtnRef.current
    if (element !== null && typeof element.getBoundingClientRect === 'function') {
      var rect = element.getBoundingClientRect()
      setSheetAnchor({
        right: Math.max(8, window.innerWidth - rect.right),
        bottom: Math.max(8, window.innerHeight - rect.top + 10),
      })
    }
    setSheetOpen(true)
  }

  var foliaBackdrop = h(FoliaBackgroundHost, {
    mode: mpLookId(MP_BG_MODES, prefs.bgMode),
    cover: cover,
    accent: flowAccent,
    seed: track && track.path ? track.path : '',
    url: typeof prefs.bgUrl === 'string' ? prefs.bgUrl : '',
    transparent: prefs.npTransparentBg === true,
    latentDisplayMode: prefs.latentDisplayMode,
    latentColorSource: prefs.latentColorSource,
  })
  // 外观 · 随机: the page paints one concrete style per slice of the song. The same
  // resolved id drives both the stage and the `mp-style-*` class, so CSS variants and
  // the renderer never disagree. The clock is the raw playback position, not the
  // lyric offset, so a lyric nudge does not move the style boundaries.
  var lyricStyleId = mpResolveLyricStyle(prefs.lyricStyle, {
    seed: trackPath,
    time: Number(time.currentTime) || 0,
    duration: duration,
  })
  var lyricStage = h(LyricStage, {
    lines: lyrics,
    offsetMs: offsetMs,
    active: active,
    focus: lyricFocus,
    now: lyricNow,
    timed: lyricsTimed,
    prefs: prefs,
    boxRef: boxRef,
    innerRef: innerRef,
    rowRefs: rowRefs.current,
    wordSpans: wordSpans,
    onSeekLine: seekLine,
    manualIndex: lyricScroll.manualIndex,
    formatClock: fmtClock,
    stylePref: lyricStyleId,
    seed: trackPath,
    accent: mpAccentCss(flowAccent),
    coverUrl: cover,
    title: track && track.title ? track.title : '',
    artist: track && track.artist ? track.artist : '',
    album: track && track.album ? track.album : '',
    duration: Number(snap.duration) || (track && Number(track.durationSec)) || 0,
  })
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
        // 外观: the lyric style and backdrop mode come from the registry. A random
        // preference has already been resolved to a concrete id for this slice.
        'mp-style-' + lyricStyleId,
        // A visualizer style is a full stage (Folia's VisualizerShell): the cover
        // column steps aside and the lyrics take the whole page.
        lyricStyleId !== 'classic' && 'is-visualizer',
        prefs.npTransparentBg === true && 'is-transparent-bg',
        chromeVisible !== true && 'is-chrome-hidden',
        'mp-bgmode-' + mpLookId(MP_BG_MODES, prefs.bgMode),
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
        '--mp-look-accent': mpLookAccent(prefs, flowAccent),
      },
    },
    foliaBackdrop,
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
            // The editor is a dark surface too; inherit its light ink (the head sets it)
            // instead of the host label token, which is dark ink in the light theme.
            h('span', { style: { fontSize: '12px' } }, t('page.translationScale')),
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
        // Folia's floating pill: transport, the bar, the times — one rounded panel.
        h(
          'div',
          { className: 'mp-np-pill' },
          h(
            'div',
            { className: 'mp-np-pill-title' },
            h('span', { className: 'mp-np-pill-name' }, trackTitleOf(track)),
            h('span', { className: 'mp-np-pill-artist' }, trackArtistOf(track)),
          ),
        h(
          'div',
          { className: 'mp-np-progress' },
          h(WaveSeekBar, {
            cover: cover,
            playing: snap.playing,
            imageRef: coverImgRef,
            active: staged,
            wave: prefs.waveEnabled !== false,
            fallbackDuration: track ? track.durationSec || 0 : 0,
          }),
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
        lyricStage,
      ),
      h(NowPlayingCapsule, { queueOpen: props.queueOpen, onToggleQueue: props.onToggleQueue }),
      h(
        'div',
        { className: cx('mp-np-handle', sheetOpen && 'is-on') },
        h('div', { className: 'mp-np-handle-track', 'aria-hidden': 'true' }, icon('equalizer', 14)),
        h(
          'button',
          {
            type: 'button',
            ref: wordBtnRef,
            className: 'mp-np-handle-btn',
            title: t('page.settings'),
            'aria-label': t('page.settings'),
            'aria-expanded': sheetOpen ? 'true' : 'false',
            onClick: togglePlayerSheet,
          },
          icon('equalizer', 20),
        ),
      ),
      // Always mounted: AnimatePresence needs the child present to play the exit.
      h(PlayerSheet, {
            open: sheetOpen,
            // Same cover the page itself shows (local file cover or the provider's).
            cover: track === null ? '' : trackCoverSrc(track),
            songTitle: track ? trackTitleOf(track) : '',
            // One SongLike for both kinds of track (see src/47-likes.js).
            like: likeStateOf(track, props.favoriteSet),
            canLocate: track !== null,
            offsetMs: offsetMs,
            onOffsetChange: setOffsetMs,
            lyricSourceLabel: lyricSourceLabel,
            lyricsText: lyricsText,
            lyricsPath: trackPath,
            onLyricsSaved: function () {
              MPLyricLoader.invalidate(trackPath)
              setLyricReload(lyricReload + 1)
            },
            gainValues: gainInfo,
            accentCss: mpAccentCss(flowAccent),
            gainAutoDb: balance.gainDb,
            gainAutoEstimated: balance.estimated === true,
            gainMode: gainMode,
            gainAppliedDb:
              gainMode === 'auto'
                ? null
                : gainInfo === null
                  ? null
                  : gainMode === 'album'
                    ? gainInfo.albumGain ?? gainInfo.trackGain
                    : gainMode === 'track'
                      ? gainInfo.trackGain
                      : null,
            onGainModeChange: function (next) {
              setPrefs({ replayGainMode: next })
            },
            lyricSources: sourceInfo,
            // Folia keeps the choice on the song, not in a global setting: each switch
            // writes the record through the Host and the panel re-reads this track.
            onSwitchLyricSource: function (key) {
              var isOnline = track !== null && Boolean(track.onlineProvider)
              var request
              if (isOnline) {
                var record = {
                  provider: String(track.onlineProvider),
                  id: String(track.onlineId || ''),
                }
                request = key === 'pure'
                  ? postJson(API + 'online/lyric-choice', Object.assign({}, record, { pureMusic: true }))
                  : postJson(API + 'online/lyric-choice', Object.assign({}, record, { source: key === 'imported' ? 'imported' : 'online' }))
              } else {
                request = key === 'pure'
                  ? postJson(API + 'lyrics/pure-music', { path: trackPath, marked: true })
                  : postJson(API + 'lyrics/choice', { path: trackPath, source: key })
              }
              request
                .then(function () {
                  MPLyricLoader.invalidate(trackPath)
                  setLyricReload(function (value) {
                    return value + 1
                  })
                })
                .catch(function (error) {
                  if (typeof showToast === 'function') showToast(errorText(error))
                })
            },
            onResetLyricSource: function () {
              var request = track !== null && track.onlineProvider
                ? postJson(API + 'online/lyric-choice', {
                    provider: String(track.onlineProvider),
                    id: String(track.onlineId || ''),
                    source: null,
                  })
                : postJson(API + 'lyrics/choice', { path: trackPath, source: 'auto' })
              request
                .then(function () {
                  MPLyricLoader.invalidate(trackPath)
                  setLyricReload(function (value) {
                    return value + 1
                  })
                })
                .catch(function (error) {
                  if (typeof showToast === 'function') showToast(errorText(error))
                })
            },
            lyricSegCount: lyricSegCount,
            onOpenLyricSegmentation: openLyricSegmentation,
            onOpenLyricFile: function () {
              pushLayer('lyricFile', {
                path: trackPath,
                name: (trackPath.split(/[\\/]/).pop() || 'lyrics').replace(/\.[^.]+$/, ''),
                text: lyricsText,
                // An online song imports onto its record; there is no file to write.
                online: track !== null && track.onlineProvider
                  ? { provider: String(track.onlineProvider), id: String(track.onlineId || '') }
                  : null,
                onSaved: function () {
                  MPLyricLoader.invalidate(trackPath)
                  setLyricReload(lyricReload + 1)
                },
              })
            },
            normalizeOn: prefs.normalizeVolume !== false,
            onToggleNormalize: function (next) {
              setPrefs({ normalizeVolume: next })
              if (player.setNormalize) player.setNormalize(next)
            },
            anchor: sheetAnchor,
            onClose: function () {
              setSheetOpen(false)
            },
            track: track,
            favoriteSet: props.favoriteSet,
            onOpenLyricSettings: toggleLyricSettings,
            onAction: function (key) {
              if (key === 'favorite') {
                if (track !== null) toggleLikeTrack(track)
                return
              }
              if (key === 'addToPlaylist') {
                setSheetOpen(false)
                if (track === null) return
                if (track.onlineProvider) {
                  pushLayer('onlineAddTo', { provider: track.onlineProvider, song: track })
                } else {
                  pushLayer('addTo', { paths: [track.path] })
                }
                return
              }
              if (key === 'locate') {
                setSheetOpen(false)
                if (typeof props.onLocate === 'function') props.onLocate()
                return
              }
              if (key === 'home') {
                setSheetOpen(false)
                if (typeof props.onHome === 'function') props.onHome()
                return
              }
              if (key === 'settings') {
                setSheetOpen(false)
                if (typeof props.onOpenSettings === 'function') props.onOpenSettings()
                return
              }
              if (key === 'lyricSettings') {
                toggleLyricSettings()
                return
              }
              if (key === 'matchOnline') {
                // The 本地 tab's "在线匹配" row: open the match window over the panel.
                // Folia keeps this entry for online songs too (`OnlineSongLyricMatch`);
                // there it only writes the song's lyric record.
                setSheetOpen(false)
                if (track !== null) {
                  pushLayer('lyricMatch', {
                    track: {
                      path: track.path,
                      title: trackTitleOf(track),
                      artist: trackArtistOf(track),
                      album: track.album || '',
                      durationSec: Number(track.durationSec) || 0,
                      onlineProvider: track.onlineProvider || '',
                      onlineId: track.onlineId || '',
                    },
                    online: Boolean(track.onlineProvider),
                    applyToRecord: true,
                    onSaved: function () {
                      MPLyricLoader.invalidate(track.path)
                      setLyricReload(function (value) {
                        return value + 1
                      })
                    },
                  })
                }
                return
              }
              // The remaining actions only close the card; their destinations live
              // outside the player.
              setSheetOpen(false)
            },
          }),
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



