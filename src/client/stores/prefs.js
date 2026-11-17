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
  circularCover: false,
  coverStyle: 'square',
  vinylRing: false,
  npLookMigrated: true,
  coverSpin: true,
  /**
   * Folia's `localLyricsPriority`: which lyric a local file shows when it has both
   * its own file lyric and a matched online one. 'local' keeps the file's own.
   */
  lyricLocalPriority: 'local',
  /** Folia's `preferredAlternativeLyricSource`: asked first when another source is searched. */
  lyricPreferredSource: 'qq',
  /**
   * Folia's `keepProviderWordTiming`: keep a platform's own word timing over another
   * source's. The plugin has no `prefersOwnWordByWord` platform (Apple Music), so this
   * is stored for parity and consumed where a provider declares it.
   */
  lyricKeepProviderWordTiming: true,
  /** Folia's `subtitleOverlayBackground`: a soft halo behind the bottom subtitle line. */
  subtitleOverlayBackground: true,
  /** Folia's `localLyricFormatOrder`: which sidecar lyric file wins when several exist. */
  lyricFormatOrder: ['lrc', 'vtt', 'ttml', 'qrc', 'yrc', 'krc'],
  /** Preferred online audio level: standard | high | lossless | hires. */
  onlineQuality: 'high',
  /**
   * Folia's `enableMediaCache`: cache a song's audio only after it was played through.
   * Off by default, exactly as upstream; reads use the cache either way.
   */
  onlineCacheEnabled: false,
  /** Folia's `mediaCacheLimitGb`: 1/2/5/10/20/50, 0 = no ceiling. */
  onlineCacheLimitGb: 5,
  lyricAlign: 'left',
  lyricSize: 35,
  lyricGap: 15,
  lyricBlur: true,
  waveEnabled: true,
  showTranslation: true,
  translationScale: 90,
  npLayoutV2: false,
  /** Lyrics column width in the player page (px), dragged by the splitter. */
  npLyricWidth: 560,
  /** Gap between the album column and the lyrics column (px), editable in the player editor. */
  npPaneGap: 60,
  /** Animated flowing-light background on the player page. */
  npFlowBg: true,
  /** Hide the ambient art behind the player page (the card's 透明背景 switch). */
  npTransparentBg: false,
  /** 外观: lyric style, Folia shell background and where the accent comes from (28-look.js). */
  lyricStyle: 'monet',
  /** Folia's calm/normal/chaotic chip (used by the styles' animation tuning). */
  lyricIntensity: 'normal',
  /**
   * Folia's `autoUseBestLyric`: when the platform's own lyric has no word-level timing,
   * ask the other lyric sources for a matched word-by-word one. On by default there too.
   */
  autoUseBestLyric: true,
  /** Global lyric font multiplier (the ≋ quick control). */
  lyricsFontScale: 1,
  bgMode: 'latent',
  /** Folia background blend chip (mix / cover / layers); kept for the controls panel. */
  bgBlend: 'mix',
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
  composerLyrics: false,
  composerTranslation: true,
  composerLyricPlace: 'input-left',
  volume: 1,
  audioOutputDeviceId: '',
  playbackFade: true,
  // Writing a real play to a music account is opt-in, as Folia's scrobble switch is.
  playbackReports: false,
  loop: 'none',
  order: 'list',
  resumeOnStart: true,
  sleepTimerMinutes: 0,
  sleepDeadline: 0,
  autoResume: false,
  rememberPerTrack: false,
  normalizeVolume: true,
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
  /** 0 keeps the old hard cut; a positive value enables the automatic blend. */
  crossfadeSeconds: 0,
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
  try {
    var parsed = JSON.parse(raw)
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return merged
    Object.keys(parsed).forEach(function (key) {
      if (parsed[key] !== undefined && parsed[key] !== null) merged[key] = parsed[key]
    })
  } catch (error) {
    // Corrupt value: defaults stand.
  }
  // The classic renderer is removed; legacy variant ids now select the default Monet style.
  if (['standard', 'glow', 'outline', 'karaoke', 'mirror', 'classic', 'cappella'].indexOf(merged.lyricStyle) >= 0) merged.lyricStyle = 'monet'
  merged.composerLyricPlace =
    String(merged.composerLyricPlace || '').indexOf('above') === 0 ? 'above' : 'input-left'
  // The player page switched from the old ambient/flow backdrop to Folia's six shell
  // backgrounds; a stored old id falls back to Folia's default (latent).
  var foliaBackgrounds = ['common', 'monet', 'nomand', 'latent', 'sora', 'url', 'none']
  if (foliaBackgrounds.indexOf(merged.bgMode) < 0) merged.bgMode = 'latent'
  // The old "lyric order" switch is gone: Folia's local/online priority decides, and the
  // sidecar always outranks the embedded lyric. A stored `lyricOrder` is simply ignored.
  delete merged.lyricOrder
  // 0.12.0 briefly defaulted to square covers; restore the 0.11 player look once.
  if (merged.npLookMigrated !== true) {
    merged.circularCover = PREF_DEFAULTS.circularCover
    merged.npLookMigrated = true
    try {
      window.localStorage.setItem(PREFS_KEY, JSON.stringify(merged))
    } catch (error) {
      // Best effort only.
    }
  }
  // One-time move to the reference now-playing layout (square cover, left lyrics,
  // denser lyric typography). Later user edits still win.
  if (merged.npLayoutV2 !== true) {
    merged.coverStyle = PREF_DEFAULTS.coverStyle
    merged.lyricAlign = PREF_DEFAULTS.lyricAlign
    merged.lyricSize = PREF_DEFAULTS.lyricSize
    merged.lyricBlur = PREF_DEFAULTS.lyricBlur
    merged.translationScale = PREF_DEFAULTS.translationScale
    merged.npLayoutV2 = true
    try {
      window.localStorage.setItem(PREFS_KEY, JSON.stringify(merged))
    } catch (error) {
      // Best effort only.
    }
  }
  return merged
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





