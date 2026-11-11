/**
 * playback engine moved verbatim from 0.11.1. It relies on the helpers in 10-base / 20-api / 30-prefs keeping their names.
 *
 * Extracted from client.js at the 0.11.1 baseline (3931c14).
 */

function randomOrderOf(size, start) {
  var order = []
  for (var i = 0; i < size; i += 1) order.push(i)
  for (var j = order.length - 1; j > 0; j -= 1) {
    var k = Math.floor(Math.random() * (j + 1))
    var tmp = order[j]
    order[j] = order[k]
    order[k] = tmp
  }
  // Random mode starts with the current track, so the displayed shuffled
  // list and the actual top-to-bottom playback order line up.
  if (Number.isInteger(start) && start >= 0 && start < order.length && order.length > 1) {
    var at = order.indexOf(start)
    if (at > 0) {
      order.splice(at, 1)
      order.unshift(start)
    }
  }
  return order
}

// Three playback modes, mapped onto the engine's loop/order pair:
//   sequence → in order, stop at the end
//   random   → shuffled, looping
//   one      → repeat the current track
var PLAY_MODES = ['sequence', 'random', 'one']

function playModeOf(snap) {
  if (snap.loop === 'one') return 'one'
  if (snap.order === 'random') return 'random'
  return 'sequence'
}

function playModeLabel(mode) {
  return mode === 'one'
    ? t('page.modeOne')
    : mode === 'random'
      ? t('page.modeRandom')
      : t('page.modeSequence')
}

function playModeIcon(mode) {
  return mode === 'one' ? 'repeatOne' : mode === 'random' ? 'shuffle' : 'list'
}

function applyPlayMode(mode) {
  if (mode === 'one') {
    player.setLoop('one')
    player.setOrder('list')
    return
  }
  if (mode === 'random') {
    player.setLoop('all')
    player.setOrder('random')
    return
  }
  player.setLoop('none')
  player.setOrder('list')
}

function cyclePlayMode(snap) {
  var current = playModeOf(snap)
  applyPlayMode(PLAY_MODES[(PLAY_MODES.indexOf(current) + 1) % PLAY_MODES.length])
}

function nextIndexOf(index, order, size, randomOrder) {
  if (size <= 1) return 0
  if (order === 'random') {
    var pos = randomOrder.indexOf(index)
    return randomOrder[(pos + 1) % randomOrder.length]
  }
  return (index + 1) % size
}

function prevIndexOf(index, order, size, randomOrder) {
  if (size <= 1) return 0
  if (order === 'random') {
    var pos = randomOrder.indexOf(index)
    return randomOrder[(pos - 1 + randomOrder.length) % randomOrder.length]
  }
  return (index - 1 + size) % size
}

// ── playback engine (module-level: survives panel unmount) ───────────
// The <audio> element lives here rather than in the React tree, so
// selecting another main panel keeps the current track playing.

function sameQueue(left, right) {
  if (left.length !== right.length) return false
  for (var i = 0; i < left.length; i += 1) {
    if (!right[i] || left[i].path !== right[i].path) return false
  }
  return true
}

// One engine per page. Client modules can be re-executed by HMR or by a
// module-table rebuild; a second engine would own a second <audio> and
// play on top of the first. Every execution reuses the same instance.
var PLAYER_KEY = '__dshMusicPlayer'

/**
 * Playback engine, one per page.
 *
 * The <audio> element is owned by the `shell.overlay` seat (a resident
 * floating layer) and handed in through `attachAudio`. That keeps the
 * element inside the document — browsers treat detached media elements
 * differently for background playback, system media keys and autoplay —
 * while this engine stays the single source of playback state.
 */
function createPlayer() {
  if (typeof window !== 'undefined' && window[PLAYER_KEY]) return window[PLAYER_KEY]
  var prefs = readPrefs()
  var audio = null
  /** Web Audio graph used by the bar visualizer (lazy, user-gesture bound). */
  var audioContext = null
  var analyser = null
  var gainNode = null
  var waveData = null
  var normalizeGain = 1
  var loudnessToken = 0
  /** Active `blob:` URL for the loaded track (local media seeks reliably). */
  var objectUrl = null
  var currentLoudnessBlob = null
  /** In-flight track download. */
  var fetchAbort = null
  /** Bumped per load so a stale download cannot overwrite a newer track. */
  var loadToken = 0
  var pendingAutoplay = false
  var randomOrder = []
  var listeners = []
  var timeListeners = []
  var errorListeners = []
  var errorStreak = 0
  var state = {
    queue: [],
    index: -1,
    playing: false,
    loop: prefs.loop === 'one' ? 'one' : 'none',
    order: prefs.order === 'random' && prefs.loop !== 'one' ? 'random' : 'list',
    // Volume follows the system mixer: the plugin no longer exposes its own.
    volume: 1,
    muted: false,
    currentTime: 0,
    duration: 0,
    buffered: 0,
  }

  // ── resume + listening statistics ───────────────────────────────────
  // Counting follows the Last.fm / MusicBee rule (half the track or four
  // minutes, whichever comes first); resume follows the NetEase / Spotify
  // pattern (restore the queue and position, then stay paused). The clock
  // only counts time that naturally advanced while playing, so dragging
  // the seek bar never inflates the statistics.
  var session = { path: '', seconds: 0, pending: 0, lastTime: 0, counted: false }
  var lastStateSave = 0
  var restoreAttempted = false
  var pendingResumeSeconds = null
  /** Only the tab holding the player lock may produce sound / write stats. */
  var leader = true

  function resetSession(item) {
    session = {
      path: item ? item.path : '',
      seconds: 0,
      pending: 0,
      lastTime: 0,
      counted: false,
    }
  }

  function durationOf(item) {
    if (audio !== null && isFinite(audio.duration) && audio.duration > 0) return audio.duration
    return item && item.durationSec > 0 ? item.durationSec : 0
  }

  function recordStatsPlay(item) {
    try {
      postJson(API + 'play', { path: item.path }).catch(function () {})
    } catch (error) {
      // Statistics never block playback.
    }
  }

  /** Flush the seconds that have not been reported yet (>= 30s only). */
  function flushListening(force) {
    if (session.path === '' || session.pending <= 0) return
    if (session.seconds < 30) {
      if (force) session.pending = 0
      return
    }
    var seconds = session.pending
    session.pending = 0
    try {
      postJson(API + 'playback', { path: session.path, seconds: seconds }).catch(function () {})
    } catch (error) {
      // Best effort.
    }
  }

  function flushSessionPosition() {
    if (session.path === '' || readPrefs().rememberPerTrack !== true) return
    var item = currentItem()
    if (item === null || item.path !== session.path) return
    var seconds = state.currentTime
    if (!(seconds > 0)) return
    try {
      postJson(API + 'position', { path: session.path, seconds: seconds }).catch(function () {})
    } catch (error) {
      // Best effort.
    }
  }

  function savePlaybackState() {
    if (!leader) return
    var item = currentItem()
    if (item === null) return
    var duration = state.duration > 0 ? state.duration : item.durationSec || 0
    // Keep the saved queue bounded (playback.json caps at 500): store a
    // window around the current track so restore never picks the wrong one.
    var queuePaths = state.queue.map(function (track) {
      return track.path
    })
    var index = state.index
    if (queuePaths.length > 500) {
      var start = Math.max(0, Math.min(index - 250, queuePaths.length - 500))
      queuePaths = queuePaths.slice(start, start + 500)
      index -= start
    }
    try {
      postJson(API + 'state', {
        queue: queuePaths,
        index: index,
        positionSec: state.currentTime,
        durationSec: duration,
        loop: state.loop,
        order: state.order,
      }).catch(function () {})
    } catch (error) {
      // Best effort.
    }
  }

  function trackListening() {
    if (audio === null) return
    var item = currentItem()
    if (item === null) return
    if (session.path !== item.path) resetSession(item)

    var current = audio.currentTime
    if (state.playing && !audio.paused) {
      var delta = current - session.lastTime
      // A seek produces a large or negative jump; only natural playback
      // advances count toward listening time.
      if (delta > 0 && delta <= 3) {
        session.seconds += delta
        session.pending += delta
      }
    }
    session.lastTime = current

    var duration = durationOf(item)
    var threshold = playThresholdOf(duration)
    if (!session.counted && duration > 30 && session.seconds >= threshold) {
      session.counted = true
      recordStatsPlay(item)
    }

    if (session.seconds >= 30 && session.pending >= 10) flushListening(false)

    var now = Date.now()
    if (now - lastStateSave >= 5000) {
      lastStateSave = now
      savePlaybackState()
    }
  }

  function restorePlayback(saved, tracks) {
    if (!saved || !Array.isArray(saved.queue) || saved.queue.length === 0) return false
    if (!Array.isArray(tracks) || tracks.length === 0) return false
    var byPath = {}
    tracks.forEach(function (track) {
      byPath[track.path] = track
    })
    var queue = []
    saved.queue.forEach(function (path) {
      if (byPath[path] !== undefined) queue.push(byPath[path])
    })
    if (queue.length === 0) return false
    var wantedPath = saved.queue[saved.index]
    var index = 0
    for (var i = 0; i < queue.length; i += 1) {
      if (typeof wantedPath === 'string' && queue[i].path === wantedPath) {
        index = i
        break
      }
    }
    state = Object.assign({}, state, {
      queue: queue,
      index: index,
      loop: saved.loop === 'one' ? 'one' : saved.order === 'random' ? 'all' : 'none',
      order: saved.order === 'random' && saved.loop !== 'one' ? 'random' : 'list',
      currentTime: saved.positionSec > 0 ? saved.positionSec : 0,
      duration: saved.durationSec > 0 ? saved.durationSec : 0,
      playing: false,
    })
    randomOrder = randomOrderOf(queue.length, index)
    emit()
    syncMediaSession()
    resetSession(queue[index])
    pendingResumeSeconds = saved.positionSec > 0 ? saved.positionSec : null
    // Paused by default (NetEase/Spotify behaviour); the setting can ask
    // for playback to start right after restore.
    load(index, readPrefs().autoResume === true)
    return true
  }

  function tryRestore() {
    if (restoreAttempted) return
    restoreAttempted = true
    if (readPrefs().resumeOnStart !== true) return
    Promise.all([getJson(API + 'state'), getJson(API + 'library')])
      .then(function (results) {
        var saved = results[0] !== null && results[0].state !== undefined ? results[0].state : null
        var tracks = results[1] !== null && Array.isArray(results[1].tracks) ? results[1].tracks : []
        restorePlayback(saved, tracks)
      })
      .catch(function () {
        // Resume is best effort.
      })
  }

  function flushOnHide() {
    flushListening(true)
    flushSessionPosition()
    savePlaybackState()
  }

  function emit() {
    listeners.forEach(function (fn) {
      fn()
    })
    timeListeners.forEach(function (fn) {
      fn()
    })
  }

  function emitTime() {
    timeListeners.forEach(function (fn) {
      fn()
    })
  }

  function patch(next) {
    state = Object.assign({}, state, next)
    emit()
  }

  function currentItem() {
    return state.index >= 0 && state.queue[state.index] ? state.queue[state.index] : null
  }

  // ── media session (system media keys, lock screen, OS media panel) ──

  function syncMediaSession() {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return
    var item = currentItem()
    try {
      if (item === null) {
        navigator.mediaSession.metadata = null
      } else if (typeof MediaMetadata !== 'undefined') {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: item.title,
          artist: item.artist || '',
          album: item.album || '',
          artwork: item.hasCover
            ? [{ src: new URL(coverUrl(item.path), window.location.href).href, sizes: '512x512' }]
            : [],
        })
      }
      if (typeof navigator.mediaSession.setPlaybackState === 'function') {
        navigator.mediaSession.setPlaybackState(state.playing ? 'playing' : 'paused')
      }
    } catch (error) {
      // Media Session is best effort.
    }
  }

  function syncMediaHandlers() {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return
    try {
      navigator.mediaSession.setActionHandler('play', function () {
        api.play()
      })
      navigator.mediaSession.setActionHandler('pause', function () {
        api.pause()
      })
      navigator.mediaSession.setActionHandler('previoustrack', function () {
        api.prev()
      })
      navigator.mediaSession.setActionHandler('nexttrack', function () {
        api.next()
      })
      navigator.mediaSession.setActionHandler('seekto', function (details) {
        if (details && typeof details.seekTime === 'number') api.seek(details.seekTime)
      })
    } catch (error) {
      // Older browsers expose a partial action list.
    }
  }

  // ── audio element wiring ───────────────────────────────────────────

  function onTime() {
    if (audio === null) return
    state = Object.assign({}, state, { currentTime: audio.currentTime })
    emitTime()
    trackListening()
  }

  function onDuration() {
    if (audio === null) return
    state = Object.assign({}, state, { duration: isFinite(audio.duration) ? audio.duration : 0 })
    emitTime()
  }

  function onProgress() {
    if (audio === null) return
    if (audio.buffered && audio.buffered.length > 0) {
      state = Object.assign({}, state, {
        buffered: audio.buffered.end(audio.buffered.length - 1),
      })
      emitTime()
    }
  }

  function onPlaying() {
    errorStreak = 0
  }

  function onPlay() {
    if (!state.playing) {
      patch({ playing: true })
      syncMediaSession()
    }
  }

  function onPause() {
    flushListening(true)
    flushSessionPosition()
    savePlaybackState()
    if (state.playing) {
      patch({ playing: false })
      syncMediaSession()
    }
  }

  function onEnded() {
    flushListening(true)
    flushSessionPosition()
    if (state.queue.length === 0) return
    if (state.loop === 'one') {
      resetSession(currentItem())
      if (audio) {
        audio.currentTime = 0
        audio.play().catch(function () {})
      }
      return
    }
    if (state.loop === 'none') {
      if (state.order === 'random') {
        if (randomOrder.length === 0 || randomOrder[randomOrder.length - 1] === state.index) {
          patch({ playing: false })
          return
        }
      } else if (state.index >= state.queue.length - 1) {
        patch({ playing: false })
        return
      }
    }
    load(nextIndexOf(state.index, state.order, state.queue.length, randomOrder), true)
  }

  function onError() {
    errorStreak += 1
    var failedTrack = state.queue[state.index] || null
    errorListeners.forEach(function (fn) {
      try {
        fn({ track: failedTrack, streak: errorStreak })
      } catch {
        /* a listener must never break playback */
      }
    })
    if (errorStreak > 3 || state.queue.length <= 1) {
      errorStreak = 0
      patch({ playing: false })
      return
    }
    load(nextIndexOf(state.index, state.order, state.queue.length, randomOrder), true)
  }

  function bind(el) {
    el.addEventListener('timeupdate', onTime)
    el.addEventListener('durationchange', onDuration)
    el.addEventListener('loadedmetadata', onDuration)
    el.addEventListener('progress', onProgress)
    el.addEventListener('canplay', onProgress)
    el.addEventListener('playing', onPlaying)
    el.addEventListener('play', onPlay)
    el.addEventListener('pause', onPause)
    el.addEventListener('ended', onEnded)
    el.addEventListener('error', onError)
  }

  function unbind(el) {
    el.removeEventListener('timeupdate', onTime)
    el.removeEventListener('durationchange', onDuration)
    el.removeEventListener('loadedmetadata', onDuration)
    el.removeEventListener('progress', onProgress)
    el.removeEventListener('canplay', onProgress)
    el.removeEventListener('playing', onPlaying)
    el.removeEventListener('play', onPlay)
    el.removeEventListener('pause', onPause)
    el.removeEventListener('ended', onEnded)
    el.removeEventListener('error', onError)
  }

  function releaseObjectUrl() {
    if (objectUrl === null) return
    try {
      URL.revokeObjectURL(objectUrl)
    } catch (error) {
      // Revoking twice is harmless.
    }
    objectUrl = null
  }

  function cancelPendingFetch() {
    if (fetchAbort === null) return
    try {
      fetchAbort.abort()
    } catch (error) {
      // Already settled.
    }
    fetchAbort = null
  }

  /**
   * Load one track through a local Blob URL.
   *
   * Playing from `blob:` is deliberate: on the Desktop (Electron) media
   * stack, writes to `currentTime` on this plugin's HTTP stream are
   * silently dropped while readyState is already 4, so seeking restarted
   * the track. A Blob is local media and seeks reliably. The download is a
   * loopback request, so it costs one disk read, not a network hop.
   */
  /** Element volume when normalization is applied without a Web Audio graph. */
  function effectiveVolume() {
    var trim = gainNode === null ? Math.min(1, normalizeGain) : 1
    return clamp(state.volume * trim, 0, 1)
  }

  function applyOutputVolume() {
    if (audio) audio.volume = effectiveVolume()
  }

  function applyNormalizeGain(linear) {
    normalizeGain = Number.isFinite(linear) && linear > 0 ? linear : 1
    if (gainNode !== null && audioContext !== null) {
      try {
        var now = audioContext.currentTime
        gainNode.gain.cancelScheduledValues(now)
        gainNode.gain.setTargetAtTime(normalizeGain, now, 0.12)
      } catch {
        gainNode.gain.value = normalizeGain
      }
    } else {
      applyOutputVolume()
    }
  }

  /** Analyse the downloaded blob in-browser and apply the per-track gain. */
  function scheduleLoudness(item, blob) {
    var token = (loudnessToken += 1)
    currentLoudnessBlob = blob || null
    applyNormalizeGain(1)
    if (readPrefs().normalizeVolume === false || !item || !blob) return
    analyzeLoudnessBlob(
      item,
      blob,
      function () {
        return token === loudnessToken
      },
      function (gainDb) {
        if (token !== loudnessToken) return
        applyNormalizeGain(Math.pow(10, clamp(gainDb, -15, 6) / 20))
      },
    )
  }

  function load(at, autoplay) {
    var item = state.queue[at]
    if (!item) return
    // Close the previous listening session before switching tracks.
    flushListening(true)
    flushSessionPosition()
    var token = (loadToken += 1)
    state = Object.assign({}, state, { index: at, currentTime: 0, duration: 0, buffered: 0 })
    emit()
    syncMediaSession()
    pendingAutoplay = autoplay === true
    // A new session starts here. The play count is recorded later, and
    // only when the Last.fm / MusicBee threshold is reached.
    resetSession(item)
    currentLoudnessBlob = null
    loudnessToken += 1
    applyNormalizeGain(1)
    if (audio === null) return

    cancelPendingFetch()
    // Online providers stream through the Host. The Desktop media stack
    // silently drops `currentTime` writes on this HTTP stream (seeking
    // restarted the track), so download the file first — when it is cached
    // this is a local read — and play from a blob like local tracks.
    if (typeof item.onlineUrl === 'string' && item.onlineUrl !== '') {
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
      releaseObjectUrl()
      var onlineToken = token
      var onlineController =
        typeof AbortController !== 'undefined' ? new AbortController() : null
      fetchAbort = onlineController
      if (item.onlineProvider && item.onlineId) {
        void postJson(API + 'online/cache/meta', {
          provider: item.onlineProvider,
          id: item.onlineId,
          title: item.title || '',
          artist: item.artist || '',
          album: item.album || '',
          coverUrl: item.coverUrl || '',
          durationSec: item.durationSec || 0,
          vip: item.qualityHint === 'VIP',
        }).catch(function () {})
      }
      fetch(item.onlineUrl, onlineController === null ? {} : { signal: onlineController.signal })
        .then(function (response) {
          if (!response.ok) throw new Error('HTTP ' + response.status)
          return response.blob()
        })
        .then(function (blob) {
          if (onlineToken !== loadToken) return
          fetchAbort = null
          if (audio === null) return
          releaseObjectUrl()
          objectUrl = URL.createObjectURL(blob)
          audio.src = objectUrl
          audio.load()
          scheduleLoudness(item, blob)
          if (pendingAutoplay) {
            pendingAutoplay = false
            audio.play().catch(function () {
              if (state.playing) patch({ playing: false })
            })
          }
        })
        .catch(function () {
          if (onlineToken !== loadToken) return
          fetchAbort = null
          if (audio === null) return
          // Streaming fallback: playback still starts even if the prefetch
          // failed (seeking may be less reliable in this rare path).
          audio.src = item.onlineUrl
          audio.load()
          if (pendingAutoplay) {
            pendingAutoplay = false
            audio.play().catch(function () {
              if (state.playing) patch({ playing: false })
            })
          }
        })
      return
    }
    // Detach the old blob before revoking it: a revoked URL still
    // assigned to the element fires a spurious `error`.
    audio.pause()
    audio.removeAttribute('src')
    audio.load()
    releaseObjectUrl()
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null
    fetchAbort = controller

    fetch(streamUrl(item.path), controller === null ? {} : { signal: controller.signal })
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status)
        return response.blob()
      })
      .then(function (blob) {
        if (token !== loadToken) return
        fetchAbort = null
        if (audio === null) return
        releaseObjectUrl()
        objectUrl = URL.createObjectURL(blob)
        audio.src = objectUrl
        audio.load()
        scheduleLoudness(item, blob)
        if (pendingResumeSeconds !== null) {
          var resumeAt = pendingResumeSeconds
          pendingResumeSeconds = null
          api.seek(resumeAt)
        } else if (readPrefs().rememberPerTrack === true) {
          getJson(API + 'position?path=' + encodeURIComponent(item.path))
            .then(function (body) {
              if (token !== loadToken) return
              var seconds = Number(body.lastPositionSec)
              if (isFinite(seconds) && seconds > 1) api.seek(seconds)
            })
            .catch(function () {})
        }
        if (pendingAutoplay) {
          pendingAutoplay = false
          audio.play().catch(function () {
            if (state.playing) patch({ playing: false })
          })
        }
      })
      .catch(function (error) {
        if (token !== loadToken) return
        fetchAbort = null
        if (error && error.name === 'AbortError') return
        onError()
      })
  }

  var api = {
    subscribe: function (fn) {
      listeners.push(fn)
      return function () {
        listeners = listeners.filter(function (item) {
          return item !== fn
        })
      }
    },
    subscribeTime: function (fn) {
      timeListeners.push(fn)
      return function () {
        timeListeners = timeListeners.filter(function (item) {
          return item !== fn
        })
      }
    },
    subscribeError: function (fn) {
      errorListeners.push(fn)
      return function () {
        errorListeners = errorListeners.filter(function (item) {
          return item !== fn
        })
      }
    },
    getSnapshot: function () {
      return state
    },
    getTime: function () {
      return { currentTime: state.currentTime, duration: state.duration, buffered: state.buffered }
    },
    /** Queue indices in the current playback order (random mode). */
    getPlayOrder: function () {
      return randomOrder.slice()
    },
    /** Restore the last queue/position once (called by the resident host). */
    tryRestore: tryRestore,
    /** Flush statistics + resume state when the page is hidden/closed. */
    flushOnHide: flushOnHide,
    /**
     * Lazily build the analyser graph. Called from a user gesture so the
     * AudioContext can start; connecting a media element source silences
     * the element until the context runs, so it must never be automatic.
     */
    ensureAnalyser: function () {
      if (audio === null) return null
      if (analyser !== null) return analyser
      try {
        var Ctx = window.AudioContext || window.webkitAudioContext
        if (!Ctx) return null
        if (audioContext === null) audioContext = new Ctx()
        var source = audioContext.createMediaElementSource(audio)
        gainNode = audioContext.createGain()
        analyser = audioContext.createAnalyser()
        analyser.fftSize = 256
        analyser.smoothingTimeConstant = 0.82
        source.connect(gainNode)
        gainNode.connect(analyser)
        analyser.connect(audioContext.destination)
        if (audio) audio.volume = state.volume
        applyNormalizeGain(normalizeGain)
        waveData = new Uint8Array(analyser.frequencyBinCount)
        if (audioContext.state === 'suspended') audioContext.resume().catch(function () {})
      } catch (error) {
        analyser = null
        return null
      }
      return analyser
    },
    /** Latest frequency data (0..255 per bin) or null when unavailable. */
    getWave: function () {
      if (analyser === null || waveData === null) return null
      analyser.getByteFrequencyData(waveData)
      return waveData
    },
    /** Hand the resident <audio> element to the engine (null detaches). */
    attachAudio: function (el) {
      if (audio === el) return
      if (audio !== null) unbind(audio)
      // A new media element needs a fresh source node; close the old graph.
      if (audioContext !== null) {
        try {
          audioContext.close()
        } catch (error) {
          // Already closed.
        }
      }
      audioContext = null
      analyser = null
      gainNode = null
      waveData = null
      audio = el
      if (el === null) return
      bind(el)
      el.preload = 'metadata'
      el.volume = effectiveVolume()
      el.muted = state.muted
      var item = currentItem()
      if (item !== null) {
        if (objectUrl !== null) {
          el.src = objectUrl
          el.load()
          if (pendingAutoplay) {
            pendingAutoplay = false
            el.play().catch(function () {})
          }
        } else {
          load(state.index, pendingAutoplay || state.playing)
        }
      }
      syncMediaSession()
    },
    setQueue: function (list) {
      // Never replace a queue that is already playing or paused mid-track.
      if (state.index >= 0) return
      state = Object.assign({}, state, { queue: list.slice(), index: -1 })
      randomOrder = randomOrderOf(list.length)
      emit()
    },
    playList: function (list, at) {
      if (!list || list.length === 0) return
      state = Object.assign({}, state, { queue: list.slice(), index: at })
      randomOrder = randomOrderOf(list.length, at)
      load(at, true)
    },
    /** Insert one track immediately after the current one, without interrupting playback. */
    enqueueNext: function (track) {
      if (track === null || track === undefined || typeof track.path !== 'string' || track.path === '') return
      if (state.queue.length === 0 || state.index < 0) {
        api.playList([track], 0)
        return
      }
      var at = Math.min(state.index + 1, state.queue.length)
      var queue = state.queue.slice()
      queue.splice(at, 0, track)
      state = Object.assign({}, state, { queue: queue })
      randomOrder = randomOrderOf(state.queue.length)
      emit()
      savePlaybackState()
    },
    /** Append one track to the queue without interrupting playback. */
    enqueue: function (track) {
      if (track === null || track === undefined || typeof track.path !== 'string' || track.path === '') return
      if (state.queue.length === 0) {
        api.playList([track], 0)
        return
      }
      state = Object.assign({}, state, {
        queue: state.queue.concat([track]),
        index: state.index < 0 ? 0 : state.index,
      })
      randomOrder = randomOrderOf(state.queue.length)
      emit()
      savePlaybackState()
    },
    select: function (list, at) {
      if (!list || list.length === 0 || at < 0) return
      if (at === state.index && sameQueue(list, state.queue)) {
        if (state.playing) api.pause()
        else api.play()
        return
      }
      if (!sameQueue(list, state.queue)) {
        state = Object.assign({}, state, { queue: list.slice(), index: at })
        randomOrder = randomOrderOf(list.length, at)
        load(at, true)
        return
      }
      load(at, true)
    },
    clearQueue: function () {
      if (audio !== null) audio.pause()
      state = Object.assign({}, state, {
        queue: [],
        index: -1,
        playing: false,
        currentTime: 0,
        duration: 0,
      })
      randomOrder = []
      emit()
      savePlaybackState()
    },
    moveQueue: function (from, to) {
      var length = state.queue.length
      if (from < 0 || from >= length || to < 0 || to >= length || from === to) return
      var list = state.queue.slice()
      var moved = list.splice(from, 1)[0]
      list.splice(to, 0, moved)
      var index = state.index
      if (from === index) {
        index = to
      } else {
        if (from < index) index -= 1
        if (to <= index) index += 1
      }
      state = Object.assign({}, state, { queue: list, index: index })
      randomOrder = randomOrderOf(length)
      emit()
      savePlaybackState()
    },
    /**
     * Reorder the queue to match the displayed order (drag & drop).
     * `indices` are original queue indices in their new visual order.
     * In random mode the new visual order becomes the play order too.
     */
    reorderQueue: function (indices) {
      var length = state.queue.length
      if (!Array.isArray(indices) || indices.length !== length) return
      var seen = {}
      for (var i = 0; i < length; i += 1) {
        var at = indices[i]
        if (!Number.isInteger(at) || at < 0 || at >= length || seen[at] === true) return
        seen[at] = true
      }
      var list = indices.map(function (at) {
        return state.queue[at]
      })
      var current = state.index >= 0 ? indices.indexOf(state.index) : -1
      state = Object.assign({}, state, { queue: list, index: current })
      randomOrder =
        state.order === 'random'
          ? list.map(function (_, position) {
              return position
            })
          : randomOrderOf(length)
      emit()
      savePlaybackState()
    },
    removeQueueAt: function (at) {
      var length = state.queue.length
      if (at < 0 || at >= length) return
      var list = state.queue.slice()
      list.splice(at, 1)
      if (list.length === 0) {
        api.clearQueue()
        return
      }
      if (at === state.index) {
        var nextIndex = Math.min(at, list.length - 1)
        var shouldPlay = state.playing === true
        state = Object.assign({}, state, { queue: list })
        randomOrder = randomOrderOf(list.length)
        load(nextIndex, shouldPlay)
        return
      }
      var index = at < state.index ? state.index - 1 : state.index
      state = Object.assign({}, state, { queue: list, index: index })
      randomOrder = randomOrderOf(list.length)
      emit()
      savePlaybackState()
    },
    /** Move a queue entry to play right after the current track. */
    playNext: function (at) {
      var length = state.queue.length
      if (at < 0 || at >= length || state.index < 0) return
      var target = Math.min(state.index + 1, length - 1)
      if (at === state.index || at === target) return
      api.moveQueue(at, target)
    },
    play: function () {
      if (!leader) return
      if (state.index < 0) {
        if (state.queue.length > 0) load(0, true)
        return
      }
      if (audio === null) return
      var item = currentItem()
      if (readPrefs().normalizeVolume !== false && item && !item.onlineProvider) {
        var context = api.ensureAnalyser()
        if (context !== null && audioContext !== null && audioContext.state === 'suspended') {
          audioContext.resume().catch(function () {
            // If the context cannot start, leave the media element untouched.
          })
        }
      }
      audio.play().catch(function () {})
    },
    /** Called by the cross-tab coordinator; never plays in a follower tab. */
    setLeader: function (value) {
      var next = value === true
      if (leader === next) return
      leader = next
      if (!leader) {
        if (audio !== null) audio.pause()
        if (state.playing) patch({ playing: false })
      }
      emit()
    },
    isLeader: function () {
      return leader
    },
    pause: function () {
      if (audio) audio.pause()
    },
    toggle: function () {
      if (state.playing) api.pause()
      else api.play()
    },
    next: function () {
      if (state.queue.length === 0) return
      load(nextIndexOf(state.index, state.order, state.queue.length, randomOrder), true)
    },
    prev: function () {
      if (state.queue.length === 0) return
      load(prevIndexOf(state.index, state.order, state.queue.length, randomOrder), true)
    },
    seek: function (seconds) {
      if (audio === null) return
      var el = audio
      var item = currentItem()
      // Media duration is unavailable until metadata lands; the scanned
      // track duration is the correct fallback, never a 1-second guess.
      var limit = isFinite(el.duration) && el.duration > 0
        ? el.duration
        : item && item.durationSec > 0
          ? item.durationSec
          : 0
      var target = clamp(seconds, 0, limit > 0 ? limit : seconds)
      if (!isFinite(target)) return

      function apply() {
        try {
          el.currentTime = target
        } catch (error) {
          return
        }
        state = Object.assign({}, state, { currentTime: target })
        emitTime()
      }

      if (el.readyState >= 1) {
        apply()
        return
      }
      var once = function () {
        el.removeEventListener('loadedmetadata', once)
        apply()
      }
      el.addEventListener('loadedmetadata', once)
      try {
        el.currentTime = target
      } catch (error) {
        // The listener above retries once metadata is ready.
      }
    },
    setNormalize: function (value) {
      savePrefs({ normalizeVolume: value !== false })
      if (value === false) {
        loudnessToken += 1
        applyNormalizeGain(1)
      } else if (currentItem()) {
        scheduleLoudness(currentItem(), currentLoudnessBlob)
      }
    },
    setVolume: function (value) {
      var next = clamp(value, 0, 1)
      state = Object.assign({}, state, { volume: next, muted: next > 0 ? state.muted : false })
      applyOutputVolume()
      savePrefs({ volume: next })
      emit()
    },
    setMuted: function (value) {
      state = Object.assign({}, state, { muted: value })
      if (audio) audio.muted = value
      emit()
    },
    setLoop: function (value) {
      state = Object.assign({}, state, { loop: value })
      savePrefs({ loop: value })
      emit()
    },
    setOrder: function (value) {
      var next = value === 'random' ? 'random' : 'list'
      if (next === 'random' && state.queue.length > 1) {
        // Fresh shuffle whenever random is selected, so the queue panel's
        // displayed order is the actual playback order.
        randomOrder = randomOrderOf(state.queue.length, state.index)
      }
      state = Object.assign({}, state, { order: next })
      savePrefs({ order: next })
      emit()
    },
    clear: function () {
      loadToken += 1
      cancelPendingFetch()
      releaseObjectUrl()
      if (audio) {
        audio.pause()
        audio.removeAttribute('src')
        audio.load()
      }
      state = Object.assign({}, state, {
        queue: [],
        index: -1,
        playing: false,
        currentTime: 0,
        duration: 0,
        buffered: 0,
      })
      randomOrder = []
      emit()
      syncMediaSession()
    },
    suspend: function () {
      if (audio) audio.pause()
    },
    destroy: function () {
      loadToken += 1
      cancelPendingFetch()
      releaseObjectUrl()
      if (audio) {
        unbind(audio)
        audio.pause()
        audio.removeAttribute('src')
        audio = null
      }
    },
  }

  syncMediaHandlers()
  if (typeof window !== 'undefined') window[PLAYER_KEY] = api
  return api
}

var player = createPlayer()
