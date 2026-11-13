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

  function rangeRow(label, value, min, max, step, unit, apply) {
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
        onChange: function (event) {
          apply(Number(event.target.value))
        },
      }),
    )
  }

  function switchRow(label, value, apply) {
    return h(
      'div',
      { className: 'mp-npe-switch-row' },
      h('span', null, label),
      h(Switch, { value: value, onChange: apply }),
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
              className: 'mp-npe-head-btn',
              title: t('editor.reset'),
              'aria-label': t('editor.reset'),
              onClick: function () {
                setResetConfirm(true)
              },
            },
            icon('refresh', 16),
          ),
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
        h(
          'div',
          { className: 'mp-npe-section' },
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
          { className: 'mp-npe-section' },
          sectionHead(t('editor.type')),
          rangeRow(t('page.lyricSize'), prefs.lyricSize || 25, 14, 40, 1, ' px', function (value) {
            setPrefs({ lyricSize: value })
          }),
          rangeRow(t('page.lyricGap'), Number(prefs.lyricGap) || 10, 2, 16, 1, ' px', function (value) {
            setPrefs({ lyricGap: value })
          }),
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
          { className: 'mp-npe-section' },
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
          h(
            'div',
            { className: 'mp-npe-row' },
            h(
              'div',
              { className: 'mp-npe-range-head' },
              h('span', null, t('settings.lyricOrder')),
            ),
            h(
              'select',
              {
                value: (prefs.lyricOrder || ['embedded', 'lrc']).join(','),
                onChange: function (event) {
                  setPrefs({ lyricOrder: event.target.value.split(',') })
                },
              },
              h('option', { value: 'embedded,lrc' }, t('settings.lyricSourceEmbedded') + ' → LRC'),
              h('option', { value: 'lrc,embedded' }, 'LRC → ' + t('settings.lyricSourceEmbedded')),
            ),
          ),
        ),
      ),
      h(
        'div',
        { className: 'mp-npe-foot' },
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
          return color.s > best.s ? color : best
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
        var image = imageRef && imageRef.current ? imageRef.current : null
        if (image === null) {
          if (tries < 20) {
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

function CoverReflectWave(props) {
  var accent = useCoverAccent(props.cover || '', props.imageRef)
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
      var palette =
        Array.isArray(accent.palette) && accent.palette.length > 1 ? accent.palette : [accent]
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
        var barW = Math.max(1, (w / bands) * 0.58)
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
        var phase = (now / 16000) % 1
        ctx.globalAlpha = 0.92
        var mid = (bands - 1) / 2
        for (var k = 0; k < bands; k += 1) {
          var dist = Math.abs(k - mid) / mid
          var bandIndex = Math.min(spectrumBands - 1, Math.round(dist * (spectrumBands - 1)))
          var level = Math.pow(Math.max(0, raw[bandIndex]) / peak, 1.5)
          level = 0.02 + Math.min(1, level) * 0.98
          var prev = levels[k] || 0
          levels[k] = level > prev ? level : prev * 0.45 + level * 0.55
          var half = (levels[k] * h) / 2
          if (half < 1) continue
          ctx.fillStyle = colorOf(mixFeature(palette, phase + dist * 0.72), 0.95)
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
  var pair = useState([])
  var lyrics = pair[0]
  var setLyrics = pair[1]
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
          return { current: texture, previous: '' }
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
        prefs.lyricBlur === true && 'is-blur',
        prefs.showTranslation === true && 'is-trans',
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
      },
    },
    bg.current !== '' || bg.previous !== ''
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
            'div',
            { className: 'mp-np-setting' },
            h('div', { className: 'mp-np-setting-head' }, h('span', null, t('settings.lyricOrder'))),
            h(
              'select',
              {
                value: (prefs.lyricOrder || ['embedded', 'lrc']).join(','),
                onChange: function (event) {
                  setPrefs({ lyricOrder: event.target.value.split(',') })
                },
              },
              h('option', { value: 'embedded,lrc' }, t('settings.lyricSourceEmbedded') + ' → LRC'),
              h('option', { value: 'lrc,embedded' }, 'LRC → ' + t('settings.lyricSourceEmbedded')),
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
          { className: 'mp-np-left-hero' },
          h(
            'div',
            { className: 'mp-np-left-layer' },
        h(
          'div',
          { className: 'mp-np-meta' },
          h('div', { className: 'mp-np-title' }, track ? trackTitleOf(track) : '—'),
          h(
            'div',
            { className: 'mp-np-artist-row' },
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
          { className: cx('mp-np-cover-stage', vinyl && 'is-vinyl') },
          h(
            'div',
            { className: cx('mp-np-disc-wrap', vinyl && 'is-vinyl'), ref: discWrapRef },
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
            ? h(CoverReflectWave, { cover: cover, playing: snap.playing, imageRef: coverImgRef, active: staged })
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
              active: extraPanel === 'audio',
              title: t('page.volume'),
              onClick: function () {
                setExtraPanel(extraPanel === 'audio' ? '' : 'audio')
              },
            }),
            extraPanel === 'audio'
              ? h(
                  'div',
                  { className: 'mp-np-extra-pop' },
                  h('div', { className: 'mp-np-extra-title' }, t('page.volume')),
                  h('input', {
                    type: 'range',
                    className: 'mp-range',
                    min: 0,
                    max: 1,
                    step: 0.01,
                    value: snap.volume,
                    onChange: function (event) {
                      player.setVolume(Number(event.target.value))
                    },
                  }),
                  h(
                    'div',
                    { className: 'mp-np-extra-row' },
                    h('span', null, t('settings.volumeNormalize')),
                    h(Switch, {
                      value: prefs.normalizeVolume !== false,
                      onChange: function (value) {
                        setPrefs({ normalizeVolume: value })
                      },
                    }),
                  ),
                  h(
                    'div',
                    { className: 'mp-np-extra-hint' },
                    track && track.qualityHint ? track.qualityHint : t('online.qualityStandard'),
                  ),
                )
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
        lyrics.length === 0
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
          h(
            'div',
            { className: 'mp-np-foot-right' },
            h(
              'button',
              {
                type: 'button',
                className: cx('mp-np-foot-btn', 'is-boxed', prefs.showTranslation === true && 'is-on'),
                title: t('page.translation'),
                onClick: function () {
                  setPrefs({ showTranslation: prefs.showTranslation !== true })
                },
              },
              '译',
            ),
          ),
        ),
      ),
    ),
    editorOpen
      ? h(NpEditor, {
          open: true,
          cover: cover,
          onClose: function () {
            setEditorOpen(false)
          },
        })
      : null,

  )
}
