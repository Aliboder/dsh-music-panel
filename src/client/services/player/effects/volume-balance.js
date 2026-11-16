/**
 * 音量平衡 — the decision Folia's `balanceRules.ts` makes for ReplayGain mode `auto`.
 *
 * Same constants and same order of trust: a whole-track reading beats a tag, a tag
 * beats an estimate, and an estimate may only turn a song down. The reading itself
 * (BS.1770 / EBU R128) lives in 35-loudness.js.
 */

var VOLUME_BALANCE_TARGET_DB = -14
var VOLUME_BALANCE_MAX_BOOST_DB = 6
var VOLUME_BALANCE_PEAK_CEILING_DB = -1.5
var TAG_TARGET_OFFSET_DB = 4
var VOLUME_BALANCE_TYPICAL_SIZE = 20
var VOLUME_BALANCE_TYPICAL_FALLBACK_DB = -5

/** A gain that may lift: no more than the cap, and only while the peak stays under the ceiling. */
function liftWithinPeak(gainDb, peak) {
  if (gainDb <= 0) return gainDb
  if (!(typeof peak === 'number' && peak > 0)) return 0
  var headroomDb = VOLUME_BALANCE_PEAK_CEILING_DB - 20 * Math.log10(peak)
  return Math.min(gainDb, VOLUME_BALANCE_MAX_BOOST_DB, Math.max(0, headroomDb))
}

/** Median of the last readings, never a lift. */
function typicalGainDb(gains) {
  var recent = (gains || [])
    .slice(-VOLUME_BALANCE_TYPICAL_SIZE)
    .filter(function (value) {
      return typeof value === 'number' && isFinite(value)
    })
    .sort(function (a, b) {
      return a - b
    })
  if (recent.length === 0) return VOLUME_BALANCE_TYPICAL_FALLBACK_DB
  var middle = Math.floor(recent.length / 2)
  var median = recent.length % 2 ? recent[middle] : (recent[middle - 1] + recent[middle]) / 2
  return Math.min(0, median)
}

/**
 * The most trusted reading available, and the gain it gives.
 *
 * @param {{ file?: {loudness:number, peak?:number}, tag?: {gainDb:number, peak?:number}, typicalDb?: number }} inputs
 */
function chooseBalance(inputs) {
  var file = inputs && inputs.file
  if (file && typeof file.loudness === 'number' && file.loudness > -70) {
    var measured = VOLUME_BALANCE_TARGET_DB - file.loudness
    return { reading: 'file', gainDb: measured, effectiveGainDb: liftWithinPeak(measured, file.peak), estimated: false }
  }
  var played = inputs && inputs.played
  if (played && typeof played.loudness === 'number' && played.loudness > -70) {
    var fromPlayed = VOLUME_BALANCE_TARGET_DB - played.loudness
    return { reading: 'played', gainDb: fromPlayed, effectiveGainDb: liftWithinPeak(fromPlayed, played.peak), estimated: false }
  }
  var tag = inputs && inputs.tag
  if (tag && typeof tag.gainDb === 'number' && isFinite(tag.gainDb)) {
    var fromTag = tag.gainDb + TAG_TARGET_OFFSET_DB
    return { reading: 'tag', gainDb: fromTag, effectiveGainDb: liftWithinPeak(fromTag, tag.peak), estimated: false }
  }
  var live = inputs && typeof inputs.live === 'number' && isFinite(inputs.live) ? VOLUME_BALANCE_TARGET_DB - inputs.live : null
  if (live !== null) {
    // An estimate only turns a song down.
    return { reading: 'live', gainDb: live, effectiveGainDb: Math.min(0, live), estimated: true }
  }
  var typical =
    inputs && typeof inputs.typicalDb === 'number' && isFinite(inputs.typicalDb)
      ? inputs.typicalDb
      : VOLUME_BALANCE_TYPICAL_FALLBACK_DB
  return { reading: 'typical', gainDb: typical, effectiveGainDb: Math.min(0, typical), estimated: true }
}

/** What the balance decided for the playing song, for the 音频增益 row. */
var balanceStore = createStore({ gainDb: 0, estimated: false, reading: '' })

function setBalanceChoice(choice) {
  balanceStore.set({
    gainDb: Number(choice && choice.effectiveGainDb) || 0,
    estimated: Boolean(choice && choice.estimated),
    reading: String((choice && choice.reading) || ''),
  })
}

/** Smaller differences are not a move. */
var BALANCE_SAME_GAIN_DB = 0.05
var BALANCE_EARLY_MOVE_SEC = 10
var BALANCE_EARLY_RAMP_SEC = 2
var BALANCE_LATE_MOVE_SEC = 30
var BALANCE_LATE_RAMP_SEC = 5
var BALANCE_LATE_MIN_CUT_DB = 3

/**
 * What a better reading may do to a song already sounding: 'set' before it starts,
 * the one eased move of the play, or null (the next play uses it).
 */
function planBalanceMove(question) {
  var nextDb = Number(question.nextDb)
  var currentDb = Number(question.currentDb) || 0
  if (!isFinite(nextDb)) return null
  if (Math.abs(nextDb - currentDb) < BALANCE_SAME_GAIN_DB) return null
  if (question.playSec <= 0) return 'set'
  if (question.moved) return null
  if (question.playSec < BALANCE_EARLY_MOVE_SEC) return BALANCE_EARLY_RAMP_SEC
  if (question.playSec < BALANCE_LATE_MOVE_SEC && nextDb <= currentDb - BALANCE_LATE_MIN_CUT_DB) return BALANCE_LATE_RAMP_SEC
  return null
}