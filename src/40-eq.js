/**
 * eq: ten-band graphic equalizer (data + pure math only).
 *
 * The audio graph lives in 50-player; this fragment owns the preset table, the
 * pref normalisation and the frequency-response math used by the editor curve.
 * Everything here is pure so `test/eq.test.mjs` can check it without Web Audio.
 *
 * Bands follow Winamp's ten-band layout because the factory presets below are
 * recorded at exactly these frequencies; switching to ISO spacing would mean
 * re-deriving every preset and losing the original curve.
 */

var EQ_FREQS = [70, 180, 320, 600, 1000, 3000, 6000, 12000, 14000, 16000]

/**
 * Q per band. The first seven are roughly one octave wide; 12k/14k/16k sit
 * within a third of an octave of each other, so they need a narrower Q or a
 * treble boost stacks into a +30 dB shelf.
 */
var EQ_Q = [1.1, 1.1, 1.1, 1.1, 1.1, 1.1, 1.1, 2, 3, 3]

var EQ_MAX_DB = 12
var EQ_PREAMP_MAX = 12
/**
 * Cap on the automatic trim. Compensating the full boosted peak would make a
 * preset like Rock ~10 dB quieter than flat, which reads as a bug to users;
 * the output limiter in the player catches whatever the cap leaves over.
 */
var EQ_HEADROOM_MAX = 6
var EQ_CUSTOM_LIMIT = 20
var EQ_CURVE_POINTS = 64
var EQ_MIN_HZ = 20
var EQ_MAX_HZ = 20000

/**
 * Winamp's original factory presets: ten raw fader values (0..64, 33 = 0 dB)
 * plus a preamp fader. Values transcribed from
 * https://github.com/schollz/Winamp-Original-Presets (resources/Winamp.q1.json).
 */
var EQ_PRESETS = [
  {
    id: 'flat',
    zh: '平直',
    en: 'Flat',
    values: [33, 33, 33, 33, 33, 33, 33, 33, 33, 33],
  },
  {
    id: 'pop',
    zh: '流行',
    en: 'Pop',
    values: [29, 40, 44, 45, 41, 30, 28, 28, 29, 29],
  },
  {
    id: 'rock',
    zh: '摇滚',
    en: 'Rock',
    values: [45, 40, 23, 19, 26, 39, 47, 50, 50, 50],
  },
  {
    id: 'softRock',
    zh: '轻摇滚',
    en: 'Soft rock',
    values: [39, 39, 36, 31, 25, 23, 26, 31, 37, 47],
  },
  {
    id: 'classical',
    zh: '古典',
    en: 'Classical',
    values: [33, 33, 33, 33, 33, 33, 20, 20, 20, 16],
  },
  {
    id: 'dance',
    zh: '舞曲',
    en: 'Dance',
    values: [48, 44, 36, 32, 32, 22, 20, 20, 32, 32],
  },
  {
    id: 'club',
    zh: '俱乐部',
    en: 'Club',
    values: [33, 33, 38, 42, 42, 42, 38, 33, 33, 33],
  },
  {
    id: 'party',
    zh: '派对',
    en: 'Party',
    values: [44, 44, 33, 33, 33, 33, 33, 33, 44, 44],
  },
  {
    id: 'live',
    zh: '现场',
    en: 'Live',
    values: [24, 33, 39, 41, 42, 42, 39, 37, 37, 36],
  },
  {
    id: 'largeHall',
    zh: '大厅',
    en: 'Large hall',
    values: [49, 49, 42, 42, 33, 24, 24, 24, 33, 33],
  },
  {
    id: 'reggae',
    zh: '雷鬼',
    en: 'Reggae',
    values: [33, 33, 31, 22, 33, 43, 43, 33, 33, 33],
  },
  {
    id: 'ska',
    zh: '斯卡',
    en: 'Ska',
    values: [28, 24, 25, 31, 39, 42, 47, 48, 50, 48],
  },
  {
    id: 'techno',
    zh: '电子',
    en: 'Techno',
    values: [45, 42, 33, 23, 24, 33, 45, 48, 48, 47],
  },
  {
    id: 'soft',
    zh: '柔和',
    en: 'Soft',
    values: [40, 35, 30, 28, 30, 39, 46, 48, 50, 52],
  },
  {
    id: 'fullBass',
    zh: '重低音',
    en: 'Full bass',
    values: [48, 48, 48, 42, 35, 25, 18, 15, 14, 14],
  },
  {
    id: 'fullTreble',
    zh: '高音增强',
    en: 'Full treble',
    values: [16, 16, 16, 25, 37, 50, 58, 58, 58, 60],
  },
  {
    id: 'fullBassTreble',
    zh: '高低音增强',
    en: 'Full bass + treble',
    values: [44, 42, 33, 20, 24, 35, 46, 50, 52, 52],
  },
  {
    id: 'laptop',
    zh: '笔记本 / 耳机',
    en: 'Laptop / headphones',
    values: [40, 50, 41, 26, 28, 35, 40, 48, 53, 56],
  },
]

/** Display name for the current UI language. */
function eqPresetName(preset) {
  if (!preset) return ''
  return LANG === 'zh' ? preset.zh || preset.en : preset.en || preset.zh
}

function eqPresetById(id) {
  var key = String(id || '')
  for (var index = 0; index < EQ_PRESETS.length; index += 1) {
    if (EQ_PRESETS[index].id === key) return EQ_PRESETS[index]
  }
  return null
}

/**
 * Winamp fader (0..64, 33 = 0 dB) to decibels. The scale is asymmetric around
 * the centre — 33 steps down, 31 steps up — so map each half separately to keep
 * both extremes at exactly ±12 dB.
 */
function eqFaderToDb(value) {
  var raw = Number(value)
  if (!isFinite(raw)) return 0
  var fader = clamp(raw, 0, 64)
  var db = fader >= 33 ? ((fader - 33) / 31) * EQ_MAX_DB : ((fader - 33) / 33) * EQ_MAX_DB
  return clamp(db, -EQ_MAX_DB, EQ_MAX_DB)
}

function eqBandsForPreset(id) {
  var preset = eqPresetById(id)
  if (preset === null) return zeroEqBands()
  // Whole decibels: the editor faders step by 1 dB, so a preset must land on
  // the same grid or picking it and nudging one band would read as "custom".
  return preset.values.map(function (value) {
    return Math.round(eqFaderToDb(value))
  })
}

function zeroEqBands() {
  return EQ_FREQS.map(function () {
    return 0
  })
}

function roundDecimals(value, digits) {
  var factor = Math.pow(10, digits)
  return Math.round(value * factor) / factor
}

/** Coerce whatever localStorage held into ten finite decibel values. */
function normalizeEqBands(list) {
  if (!Array.isArray(list)) return zeroEqBands()
  return EQ_FREQS.map(function (_, index) {
    var value = Number(list[index])
    if (!isFinite(value)) return 0
    return Math.round(clamp(value, -EQ_MAX_DB, EQ_MAX_DB))
  })
}

/**
 * Resolve the persisted preferences into a complete EQ state. Missing fields
 * keep the EQ off, so upgrades never change how a playlist sounds.
 */
function normalizeEqPrefs(prefs) {
  var source = prefs !== null && typeof prefs === 'object' ? prefs : {}
  var presetId = String(source.eqPreset || 'flat')
  var preset = eqPresetById(presetId)
  var bands
  if (Array.isArray(source.eqBands)) {
    bands = normalizeEqBands(source.eqBands)
  } else {
    bands = preset === null ? zeroEqBands() : eqBandsForPreset(preset.id)
  }
  var savedPreset = presetId === 'custom' ? 'custom' : preset === null ? 'flat' : preset.id
  return {
    enabled: source.eqEnabled === true,
    preset: savedPreset,
    bands: bands,
    preamp: Math.round(clamp(Number(source.eqPreamp) || 0, -EQ_PREAMP_MAX, EQ_PREAMP_MAX)),
  }
}

/** True when the band layout matches a factory preset exactly. */
function eqBandsMatchPreset(bands, presetId) {
  var target = eqBandsForPreset(presetId)
  var list = normalizeEqBands(bands)
  for (var index = 0; index < target.length; index += 1) {
    if (Math.abs(target[index] - list[index]) > 0.05) return false
  }
  return true
}

/** Which factory preset the given bands represent, or 'custom'. */
function eqPresetForBands(bands) {
  for (var index = 0; index < EQ_PRESETS.length; index += 1) {
    if (eqBandsMatchPreset(bands, EQ_PRESETS[index].id)) return EQ_PRESETS[index].id
  }
  return 'custom'
}

/**
 * Peaking sections for the current bands, skipping anything a 0 dB band or the
 * Nyquist limit makes pointless.
 */
function eqSections(bands, sampleRate) {
  var list = normalizeEqBands(bands)
  var rate = isFinite(sampleRate) && sampleRate > 0 ? sampleRate : 44100
  var sections = []
  for (var band = 0; band < EQ_FREQS.length; band += 1) {
    if (EQ_FREQS[band] >= rate / 2) continue
    if (Math.abs(list[band]) < 0.01) continue
    sections.push(eqPeakingCoefficients(EQ_FREQS[band], EQ_Q[band], list[band], rate))
  }
  return sections
}

/**
 * Loudest point of the boosted response. Adjacent bands overlap in phase, so
 * the true peak is above the largest single band; sampling the response keeps
 * the headroom honest instead of guessing from the fader values.
 */
function eqPeakBoostDb(bands, sampleRate) {
  var sections = eqSections(bands, sampleRate)
  if (sections.length === 0) return 0
  var rate = isFinite(sampleRate) && sampleRate > 0 ? sampleRate : 44100
  var lowLog = Math.log(EQ_MIN_HZ)
  var highLog = Math.log(Math.min(EQ_MAX_HZ, rate / 2))
  var peak = 0
  for (var index = 0; index <= 48; index += 1) {
    var freq = Math.exp(lowLog + ((highLog - lowLog) * index) / 48)
    var db = 0
    for (var section = 0; section < sections.length; section += 1) {
      db += eqSectionDb(sections[section], freq, rate)
    }
    if (db > peak) peak = db
  }
  return peak
}

/**
 * Automatic headroom: trim by the boosted peak, capped at EQ_HEADROOM_MAX so a
 * heavy preset stays roughly as loud as flat. Never boosts, so switching the EQ
 * off and on cannot make the track louder.
 */
function eqHeadroomDb(bands) {
  var peak = eqPeakBoostDb(bands, 44100)
  if (!(peak > 0)) return 0
  return -Math.min(roundDecimals(peak, 1), EQ_HEADROOM_MAX)
}

/** Total gain the preamp node should apply, including the headroom trim. */
function eqTotalPreampDb(preamp, bands) {
  var value = clamp(Number(preamp) || 0, -EQ_PREAMP_MAX, EQ_PREAMP_MAX)
  return roundDecimals(value + eqHeadroomDb(bands), 2)
}

function eqDbToLinear(db) {
  return Math.pow(10, (Number(db) || 0) / 20)
}

/**
 * Peaking-filter coefficients, matching the Web Audio `BiquadFilterNode`
 * definition (RBJ audio EQ cookbook). Returned as [b0, b1, b2, a0, a1, a2].
 */
function eqPeakingCoefficients(freq, q, gainDb, sampleRate) {
  var rate = isFinite(sampleRate) && sampleRate > 0 ? sampleRate : 44100
  var f0 = clamp(freq, 10, rate / 2 - 1)
  var amplitude = Math.pow(10, (Number(gainDb) || 0) / 40)
  var omega = (2 * Math.PI * f0) / rate
  var alpha = Math.sin(omega) / (2 * Math.max(0.0001, Number(q) || 1))
  var cos = Math.cos(omega)
  return [
    1 + alpha * amplitude,
    -2 * cos,
    1 - alpha * amplitude,
    1 + alpha / amplitude,
    -2 * cos,
    1 - alpha / amplitude,
  ]
}

/** |H(e^{jw})| for one biquad section, in decibels. */
function eqSectionDb(coefficients, freq, sampleRate) {
  var rate = isFinite(sampleRate) && sampleRate > 0 ? sampleRate : 44100
  var omega = (2 * Math.PI * clamp(freq, 1, rate / 2)) / rate
  var cos1 = Math.cos(-omega)
  var sin1 = Math.sin(-omega)
  var cos2 = Math.cos(-2 * omega)
  var sin2 = Math.sin(-2 * omega)
  var numReal = coefficients[0] + coefficients[1] * cos1 + coefficients[2] * cos2
  var numImag = coefficients[1] * sin1 + coefficients[2] * sin2
  var denReal = coefficients[3] + coefficients[4] * cos1 + coefficients[5] * cos2
  var denImag = coefficients[4] * sin1 + coefficients[5] * sin2
  var numerator = Math.sqrt(numReal * numReal + numImag * numImag)
  var denominator = Math.sqrt(denReal * denReal + denImag * denImag)
  if (!(denominator > 0)) return 0
  return 20 * Math.log10(numerator / denominator)
}

/**
 * Sampled magnitude response of the whole chain (bands + preamp + headroom),
 * log-spaced across the audible range. Used to draw the editor curve.
 */
function eqCurveSamples(bands, preampDb, count, sampleRate) {
  var list = normalizeEqBands(bands)
  var rate = isFinite(sampleRate) && sampleRate > 0 ? sampleRate : 44100
  var points = Math.max(2, Math.floor(Number(count) || EQ_CURVE_POINTS))
  var sections = eqSections(list, rate)
  var total = eqTotalPreampDb(preampDb, list)
  var output = []
  var lowLog = Math.log(EQ_MIN_HZ)
  var highLog = Math.log(Math.min(EQ_MAX_HZ, rate / 2))
  for (var index = 0; index < points; index += 1) {
    var ratio = points === 1 ? 0 : index / (points - 1)
    var freq = Math.exp(lowLog + (highLog - lowLog) * ratio)
    var db = total
    for (var section = 0; section < sections.length; section += 1) {
      db += eqSectionDb(sections[section], freq, rate)
    }
    output.push({ freq: freq, db: db })
  }
  return output
}

/** Frequency marks drawn under the curve. */
function eqCurveTicks() {
  return [70, 180, 320, 600, 1000, 3000, 6000, 12000, 16000]
}
