/**
 * prefs: user preferences, persisted in localStorage.
 *
 * The playback engine calls `readPrefs()` / `savePrefs()` directly, so the
 * shape below must stay compatible with 0.11.1 (loop / order / volume /
 * resumeOnStart / rememberPerTrack / sleepTimerMinutes).
 */

var PREFS_KEY = 'music.prefs.v2'
var LEGACY_PREFS_KEY = 'dsh-music.prefs'

var PREF_DEFAULTS = {
  layout: 'top',
  sortBy: 'title',
  sortDir: 'asc',
  /** Recent P3 search queries, newest first (max 8). */
  searchHistory: [],
  /**
   * Folia's `localLyricsPriority`: which lyric a local file shows when it has both
   * its own file lyric and a matched online one. 'local' keeps the file's own.
   */
  lyricLocalPriority: 'online',
  /** Folia's `preferredAlternativeLyricSource`: asked first when another source is searched. */
  lyricPreferredSource: 'kugouLite',
  /**
   * Folia's `keepProviderWordTiming`: a platform's own word-timed lyric is only replaced by
   * the preferred source, and only by a word-timed lyric; off, every source competes.
   */
  lyricKeepProviderWordTiming: true,
  /** Folia's device-wide lyric offset, added on top of the per-song one (limited to ±2000 ms). */
  lyricGlobalOffsetMs: 0,
  /** Folia's `subtitleOverlayBackground`: a soft halo behind the bottom subtitle line. */
  subtitleOverlayBackground: true,
  /** Folia's `localLyricFormatOrder`: which sidecar lyric file wins when several exist. */
  lyricFormatOrder: ['lrc', 'vtt', 'ttml', 'qrc', 'yrc', 'krc'],
  /** Preferred online audio level: standard | high | lossless | hires. */
  onlineQuality: 'standard',
  /**
   * Folia's `enableMediaCache`: cache a song's audio only after it was played through.
   * Off by default, exactly as upstream; reads use the cache either way.
   */
  onlineCacheEnabled: true,
  /** Folia's `mediaCacheLimitGb`: 1/2/5/10/20/50, 0 = no ceiling. */
  onlineCacheLimitGb: 5,
  waveEnabled: true,
  showTranslation: true,
  /** Ready-made line filters (Folia's preset ids) and free words that hide a line. */
  lyricFilterPresets: [],
  lyricFilterWords: '',
  /** Lyrics column width in the player page (px), dragged by the splitter. */
  npLyricWidth: 560,
  /** Gap between the album column and the lyrics column (px), editable in the player editor. */
  npPaneGap: 60,
  /** Animated flowing-light background on the player page. */
  npFlowBg: true,
  /** 外观: lyric style, Folia shell background and where the accent comes from (28-look.js). */
  lyricStyle: 'classic',
  lyricStyleChosen: false,
  /** Folia classic's own tuning; defaults are the upstream DEFAULT_CLASSIC_TUNING. */
  hanabiTuning: {
    hanabiColorMode: 'mixed',
    sparkAmount: 1,
    ornamentAmount: 1,
    textMotion: 1,
    blockOpacity: 1,
    riseSpeed: 1,
    spin: 1,
    ambient: 1,
    glow: 1,
    bloom: 0.8,
    chorusBloom: 1.3,
    launches: true,
    overlayFrame: true,
    textOnly: false,
    sky: 0.85,
    collage: 1,
  },
  claddaghTuning: {
    focusScaleRatio: 0.65,
    radiusScale: 1.0,
    ellipseTiltDeg: 45,
    showAxisLine: true,
    letterSpacingOffset: 0,
    positionX: 0,
    positionY: 0,
    showTranslation: false,
    translationFontScale: 1,
    translationLetterSpacingOffset: 0,
  },
  fumeTuning: {
    hidePrintSymbols: false,
    disableGeometricBackground: true,
    backgroundObjectOpacity: 0.5,
    textHoldRatio: 1,
    cameraTrackingMode: 'smooth',
    cameraSpeed: 1,
    glowIntensity: 1,
    heroScale: 1,
  },
  partitaTuning: {
    showGuideLines: true,
    useSemanticLayout: true,
    staggerMin: 20,
    staggerMax: 100,
    avoidOverlap: false,
  },
  tiltTuning: {
    splitProbability: 0.75,
    tiltStyleProbability: 0.35,
    colorScheme: 'default',
  },
  classicTuning: {
    enableWordRotation: true,
    breathingFloatMultiplier: 1,
    useLegacyLayout: false,
    wordSpacing: 0.7,
    avoidOverlap: false,
  },
  /** Folia's calm/normal/chaotic chip (used by the styles' animation tuning). */
  lyricIntensity: 'normal',
  /**
   * Folia's `autoUseBestLyric`: when the platform's own lyric has no word-level timing,
   * ask the other lyric sources for a matched word-by-word one. On by default there too.
   */
  autoUseBestLyric: true,
  /** Every Folia lyric style's font multiplier (设置 · 歌词 · 字号, and the ≋ quick control). */
  lyricsFontScale: 1,
  bgMode: 'latent',
  bgCoverOnly: false,
  /** Latent background layers: pixel dithering, fluid mesh, or both. */
  latentDisplayMode: 'both',
  latentColorSource: 'cover-theme',
  /** URL for the Folia "url" (embedded) background. */
  bgUrl: '',
  themeSource: 'default',
  themeAccent: '',
  /** Ambient backdrop motion (blurred cover). */
  npAmbientOn: true,
  npAmbientDrift: 300,
  npAmbientSpeed: 400,
  npBeatSensitivity: 200,
  npBeatAmount: 300,
  composerLyrics: true,
  composerTranslation: true,
  /**
   * The composer seat: one list button beside the chat input that opens the queue.
   * Off removes the seat, not just its content; the lyric strip keeps `composerLyrics`.
   */
  composerListButton: true,
  volume: 1,
  audioOutputDeviceId: '',
  playbackFade: false,
  /** Folia default: the player chrome stays visible until the user asks it to hide. */
  autoHidePlayerChrome: false,
  /** Folia's three-way player chrome mode: always-visible / auto-hide / always-hidden. */
  playerChromeVisibilityMode: 'always-visible',
  // Writing a real play to a music account is opt-in, as Folia's scrobble switch is.
  playbackReports: false,
  /** Folia's voice-input pause: Windows microphone capture pauses playback. */
  voiceInputPause: false,
  /** External TTS/voice plugins may duck the music through the audio-focus API. */
  audioFocusDucking: true,
  /** Remaining volume while ducked (0.3 = 30%). */
  audioFocusDuckLevel: 0.3,
  /** Duck/release ramp in milliseconds. */
  audioFocusFadeMs: 300,
  /** Folia's replay-gain choice; `normalizeVolume` is the legacy on/off form. */
  replayGainMode: 'off',
  loop: 'none',
  order: 'list',
  resumeOnStart: true,
  sleepTimerMinutes: 0,
  sleepDeadline: 0,
  autoResume: false,
  rememberPerTrack: false,
  normalizeVolume: false,
  eqEnabled: false,
  eqPreset: 'flat',
  eqBands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  eqEffects: {
    highpass: 20,
    lowpass: 20000,
    drive: 0,
    crush: 0,
    wow: 0,
    noise: 0,
    width: 1,
    space: 0,
    punch: 0,
  },
  /** Written on the first EQ change; an empty value means "old band grid". */
  eqLayout: '',
  eqDevice: '',
  eqSlots: [
    { bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], effects: {} },
    { bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], effects: {} },
  ],
  /** Folia's automix/crossfade switch, kept apart from the maximum overlap. */
  crossfadeEnabled: false,
  /** Folia's `crossfadeMaxSec`: the upper bound of the automatic overlap. */
  crossfadeSeconds: 5,
  /** Folia's `queueAddBehavior`: where 「加入队列」 puts a song, after the current one or at the end. */
  queueAddBehavior: 'append',
  /** Folia's `autoSkipUnplayable`: a track that cannot be played is skipped instead of stopping. */
  autoSkipUnplayable: true,
  /** Folia's `shuffleRoundNoRepeat`: a shuffled queue is re-shuffled for every round. */
  shuffleRoundNoRepeat: false,
  /** Keep the screen awake while a song plays (Wake Lock, where the host offers it). */
  preventSleepDuringPlayback: false,
  onlinePlaylistSort: 'source',
  onboardingDone: true,
}

function readPrefs() {
  var merged = {}
  Object.keys(PREF_DEFAULTS).forEach(function (key) {
    merged[key] = PREF_DEFAULTS[key]
  })
  var raw = null
  try {
    raw = window.localStorage.getItem(PREFS_KEY)
  } catch (error) {
    raw = null
  }
  // One-time migration from the 0.11 key so nobody loses their settings.
  if (raw === null) {
    try {
      raw = window.localStorage.getItem(LEGACY_PREFS_KEY)
      if (raw !== null) window.localStorage.setItem(PREFS_KEY, raw)
    } catch (error) {
      raw = null
    }
  }
  if (raw === null) return merged
  var parsed = null
  try {
    parsed = JSON.parse(raw)
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return merged
    Object.keys(parsed).forEach(function (key) {
      if (parsed[key] !== undefined && parsed[key] !== null) merged[key] = parsed[key]
    })
  } catch (error) {
    // Corrupt value: defaults stand.
  }
  // Legacy variant ids now select Folia's classic style; a stored `classic` is kept.
  if (['standard', 'glow', 'outline', 'karaoke', 'mirror', 'cappella'].indexOf(merged.lyricStyle) >= 0) merged.lyricStyle = 'classic'
  // The old default was Monet. Move a preference the user never chose to Folia's
  // default once; an explicit later choice writes `lyricStyleChosen` and is kept.
  if (merged.lyricStyleChosen !== true && merged.lyricStyle === 'monet') {
    merged.lyricStyle = 'classic'
    merged.lyricStyleChosen = true
    dropped = true
  }
  // The player page switched from the old ambient/flow backdrop to Folia's six shell
  // backgrounds; a stored old id falls back to Folia's default (latent).
  var foliaBackgrounds = ['common', 'monet', 'nomand', 'latent', 'sora', 'url', 'none']
  if (foliaBackgrounds.indexOf(merged.bgMode) < 0) merged.bgMode = 'latent'
  // The old "lyric order" switch is gone: Folia's local/online priority decides, and the
  // sidecar always outranks the embedded lyric. A stored `lyricOrder` is simply ignored.
  delete merged.lyricOrder
  if (['off', 'auto', 'track', 'album'].indexOf(merged.replayGainMode) < 0) {
    merged.replayGainMode = merged.normalizeVolume === false ? 'off' : 'auto'
  }
  // The classic lyric list is gone: every style is a Folia renderer whose typography
  // inputs are multipliers, so the old px-based keys have no reader. The relative
  // translation size is gone too — one text-size control, translation at Folia's 90%.
  // Drop them once instead of leaving stored values that look like they still do something.
  var deadLyricKeys = ['lyricSize', 'lyricGap', 'lyricBlur', 'lyricAlign', 'npLayoutV2', 'lyricAutoWordSegmentation', 'translationScale']
  var dropped = false
  deadLyricKeys.forEach(function (key) {
    if (Object.prototype.hasOwnProperty.call(merged, key)) {
      delete merged[key]
      dropped = true
    }
  })
  // Folia hanabi tuning: numeric amounts clamp, switches default as upstream.
  var hanabiDefaults = PREF_DEFAULTS.hanabiTuning
  var storedHanabi = merged.hanabiTuning && typeof merged.hanabiTuning === 'object' ? merged.hanabiTuning : {}
  function hanabiNumber(key, min, max) {
    var value = Number(storedHanabi[key])
    return isFinite(value) ? Math.min(max, Math.max(min, value)) : hanabiDefaults[key]
  }
  merged.hanabiTuning = {
    hanabiColorMode: ['theme', 'vivid', 'mixed'].indexOf(storedHanabi.hanabiColorMode) >= 0 ? storedHanabi.hanabiColorMode : hanabiDefaults.hanabiColorMode,
    sparkAmount: hanabiNumber('sparkAmount', 0, 2),
    ornamentAmount: hanabiNumber('ornamentAmount', 0, 2),
    textMotion: hanabiNumber('textMotion', 0, 2),
    blockOpacity: hanabiNumber('blockOpacity', 0, 1),
    riseSpeed: hanabiNumber('riseSpeed', 0, 2),
    spin: hanabiNumber('spin', 0, 2),
    ambient: hanabiNumber('ambient', 0, 2),
    glow: hanabiNumber('glow', 0, 2),
    bloom: hanabiNumber('bloom', 0, 2),
    chorusBloom: hanabiNumber('chorusBloom', 0, 2),
    launches: storedHanabi.launches !== false,
    overlayFrame: storedHanabi.overlayFrame !== false,
    textOnly: storedHanabi.textOnly === true,
    sky: hanabiNumber('sky', 0, 1),
    collage: hanabiNumber('collage', 0, 2),
  }
  // Folia claddagh tuning: angular/numeric ranges mirror the upstream resolve().
  var claddaghDefaults = PREF_DEFAULTS.claddaghTuning
  var storedCladdagh = merged.claddaghTuning && typeof merged.claddaghTuning === 'object' ? merged.claddaghTuning : {}
  function claddaghNumber(key, min, max) {
    var value = Number(storedCladdagh[key])
    return isFinite(value) ? Math.min(max, Math.max(min, value)) : claddaghDefaults[key]
  }
  merged.claddaghTuning = {
    focusScaleRatio: claddaghNumber('focusScaleRatio', 0, 1.5),
    radiusScale: claddaghNumber('radiusScale', 0.5, 1.5),
    ellipseTiltDeg: claddaghNumber('ellipseTiltDeg', 0, 60),
    showAxisLine: storedCladdagh.showAxisLine !== false,
    letterSpacingOffset: claddaghNumber('letterSpacingOffset', -5, 20),
    positionX: claddaghNumber('positionX', -40, 40),
    positionY: claddaghNumber('positionY', -40, 40),
    showTranslation: storedCladdagh.showTranslation === true,
    translationFontScale: claddaghNumber('translationFontScale', 0.5, 2),
    translationLetterSpacingOffset: claddaghNumber('translationLetterSpacingOffset', -5, 20),
  }
  // Folia fume tuning: numeric ranges clamp, camera mode falls back to smooth.
  var fumeDefaults = PREF_DEFAULTS.fumeTuning
  var storedFume = merged.fumeTuning && typeof merged.fumeTuning === 'object' ? merged.fumeTuning : {}
  function fumeNumber(key, min, max) {
    var value = Number(storedFume[key])
    return isFinite(value) ? Math.min(max, Math.max(min, value)) : fumeDefaults[key]
  }
  merged.fumeTuning = {
    hidePrintSymbols: storedFume.hidePrintSymbols === true,
    disableGeometricBackground: storedFume.disableGeometricBackground !== false,
    backgroundObjectOpacity: fumeNumber('backgroundObjectOpacity', 0, 1),
    textHoldRatio: fumeNumber('textHoldRatio', 0, 1),
    cameraTrackingMode: storedFume.cameraTrackingMode === 'stepped' ? 'stepped' : 'smooth',
    cameraSpeed: fumeNumber('cameraSpeed', 0.55, 1.85),
    glowIntensity: fumeNumber('glowIntensity', 0, 1.8),
    heroScale: fumeNumber('heroScale', 0.82, 1.32),
  }
  // Folia partita tuning: two staggers clamp to 0..180 and stay ordered.
  var partitaDefaults = PREF_DEFAULTS.partitaTuning
  var storedPartita = merged.partitaTuning && typeof merged.partitaTuning === 'object' ? merged.partitaTuning : {}
  var staggerA = Number(storedPartita.staggerMin)
  var staggerB = Number(storedPartita.staggerMax)
  if (!isFinite(staggerA)) staggerA = partitaDefaults.staggerMin
  if (!isFinite(staggerB)) staggerB = partitaDefaults.staggerMax
  merged.partitaTuning = {
    showGuideLines: storedPartita.showGuideLines !== false,
    useSemanticLayout: storedPartita.useSemanticLayout !== false,
    staggerMin: Math.min(180, Math.max(0, Math.min(staggerA, staggerB))),
    staggerMax: Math.min(180, Math.max(0, Math.max(staggerA, staggerB))),
    avoidOverlap: storedPartita.avoidOverlap === true,
  }
  // Folia tilt tuning: probabilities clamp to 0..1, unknown colour schemes fall back.
  var tiltDefaults = PREF_DEFAULTS.tiltTuning
  var storedTilt = merged.tiltTuning && typeof merged.tiltTuning === 'object' ? merged.tiltTuning : {}
  var tiltSplit = Number(storedTilt.splitProbability)
  var tiltStyle = Number(storedTilt.tiltStyleProbability)
  var tiltScheme = ['default', 'swap', 'accentAll', 'primaryAll'].indexOf(storedTilt.colorScheme) >= 0 ? storedTilt.colorScheme : tiltDefaults.colorScheme
  merged.tiltTuning = {
    splitProbability: isFinite(tiltSplit) ? Math.min(1, Math.max(0, tiltSplit)) : tiltDefaults.splitProbability,
    tiltStyleProbability: isFinite(tiltStyle) ? Math.min(1, Math.max(0, tiltStyle)) : tiltDefaults.tiltStyleProbability,
    colorScheme: tiltScheme,
  }
  // Folia's classic tuning is one stored object: a partial older value keeps the upstream defaults.
  var classicTuningDefaults = PREF_DEFAULTS.classicTuning
  var storedClassicTuning = merged.classicTuning
  merged.classicTuning = Object.assign({}, classicTuningDefaults, storedClassicTuning && typeof storedClassicTuning === 'object' ? storedClassicTuning : {})
  var classicFloat = Number(merged.classicTuning.breathingFloatMultiplier)
  var classicSpacing = Number(merged.classicTuning.wordSpacing)
  merged.classicTuning.enableWordRotation = merged.classicTuning.enableWordRotation !== false
  merged.classicTuning.useLegacyLayout = merged.classicTuning.useLegacyLayout === true
  merged.classicTuning.avoidOverlap = merged.classicTuning.avoidOverlap === true
  merged.classicTuning.breathingFloatMultiplier = isFinite(classicFloat) ? Math.min(2, Math.max(0, classicFloat)) : classicTuningDefaults.breathingFloatMultiplier
  merged.classicTuning.wordSpacing = isFinite(classicSpacing) ? Math.min(2, Math.max(0, classicSpacing)) : classicTuningDefaults.wordSpacing
  var fontScale = Number(merged.lyricsFontScale)
  if (!isFinite(fontScale) || fontScale < 0.5 || fontScale > 2) merged.lyricsFontScale = PREF_DEFAULTS.lyricsFontScale
  var globalOffset = Number(merged.lyricGlobalOffsetMs)
  if (!isFinite(globalOffset)) globalOffset = PREF_DEFAULTS.lyricGlobalOffsetMs
  merged.lyricGlobalOffsetMs = Math.max(-2000, Math.min(2000, Math.round(globalOffset)))
  if (merged.queueAddBehavior !== 'next') merged.queueAddBehavior = 'append'
  // Before the switch existed, a positive seconds value was the switch itself. Fresh installs
  // (defaults above) stay off; old users keep exactly the state they had.
  var storedHadCrossfadeSwitch = parsed !== null && Object.prototype.hasOwnProperty.call(parsed, 'crossfadeEnabled')
  var storedCrossfadeSeconds = parsed === null ? NaN : Number(parsed.crossfadeSeconds)
  if (!storedHadCrossfadeSwitch) merged.crossfadeEnabled = isFinite(storedCrossfadeSeconds) && storedCrossfadeSeconds > 0
  var crossfadeSeconds = Number(merged.crossfadeSeconds)
  if (!isFinite(crossfadeSeconds) || crossfadeSeconds < 1) crossfadeSeconds = PREF_DEFAULTS.crossfadeSeconds
  merged.crossfadeSeconds = Math.min(25, Math.max(1, Math.round(crossfadeSeconds)))
  if (dropped) {
    try {
      window.localStorage.setItem(PREFS_KEY, JSON.stringify(merged))
    } catch (error) {
      // Best effort only.
    }
  }
  return merged
}

/** The settings a backup may carry; unknown keys in an imported file are ignored. */
function prefKeys() {
  return Object.keys(PREF_DEFAULTS)
}

function savePrefs(patch) {
  var next = readPrefs()
  if (patch !== null && typeof patch === 'object') {
    Object.keys(patch).forEach(function (key) {
      next[key] = patch[key]
    })
  }
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(next))
  } catch (error) {
    // Private mode / quota: preferences are best effort.
  }
  if (prefsStore !== undefined) prefsStore.set(next)
  return next
}

var prefsStore = createStore(readPrefs())

function setPrefs(patch) {
  return savePrefs(patch)
}





