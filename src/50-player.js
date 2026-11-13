/**
 * playback engine moved verbatim from 0.11.1. It relies on the helpers in 10-base / 20-api / 30-prefs keeping their names.
 *
 * Extracted from client.js at the 0.11.1 baseline (3931c14).
 */

function shuffleTracks(list, currentTrack) {
  var queue = list.slice()
  for (var j = queue.length - 1; j > 0; j -= 1) {
    var k = Math.floor(Math.random() * (j + 1))
    var tmp = queue[j]
    queue[j] = queue[k]
    queue[k] = tmp
  }
  if (currentTrack) {
    var at = queue.indexOf(currentTrack)
    if (at > 0) {
      queue.splice(at, 1)
      queue.unshift(currentTrack)
    }
  }
  return queue
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
  return mode === 'one' ? 'repeatOne' : mode === 'random' ? 'shuffle' : 'repeat'
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

function nextIndexOf(index, size) {
  if (size <= 1) return 0
  return (index + 1) % size
}

function prevIndexOf(index, size) {
  if (size <= 1) return 0
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
  /**
   * Second element used only for the incoming side of a crossfade. The active
   * deck is always the one in `audio`; the two swap roles when a fade lands, so
   * everything below keeps talking about "the current element".
   */
  var audioB = null
  var deckSource = null
  var deckSourceB = null
  var fadeNode = null
  var fadeNodeB = null
  var trimNode = null
  var trimNodeB = null
  var secondaryWired = false
  var objectUrlB = null
  var normalizeGainB = 1
  /** Crossfade controller: token cancels stale fetches, timer lands the swap. */
  var xfadeToken = 0
  var xfadeActive = false
  var xfadePending = false
  var xfadeTimer = null
  var xfadeNext = -1
  var xfadeBlob = null
  /** Web Audio graph used by the bar visualizer (lazy, user-gesture bound). */
  var audioContext = null
  var analyser = null
  var gainNode = null
  /** Preamp stage in front of the EQ chain (0 dB when the EQ is off). */
  var preampNode = null
  /** Safety limiter after the EQ: heavy boosts must not clip the DAC. */
  var limiterNode = null
  /** `[{ band, node }]` — bands above Nyquist are skipped, so keep the mapping. */
  var eqNodes = []
  /** Resolved EQ settings; persisted through prefs on every change. */
  var eq = normalizeEqPrefs(prefs)
  var waveData = null
  var normalizeGain = 1
  var loudnessToken = 0
  /** Resolves when the current track's gain is ready (or analysis gave up). */
  var loudnessGate = null
  /** Active `blob:` URL for the loaded track (local media seeks reliably). */
  var objectUrl = null
  var currentLoudnessBlob = null
  /** In-flight track download. */
  var fetchAbort = null
  /** Bumped per load so a stale download cannot overwrite a newer track. */
  var loadToken = 0
  var pendingAutoplay = false
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
  var leaderTimer = null
  var tabId = 'music-' + Math.random().toString(36).slice(2) + '-' + Date.now().toString(36)
  var LEADER_KEY = 'dsh-music-panel.player.leader'

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

  function playbackTrackSnapshot(track) {
    return {
      path: track.path,
      title: trackTitleOf(track),
      artist: trackArtistOf(track),
      album: track.album || '',
      durationSec: Number(track.durationSec) || 0,
      coverUrl: track.coverUrl || '',
      hasCover: track.hasCover === true,
      // Self-hosted artwork is addressed by id; persisting it keeps the
      // restored queue's covers intact.
      coverArtId: track.coverArtId || '',
      onlineProvider: track.onlineProvider || '',
      onlineId: track.onlineId || '',
      qualityHint: track.qualityHint || '',
    }
  }

  function savePlaybackState() {
    if (!leader) return
    var item = currentItem()
    if (item === null) return
    var duration = state.duration > 0 ? state.duration : item.durationSec || 0
    // Keep the saved queue bounded (playback.json caps at 500): store a
    // window around the current track so restore never picks the wrong one.
    var queueItems = state.queue.map(playbackTrackSnapshot)
    var index = state.index
    if (queueItems.length > 500) {
      var start = Math.max(0, Math.min(index - 250, queueItems.length - 500))
      queueItems = queueItems.slice(start, start + 500)
      index -= start
    }
    try {
      postJson(API + 'state', {
        queue: queueItems,
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

  function trackFromSaved(entry, byPath) {
    if (typeof entry === 'string') return byPath[entry] || null
    if (entry === null || typeof entry !== 'object') return null
    if (entry.onlineProvider && entry.onlineId) {
      return {
        path: entry.path || 'online:' + entry.onlineProvider + ':' + entry.onlineId,
        title: entry.title || '',
        artist: entry.artist || '',
        album: entry.album || '',
        durationSec: Number(entry.durationSec) || 0,
        hasCover: entry.hasCover === true,
        coverUrl: entry.coverUrl || '',
        coverArtId: entry.coverArtId || '',
        onlineUrl: onlineStreamUrl(entry.onlineProvider, entry.onlineId),
        onlineProvider: entry.onlineProvider,
        onlineId: entry.onlineId,
        qualityHint: entry.qualityHint || '',
        sampleRate: 0,
        size: 0,
        mtime: 0,
      }
    }
    return byPath[entry.path] || null
  }

  function restorePlayback(saved, tracks) {
    if (!saved || !Array.isArray(saved.queue) || saved.queue.length === 0) return false
    var byPath = {}
    ;(Array.isArray(tracks) ? tracks : []).forEach(function (track) {
      byPath[track.path] = track
    })
    var queue = []
    saved.queue.forEach(function (entry) {
      var track = trackFromSaved(entry, byPath)
      if (track !== null && typeof track.path === 'string' && track.path !== '') queue.push(track)
    })
    if (queue.length === 0) return false
    var wanted = saved.queue[saved.index]
    var wantedPath = typeof wanted === 'string' ? wanted : wanted && wanted.path ? wanted.path : ''
    var index = 0
    for (var i = 0; i < queue.length; i += 1) {
      if (wantedPath !== '' && queue[i].path === wantedPath) {
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

  /**
   * Events from the spare deck must not touch state. Handlers receive the
   * Event when registered and a plain reason string when called internally.
   */
  function isActiveEvent(event) {
    return event === null || event === undefined || !event.target || event.target === audio
  }

  function onTime(event) {
    if (!isActiveEvent(event)) return
    if (audio === null) return
    state = Object.assign({}, state, { currentTime: audio.currentTime })
    emitTime()
    trackListening()
    maybeCrossfade()
  }

  function onDuration(event) {
    if (!isActiveEvent(event)) return
    if (audio === null) return
    state = Object.assign({}, state, { duration: isFinite(audio.duration) ? audio.duration : 0 })
    emitTime()
  }

  function onProgress(event) {
    if (!isActiveEvent(event)) return
    if (audio === null) return
    if (audio.buffered && audio.buffered.length > 0) {
      state = Object.assign({}, state, {
        buffered: audio.buffered.end(audio.buffered.length - 1),
      })
      emitTime()
    }
  }

  function onPlaying(event) {
    if (!isActiveEvent(event)) return
    errorStreak = 0
  }

  function onPlay(event) {
    if (!isActiveEvent(event)) return
    if (!state.playing) {
      patch({ playing: true })
      syncMediaSession()
    }
  }

  function onPause(event) {
    if (!isActiveEvent(event)) return
    flushListening(true)
    flushSessionPosition()
    savePlaybackState()
    if (state.playing) {
      patch({ playing: false })
      syncMediaSession()
    }
  }

  function onEnded(event) {
    if (!isActiveEvent(event)) return
    // The fade timer owns the hand-over; a late `ended` must not load twice.
    if (xfadeActive) return
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
    if (state.loop === 'none' && state.index >= state.queue.length - 1) {
      patch({ playing: false })
      return
    }
    load(nextIndexOf(state.index, state.queue.length), true)
  }

  function onError(eventOrReason) {
    if (
      eventOrReason !== null &&
      typeof eventOrReason === 'object' &&
      eventOrReason.target &&
      eventOrReason.target !== audio
    ) {
      return
    }
    var reason =
      typeof eventOrReason === 'string'
        ? eventOrReason
        : eventOrReason && typeof eventOrReason.message === 'string'
          ? eventOrReason.message
          : ''
    errorStreak += 1
    var failedTrack = state.queue[state.index] || null
    errorListeners.forEach(function (fn) {
      try {
        fn({ track: failedTrack, streak: errorStreak, reason: reason || '' })
      } catch {
        /* a listener must never break playback */
      }
    })
    if (errorStreak > 3 || state.queue.length <= 1) {
      errorStreak = 0
      patch({ playing: false })
      return
    }
    load(nextIndexOf(state.index, state.queue.length), true)
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
    if (audioB) audioB.volume = effectiveVolume()
  }

  /** Push a linear gain into one deck's trim node (short ramp while playing). */
  function applyTrimGain(node, linear, paused) {
    if (node === null || audioContext === null) return
    try {
      var now = audioContext.currentTime
      node.gain.cancelScheduledValues(now)
      if (paused) node.gain.setValueAtTime(linear, now)
      else node.gain.setTargetAtTime(linear, now, 0.12)
    } catch (error) {
      node.gain.value = linear
    }
  }

  function applyNormalizeGain(linear) {
    normalizeGain = Number.isFinite(linear) && linear > 0 ? linear : 1
    if (trimNode !== null && audioContext !== null) {
      // Before playback starts the gain must already be at its target;
      // otherwise the first seconds ramp down audibly. While a track is
      // playing, keep the short ramp so toggling normalization is smooth.
      applyTrimGain(trimNode, normalizeGain, audio === null || audio.paused === true)
    } else {
      applyOutputVolume()
    }
  }

  /**
   * Routing a cross-origin media element through Web Audio silences it: the
   * browser has no CORS grant, so the graph only outputs zeros. The plugin
   * normally plays blobs (same-origin), but the stream fallback assigns a
   * remote URL, and one media element can only enter Web Audio once.
   */
  function canRouteThroughWebAudio(el) {
    var source = ''
    try {
      source = String(el.currentSrc || el.src || '')
    } catch (error) {
      source = ''
    }
    if (source === '') return true
    if (source.indexOf('blob:') === 0 || source.indexOf('data:') === 0) return true
    try {
      return new URL(source, window.location.href).origin === window.location.origin
    } catch (error) {
      return false
    }
  }

  function buildEqNodes(context) {
    var nodes = []
    for (var band = 0; band < EQ_FREQS.length; band += 1) {
      // A band at or above Nyquist cannot be realised; skip it and keep going.
      if (EQ_FREQS[band] >= context.sampleRate / 2) continue
      var filter = context.createBiquadFilter()
      filter.type = 'peaking'
      filter.frequency.value = EQ_FREQS[band]
      filter.Q.value = EQ_Q[band]
      filter.gain.value = 0
      nodes.push({ band: band, node: filter })
    }
    return nodes
  }

  /**
   * Push the current EQ settings into the live graph. Disabled means every
   * band at 0 dB and no preamp, i.e. an actual bypass rather than "flat preset".
   */
  function applyEq(immediate) {
    var bands = eq.enabled ? eq.bands : zeroEqBands()
    var preampDb = eq.enabled ? eqTotalPreampDb(eq.preamp, bands) : 0
    var linear = eqDbToLinear(preampDb)
    var paused = audio === null || audio.paused === true || immediate === true
    if (preampNode !== null && audioContext !== null) {
      try {
        var now = audioContext.currentTime
        preampNode.gain.cancelScheduledValues(now)
        if (paused) preampNode.gain.setValueAtTime(linear, now)
        else preampNode.gain.setTargetAtTime(linear, now, 0.02)
      } catch (error) {
        preampNode.gain.value = linear
      }
    }
    for (var index = 0; index < eqNodes.length; index += 1) {
      var entry = eqNodes[index]
      var target = bands[entry.band]
      try {
        var time = audioContext === null ? 0 : audioContext.currentTime
        entry.node.gain.cancelScheduledValues(time)
        if (paused) entry.node.gain.setValueAtTime(target, time)
        else entry.node.gain.setTargetAtTime(target, time, 0.02)
      } catch (error) {
        entry.node.gain.value = target
      }
    }
  }

  /** Web Audio is the whole mechanism; without it the panel must say so. */
  function eqSupported() {
    return typeof window !== 'undefined' && !!(window.AudioContext || window.webkitAudioContext)
  }

  function createLoudnessGate() {
    var resolveGate = null
    var promise = new Promise(function (resolve) {
      resolveGate = resolve
    })
    loudnessGate = promise
    return {
      promise: promise,
      resolve: function () {
        if (resolveGate !== null) {
          var finish = resolveGate
          resolveGate = null
          finish()
        }
      },
    }
  }

  function playAfterLoudness(token) {
    var gate = loudnessGate === null ? Promise.resolve() : loudnessGate
    gate.then(function () {
      if (token !== loadToken || pendingAutoplay !== true || audio === null) return
      pendingAutoplay = false
      var context = api.ensureAnalyser()
      if (context !== null && audioContext !== null && audioContext.state === 'suspended') {
        audioContext.resume().catch(function () {
          // If the context cannot start, leave the media element untouched.
        })
      }
      audio.play().catch(function () {
        // Autoplay may still be blocked; the play event will update the UI.
      })
    })
  }

  /** Analyse the downloaded blob in-browser and apply the per-track gain. */
  function scheduleLoudness(item, blob, done) {
    var token = (loudnessToken += 1)
    currentLoudnessBlob = blob || null
    applyNormalizeGain(1)
    var finish = typeof done === 'function' ? done : function () {}
    if (readPrefs().normalizeVolume === false || !item || !blob) {
      finish()
      return
    }
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
      .then(function (gainDb) {
        if (token === loudnessToken && (gainDb === null || gainDb === undefined)) {
          applyNormalizeGain(1)
        }
      })
      .catch(function () {
        if (token === loudnessToken) applyNormalizeGain(1)
      })
      .then(function () {
        finish()
      })
  }

  function load(at, autoplay) {
    var item = state.queue[at]
    if (!item) return
    abortCrossfade()
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
    var loudness = createLoudnessGate()
    if (audio === null) {
      loudness.resolve()
      return
    }
    if (autoplay === true) {
      var visualizerContext = api.ensureAnalyser()
      if (visualizerContext !== null && audioContext !== null && audioContext.state === 'suspended') {
        audioContext.resume().catch(function () {
          // The visualizer simply stays flat if the context cannot start.
        })
      }
    }

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
          if (onlineToken !== loadToken) {
            loudness.resolve()
            return
          }
          fetchAbort = null
          if (audio === null) {
            loudness.resolve()
            return
          }
          releaseObjectUrl()
          objectUrl = URL.createObjectURL(blob)
          audio.src = objectUrl
          audio.load()
          scheduleLoudness(item, blob, loudness.resolve)
          if (pendingAutoplay) playAfterLoudness(token)
        })
        .catch(function () {
          if (onlineToken !== loadToken) {
            loudness.resolve()
            return
          }
          fetchAbort = null
          // The gate must open even when analysis is impossible: this path
          // streams without a blob and therefore has no gain to apply.
          loudness.resolve()
          if (audio === null) return
          // Streaming fallback: playback still starts even if the prefetch
          // failed (seeking may be less reliable in this rare path).
          audio.src = item.onlineUrl
          audio.load()
          if (pendingAutoplay) playAfterLoudness(token)
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
        if (response.ok) return response.blob()
        return response
          .json()
          .catch(function () {
            return null
          })
          .then(function (body) {
            var reason =
              body && body.error && typeof body.error.message === 'string' ? body.error.message : ''
            throw new Error(reason || 'HTTP ' + response.status)
          })
      })
      .then(function (blob) {
        if (token !== loadToken) {
          loudness.resolve()
          return
        }
        fetchAbort = null
        if (audio === null) {
          loudness.resolve()
          return
        }
        releaseObjectUrl()
        objectUrl = URL.createObjectURL(blob)
        audio.src = objectUrl
        audio.load()
        scheduleLoudness(item, blob, loudness.resolve)
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
        if (pendingAutoplay) playAfterLoudness(token)
      })
      .catch(function (error) {
        if (token !== loadToken) {
          loudness.resolve()
          return
        }
        fetchAbort = null
        loudness.resolve()
        if (error && error.name === 'AbortError') return
        onError(error && typeof error.message === 'string' ? error.message : '')
      })
  }

  // ── crossfade: two decks, equal-power overlap ───────────────────────
  //
  // The outgoing track keeps playing on the active element while the incoming
  // track starts on the spare one. When the fade lands, the two decks swap
  // roles, so every other part of the engine keeps working with `audio` and
  // `normalizeGain`.

  function ensureSecondary() {
    if (audio === null || audioB !== null) return
    var doc = audio.ownerDocument || (typeof document !== 'undefined' ? document : null)
    if (doc === null || typeof doc.createElement !== 'function') return
    audioB = doc.createElement('audio')
    audioB.preload = 'metadata'
    audioB.setAttribute('aria-hidden', 'true')
    audioB.className = 'mp-audio-host'
    if (audio.parentNode) audio.parentNode.insertBefore(audioB, audio.nextSibling)
    bind(audioB)
    audioB.volume = effectiveVolume()
    audioB.muted = state.muted
  }

  /** Build the spare deck's source/fade/trim nodes once the graph exists. */
  function wireSecondary() {
    if (secondaryWired) return
    if (audioB === null || audioContext === null || preampNode === null) return
    try {
      deckSourceB = audioContext.createMediaElementSource(audioB)
      fadeNodeB = audioContext.createGain()
      fadeNodeB.gain.value = 0
      trimNodeB = audioContext.createGain()
      trimNodeB.gain.value = normalizeGainB
      deckSourceB.connect(fadeNodeB)
      fadeNodeB.connect(trimNodeB)
      trimNodeB.connect(preampNode)
      secondaryWired = true
    } catch (error) {
      // A media element can only be bound once; leave crossfade disabled.
      secondaryWired = false
    }
  }

  function releaseObjectUrlB() {
    if (objectUrlB === null) return
    try {
      URL.revokeObjectURL(objectUrlB)
    } catch (error) {
      // Revoking twice is harmless.
    }
    objectUrlB = null
  }

  /** Fetch one track the same way `load()` does, without touching the decks. */
  function fetchTrackBlob(item) {
    if (typeof item.onlineUrl === 'string' && item.onlineUrl !== '') {
      return fetch(item.onlineUrl).then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status)
        return response.blob()
      })
    }
    return fetch(streamUrl(item.path)).then(function (response) {
      if (response.ok) return response.blob()
      return response
        .json()
        .catch(function () {
          return null
        })
        .then(function (body) {
          var reason = body && body.error && typeof body.error.message === 'string' ? body.error.message : ''
          throw new Error(reason || 'HTTP ' + response.status)
        })
    })
  }

  /** Per-track loudness trim for the incoming deck (1 when normalization is off). */
  function incomingTrim(item, blob) {
    if (readPrefs().normalizeVolume === false) return Promise.resolve(1)
    return analyzeLoudnessBlob(
      item,
      blob,
      function () {
        return true
      },
      function () {},
    )
      .then(function (gainDb) {
        if (gainDb === null || gainDb === undefined) return 1
        return Math.pow(10, clamp(gainDb, -15, 6) / 20)
      })
      .catch(function () {
        return 1
      })
  }

  function maybeCrossfade() {
    if (xfadeActive || xfadePending) return
    if (analyser === null || audio === null || audioContext === null) return
    var settings = readPrefs()
    if (crossfadeFadeSeconds(settings) <= 0) return
    if (state.index < 0 || state.queue.length < 2) return
    var next = nextIndexOf(state.index, state.queue.length)
    if (next < 0 || next === state.index) return
    if (!crossfadeNextAllowed(settings, currentItem(), state.queue[next])) return
    var should = crossfadeShouldStart({
      prefs: settings,
      playing: state.playing,
      hasGraph: true,
      loop: state.loop,
      index: state.index,
      queueLength: state.queue.length,
      duration: state.duration > 0 ? state.duration : isFinite(audio.duration) ? audio.duration : 0,
      currentTime: audio.currentTime,
    })
    if (!should) return
    startCrossfade(next, crossfadeFadeSeconds(settings))
  }

  function startCrossfade(nextAt, seconds) {
    var item = state.queue[nextAt]
    if (!item || audio === null || analyser === null) return
    var token = (xfadeToken += 1)
    xfadePending = true
    xfadeNext = nextAt
    fetchTrackBlob(item)
      .then(function (blob) {
        if (token !== xfadeToken) return null
        return incomingTrim(item, blob).then(function (trim) {
          return { blob: blob, trim: trim }
        })
      })
      .then(function (ready) {
        if (ready === null || token !== xfadeToken || audio === null) return
        var duration = state.duration > 0 ? state.duration : isFinite(audio.duration) ? audio.duration : 0
        var remaining = duration - audio.currentTime
        // Preparation can finish late; never schedule a fade longer than the
        // audio that is actually left.
        if (!(remaining > 0.8)) return abortCrossfade()
        beginCrossfadePlayback(ready.blob, ready.trim, Math.min(seconds, remaining - 0.1), token)
      })
      .catch(function () {
        if (token === xfadeToken) abortCrossfade()
      })
  }

  function beginCrossfadePlayback(blob, trim, fade, token) {
    ensureSecondary()
    if (audioB === null || audioContext === null || fadeNode === null) return abortCrossfade()
    wireSecondary()
    if (!secondaryWired || fadeNodeB === null || trimNodeB === null) return abortCrossfade()
    releaseObjectUrlB()
    objectUrlB = URL.createObjectURL(blob)
    xfadeBlob = blob
    normalizeGainB = trim
    audioB.volume = effectiveVolume()
    audioB.muted = state.muted
    audioB.src = objectUrlB
    audioB.load()
    var now = audioContext.currentTime
    trimNodeB.gain.setValueAtTime(trim, now)
    fadeNodeB.gain.cancelScheduledValues(now)
    fadeNodeB.gain.setValueAtTime(0, now)
    fadeNode.gain.cancelScheduledValues(now)
    fadeNode.gain.setValueAtTime(1, now)
    var started
    try {
      started = audioB.play()
    } catch (error) {
      return abortCrossfade()
    }
    Promise.resolve(started)
      .then(function () {
        if (token !== xfadeToken || audioContext === null) return
        var at = audioContext.currentTime
        var curves = crossfadeEqualPowerCurves(32)
        fadeNode.gain.cancelScheduledValues(at)
        fadeNode.gain.setValueAtTime(1, at)
        fadeNode.gain.setValueCurveAtTime(curves.out, at, fade)
        fadeNodeB.gain.cancelScheduledValues(at)
        fadeNodeB.gain.setValueAtTime(0, at)
        fadeNodeB.gain.setValueCurveAtTime(curves.incoming, at, fade)
        xfadePending = false
        xfadeActive = true
        if (xfadeTimer !== null) clearTimeout(xfadeTimer)
        xfadeTimer = setTimeout(function () {
          xfadeTimer = null
          promoteCrossfade(token)
        }, Math.max(200, fade * 1000 - 40))
      })
      .catch(function () {
        if (token === xfadeToken) abortCrossfade()
      })
  }

  function swapDecks() {
    var element = audio
    audio = audioB
    audioB = element
    var source = deckSource
    deckSource = deckSourceB
    deckSourceB = source
    var fade = fadeNode
    fadeNode = fadeNodeB
    fadeNodeB = fade
    var trim = trimNode
    trimNode = trimNodeB
    trimNodeB = trim
    var url = objectUrl
    objectUrl = objectUrlB
    objectUrlB = url
    var loudness = normalizeGain
    normalizeGain = normalizeGainB
    normalizeGainB = loudness
  }

  function promoteCrossfade(token) {
    if (token !== xfadeToken) return
    if (!xfadeActive) return
    xfadeActive = false
    xfadePending = false
    var nextAt = xfadeNext
    xfadeNext = -1
    if (nextAt < 0 || !state.queue[nextAt] || audio === null) return abortCrossfade()
    flushListening(true)
    flushSessionPosition()
    swapDecks()
    var item = state.queue[nextAt]
    state = Object.assign({}, state, {
      index: nextAt,
      currentTime: audio.currentTime || 0,
      duration: isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0,
      buffered: 0,
      playing: true,
    })
    currentLoudnessBlob = xfadeBlob
    xfadeBlob = null
    resetSession(item)
    session.lastTime = audio.currentTime || 0
    syncMediaSession()
    applyOutputVolume()
    emit()
    savePlaybackState()
    if (audioContext !== null) {
      var now = audioContext.currentTime
      if (fadeNode !== null) {
        try {
          fadeNode.gain.cancelScheduledValues(now)
          fadeNode.gain.setValueAtTime(1, now)
        } catch (error) {
          // Already at unity.
        }
      }
      if (fadeNodeB !== null) {
        try {
          fadeNodeB.gain.cancelScheduledValues(now)
          fadeNodeB.gain.setValueAtTime(0, now)
        } catch (error) {
          // Already silenced.
        }
      }
    }
    // Silence and release the outgoing element; the next fade reuses it.
    if (audioB !== null) {
      try {
        audioB.pause()
        audioB.removeAttribute('src')
        audioB.load()
      } catch (error) {
        // Detached element: nothing to stop.
      }
    }
    releaseObjectUrlB()
    normalizeGainB = 1
  }

  function abortCrossfade() {
    if (!xfadePending && !xfadeActive && xfadeTimer === null) return
    xfadeToken += 1
    xfadePending = false
    xfadeActive = false
    xfadeNext = -1
    xfadeBlob = null
    if (xfadeTimer !== null) {
      clearTimeout(xfadeTimer)
      xfadeTimer = null
    }
    if (audioB !== null) {
      try {
        audioB.pause()
        audioB.removeAttribute('src')
        audioB.load()
      } catch (error) {
        // Detached element: nothing to stop.
      }
    }
    releaseObjectUrlB()
    normalizeGainB = 1
    if (audioContext !== null) {
      var now = audioContext.currentTime
      if (fadeNode !== null) {
        try {
          fadeNode.gain.cancelScheduledValues(now)
          fadeNode.gain.setValueAtTime(1, now)
        } catch (error) {
          // Already at unity.
        }
      }
      if (fadeNodeB !== null) {
        try {
          fadeNodeB.gain.cancelScheduledValues(now)
          fadeNodeB.gain.setValueAtTime(0, now)
        } catch (error) {
          // Already silenced.
        }
      }
    }
  }

  function crossfadeActive() {
    return xfadeActive === true
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
    /** Merge probed audio facts (codec/sampleRate/bitrate) into a queued track. */
    updateTrack: function (path, info) {
      if (!path || !info || typeof info !== 'object') return
      var found = false
      var queue = state.queue.map(function (item) {
        if (!item || item.path !== path) return item
        found = true
        return Object.assign({}, item, info)
      })
      if (!found) return
      state = Object.assign({}, state, { queue: queue })
      emit()
    },
    getTime: function () {
      return { currentTime: state.currentTime, duration: state.duration, buffered: state.buffered }
    },
    /** Queue indices in the current playback order (random mode). */
    getPlayOrder: function () {
      return state.queue.map(function (_, index) {
        return index
      })
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
      if (!canRouteThroughWebAudio(audio)) return null
      try {
        var Ctx = window.AudioContext || window.webkitAudioContext
        if (!Ctx) return null
        if (audioContext === null) audioContext = new Ctx()
        deckSource = audioContext.createMediaElementSource(audio)
        preampNode = audioContext.createGain()
        eqNodes = buildEqNodes(audioContext)
        limiterNode = audioContext.createDynamicsCompressor()
        limiterNode.threshold.value = -1.5
        limiterNode.knee.value = 0
        limiterNode.ratio.value = 20
        limiterNode.attack.value = 0.003
        limiterNode.release.value = 0.15
        gainNode = audioContext.createGain()
        analyser = audioContext.createAnalyser()
        analyser.fftSize = 256
        analyser.smoothingTimeConstant = 0.82
        // Each deck owns a fade gain and a loudness trim; both sum into the
        // shared preamp so the EQ, limiter and analyser stay single-instance.
        fadeNode = audioContext.createGain()
        trimNode = audioContext.createGain()
        deckSource.connect(fadeNode)
        fadeNode.connect(trimNode)
        trimNode.connect(preampNode)
        var tail = preampNode
        for (var index = 0; index < eqNodes.length; index += 1) {
          tail.connect(eqNodes[index].node)
          tail = eqNodes[index].node
        }
        tail.connect(limiterNode)
        tail = limiterNode
        tail.connect(gainNode)
        gainNode.connect(analyser)
        analyser.connect(audioContext.destination)
        if (audio) audio.volume = state.volume
        wireSecondary()
        applyNormalizeGain(normalizeGain)
        applyEq(true)
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
      abortCrossfade()
      if (audio !== null) unbind(audio)
      if (audioB !== null) {
        unbind(audioB)
        if (audioB.parentNode) audioB.parentNode.removeChild(audioB)
        audioB = null
      }
      releaseObjectUrlB()
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
      preampNode = null
      limiterNode = null
      deckSource = null
      deckSourceB = null
      fadeNode = null
      fadeNodeB = null
      trimNode = null
      trimNodeB = null
      secondaryWired = false
      eqNodes = []
      waveData = null
      audio = el
      if (el === null) return
      bind(el)
      el.preload = 'metadata'
      el.volume = effectiveVolume()
      el.muted = state.muted
      ensureSecondary()
      var item = currentItem()
      if (item !== null) {
        if (objectUrl !== null) {
          el.src = objectUrl
          el.load()
          if (pendingAutoplay) playAfterLoudness(loadToken)
        } else {
          load(state.index, pendingAutoplay || state.playing)
        }
      }
      syncMediaSession()
    },
    setQueue: function (list) {
      // Never replace a queue that is already playing or paused mid-track.
      if (state.index >= 0) return
      var queue = state.order === 'random' ? shuffleTracks(list, null) : list.slice()
      state = Object.assign({}, state, { queue: queue, index: -1 })
      emit()
    },
    playList: function (list, at) {
      if (!list || list.length === 0) return
      var queue = list.slice()
      var index = at
      if (state.order === 'random') {
        queue = shuffleTracks(queue, queue[at])
        index = 0
      }
      state = Object.assign({}, state, { queue: queue, index: index })
      load(index, true)
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
        var queue = list.slice()
        var index = at
        if (state.order === 'random') {
          queue = shuffleTracks(queue, queue[at])
          index = 0
        }
        state = Object.assign({}, state, { queue: queue, index: index })
        load(index, true)
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
        load(nextIndex, shouldPlay)
        return
      }
      var index = at < state.index ? state.index - 1 : state.index
      state = Object.assign({}, state, { queue: list, index: index })
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
      var context = api.ensureAnalyser()
      if (context !== null && audioContext !== null && audioContext.state === 'suspended') {
        audioContext.resume().catch(function () {
          // If the context cannot start, leave the media element untouched.
        })
      }
      pendingAutoplay = true
      // Wait for the current track's loudness result so the first audible
      // sample already has its final gain instead of ducking mid-play.
      playAfterLoudness(loadToken)
    },
    /** Called by the cross-tab coordinator; never plays in a follower tab. */
    setLeader: function (value) {
      var next = value === true
      if (leader === next) return
      leader = next
      if (!leader) {
        pendingAutoplay = false
        abortCrossfade()
        if (audio !== null) audio.pause()
        if (audioB !== null) audioB.pause()
        if (state.playing) patch({ playing: false })
      }
      emit()
    },
    isLeader: function () {
      return leader
    },
    /** Test/diagnostic view of the two-deck hand-over (no controls). */
    getCrossfadeState: function () {
      return {
        active: xfadeActive,
        pending: xfadePending,
        secondary: audioB !== null,
        wired: secondaryWired,
        next: xfadeNext,
      }
    },
    pause: function () {
      pendingAutoplay = false
      abortCrossfade()
      if (audio) audio.pause()
    },
    toggle: function () {
      if (state.playing) api.pause()
      else api.play()
    },
    next: function () {
      if (state.queue.length === 0) return
      load(nextIndexOf(state.index, state.queue.length), true)
    },
    prev: function () {
      if (state.queue.length === 0) return
      load(prevIndexOf(state.index, state.queue.length), true)
    },
    seek: function (seconds) {
      if (audio === null) return
      // A seek during a fade would desync the two decks; drop the fade first.
      abortCrossfade()
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
    /**
     * Update the equalizer. Every call persists, so the panel can drive this
     * directly without a second write path. Enabling builds the graph on the
     * spot: the click that flips the switch is the user gesture Web Audio needs.
     */
    setEq: function (patch) {
      var source = patch !== null && typeof patch === 'object' ? patch : {}
      var bands = source.bands === undefined ? eq.bands.slice() : normalizeEqBands(source.bands)
      var preset
      if (source.preset === undefined) {
        // A band edit without an explicit preset still has to name its curve.
        preset = source.bands === undefined ? eq.preset : eqPresetForBands(bands)
      } else if (source.preset === 'custom') {
        preset = 'custom'
      } else if (source.preset === 'device') {
        preset = 'device'
      } else {
        preset = eqPresetById(source.preset) === null ? 'flat' : String(source.preset)
      }
      var next = {
        enabled: source.enabled === undefined ? eq.enabled : source.enabled === true,
        preset: preset,
        bands: bands,
        preamp:
          source.preamp === undefined
            ? eq.preamp
            : Math.round(clamp(Number(source.preamp) || 0, -EQ_PREAMP_MAX, EQ_PREAMP_MAX)),
        device:
          source.device === undefined
            ? preset === 'device'
              ? eq.device
              : ''
            : String(source.device || ''),
      }
      eq = next
      savePrefs({
        eqEnabled: next.enabled,
        eqPreset: next.preset,
        eqBands: next.bands,
        eqPreamp: next.preamp,
        // Any EQ change also re-writes the layout tag, so a library upgrade can
        // tell which band grid the stored bands belong to.
        eqLayout: EQ_LAYOUT,
        eqDevice: next.device,
      })
      if (next.enabled && analyser === null) api.ensureAnalyser()
      applyEq(next.enabled !== true)
    },
    getEq: function () {
      return {
        enabled: eq.enabled,
        preset: eq.preset,
        bands: eq.bands.slice(),
        preamp: eq.preamp,
        device: eq.device,
        /** False when the browser cannot host the graph (EQ is inert then). */
        available: eqSupported() && (analyser !== null || audio === null || canRouteThroughWebAudio(audio)),
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
      if (audioB) audioB.muted = value
      emit()
    },
    setLoop: function (value) {
      if (value === 'one') abortCrossfade()
      state = Object.assign({}, state, { loop: value })
      savePrefs({ loop: value })
      emit()
    },
    setOrder: function (value) {
      var next = value === 'random' ? 'random' : 'list'
      if (next === 'random' && state.queue.length > 1) {
        // Shuffle the canonical queue once; the panel order is the play order.
        var current = currentItem()
        var queue = shuffleTracks(state.queue, current)
        state = Object.assign({}, state, { queue: queue, index: current ? 0 : state.index, order: next })
      } else {
        state = Object.assign({}, state, { order: next })
      }
      savePrefs({ order: next })
      emit()
      savePlaybackState()
    },
    clear: function () {
      loadToken += 1
      cancelPendingFetch()
      abortCrossfade()
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
      emit()
      syncMediaSession()
    },
    suspend: function () {
      if (audio) audio.pause()
    },
    destroy: function () {
      stopLeaderElection()
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

  // ── cross-window leader (one audible player per browser profile) ─────
  function readLease() {
    try {
      var raw = window.localStorage.getItem(LEADER_KEY)
      var value = raw === null ? null : JSON.parse(raw)
      return value !== null && typeof value === 'object' ? value : null
    } catch {
      return null
    }
  }

  function claimLeader() {
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return true
    try {
      var now = Date.now()
      var lease = readLease()
      if (lease !== null && lease.id !== tabId && now - Number(lease.at || 0) < 7000) {
        if (leader) {
          leader = false
          if (audio !== null) audio.pause()
          if (state.playing) patch({ playing: false })
          emit()
        }
        return false
      }
      window.localStorage.setItem(LEADER_KEY, JSON.stringify({ id: tabId, at: now }))
      if (!leader) {
        leader = true
        emit()
      }
      return true
    } catch {
      return true
    }
  }

  function releaseLeader() {
    try {
      var lease = readLease()
      if (lease !== null && lease.id === tabId) window.localStorage.removeItem(LEADER_KEY)
    } catch {
      // Best effort.
    }
  }

  function startLeaderElection() {
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return
    claimLeader()
    leaderTimer = setInterval(claimLeader, 2000)
    if (leaderTimer && typeof leaderTimer.unref === 'function') leaderTimer.unref()
    window.addEventListener('beforeunload', releaseLeader)
    window.addEventListener('pagehide', releaseLeader)
  }

  function stopLeaderElection() {
    if (leaderTimer !== null) clearInterval(leaderTimer)
    leaderTimer = null
    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', releaseLeader)
      window.removeEventListener('pagehide', releaseLeader)
    }
    releaseLeader()
  }

  try {
    startLeaderElection()
  } catch {
    // localStorage can be unavailable in private/browser test modes.
  }

  syncMediaHandlers()
  if (typeof window !== 'undefined') window[PLAYER_KEY] = api
  return api
}

var player = createPlayer()
