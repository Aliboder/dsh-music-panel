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
