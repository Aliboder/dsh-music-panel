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
  nebbiaTuning: {
    appear: ['write', 'fade'],
    fade: ['fog'],
    layouts: ['ribbon', 'lines2', 'lines3', 'cross', 'pillar', 'header', 'badge', 'columns', 'orbit'],
    scenery: ['spot', 'buildings', 'lights', 'cars', 'road'],
    behind: 'night',
    glass: 'rain',
    rain: 'slant',
    credits: true,
    jitter: 0.6,
    warp: 0.6,
    mist: 0.75,
    hold: 1.2,
    refog: 4,
    strokeWidth: 0.09,
    writeSpeed: 1,
    doodle: 0.3,
    busSpeed: 1,
    neon: 1,
    spot: 0.5,
    spotX: 0.8,
    rainHit: 1,
    rainBig: 1,
    bump: 1,
    jellies: 16,
    jellySize: 1,
    bubbles: 0.6,
    dew: 1,
    dewSize: 1,
    dewGlint: 1,
    snow: 1,
    snowSize: 1,
    snowMelt: 1,
  },
  /** Folia metaphor's tuning; defaults mirror DEFAULT_METAPHOR_TUNING. */
  metaphorTuning: {
    cutPace: 1,
    cameraMotion: 1,
    flow: 1,
    blobs: 1,
    halftone: 1,
    grain: 1,
    negative: true,
    flip: false,
    keywordColors: false,
    transitions: true,
  },
  temperaTuning: {
    cameraIntensity: 1,
    glyphMotion: 1,
    wholeLineLyrics: false,
    glyphSettleStretch: 0.5,
    depthOfField: 1,
    depthPan: 1,
    glyphDepth: 0.9,
    temperaColorMode: 'duo',
    showBlocks: true,
    showDecor: true,
    showCornerMarks: true,
    textInversion: true,
    enableTransitions: true,
    textureResolution: 1.5,
    postProcessEnabled: true,
    postProcessTextureCompression: false,
    postProcessGrain: 0.1,
    postProcessContrast: 0.4,
    postProcessRgbShift: 0,
    postProcessVignette: 0.85,
    postProcessLensDistortion: 0.3,
  },
  dioramaTuning: {
    cameraSpeed: 1.3,
    motionAmount: 0.9,
    audioReactivity: 1.5,
    particleDensity: 576,
    particleScale: 1,
    particleGlowEnabled: true,
    particleGlowIntensity: 0.65,
    showParticles: true,
    backgroundParticleCircumference: 28,
    backgroundParticleRadial: 2,
    glowEnabled: true,
    glowIntensity: 1,
    soulEnabled: true,
    soulIntensity: 1,
    soulActiveEnabled: true,
    gradientEnabled: true,
    gradientIntensity: 1,
    keywordColoringEnabled: true,
  },
  // 时计（Folia 的 pendolo）的出厂调参。2026-11 按用户调好的手感定为默认：
  // 弧更平、指针回弹更快、当前字更大、整盘微倾。
  pendoloTuning: {
    arcRadius: 0.48,
    arcAngleDeg: 100,
    wheelCenterX: 0,
    wheelCenterY: 0.5,
    tickSnappiness: 3,
    activeScale: 1.41,
    tiltDeg: 2,
    parallaxDepth: 1,
    mirrorLayout: false,
  },
  lumiereTuning: {
    lightIntensity: 0.4,
    audioResponse: 2,
    fogDensity: 0.5,
    darkField: 0.5,
    moteAmount: 2,
    bloom: 0.8,
    textBloom: 0.5,
    unlitOpacity: 0.1,
    windowNeighbors: 2,
    decay: 1.3,
    echo: 1.2,
    fogOctaves: 1,
    lineArt: true,
    frontBokeh: true,
    trails: true,
    hideTrails: false,
    seamlessTransitions: true,
    overlayFrame: true,
    textOnly: false,
    keywordColors: true,
    themeIcons: true,
    themeColorMix: 1,
    renderQuality: 'full',
  },
  machiTuning: {
    scene: 'auto',
    timeOfDay: 'auto',
    weather: 'auto',
    camera: 'default',
    motion: false,
    motionSpeed: 1,
    aperture: 8,
    dof: 1,
    dofRange: 1,
    tiltShift: 0.3,
    focus: 'center',
    focusOffset: 0,
    simulatedBeat: true,
  },
  monetTuning: {
    keywordColoringEnabled: true,
    showDescription: true,
    descriptionVisibility: 'auto',
    showAudioVisualization: true,
    audioStyle: 'bar',
    fontScale: 1.5,
    portraitSource: 'cover',
    portraitOffsetX: 0,
    portraitStyle: 'square',
    showPortraitDragHanger: true,
    portraitHangerVisibility: 'auto',
    mirrorLayout: false,
  },
  sonnetTuning: {
    cameraIntensity: 1.2,
    typographyMotion: 1,
    mgDensity: 0.6,
    showOnlyText: false,
    showGuide: true,
    showBackgroundMg: true,
    showFixedGeo: true,
    showGiantDecorativeText: true,
    showBackgroundDecor: true,
    enableTransitions: true,
    outerFrameMode: 'full',
    textureResolution: 1.5,
    postProcessEnabled: true,
    postProcessGrain: 0.2,
    postProcessContrast: 0,
    postProcessRgbShift: 0.05,
    postProcessHalftone: 0.05,
    postProcessVignette: 1.05,
    postProcessLensDistortion: 0.3,
    postProcessLensDispersion: 0.6,
  },
  cadenzaTuning: {
    fontScale: 1.12,
    widthRatio: 0.72,
    motionAmount: 1,
    glowIntensity: 1,
  },
  hanabiTuning: {
    hanabiColorMode: 'mixed',
    sparkAmount: 0.5,
    ornamentAmount: 2,
    textMotion: 1,
    blockOpacity: 1,
    riseSpeed: 1,
    spin: 1,
    ambient: 1,
    glow: 0.55,
    bloom: 0.3,
    chorusBloom: 0.5,
    launches: true,
    overlayFrame: true,
    textOnly: false,
    sky: 0.75,
    collage: 1,
  },
  claddaghTuning: {
    focusScaleRatio: 0.65,
    radiusScale: 0.85,
    ellipseTiltDeg: 39,
    showAxisLine: true,
    letterSpacingOffset: 0,
    positionX: 0,
    positionY: 0,
    showTranslation: true,
    translationFontScale: 1,
    translationLetterSpacingOffset: 2,
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
  /**
   * Folia 的 `subtitleFontScale`：译文（以及样式里的下一句字幕）字号倍率，默认 1，
   * 上下限 0.85–1.4 与上游的 handleSetSubtitleFontScale / 滑杆一致。歌词字号由
   * 外观页的样式参数控制，这一项只放大/缩小译文。
   */
  subtitleFontScale: 1,
  /** 在线平台底层换新提示的确认版本：勾选「不再显示」后写入当前 notice id。 */
  onlineRelaunchNoticeAck: '',
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
  /** Player chrome auto-hide is the plugin default; the three-way control can pin it visible. */
  autoHidePlayerChrome: true,
  /** Default follows the plugin's auto-hide request; the three-way control still allows always-visible. */
  playerChromeVisibilityMode: 'auto-hide',
  playerChromeModeChosen: false,
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
  /** 播放模式：顺序播放 / 单曲循环 / 随机播放（一颗按钮轮转）。 */
  playMode: 'sequence',
  /** 旧字段，只用于迁移到 playMode。 */
  loop: 'none',
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
  autoSkipUnplayable: false,
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
  // 播放模式从旧的 loop/order 迁移（旧版没有 playMode）。随机模式后来才有的字段：
  // 旧档 order=random 视为随机，loop=one 视为单曲，其余为顺序。
  if (parsed !== null && parsed.playMode === undefined) {
    merged.playMode = parsed.order === 'random' ? 'random' : parsed.loop === 'one' ? 'one' : 'sequence'
  }
  if (['sequence', 'one', 'random'].indexOf(merged.playMode) < 0) merged.playMode = 'sequence'
  // One-time default switch: profiles that still hold the old always-visible default move to
  // auto-hide. An explicit later choice writes `playerChromeModeChosen` and is kept.
  if (merged.playerChromeModeChosen !== true && merged.playerChromeVisibilityMode === 'always-visible' && merged.autoHidePlayerChrome === false) {
    merged.playerChromeVisibilityMode = 'auto-hide'
    merged.autoHidePlayerChrome = true
    merged.playerChromeModeChosen = true
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
  // Folia monet tuning: visibility, portrait and audio options.
  var monetDefaults = PREF_DEFAULTS.monetTuning
  var storedMonet = merged.monetTuning && typeof merged.monetTuning === 'object' ? merged.monetTuning : {}
  function monetNumber(key, min, max) {
    var value = Number(storedMonet[key])
    return isFinite(value) ? Math.min(max, Math.max(min, value)) : monetDefaults[key]
  }
  function monetVisibility(key) {
    return ['auto', 'always', 'hidden'].indexOf(storedMonet[key]) >= 0 ? storedMonet[key] : 'auto'
  }
  merged.monetTuning = {
    keywordColoringEnabled: storedMonet.keywordColoringEnabled !== false,
    showDescription: storedMonet.showDescription !== false,
    descriptionVisibility: monetVisibility('descriptionVisibility'),
    showAudioVisualization: storedMonet.showAudioVisualization !== false,
    audioStyle: storedMonet.audioStyle === 'line' ? 'line' : 'bar',
    fontScale: monetNumber('fontScale', 0.7, 1.5),
    portraitSource: ['cover', 'custom', 'none'].indexOf(storedMonet.portraitSource) >= 0 ? storedMonet.portraitSource : 'cover',
    portraitOffsetX: monetNumber('portraitOffsetX', -150, 0),
    portraitStyle: storedMonet.portraitStyle === 'rectangular' ? 'rectangular' : 'square',
    showPortraitDragHanger: storedMonet.showPortraitDragHanger !== false,
    portraitHangerVisibility: monetVisibility('portraitHangerVisibility'),
    mirrorLayout: storedMonet.mirrorLayout === true,
  }
  // Folia pendolo tuning: arc geometry and small display options.
  var pendoloDefaults = PREF_DEFAULTS.pendoloTuning
  var storedPendolo = merged.pendoloTuning && typeof merged.pendoloTuning === 'object' ? merged.pendoloTuning : {}
  function pendoloNumber(key, min, max) {
    var value = Number(storedPendolo[key])
    return isFinite(value) ? Math.min(max, Math.max(min, value)) : pendoloDefaults[key]
  }
  merged.pendoloTuning = {
    arcRadius: pendoloNumber('arcRadius', 0.2, 0.6),
    arcAngleDeg: pendoloNumber('arcAngleDeg', 30, 180),
    wheelCenterX: pendoloNumber('wheelCenterX', -0.5, 0.5),
    wheelCenterY: pendoloNumber('wheelCenterY', 0, 1),
    tickSnappiness: pendoloNumber('tickSnappiness', 0.5, 4),
    activeScale: pendoloNumber('activeScale', 0.8, 1.6),
    tiltDeg: pendoloNumber('tiltDeg', -45, 45),
    parallaxDepth: pendoloNumber('parallaxDepth', 0, 2),
    mirrorLayout: storedPendolo.mirrorLayout === true,
  }
  // Folia nebbia tuning: window/glass choices and the handwriting/mist core.
  var nebbiaDefaults = PREF_DEFAULTS.nebbiaTuning
  var storedNebbia = merged.nebbiaTuning && typeof merged.nebbiaTuning === 'object' ? merged.nebbiaTuning : {}
  function nebbiaNumber(key, min, max) {
    var value = Number(storedNebbia[key])
    return isFinite(value) ? Math.min(max, Math.max(min, value)) : nebbiaDefaults[key]
  }
  function nebbiaChoice(key, choices) {
    return choices.indexOf(storedNebbia[key]) >= 0 ? storedNebbia[key] : nebbiaDefaults[key]
  }
  function nebbiaList(key, choices, fallback, minOne) {
    var picked = Array.isArray(storedNebbia[key]) ? choices.filter(function (item) { return storedNebbia[key].indexOf(item) >= 0 }) : []
    if (picked.length === 0 && minOne) return fallback.slice()
    return picked
  }
  var nebbiaAppear = nebbiaList('appear', ['write', 'fade', 'breath'], ['write', 'fade'], true)
  var nebbiaFade = nebbiaList('fade', ['fog', 'fingers'], ['fog'], true)
  var nebbiaLayouts = nebbiaList('layouts', ['ribbon', 'lines2', 'lines3', 'cross', 'pillar', 'header', 'badge', 'columns', 'orbit'], ['ribbon'], true)
  var nebbiaScenery = nebbiaList('scenery', ['spot', 'buildings', 'lights', 'cars', 'road'], ['spot', 'buildings', 'lights', 'cars', 'road'], false)
  merged.nebbiaTuning = {
    appear: nebbiaAppear,
    fade: nebbiaFade,
    layouts: nebbiaLayouts,
    scenery: nebbiaScenery,
    behind: nebbiaChoice('behind', ['night', 'aquarium', 'backdrop']),
    glass: nebbiaChoice('glass', ['rain', 'dew', 'snow']),
    rain: nebbiaChoice('rain', ['slant', 'straight', 'off']),
    credits: storedNebbia.credits !== false,
    jitter: nebbiaNumber('jitter', 0, 1.5),
    warp: nebbiaNumber('warp', 0, 1.5),
    mist: nebbiaNumber('mist', 0.2, 1),
    hold: nebbiaNumber('hold', 0, 6),
    refog: nebbiaNumber('refog', 0.5, 12),
    strokeWidth: nebbiaNumber('strokeWidth', 0.04, 0.16),
    writeSpeed: nebbiaNumber('writeSpeed', 0.4, 2.5),
    doodle: nebbiaNumber('doodle', 0, 1),
    busSpeed: nebbiaNumber('busSpeed', 0, 3),
    neon: nebbiaNumber('neon', 0, 2),
    spot: nebbiaNumber('spot', 0, 2),
    spotX: nebbiaNumber('spotX', 0, 1),
    rainHit: nebbiaNumber('rainHit', 0, 3),
    rainBig: nebbiaNumber('rainBig', 0, 2),
    bump: nebbiaNumber('bump', 0, 2.5),
    jellies: Math.round(nebbiaNumber('jellies', 0, 24)),
    jellySize: nebbiaNumber('jellySize', 0.5, 1.8),
    bubbles: nebbiaNumber('bubbles', 0, 1),
    dew: nebbiaNumber('dew', 0, 1.5),
    dewSize: nebbiaNumber('dewSize', 0.5, 2),
    dewGlint: nebbiaNumber('dewGlint', 0, 2),
    snow: nebbiaNumber('snow', 0, 3),
    snowSize: nebbiaNumber('snowSize', 0.5, 2),
    snowMelt: nebbiaNumber('snowMelt', 0.25, 3),
  }
  // Folia tempera tuning: camera, print passes and colour mode.
  var temperaDefaults = PREF_DEFAULTS.temperaTuning
  var storedTempera = merged.temperaTuning && typeof merged.temperaTuning === 'object' ? merged.temperaTuning : {}
  function temperaNumber(key, min, max) {
    var value = Number(storedTempera[key])
    return isFinite(value) ? Math.min(max, Math.max(min, value)) : temperaDefaults[key]
  }
  function temperaSwitch(key, fallback) {
    return typeof storedTempera[key] === 'boolean' ? storedTempera[key] : fallback
  }
  merged.temperaTuning = {
    cameraIntensity: temperaNumber('cameraIntensity', 0, 2),
    glyphMotion: temperaNumber('glyphMotion', 0, 2),
    wholeLineLyrics: temperaSwitch('wholeLineLyrics', false),
    glyphSettleStretch: temperaNumber('glyphSettleStretch', 0, 1),
    depthOfField: temperaNumber('depthOfField', 0, 2),
    depthPan: temperaNumber('depthPan', 0, 2),
    glyphDepth: temperaNumber('glyphDepth', 0, 2),
    temperaColorMode: storedTempera.temperaColorMode === 'mono' ? 'mono' : 'duo',
    showBlocks: temperaSwitch('showBlocks', true),
    showDecor: temperaSwitch('showDecor', true),
    showCornerMarks: temperaSwitch('showCornerMarks', true),
    textInversion: temperaSwitch('textInversion', true),
    enableTransitions: temperaSwitch('enableTransitions', true),
    textureResolution: temperaNumber('textureResolution', 0.5, 4),
    postProcessEnabled: temperaSwitch('postProcessEnabled', true),
    postProcessTextureCompression: temperaSwitch('postProcessTextureCompression', false),
    postProcessGrain: temperaNumber('postProcessGrain', 0, 1),
    postProcessContrast: temperaNumber('postProcessContrast', 0, 1),
    postProcessRgbShift: temperaNumber('postProcessRgbShift', 0, 1),
    postProcessVignette: temperaNumber('postProcessVignette', 0, 2),
    postProcessLensDistortion: temperaNumber('postProcessLensDistortion', 0, 2),
  }
  // Folia diorama tuning: camera, particles and follow-singing effects.
  var dioramaDefaults = PREF_DEFAULTS.dioramaTuning
  var storedDiorama = merged.dioramaTuning && typeof merged.dioramaTuning === 'object' ? merged.dioramaTuning : {}
  function dioramaNumber(key, min, max) {
    var value = Number(storedDiorama[key])
    return isFinite(value) ? Math.min(max, Math.max(min, value)) : dioramaDefaults[key]
  }
  function dioramaSwitch(key, fallback) {
    return typeof storedDiorama[key] === 'boolean' ? storedDiorama[key] : fallback
  }
  merged.dioramaTuning = {
    cameraSpeed: dioramaNumber('cameraSpeed', 0.55, 1.85),
    motionAmount: dioramaNumber('motionAmount', 0.4, 1.6),
    audioReactivity: dioramaNumber('audioReactivity', 0, 1.5),
    particleDensity: Math.round(dioramaNumber('particleDensity', 32, 2048)),
    particleScale: dioramaNumber('particleScale', 0.5, 2),
    particleGlowEnabled: dioramaSwitch('particleGlowEnabled', true),
    particleGlowIntensity: dioramaNumber('particleGlowIntensity', 0, 1.5),
    showParticles: dioramaSwitch('showParticles', true),
    backgroundParticleCircumference: Math.round(dioramaNumber('backgroundParticleCircumference', 4, 64)),
    backgroundParticleRadial: Math.round(dioramaNumber('backgroundParticleRadial', 1, 8)),
    glowEnabled: dioramaSwitch('glowEnabled', true),
    glowIntensity: dioramaNumber('glowIntensity', 0.1, 1.5),
    soulEnabled: dioramaSwitch('soulEnabled', true),
    soulIntensity: dioramaNumber('soulIntensity', 0.1, 1.5),
    soulActiveEnabled: dioramaSwitch('soulActiveEnabled', dioramaDefaults.soulActiveEnabled === true),
    gradientEnabled: dioramaSwitch('gradientEnabled', dioramaDefaults.gradientEnabled === true),
    gradientIntensity: dioramaNumber('gradientIntensity', 0.1, 1.5),
    keywordColoringEnabled: dioramaSwitch('keywordColoringEnabled', true),
  }
  // Folia lumiere tuning: light field and effects; unknown enums fall back.
  var lumiereDefaults = PREF_DEFAULTS.lumiereTuning
  var storedLumiere = merged.lumiereTuning && typeof merged.lumiereTuning === 'object' ? merged.lumiereTuning : {}
  function lumiereNumber(key, min, max) {
    var value = Number(storedLumiere[key])
    return isFinite(value) ? Math.min(max, Math.max(min, value)) : lumiereDefaults[key]
  }
  function lumiereSwitch(key, fallback) {
    return typeof storedLumiere[key] === 'boolean' ? storedLumiere[key] : fallback
  }
  merged.lumiereTuning = {
    lightIntensity: lumiereNumber('lightIntensity', 0.3, 2),
    audioResponse: lumiereNumber('audioResponse', 0, 2),
    fogDensity: lumiereNumber('fogDensity', 0, 2),
    darkField: lumiereNumber('darkField', 0, 1),
    moteAmount: lumiereNumber('moteAmount', 0, 2),
    bloom: lumiereNumber('bloom', 0, 2),
    textBloom: lumiereNumber('textBloom', 0, 2),
    unlitOpacity: lumiereNumber('unlitOpacity', 0.05, 0.6),
    windowNeighbors: Math.round(lumiereNumber('windowNeighbors', 1, 2)),
    decay: lumiereNumber('decay', 0, 2),
    echo: lumiereNumber('echo', 0, 2),
    fogOctaves: Math.round(lumiereNumber('fogOctaves', 1, 8)),
    lineArt: lumiereSwitch('lineArt', true),
    frontBokeh: lumiereSwitch('frontBokeh', true),
    trails: lumiereSwitch('trails', true),
    hideTrails: lumiereSwitch('hideTrails', false),
    seamlessTransitions: lumiereSwitch('seamlessTransitions', true),
    overlayFrame: lumiereSwitch('overlayFrame', true),
    textOnly: lumiereSwitch('textOnly', false),
    keywordColors: lumiereSwitch('keywordColors', true),
    themeIcons: lumiereSwitch('themeIcons', true),
    themeColorMix: lumiereNumber('themeColorMix', 0, 1),
    renderQuality: ['full', 'balanced', 'low'].indexOf(storedLumiere.renderQuality) >= 0 ? storedLumiere.renderQuality : 'full',
  }
  // Folia machi tuning: scene/time/weather/camera and lens; quality uses the upstream default.
  var machiDefaults = PREF_DEFAULTS.machiTuning
  var storedMachi = merged.machiTuning && typeof merged.machiTuning === 'object' ? merged.machiTuning : {}
  function machiChoice(key, choices) {
    return choices.indexOf(storedMachi[key]) >= 0 ? storedMachi[key] : machiDefaults[key]
  }
  function machiNumber(key, min, max) {
    var value = Number(storedMachi[key])
    return isFinite(value) ? Math.min(max, Math.max(min, value)) : machiDefaults[key]
  }
  merged.machiTuning = {
    scene: machiChoice('scene', ['auto', 'konbini', 'station', 'kowloon']),
    timeOfDay: machiChoice('timeOfDay', ['auto', 'day', 'dusk', 'night']),
    weather: machiChoice('weather', ['auto', 'clear', 'rain', 'snow', 'fog']),
    camera: machiChoice('camera', ['default', 'custom']),
    motion: storedMachi.motion === true,
    motionSpeed: machiNumber('motionSpeed', 0.25, 3),
    aperture: machiNumber('aperture', 1.4, 16),
    dof: machiNumber('dof', 0, 2),
    dofRange: machiNumber('dofRange', 0.3, 3),
    tiltShift: machiNumber('tiltShift', 0, 1),
    focus: machiChoice('focus', ['center', 'lyrics', 'manual']),
    focusOffset: machiNumber('focusOffset', -10, 10),
    simulatedBeat: storedMachi.simulatedBeat !== false,
  }
  // Folia sonnet tuning: ranges and switches from its resolve().
  var sonnetDefaults = PREF_DEFAULTS.sonnetTuning
  var storedSonnet = merged.sonnetTuning && typeof merged.sonnetTuning === 'object' ? merged.sonnetTuning : {}
  function sonnetNumber(key, min, max) {
    var value = Number(storedSonnet[key])
    return isFinite(value) ? Math.min(max, Math.max(min, value)) : sonnetDefaults[key]
  }
  function sonnetSwitch(key, fallback) {
    return typeof storedSonnet[key] === 'boolean' ? storedSonnet[key] : fallback
  }
  merged.sonnetTuning = {
    cameraIntensity: sonnetNumber('cameraIntensity', 0, 2),
    typographyMotion: sonnetNumber('typographyMotion', 0, 2),
    mgDensity: sonnetNumber('mgDensity', 0, 2),
    showOnlyText: sonnetSwitch('showOnlyText', false),
    showGuide: sonnetSwitch('showGuide', true),
    showBackgroundMg: sonnetSwitch('showBackgroundMg', true),
    showFixedGeo: sonnetSwitch('showFixedGeo', true),
    showGiantDecorativeText: sonnetSwitch('showGiantDecorativeText', true),
    showBackgroundDecor: sonnetSwitch('showBackgroundDecor', true),
    enableTransitions: sonnetSwitch('enableTransitions', true),
    outerFrameMode: ['none', 'frame', 'full'].indexOf(storedSonnet.outerFrameMode) >= 0 ? storedSonnet.outerFrameMode : 'full',
    textureResolution: sonnetNumber('textureResolution', 0.5, 4),
    postProcessEnabled: sonnetSwitch('postProcessEnabled', sonnetDefaults.postProcessEnabled === true),
    postProcessGrain: sonnetNumber('postProcessGrain', 0, 1),
    postProcessContrast: sonnetNumber('postProcessContrast', 0, 1),
    postProcessRgbShift: sonnetNumber('postProcessRgbShift', 0, 1),
    postProcessHalftone: sonnetNumber('postProcessHalftone', 0, 1),
    postProcessVignette: sonnetNumber('postProcessVignette', 0, 2),
    postProcessLensDistortion: sonnetNumber('postProcessLensDistortion', 0, 2),
    postProcessLensDispersion: sonnetNumber('postProcessLensDispersion', 0, 1),
  }
  // Folia cadenza tuning: font/width ratios plus motion and glow.
  var cadenzaDefaults = PREF_DEFAULTS.cadenzaTuning
  var storedCadenza = merged.cadenzaTuning && typeof merged.cadenzaTuning === 'object' ? merged.cadenzaTuning : {}
  function cadenzaNumber(key, min, max) {
    var value = Number(storedCadenza[key])
    return isFinite(value) ? Math.min(max, Math.max(min, value)) : cadenzaDefaults[key]
  }
  merged.cadenzaTuning = {
    fontScale: cadenzaNumber('fontScale', 0.7, 1.5),
    widthRatio: cadenzaNumber('widthRatio', 0.3, 1),
    motionAmount: cadenzaNumber('motionAmount', 0, 2),
    glowIntensity: cadenzaNumber('glowIntensity', 0, 2),
  }
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
    showTranslation: typeof storedCladdagh.showTranslation === 'boolean' ? storedCladdagh.showTranslation : claddaghDefaults.showTranslation === true,
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
  var subtitleFontScale = Number(merged.subtitleFontScale)
  if (!isFinite(subtitleFontScale) || subtitleFontScale < 0.85 || subtitleFontScale > 1.4) {
    merged.subtitleFontScale = PREF_DEFAULTS.subtitleFontScale
  }
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

/**
 * A preference's factory default, deep-copied so the caller can store it without mutating
 * PREF_DEFAULTS. The look tab's 重置 writes one of these back (Folia's tuning defaults).
 */
function prefDefaultOf(key) {
  var value = PREF_DEFAULTS[key]
  if (value === undefined) return undefined
  if (value === null || typeof value !== 'object') return value
  try {
    return JSON.parse(JSON.stringify(value))
  } catch (error) {
    return undefined
  }
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





