/**
 * Self-contained EBU R128 integrated-loudness analysis.
 *
 * The browser's own decoder + OfflineAudioContext provide the K-weighting
 * filters, so no ffmpeg or npm runtime is required. Results are cached by
 * track path + file size and applied through the player's GainNode.
 */

var LOUDNESS_CACHE_KEY = 'music.loudness.v1'
var LOUDNESS_TARGET = -16
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

function lookupLoudnessGain(key) {
  var row = loudnessCache[key]
  var gain = row && Number(row.gainDb)
  return Number.isFinite(gain) ? gain : null
}

function storeLoudnessGain(key, gainDb) {
  loudnessCache[key] = { gainDb: gainDb, at: Date.now() }
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
  var Ctor = window.AudioContext || window.webkitAudioContext
  if (!Ctor) return null
  try {
    loudnessDecoder = new Ctor()
  } catch (error) {
    loudnessDecoder = null
  }
  return loudnessDecoder
}

/** Integrated loudness in LUFS, following ITU-R BS.1770-4 / EBU R128. */
function lufsFromAudioBuffer(buffer) {
  var Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext
  if (!Offline) return Promise.reject(new Error('OfflineAudioContext unavailable'))
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

function analyzeLoudnessBlob(item, blob, isCurrent, onGain) {
  if (!item || !blob || typeof isCurrent !== 'function') return Promise.resolve(null)
  var key = loudnessCacheKey(item, blob)
  var cached = lookupLoudnessGain(key)
  if (cached !== null) {
    if (isCurrent() && typeof onGain === 'function') onGain(cached)
    return Promise.resolve(cached)
  }
  var decoder = loudnessContext()
  if (decoder === null) return Promise.resolve(null)
  return blob
    .arrayBuffer()
    .then(function (bytes) {
      return decoder.decodeAudioData(bytes)
    })
    .then(function (buffer) {
      if (!isCurrent()) return null
      return lufsFromAudioBuffer(buffer)
    })
    .then(function (lufs) {
      if (lufs === null || !isCurrent()) return null
      var gainDb = clamp(LOUDNESS_TARGET - lufs, -15, 6)
      storeLoudnessGain(key, gainDb)
      if (typeof onGain === 'function') onGain(gainDb)
      return gainDb
    })
    .catch(function () {
      // Corrupt/unsupported file: keep the user volume.
      return null
    })
}
