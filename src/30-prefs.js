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
  circularCover: true,
  vinylRing: false,
  npLookMigrated: true,
  coverSpin: true,
  lyricOrder: ['embedded', 'lrc'],
  lyricAlign: 'center',
  lyricSize: 18,
  lyricWeight: 500,
  lyricBlur: true,
  showTranslation: true,
  translationScale: 80,
  composerLyrics: false,
  composerLyricPlace: 'input-left',
  volume: 1,
  loop: 'none',
  order: 'list',
  resumeOnStart: true,
  sleepTimerMinutes: 0,
  sleepDeadline: 0,
  autoResume: false,
  rememberPerTrack: false,
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
  merged.composerLyricPlace =
    String(merged.composerLyricPlace || '').indexOf('above') === 0 ? 'above' : 'input-left'
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
