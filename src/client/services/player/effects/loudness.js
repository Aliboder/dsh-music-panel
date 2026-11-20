/**
 * Self-contained EBU R128 integrated-loudness analysis.
 *
 * The browser's own decoder + OfflineAudioContext provide the K-weighting
 * filters, so no ffmpeg or npm runtime is required. Results are cached by
 * track path + file size and applied through the player's GainNode.
 */

var LOUDNESS_CACHE_KEY = 'music.loudness.v1'
var LOUDNESS_TARGET = -14
var loudnessDecoder = null
var loudnessCache = readLoudnessCache()

function readLoudnessCache() {
  try {
    var raw = window.localStorage.getItem(LOUDNESS_CACHE_KEY)
    var parsed = raw === null ? null : JSON.parse(raw)
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch (error) {
    return {}
  }
}

function writeLoudnessCache(cache) {
  try {
    window.localStorage.setItem(LOUDNESS_CACHE_KEY, JSON.stringify(cache))
  } catch (error) {
    // Quota/private mode: in-memory cache still works.
  }
}

function loudnessCacheKey(item, blob) {
  return String(item.path || '') + '|' + String(blob.size || 0)
}

function lookupLoudnessMeasurement(key) {
  var row = loudnessCache[key]
  if (!row || typeof row.loudness !== 'number' || !Number.isFinite(row.loudness)) return null
  return { loudness: row.loudness, peak: typeof row.peak === 'number' ? row.peak : null }
}

function storeLoudnessMeasurement(key, measured) {
  loudnessCache[key] = { loudness: measured.loudness, peak: measured.peak, at: Date.now() }
  var keys = Object.keys(loudnessCache)
  if (keys.length > 1200) {
    keys
      .sort(function (left, right) {
        return (loudnessCache[left].at || 0) - (loudnessCache[right].at || 0)
      })
      .slice(0, keys.length - 1200)
      .forEach(function (old) {
        delete loudnessCache[old]
      })
  }
  writeLoudnessCache(loudnessCache)
}

function loudnessContext() {
  if (loudnessDecoder !== null) return loudnessDecoder
  // Folia decodes at 22.05 kHz so the file measurement and the live meter use
  // the same analysis band. decodeAudioData resamples into this context.
  var Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext
  try {
    if (Offline) loudnessDecoder = new Offline(2, 1, 22050)
    else loudnessDecoder = new (window.AudioContext || window.webkitAudioContext)()
  } catch (error) {
    loudnessDecoder = null
  }
  return loudnessDecoder
}

/** Folia's K-weighting + gated loudness, on a decoded buffer. */
function lufsWithFoliaMath(buffer) {
  var api = typeof balanceAudioApi === 'function' ? balanceAudioApi() : null
  if (!api || typeof api.kWeightStep !== 'function' || typeof api.gatedLoudness !== 'function') return null
  var sampleRate = buffer.sampleRate
  var stepLength = Math.round(sampleRate / 10)
  if (!(stepLength > 0)) return null
  var channels = []
  var filters = []
  var count = Math.min(2, buffer.numberOfChannels)
  for (var ch = 0; ch < count; ch += 1) {
    channels.push(buffer.getChannelData(ch))
    filters.push(api.kWeightStep(sampleRate))
  }
  if (channels.length === 0) return null
  var steps = []
  var power = 0
  var filled = 0
  var length = channels[0].length
  for (var index = 0; index < length; index += 1) {
    var weighted = 0
    for (var c = 0; c < channels.length; c += 1) {
      var value = filters[c](channels[c][index])
      weighted += value * value
    }
    power += weighted
    filled += 1
    if (filled === stepLength) {
      steps.push(power / stepLength)
      power = 0
      filled = 0
    }
  }
  var lufs = api.gatedLoudness(steps)
  return Number.isFinite(lufs) && lufs > -90 ? lufs : null
}

/** Integrated loudness in LUFS, following ITU-R BS.1770-4 / EBU R128. */
function lufsFromAudioBuffer(buffer) {
  var Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext
  if (!Offline) return Promise.reject(new Error('OfflineAudioContext unavailable'))
  var folia = lufsWithFoliaMath(buffer)
  if (folia !== null) return Promise.resolve(folia)
  return new Promise(function (resolve, reject) {
    var offline
    try {
      offline = new Offline(buffer.numberOfChannels, buffer.length, buffer.sampleRate)
      var source = offline.createBufferSource()
      source.buffer = buffer
      var shelf = offline.createBiquadFilter()
      shelf.type = 'highshelf'
      shelf.frequency.value = 1681.974450955533
      shelf.gain.value = 3.999843853973347
      shelf.Q.value = 0.7071752369554196
      var highpass = offline.createBiquadFilter()
      highpass.type = 'highpass'
      highpass.frequency.value = 38.13547087602444
      highpass.Q.value = 0.5003270373238773
      source.connect(shelf)
      shelf.connect(highpass)
      highpass.connect(offline.destination)
      source.start()
    } catch (error) {
      reject(error)
      return
    }
    offline
      .startRendering()
      .then(function (rendered) {
        var lufs = integratedLoudnessOf(rendered)
        if (lufs === null) reject(new Error('no gated loudness blocks'))
        else resolve(lufs)
      })
      .catch(reject)
  })
}

/** Mean square per gated 400 ms block, with surround channel weights. */
function integratedLoudnessOf(buffer) {
  var sampleRate = buffer.sampleRate
  var blockSize = Math.round(0.4 * sampleRate)
  var step = Math.round(0.1 * sampleRate)
  if (blockSize <= 0 || buffer.length < blockSize) return null
  var channels = []
  for (var channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    channels.push(buffer.getChannelData(channel))
  }
  var weights = channels.map(function (_, index) {
    return index === 3 || index === 4 ? 1.41 : 1
  })
  var blocks = []
  for (var start = 0; start + blockSize <= buffer.length; start += step) {
    var energy = 0
    for (var ch = 0; ch < channels.length; ch += 1) {
      var data = channels[ch]
      var sum = 0
      for (var i = start; i < start + blockSize; i += 1) sum += data[i] * data[i]
      energy += weights[ch] * (sum / blockSize)
    }
    var loudness = -0.691 + 10 * Math.log10(energy)
    if (loudness > -70) blocks.push({ loudness: loudness, energy: energy })
  }
  if (blocks.length === 0) return null
  var absoluteEnergy =
    blocks.reduce(function (sum, block) {
      return sum + block.energy
    }, 0) / blocks.length
  var relativeGate = -0.691 + 10 * Math.log10(absoluteEnergy) - 10
  var gated = blocks.filter(function (block) {
    return block.loudness > relativeGate
  })
  if (gated.length === 0) return null
  var finalEnergy =
    gated.reduce(function (sum, block) {
      return sum + block.energy
    }, 0) / gated.length
  return -0.691 + 10 * Math.log10(finalEnergy)
}

/** Loudest sample of the decoded file, linear, for the balance's peak ceiling. */
function peakOfAudioBuffer(buffer) {
  var peak = 0
  for (var channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    var data = buffer.getChannelData(channel)
    for (var index = 0; index < data.length; index += 1) {
      var value = data[index] < 0 ? -data[index] : data[index]
      if (value > peak) peak = value
    }
  }
  return peak
}

function analyzeLoudnessBlob(item, blob, isCurrent, onMeasured) {
  if (!item || !blob || typeof isCurrent !== 'function') return Promise.resolve(null)
  var key = loudnessCacheKey(item, blob)
  var cached = lookupLoudnessMeasurement(key)
  if (cached !== null) {
    noteBalanceMeasurement(item.path, 'file', cached)
    if (isCurrent() && typeof onMeasured === 'function') onMeasured(cached)
    return Promise.resolve(cached)
  }
  var decoder = loudnessContext()
  if (decoder === null) return Promise.resolve(null)
  var measuredBuffer = null
  return blob
    .arrayBuffer()
    .then(function (bytes) {
      return decoder.decodeAudioData(bytes)
    })
    .then(function (buffer) {
      if (!isCurrent()) return null
      measuredBuffer = buffer
      return lufsFromAudioBuffer(buffer)
    })
    .then(function (lufs) {
      if (lufs === null || !isCurrent()) return null
      var measured = { loudness: lufs, peak: peakOfAudioBuffer(measuredBuffer) }
      noteBalanceMeasurement(item.path, 'file', measured)
      storeLoudnessMeasurement(key, measured)
      if (typeof onMeasured === 'function') onMeasured(measured)
      return measured
    })
    .catch(function () {
      // Corrupt/unsupported file: keep the user volume.
      return null
    })
}
