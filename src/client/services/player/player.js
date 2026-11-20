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
  /** Folia graph/transport boundary; one per player instance. */
  var foliaGraph = null
  var foliaTransport = null
  /**
   * Second element used only for the incoming side of a crossfade. The active
   * deck is always the one in `audio`; the two swap roles when a fade lands, so
   * everything below keeps talking about "the current element".
   */
  var audioB = null
  var fadeNode = null
  var fadeNodeB = null
  var trimNode = null
  var trimNodeB = null
  var objectUrlB = null
  var normalizeGainB = 1
  /** Crossfade controller: token cancels stale fetches, timer lands the swap. */
  var xfadeToken = 0
  var xfadeActive = false
  var xfadePending = false
  var xfadeAdopted = false
  var xfadeTimer = null
  var xfadeNext = -1
  /** Blob of the track on the active deck, kept for the tail analysis. */
  var currentBlob = null
  /** Measured plan + fetched audio for the incoming side. */
  var xfadePrepared = null
  /** The track leaving on the ghost deck, kept until the fade lands (cache report). */
  var xfadeOutgoing = null
  /** Background download of the next track, so an uncached online song is ready. */
  var prefetchedNext = null
  var prefetchAbort = null
  var prefetchToken = 0
  /** Web Audio graph used by the bar visualizer (lazy, user-gesture bound). */
  var audioContext = null
  var analyser = null
  var gainNode = null
  /** `[{ band, node }]` — bands above Nyquist are skipped, so keep the mapping. */
  var eqNodes = []
  /** Resolved EQ settings; persisted through prefs on every change. */
  var eq = normalizeEqPrefs(prefs)
  var waveData = null
  var normalizeGain = 1
  // The loudness trim and the tag gain multiply: `normalizeBase` is the measured
  // trim, `replayGainFactor` the ReplayGain tag multiplier (1 when off).
  var normalizeBase = 1
  var replayGainFactor = 1
  var loudnessToken = 0
  /** Resolves when the current track's gain is ready (or analysis gave up). */
  var loudnessGate = null
  /** Active `blob:` URL for the loaded track (local media seeks reliably). */
  var objectUrl = null
  /** Live meter tapped ahead of the balance gain (see 49-balance-meter.js). */
  var balanceMeter = null
  /** What the balance asked for this play, and whether it already moved once. */
  var balanceMoved = false
  var balanceAppliedDb = 0
  var balanceAppliedReading = ''
  /** The song's own gain tags (local file or Navidrome), for the balance's fallbacks. */
  var tagGainDb = null
var platformGain = null
var prefetchedProfilePath = ''
var profileToken = 0
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
  var lastPositionSync = 0
  var duckFactor = 1
  var duckRampSeconds = 0.3
  // The slider saves every change through savePrefs; a new engine must start from
  // that value, or a restart resets the visible and audible level to 1.
  var savedVolume = Number(prefs.volume)
  if (!isFinite(savedVolume)) savedVolume = 1
  var state = {
    queue: [],
    index: -1,
    playing: false,
    loop: prefs.loop === 'one' ? 'one' : 'none',
    order: prefs.order === 'random' && prefs.loop !== 'one' ? 'random' : 'list',
    volume: clamp(savedVolume, 0, 1),
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
      reported: false,
      preview: false,
    }
  }

  /**
   * Send the one listening report a track earned, if its platform takes them.
   * The Host still checks the capability; this client-side check only avoids a
   * request for local tracks and platforms without reports.
   */
  function reportProviderPlayback(item) {
    if (item === null || item === undefined || session.reported === true) return
    if (session.preview === true) return
    if (session.seconds < 30) return
    if (readPrefs().playbackReports !== true) return
    var provider = String(item.onlineProvider || '')
    if (provider === '' || typeof supports !== 'function' || !supports(provider, 'playbackReports')) return
    session.reported = true
    try {
      postJson(API + 'online/report-playback', {
        provider: provider,
        id: String(item.onlineId || ''),
        title: trackTitleOf(item),
        artist: trackArtistOf(item),
        playedSeconds: Math.round(session.seconds),
        totalSeconds: Math.round(durationOf(item)),
        quality: String(readPrefs().onlineQuality || 'high'),
      }).catch(function () {
        // Reporting is a background courtesy; a failure never touches playback.
      })
    } catch (error) {
      // Best effort.
    }
  }

  /**
   * Folia caches an online song only once it was heard to its end: the Host downloads it
   * then. This says which song, at which quality, and with which stated length/cover — the
   * decision (preview / half song / limit) belongs to the Host.
   */
  function reportPlayed(item) {
    if (item === null || item === undefined) return
    if (!item.onlineProvider || !item.onlineId) return
    var settings = readPrefs()
    if (settings.onlineCacheEnabled !== true) return
    var limitGb = Number(settings.onlineCacheLimitGb)
    try {
      postJson(API + 'online/played', {
        provider: String(item.onlineProvider),
        id: String(item.onlineId),
        quality: String(settings.onlineQuality || 'high'),
        limitGb: isFinite(limitGb) && limitGb >= 0 ? limitGb : 5,
        durationSec: Number(item.durationSec) || 0,
        coverUrl: typeof item.coverUrl === 'string' ? item.coverUrl : '',
      }).catch(function () {
        // Caching is a background courtesy; a failure never touches playback.
      })
    } catch (error) {
      // Best effort.
    }
  }

  /**
   * Folia's light prefetch window (the next two songs and the previous one): a queue move
   * should start with its lyric already local. Lyrics only — the Host resolves stream URLs
   * per play, so there is nothing to prefetch for the audio.
   */
  function prefetchLyricsAround() {
    if (typeof MPLyricLoader === 'undefined' || MPLyricLoader === null) return
    if (typeof MPLyricLoader.prefetch !== 'function') return
    if (state.index < 0 || state.queue.length === 0) return
    var around = []
    for (var offset = -1; offset <= 2; offset += 1) {
      var at = state.index + offset
      if (at < 0 || at >= state.queue.length) continue
      var item = state.queue[at]
      if (item && item.onlineProvider) around.push(item)
    }
    if (around.length > 0) MPLyricLoader.prefetch(around)
  }

  /** The cached copy failed to play: the Host bypasses it until a new one is written. */
  function reportCacheDistrust(item) {    if (item === null || item === undefined) return
    if (!item.onlineProvider || !item.onlineId) return
    try {
      postJson(API + 'online/cache/distrust', {
        provider: String(item.onlineProvider),
        id: String(item.onlineId),
      }).catch(function () {})
    } catch (error) {
      // Best effort.
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
    if (session.preview === true) return
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
      albumId: track.albumId || '',
      durationSec: Number(track.durationSec) || 0,
      coverUrl: track.coverUrl || '',
      hasCover: track.hasCover === true,
      // Self-hosted artwork is addressed by id; persisting it keeps the
      // restored queue's covers intact.
      coverArtId: track.coverArtId || '',
      onlineProvider: track.onlineProvider || '',
      onlineId: track.onlineId || '',
      qualityHint: track.qualityHint || '',
      // The artist page opens on catalog ids; a restored queue must keep them too.
      artistsDetail: Array.isArray(track.artistsDetail) ? track.artistsDetail : [],
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
    var expected = Number(item.durationSec) || 0
    if (
      session.preview !== true &&
      item.onlineProvider &&
      expected > 0 &&
      isFinite(audio.duration) &&
      audio.duration > 0 &&
      audio.duration < expected * 0.5
    ) {
      session.preview = true
      showToast(t('online.previewOnly'))
    }
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
    if (!session.preview && !session.counted && duration > 30 && session.seconds >= threshold) {
      session.counted = true
      recordStatsPlay(item)
    }

    if (!session.preview && session.seconds >= 30 && session.pending >= 10) flushListening(false)

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
        albumId: entry.albumId || '',
        durationSec: Number(entry.durationSec) || 0,
        hasCover: entry.hasCover === true,
        coverUrl: entry.coverUrl || '',
        coverArtId: entry.coverArtId || '',
        onlineUrl: onlineStreamUrl(entry.onlineProvider, entry.onlineId),
        onlineProvider: entry.onlineProvider,
        onlineId: entry.onlineId,
        qualityHint: entry.qualityHint || '',
        artistsDetail: Array.isArray(entry.artistsDetail) ? entry.artistsDetail : [],
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

  function syncMediaPosition(force) {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return
    var session = navigator.mediaSession
    if (typeof session.setPositionState !== 'function') return
    var now = Date.now()
    if (force !== true && now - lastPositionSync < 1000) return
    lastPositionSync = now
    try {
      var duration = Number(state.duration)
      var position = Number(state.currentTime)
      if (duration > 0 && isFinite(position)) {
        session.setPositionState({
          duration: duration,
          position: clamp(position, 0, duration),
          playbackRate: 1,
        })
      } else {
        session.setPositionState()
      }
    } catch (error) {
      // Media Session is best effort.
    }
  }

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
    syncMediaPosition(true)
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

  function readReplayGainHeaders(headers) {
    if (!headers || typeof headers.get !== 'function') return null
    var fields = {
      trackGain: headers.get('x-music-track-gain'),
      albumGain: headers.get('x-music-album-gain'),
      trackPeak: headers.get('x-music-track-peak'),
      albumPeak: headers.get('x-music-album-peak'),
    }
    var out = {}
    Object.keys(fields).forEach(function (key) {
      if (fields[key] === null || fields[key] === '') return
      var value = Number(fields[key])
      if (Number.isFinite(value)) out[key] = value
    })
    return Object.keys(out).length > 0 ? out : null
  }

  function balanceInputs(extra) {
    var item = currentItem()
    var record = item === null ? null : balanceRecordFor(item.path)
    var prof = item === null ? null : profileFor(item.path)
    return {
      file: record && record.file ? record.file : null,
      played: record && record.played ? record.played : null,
      profile: prof && !prof.partial
        ? { loudness: prof.programLoudness, peak: prof.peak }
        : null,
      tag: tagGainDb && typeof tagGainDb.trackGain === 'number'
        ? { gainDb: tagGainDb.trackGain, peak: typeof tagGainDb.trackPeak === 'number' ? tagGainDb.trackPeak : null }
        : null,
      head: prof && prof.partial ? prof.programLoudness : null,
      live: extra && typeof extra.live === 'number' ? extra.live : null,
      platformDb: platformGain && typeof platformGain.trackGain === 'number' ? platformGain.trackGain : null,
      typicalDb: typicalGainDb(balanceTypicalGains()),
    }
  }

  function applyBalancePlan(choice, plan) {
    if (plan === 'set') {
      applyBalanceChoice(choice, 0.1)
      return
    }
    if (plan === 'hold' || plan === null || plan === undefined) return
    if (typeof plan === 'object' && typeof plan.rampSec === 'number') {
      balanceMoved = true
      applyBalanceChoice(choice, plan.rampSec)
    }
  }

  function reconsiderBalance(live) {
    if (readPrefs().normalizeVolume === false) return
    var choice = chooseBalance(balanceInputs({ live: live }))
    var plan = planBalanceMove({
      playSec: audio === null ? 0 : audio.currentTime,
      moved: balanceMoved,
      currentDb: balanceAppliedDb,
      nextDb: choice.effectiveGainDb,
      blendAudible: typeof crossfadeActive === 'function' ? crossfadeActive() : false,
    })
    applyBalancePlan(choice, plan)
  }

  function onTime(event) {
    if (balanceMeter !== null && readPrefs().normalizeVolume !== false) {
      reconsiderBalance(balanceMeter.liveLoudness())
    }
    if (!isActiveEvent(event)) return
    if (audio === null) return
    state = Object.assign({}, state, { currentTime: audio.currentTime })
    emitTime()
    trackListening()
    maybeCrossfade()
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
    // Warm the next online track while this one plays (crossfade only).
    maybePrefetchNext()
  }

  function onPause(event) {
    if (!isActiveEvent(event)) return
    reportProviderPlayback(currentItem())
    flushListening(true)
    flushSessionPosition()
    savePlaybackState()
    if (state.playing) {
      patch({ playing: false })
      syncMediaSession()
    }
  }

  function onEnded(event) {
    // The song was heard whole: keep its reading for the next play.
    commitBalanceReading(currentItem(), audio === null ? 0 : audio.duration)
    if (!isActiveEvent(event)) return
    // Folia's cache rule: the song was heard whole, so the Host may keep it.
    reportPlayed(currentItem())
    reportProviderPlayback(currentItem())
    flushListening(true)
    flushSessionPosition()
    if (state.queue.length === 0) return
    if (state.loop === 'one') {
      reportProviderPlayback(currentItem())
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
    reportCacheDistrust(failedTrack)
    errorListeners.forEach(function (fn) {
      try {
        fn({ track: failedTrack, streak: errorStreak, reason: reason || '' })
      } catch {
        /* a listener must never break playback */
      }
    })
    // An online track that cannot be fetched (expired sign-in, rights restriction, provider
    // refusal) must not spin the queue: stop on it and let the toast name the reason.
    if (failedTrack !== null && failedTrack.onlineProvider) {
      errorStreak = 0
      patch({ playing: false })
      return
    }
    if (errorStreak > 3 || state.queue.length <= 1) {
      errorStreak = 0
      patch({ playing: false })
      return
    }
    load(nextIndexOf(state.index, state.queue.length), true)
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
    if (gainNode !== null) return 1
    var trim = Math.min(1, normalizeGain)
    return clamp(state.volume * trim * duckFactor, 0, 1)
  }

  function applyOutputVolume(fadeSeconds) {
    var fade = fadeSeconds === undefined ? 0.015 : Math.max(0, Number(fadeSeconds) || 0)
    var target = clamp(state.volume * duckFactor, 0, 1)
    if (gainNode !== null && foliaGraph !== null) {
      foliaGraph.setVolume(target, fade)
      foliaGraph.setMuted(state.muted, fade)
      if (audio) audio.volume = 1
      if (audioB) audioB.volume = 1
      return
    }
    if (audio) audio.volume = effectiveVolume()
    if (audioB) audioB.volume = effectiveVolume()
  }

  /** Push a linear gain into one deck's trim node (short ramp while playing). */
  function applyTrimGain(node, linear, paused, rampSec) {
    if (node === null || audioContext === null) return
    try {
      var now = audioContext.currentTime
      var ramp = Number(rampSec)
      node.gain.cancelScheduledValues(now)
      if (paused || !isFinite(ramp) || ramp <= 0) {
        if (paused) node.gain.setValueAtTime(linear, now)
        else node.gain.setTargetAtTime(linear, now, 0.12)
        return
      }
      node.gain.setValueAtTime(node.gain.value, now)
      node.gain.linearRampToValueAtTime(linear, now + ramp)
    } catch (error) {
      node.gain.value = linear
    }
  }

  function applyNormalizeGain(linear, rampSec) {
    normalizeBase = Number.isFinite(linear) && linear > 0 ? linear : 1
    normalizeGain = normalizeBase * replayGainFactor
    if (trimNode !== null && audioContext !== null) {
      // Before playback starts the gain must already be at its target;
      // otherwise the first seconds ramp down audibly. While a track is
      // playing, keep the short ramp so toggling normalization is smooth.
      applyTrimGain(trimNode, normalizeGain, audio === null || audio.paused === true, rampSec)
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

  /**
   * Push the current EQ settings into Folia's graph. The old preamp/headroom
   * path is gone: Folia owns the ten filters and the effect chain.
   */
  function applyEq(immediate) {
    if (foliaGraph === null) return
    foliaGraph.setEq({
      enabled: eq.enabled,
      gains: eq.bands,
      preset: 'custom1',
      effects: eq.effects,
    })
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

  /**
   * Folia's lyric gate: audio starts once the song's first lyric is resolved (the
   * optional word-by-word upgrade is not part of it). Always resolves, and is a no-op
   * when the loader is absent (tests, or a client built without the lyric surface).
   */
  function whenLyricReady(item) {
    var loader = typeof MPLyricLoader === 'undefined' ? null : MPLyricLoader
    if (loader === null || typeof loader !== 'object' || typeof loader.whenReady !== 'function') {
      return Promise.resolve(null)
    }
    try {
      return loader.whenReady(item).catch(function () {
        return null
      })
    } catch (error) {
      return Promise.resolve(null)
    }
  }

  function playAfterLoudness(token) {
    var gate = loudnessGate === null ? Promise.resolve() : loudnessGate
    // Both waits run at once: the lyric request is in flight while the loudness analysis
    // measures, instead of the song starting after one wait and then the other.
    var lyrics = whenLyricReady(currentItem())
    gate
      .then(function () {
        if (token !== loadToken || pendingAutoplay !== true || audio === null) return null
        return lyrics
      })
      .then(function () {
        if (token !== loadToken || pendingAutoplay !== true || audio === null) return
        pendingAutoplay = false
        var context = api.ensureAnalyser()
        if (context !== null && audioContext !== null && audioContext.state === 'suspended') {
          audioContext.resume().catch(function () {
            // If the context cannot start, leave the media element untouched.
          })
        }
        if (foliaTransport !== null) {
          foliaTransport.play(foliaTransport.getActiveDeck()).catch(function () {
            // Autoplay may still be blocked; the play event will update the UI.
          })
        } else {
          audio.play().catch(function () {
            // Autoplay may still be blocked; the play event will update the UI.
          })
        }
      })
  }

  /** Analyse the downloaded blob in-browser and apply the per-track gain. */
  /** Apply the balance's decision through the loudness trim. */
  function applyBalanceChoice(choice, rampSec) {
    if (!choice) return
    setBalanceChoice(choice)
    balanceAppliedDb = Number(choice.effectiveGainDb) || 0
    balanceAppliedReading = String(choice.reading || '')
    applyNormalizeGain(Math.pow(10, clamp(balanceAppliedDb, -15, VOLUME_BALANCE_MAX_BOOST_DB) / 20), rampSec)
  }

  /** A whole play becomes a reading for this song, and joins the typical gains. */
  function commitBalanceReading(item, durationSec) {
    if (balanceMeter === null) return
    var play = balanceMeter.play()
    if (typeof balanceMeter.reset === 'function') balanceMeter.reset()
    if (!item) return
    var prof = profileFor(item.path)
    if (balanceWholePlayIssue(play, durationSec, prof ? prof.leadIn : 0) !== null) return
    noteBalanceMeasurement(item.path, 'played', play)
  }

  /** Folia's profile look-ahead: measure the next local track while this one plays. */
  function prefetchNextProfile() {
    var token = profileToken
    var stillCurrent = function () { return token === profileToken }
    if (readPrefs().normalizeVolume === false) return
    if (state.index < 0 || state.queue.length < 2) return
    var next = nextIndexOf(state.index, state.queue.length)
    if (next === state.index) return
    var item = state.queue[next]
    if (!item || typeof item.path !== 'string' || item.path === '') return
    if (prefetchedProfilePath === item.path || profileFor(item.path) !== null) return
    if (item.onlineProvider && item.onlineProvider !== 'navidrome') {
      // Folia analyses an online track only when its bytes are already in hand:
      // the crossfade prefetch, or the Host's played-through media cache.
      if (prefetchedNext !== null && prefetchedNext.path === item.path) {
        prefetchedProfilePath = item.path
        analyzeLoudnessBlob(
          item,
          prefetchedNext.blob,
          stillCurrent,
          function () { /* the store is the result */ },
        ).catch(function () { /* optional */ })
        return
      }
      getJson(API + 'online/cache-info?provider=' + encodeURIComponent(item.onlineProvider) + '&id=' + encodeURIComponent(item.onlineId || ''))
        .then(function (info) {
          if (!info || info.cached !== true) return null
          prefetchedProfilePath = item.path
          return fetch(streamUrl(item.path))
            .then(function (response) {
              if (!response.ok) throw new Error('HTTP ' + response.status)
              return response.blob()
            })
            .then(function (blob) {
              return analyzeLoudnessBlob(
                item,
                blob,
                stillCurrent,
                function () { /* the store is the result */ },
              )
            })
        })
        .catch(function () { /* optional */ })
      return
    }
    prefetchedProfilePath = item.path
    var request = item.onlineProvider === 'navidrome'
      ? fetch(item.onlineUrl, { headers: { Range: 'bytes=0-1572863' } })
      : fetch(streamUrl(item.path))
    request
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status)
        return response.blob()
      })
      .then(function (blob) {
        if (item.onlineProvider === 'navidrome') return analyzePartialLoudnessBlob(item, blob, stillCurrent)
        return analyzeLoudnessBlob(
          item,
          blob,
          stillCurrent,
          function () { /* the store is the result */ },
        )
      })
      .catch(function () {
        // A profile is optional; playback never waits for it.
      })
  }

  function scheduleLoudness(item, blob, done) {
    var token = (loudnessToken += 1)
    currentLoudnessBlob = blob || null
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
      function (measured) {
        if (token !== loudnessToken) return
        reconsiderBalance(null)
      },
    )
      .then(function (measured) {
        if (token === loudnessToken && (measured === null || measured === undefined)) {
          reconsiderBalance(null)
        }
      })
      .catch(function () {
        if (token === loudnessToken) reconsiderBalance(null)
      })
      .then(function () {
        finish()
        prefetchNextProfile()
      })
  }

  /** Point the active deck at a source through Folia's transport. */
  function loadActiveSource(url) {
    if (foliaTransport !== null) {
      return foliaTransport.load(foliaTransport.getActiveDeck(), url, { autoplay: false })
    }
    if (audio !== null) {
      audio.src = url
      audio.load()
    }
    return Promise.resolve(true)
  }

  function load(at, autoplay) {
    var item = state.queue[at]
    if (!item) return
    abortCrossfade()
    cancelPrefetch()
    currentBlob = null
    // Close the previous listening session before switching tracks.
    reportProviderPlayback(currentItem())
    flushListening(true)
    flushSessionPosition()
    var token = (loadToken += 1)
    tagGainDb = null
    platformGain = null
    prefetchedProfilePath = ''
    profileToken += 1
    state = Object.assign({}, state, { index: at, currentTime: 0, duration: 0, buffered: 0 })
    emit()
    syncMediaSession()
    pendingAutoplay = autoplay === true
    // A new session starts here. The play count is recorded later, and
    // only when the Last.fm / MusicBee threshold is reached.
    resetSession(item)
    // Folia's light prefetch window: the next two and the previous track's lyrics.
    prefetchLyricsAround()
    currentLoudnessBlob = null
    loudnessToken += 1
    applyNormalizeGain(1)
    if (balanceMeter !== null && typeof balanceMeter.reset === 'function') balanceMeter.reset()
    balanceMoved = false
    if (readPrefs().normalizeVolume !== false) {
      // What is known before the file is read: a whole reading (file or played),
      // then the tag, then the typical gain. Folia applies this with SET_RAMP_SEC.
      applyBalanceChoice(chooseBalance(balanceInputs()), 0.1)
    }
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
      fetch(item.onlineUrl, onlineController === null ? {} : { signal: onlineController.signal })
        .then(function (response) {
          if (response.ok) {
            var gain = readReplayGainHeaders(response.headers)
            if (gain !== null) {
              platformGain = gain
              reconsiderBalance(null)
            }
            return response.blob()
          }
          // Read the Host's error body so the toast names the platform's reason instead of
          // a bare HTTP status (or, worse, a media-element "no supported source").
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
          currentBlob = blob
          loadActiveSource(objectUrl)
          scheduleLoudness(item, blob, loudness.resolve)
          if (pendingAutoplay) playAfterLoudness(token)
        })
        .catch(function (error) {
          if (onlineToken !== loadToken) {
            loudness.resolve()
            return
          }
          fetchAbort = null
          // The gate must open even when analysis is impossible.
          loudness.resolve()
          if (error && error.name === 'AbortError') return
          // Do not fall back to the same URL as a media source: the Host answered with an
          // error body, and the element would only report "no supported source", hiding the
          // platform's reason. The error listener shows the real message and stops.
          onError(error && typeof error.message === 'string' ? error.message : '')
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
        currentBlob = blob
        loadActiveSource(objectUrl)
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

  function releaseObjectUrlB() {
    if (objectUrlB === null) return
    try {
      URL.revokeObjectURL(objectUrlB)
    } catch (error) {
      // Revoking twice is harmless.
    }
    objectUrlB = null
  }

  function releasePrefetched() {
    prefetchedNext = null
  }

  function cancelPrefetch() {
    prefetchToken += 1
    prefetchedNext = null
    if (prefetchAbort !== null) {
      try {
        prefetchAbort.abort()
      } catch (error) {
        // Already settled.
      }
      prefetchAbort = null
    }
  }

  /**
   * Warm the next online track while the current one plays. The 14 s prepare
   * window is not enough for a first-time download of a large file, so start
   * early instead of at the end; cached tracks make this a no-op.
   */
  function maybePrefetchNext() {
    if (xfadeActive || xfadePending || xfadePrepared !== null) return
    var settings = readPrefs()
    if (crossfadeFadeSeconds(settings) <= 0) return
    if (state.index < 0 || state.queue.length < 2) return
    var next = nextIndexOf(state.index, state.queue.length)
    if (next === state.index) return
    var item = state.queue[next]
    if (!item || typeof item.onlineUrl !== 'string' || item.onlineUrl === '') return
    if (!crossfadeNextAllowed(settings, currentItem(), item)) return
    if (prefetchedNext !== null && prefetchedNext.path === item.path) return
    if (prefetchAbort !== null) return
    var token = prefetchToken
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null
    prefetchAbort = controller
    var itemPath = item.path
    fetchTrackBlob(item, controller === null ? null : controller.signal)
      .then(function (blob) {
        if (token !== prefetchToken) return
        prefetchAbort = null
        // One track of memory at most; bigger files rely on the Host cache.
        prefetchedNext =
          blob.size > 80 * 1024 * 1024 ? null : { path: itemPath, blob: blob }
      })
      .catch(function () {
        if (token === prefetchToken) prefetchAbort = null
      })
  }

  /** Fetch one track the same way `load()` does, without touching the decks. */
  function fetchTrackBlob(item, signal) {
    var options = signal === undefined || signal === null ? {} : { signal: signal }
    if (typeof item.onlineUrl === 'string' && item.onlineUrl !== '') {
      return fetch(item.onlineUrl, options).then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status)
        return response.blob()
      })
    }
    return fetch(streamUrl(item.path), options).then(function (response) {
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

  function decodeBlob(blob) {
    var decoder = loudnessContext()
    if (decoder === null) return Promise.reject(new Error('no audio decoder'))
    return blob.arrayBuffer().then(function (bytes) {
      return decoder.decodeAudioData(bytes)
    })
  }

  /**
   * Decode once and return what the transition needs: the level envelope and,
   * for the incoming deck, its loudness trim.
   */
  function analyzeTransitionBlob(blob, wantTrim) {
    return decodeBlob(blob).then(function (buffer) {
      var envelope = analyzeTransitionBuffer(buffer)
      if (!wantTrim) return { envelope: envelope, trim: 1 }
      return lufsFromAudioBuffer(buffer)
        .then(function (lufs) {
          var gainDb = clamp(LOUDNESS_TARGET - lufs, -15, 6)
          return { envelope: envelope, trim: Math.pow(10, gainDb / 20) }
        })
        .catch(function () {
          return { envelope: envelope, trim: 1 }
        })
    })
  }

  /** Phase one: measure both sides while there is still time to fetch B. */
  function prepareCrossfade(nextAt) {
    var item = state.queue[nextAt]
    if (!item || audio === null || analyser === null) return
    var token = (xfadeToken += 1)
    xfadePending = true
    xfadeNext = nextAt
    var outgoingBlob = currentBlob
    var wantTrim = readPrefs().normalizeVolume !== false
    var nextBlob = null
    var cachedBlob = prefetchedNext !== null && prefetchedNext.path === item.path ? prefetchedNext.blob : null
    Promise.all([
      outgoingBlob
        ? analyzeTransitionBlob(outgoingBlob, false)
            .then(function (result) {
              return result.envelope
            })
            .catch(function () {
              return null
            })
        : Promise.resolve(null),
      (cachedBlob !== null
        ? Promise.resolve(cachedBlob)
        : fetchTrackBlob(item)
      )
        .then(function (blob) {
          nextBlob = blob
          return analyzeTransitionBlob(blob, wantTrim)
        })
        .catch(function () {
          return null
        }),
    ]).then(function (results) {
      if (token !== xfadeToken || audio === null) return
      var incoming = results[1]
      if (nextBlob === null || incoming === null) {
        abortCrossfade()
        return
      }
      // The prefetched blob now lives in the prepared plan.
      releasePrefetched()
      var duration = state.duration > 0 ? state.duration : isFinite(audio.duration) ? audio.duration : 0
      var currentProfile = currentItem() === null ? null : profileFor(currentItem().path)
      var nextProfile = item === null ? null : profileFor(item.path)
      var plan = crossfadePlan(
        {
          duration: duration,
          outroQuietSec: results[0] && typeof results[0].outroQuietSec === 'number'
            ? results[0].outroQuietSec
            : currentProfile && typeof currentProfile.bodyOut === 'number' ? currentProfile.bodyOut : 0,
        },
        {
          durationSec: incoming.envelope ? incoming.envelope.duration : 0,
          introQuietSec: incoming.envelope ? incoming.envelope.introQuietSec : 0,
          introSilentSec: incoming.envelope && incoming.envelope.introSilentSec > 0
            ? incoming.envelope.introSilentSec
            : nextProfile && typeof nextProfile.leadIn === 'number' ? nextProfile.leadIn : 0,
        },
        { prefs: readPrefs(), remaining: duration - audio.currentTime },
      )
      if (plan === null) {
        abortCrossfade()
        return
      }
      var keyRelation = crossfadeKeyRelation(currentProfile, nextProfile)
      var keyScale = crossfadeKeyLengthScale(keyRelation)
      if (keyScale !== 1) {
        plan.overlap = Math.max(CROSSFADE_MIN_SECONDS, Math.min(CROSSFADE_MAX_SECONDS, plan.overlap * keyScale))
      }
      var shape = null
      var audioApi = typeof __mpAudioBundle === 'function' ? __mpAudioBundle() : null
  if (audioApi !== null && typeof window !== 'undefined') window.__mpFoliaAudio = audioApi
      if (audioApi !== null && typeof audioApi.planBlendShape === 'function') {
        var periodSec = nextProfile && typeof nextProfile.bpm === 'number' && nextProfile.bpm > 0 ? 60 / nextProfile.bpm : null
        var nextBeatIn = null
        if (periodSec !== null) {
          var phase = ((plan.startInNext - (typeof nextProfile.beatOffset === 'number' ? nextProfile.beatOffset : 0)) % periodSec + periodSec) % periodSec
          nextBeatIn = phase === 0 ? 0 : periodSec - phase
        }
        shape = audioApi.planBlendShape({
          overlap: plan.overlap,
          outgoingDb: results[0] ? results[0].loudnessDb : null,
          nextBeatIn: nextBeatIn,
          periodSec: periodSec,
          minOverlap: CROSSFADE_MIN_SECONDS,
          maxOverlap: CROSSFADE_MAX_SECONDS,
        })
        if (shape !== null && typeof shape.overlap === 'number' && shape.overlap > 0) {
          plan.overlap = shape.overlap
        }
      }
      xfadePrepared = {
        nextAt: nextAt,
        plan: plan,
        crossover: shape !== null ? shape.crossover : 0.5,
        blob: nextBlob,
        trim: incoming.trim,
        duration: incoming.envelope ? incoming.envelope.duration : 0,
      }
      xfadePending = false
      maybeCrossfade()
    })
  }

  function maybeCrossfade() {
    if (xfadeActive || audio === null || analyser === null || audioContext === null) return
    var settings = readPrefs()
    if (crossfadeFadeSeconds(settings) <= 0) {
      abortCrossfade()
      return
    }
    var duration = state.duration > 0 ? state.duration : isFinite(audio.duration) ? audio.duration : 0
    var remaining = duration - audio.currentTime
    if (xfadePrepared !== null) {
      if (remaining <= xfadePrepared.plan.overlap + 0.25) {
        if (remaining > 0.35) beginCrossfadePlayback(xfadePrepared)
        else abortCrossfade()
      }
      return
    }
    if (xfadePending) return
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
      duration: duration,
      currentTime: audio.currentTime,
    })
    if (!should) return
    prepareCrossfade(next)
  }

  function beginCrossfadePlayback(prepared) {
    if (prepared === null || prepared === undefined) return abortCrossfade()
    if (audioB === null || audioContext === null || foliaTransport === null) return abortCrossfade()
    var remaining = (state.duration > 0 ? state.duration : audio.duration || 0) - audio.currentTime
    var fade = Math.min(prepared.plan.overlap, remaining - 0.05)
    if (!(fade >= 1)) return abortCrossfade()
    var token = xfadeToken
    // The outgoing song never fires `ended` once the fade takes it off the active deck; its
    // "played whole" report is made when the fade lands, from this capture.
    xfadeOutgoing = { item: currentItem(), duration: state.duration > 0 ? state.duration : audio.duration || 0 }
    var incomingDeck = foliaGraph !== null && audio === foliaGraph.getDeckElement('A') ? 'B' : 'A'
    releaseObjectUrlB()
    objectUrlB = URL.createObjectURL(prepared.blob)
    normalizeGainB = prepared.trim
    var trimDb = prepared.trim > 0 ? 20 * Math.log10(prepared.trim) : 0
    xfadeActive = true
    xfadePending = false
    xfadeAdopted = false
    foliaTransport
      .crossfadeTo(incomingDeck, objectUrlB, {
        seconds: fade,
        crossover: prepared.crossover,
        hold: 0,
        together: 0,
        startAt: prepared.plan.startInNext,
        replayGainDb: trimDb,
        setActive: false,
      })
      .then(function (started) {
        if (!started || token !== xfadeToken) return abortCrossfade()
        adoptIncoming(token)
        if (xfadeTimer !== null) clearTimeout(xfadeTimer)
        xfadeTimer = setTimeout(function () {
          xfadeTimer = null
          finishCrossfade(token)
        }, Math.max(200, fade * 1000 - 40))
      })
      .catch(function () {
        if (token === xfadeToken) abortCrossfade()
      })
  }

  function swapDecks() {
    var nextDeck = foliaGraph !== null && audio === foliaGraph.getDeckElement('A') ? 'B' : 'A'
    var element = audio
    audio = audioB
    audioB = element
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
    if (foliaTransport !== null) foliaTransport.setActiveDeck(nextDeck)
    if (foliaGraph !== null) balanceMeter = foliaGraph.getDeckChain(nextDeck).balanceMeter
  }

  /**
   * The fade has started, so the incoming deck is already audible: switch the
   * UI and every track-bound piece of state to it at once. The outgoing
   * element keeps playing (and fading) as a ghost until the curve lands.
   */
  function adoptIncoming(token) {
    if (token !== xfadeToken || xfadeAdopted) return
    var prepared = xfadePrepared
    if (prepared === null || audio === null || audioB === null) return abortCrossfade()
    var nextAt = prepared.nextAt
    if (nextAt < 0 || !state.queue[nextAt]) return abortCrossfade()
    flushListening(true)
    flushSessionPosition()
    swapDecks()
    var item = state.queue[nextAt]
    var duration = prepared.duration > 0 ? prepared.duration : item.durationSec > 0 ? item.durationSec : 0
    state = Object.assign({}, state, {
      index: nextAt,
      currentTime: audio.currentTime || 0,
      duration: duration,
      buffered: 0,
      playing: true,
    })
    currentBlob = prepared.blob
    currentLoudnessBlob = prepared.blob
    xfadePrepared = null
    xfadeAdopted = true
    xfadeNext = -1
    resetSession(item)
    session.lastTime = audio.currentTime || 0
    syncMediaSession()
    applyOutputVolume()
    emit()
    savePlaybackState()
    prefetchLyricsAround()
    maybePrefetchNext()
  }

  /** The overlap is over: silence and release the outgoing element. */
  function finishCrossfade(token) {
    if (token !== xfadeToken) return
    // Timers can race under throttling; never leave the UI on the ghost.
    if (!xfadeAdopted && xfadePrepared !== null) adoptIncoming(token)
    xfadeActive = false
    xfadePending = false
    xfadeAdopted = false
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
    if (audioB !== null) {
      try {
        // Before the ghost is silenced: did it reach the end of the song? The fade is
        // clamped to `remaining - 0.05`, so a completed crossfade always did.
        var reachedEnd =
          xfadeOutgoing !== null &&
          isFinite(audioB.duration) &&
          audioB.duration > 0 &&
          audioB.duration - audioB.currentTime <= 1.5
        if (reachedEnd) reportPlayed(xfadeOutgoing.item)
        audioB.pause()
        audioB.removeAttribute('src')
        audioB.load()
      } catch (error) {
        // Detached element: nothing to stop.
      }
    }
    xfadeOutgoing = null
    releaseObjectUrlB()
    normalizeGainB = 1
    maybePrefetchNext()
  }

  function abortCrossfade() {
    if (!xfadePending && !xfadeActive && xfadeTimer === null && xfadePrepared === null) return
    xfadeToken += 1
    xfadePending = false
    xfadeActive = false
    xfadeAdopted = false
    xfadeNext = -1
    xfadePrepared = null
    xfadeOutgoing = null
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

  /** Forward a transport event only when it belongs to the deck on screen. */
  function transportIsActive(info) {
    return foliaTransport !== null && info !== null && info.deck === foliaTransport.getActiveDeck()
  }

  function transportStateChanged(info) {
    if (!transportIsActive(info)) return
    if (info.playing === true) {
      onPlaying({ target: audio })
      onPlay({ target: audio })
      return
    }
    onPause({ target: audio })
  }

  function transportTimeChanged(info) {
    if (foliaTransport !== null && foliaGraph !== null && audioContext !== null) {
      var chain = foliaGraph.getDeckChain(info.deck)
      if (chain !== null && chain.balanceMeter && typeof chain.balanceMeter.tick === 'function') {
        chain.balanceMeter.tick(audioContext.currentTime)
      }
    }
    if (!transportIsActive(info)) return
    state = Object.assign({}, state, {
      duration: Number(info.duration) || state.duration,
      buffered: Number(info.buffered) || 0,
    })
    onTime({ target: audio })
    syncMediaPosition(false)
  }

  function transportFailed(info) {
    onError(info)
  }

  function transportEnded(info) {
    if (!transportIsActive(info)) return
    onEnded({ target: audio })
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
    /**
     * The active deck's media time, read at frame rate. `getTime()` is driven by
     * timeupdate (~4 Hz) and is not enough for a lyric clock; this follows the deck
     * that is actually sounding, including after a crossfade swaps A and B.
     */
    getPlaybackTime: function () {
      var source = audio
      var currentTime = source !== null && isFinite(source.currentTime) ? source.currentTime : state.currentTime
      var duration = source !== null && isFinite(source.duration) ? source.duration : state.duration
      return {
        currentTime: Number(currentTime) || 0,
        duration: Number(duration) || 0,
        buffered: Number(state.buffered) || 0,
      }
    },
    /** The deck currently producing sound; the Folia stages read it instead of the first DOM audio. */
    getActiveAudio: function () {
      return audio
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
     * Lazily build Folia's graph. Called from a user gesture so the
     * AudioContext can start; connecting a media element source silences
     * the element until the context runs, so it must never be automatic.
     */
    ensureAnalyser: function () {
      if (audio === null || foliaGraph === null) return null
      if (analyser !== null) return analyser
      if (!canRouteThroughWebAudio(audio)) return null
      var built = foliaGraph.ensure()
      if (built === null) return null
      audioContext = foliaGraph.getContext()
      analyser = foliaGraph.getAnalyser()
      gainNode = foliaGraph.getMasterGain()
      if (audioContext === null || analyser === null || gainNode === null) {
        analyser = null
        return null
      }
      var chainA = foliaGraph.getDeckChain('A')
      var chainB = foliaGraph.getDeckChain('B')
      if (chainA === null || chainB === null) {
        analyser = null
        return null
      }
      // Compatibility aliases while the transport half is still the old code:
      // the deck chain's four gain stages now back the old names. The old
      // preamp/limiter are not created any more.
      fadeNode = chainA.fade
      fadeNodeB = chainB.fade
      trimNode = chainA.replayGain
      trimNodeB = chainB.replayGain
      balanceMeter = chainA.balanceMeter
      eqNodes = []
      waveData = new Uint8Array(analyser.frequencyBinCount)
      applyNormalizeGain(normalizeGain)
      applyEq(true)
      applyOutputVolume()
      try {
        if (typeof navigator !== 'undefined' && navigator.audioSession) navigator.audioSession.type = 'playback'
      } catch (error) {
        // audioSession is optional.
      }
      if (audioContext.state === 'suspended') audioContext.resume().catch(function () {})
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
      if (audio === el && (el === null || foliaGraph !== null)) return
      abortCrossfade()
      cancelPrefetch()
      if (audio !== null) audio = null
      if (audioB !== null) audioB = null
      if (foliaTransport !== null) {
        foliaTransport.dispose()
        foliaTransport = null
      }
      if (foliaGraph !== null) {
        foliaGraph.dispose()
        foliaGraph = null
      }
      audioB = null
      releaseObjectUrlB()
      audioContext = null
      analyser = null
      gainNode = null
      fadeNode = null
      fadeNodeB = null
      trimNode = null
      trimNodeB = null
      eqNodes = []
      waveData = null
      audio = el
      if (el === null) return
      foliaGraph = createFoliaGraph()
      foliaGraph.attach(el)
      foliaGraph.setOutputDevice(readPrefs().audioOutputDeviceId || '')
      audioB = foliaGraph.getDeckElement('B')
      foliaTransport = createFoliaTransport({
        graph: foliaGraph,
        playbackFade: readPrefs().playbackFade !== false,
        onState: transportStateChanged,
        onTime: transportTimeChanged,
        onError: transportFailed,
        onEnded: transportEnded,
      })
      el.preload = 'metadata'
      el.volume = effectiveVolume()
      el.muted = state.muted
      if (audioB !== null) {
        audioB.volume = effectiveVolume()
        audioB.muted = state.muted
      }
      var item = currentItem()
      if (item !== null) {
        if (objectUrl !== null) {
          loadActiveSource(objectUrl)
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
        adopted: xfadeAdopted,
        secondary: audioB !== null,
        wired: foliaGraph !== null && analyser !== null,
        next: xfadeNext,
      }
    },
    pause: function () {
      pendingAutoplay = false
      abortCrossfade()
      if (foliaTransport !== null) foliaTransport.pause(foliaTransport.getActiveDeck())
      else if (audio) audio.pause()
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

      if (foliaTransport !== null) {
        foliaTransport.seek(foliaTransport.getActiveDeck(), target)
        state = Object.assign({}, state, { currentTime: target })
        emitTime()
        return
      }

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
    // ReplayGain tag value in dB; folds into the same trim node as the loudness gain.
    // The song's ReplayGain tags; the balance uses them when it has no reading of its own.
    setTagGain: function (gain) {
      tagGainDb = gain && typeof gain.trackGain === 'number' ? gain : null
      if (readPrefs().normalizeVolume !== false) reconsiderBalance(null)
    },
    setReplayGain: function (db) {
      var value = Number(db)
      replayGainFactor = Number.isFinite(value) && value !== 0 ? Math.pow(10, value / 20) : 1
      if (trimNode !== null && audioContext !== null) {
        applyTrimGain(trimNode, normalizeBase * replayGainFactor, audio === null || audio.paused === true)
      } else {
        applyOutputVolume()
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
      } else if (isEqSoundPreset(source.preset)) {
        preset = String(source.preset)
      } else if (isEqCustomSlotId(source.preset)) {
        preset = String(source.preset)
      } else {
        preset = eqPresetById(source.preset) === null ? 'flat' : String(source.preset)
      }
      var next = {
        enabled: source.enabled === undefined ? eq.enabled : source.enabled === true,
        preset: preset,
        bands: bands,
        effects:
          source.effects === undefined ? normalizeEqEffects(eq.effects) : normalizeEqEffects(source.effects),
        slots:
          source.slots === undefined ? normalizeEqSlots(eq.slots) : normalizeEqSlots(source.slots),
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
        eqEffects: next.effects,
        eqSlots: next.slots,
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
        effects: normalizeEqEffects(eq.effects),
        slots: normalizeEqSlots(eq.slots),
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
    /**
     * Lower the audible master gain without changing the saved volume. Used by
     * host audio focus (TTS ducking); level is the remaining volume and fadeMs the ramp.
     */
    setDuck: function (level, fadeMs) {
      var next = clamp(Number(level), 0, 1)
      if (!isFinite(next)) return duckFactor
      var fade = Number(fadeMs)
      if (!isFinite(fade) || fade < 0) fade = 300
      fade = Math.min(5000, Math.max(0, Math.round(fade))) / 1000
      if (next === duckFactor && fade === duckRampSeconds) return duckFactor
      duckFactor = next
      duckRampSeconds = fade
      applyOutputVolume(fade)
      emit()
      return duckFactor
    },
    getDuck: function () {
      return duckFactor
    },
    /** Select the AudioContext sink; harmless when the engine has no setSinkId. */
    setOutputDevice: function (deviceId) {
      var next = deviceId === undefined || deviceId === null ? '' : String(deviceId)
      savePrefs({ audioOutputDeviceId: next })
      if (foliaGraph !== null) foliaGraph.setOutputDevice(next)
      return next
    },
    setPlaybackFade: function (enabled) {
      var next = enabled !== false
      savePrefs({ playbackFade: next })
      if (foliaTransport !== null) foliaTransport.setPlaybackFade(next)
      return next
    },
    setMuted: function (value) {
      state = Object.assign({}, state, { muted: value })
      if (gainNode !== null && foliaGraph !== null) {
        applyOutputVolume()
      } else {
        if (audio) audio.muted = value
        if (audioB) audioB.muted = value
      }
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
      // The neighbour changed; drop the old prefetch and warm the new one.
      cancelPrefetch()
      maybePrefetchNext()
    },
    clear: function () {
      loadToken += 1
      cancelPendingFetch()
      abortCrossfade()
      cancelPrefetch()
      currentBlob = null
      releaseObjectUrl()
      if (foliaTransport !== null) {
        foliaTransport.stop(foliaTransport.getActiveDeck())
      } else if (audio) {
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
      if (foliaTransport !== null) foliaTransport.pause(foliaTransport.getActiveDeck())
      else if (audio) audio.pause()
    },
    destroy: function () {
      stopLeaderElection()
      loadToken += 1
      cancelPendingFetch()
      releaseObjectUrl()
      if (foliaTransport !== null) {
        foliaTransport.dispose()
        foliaTransport = null
      }
      if (foliaGraph !== null) {
        foliaGraph.dispose()
        foliaGraph = null
      }
      if (audio) {
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

