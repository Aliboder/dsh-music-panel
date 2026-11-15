/**
 * LRC parsing, translation merge and online path helpers.
 *
 * Extracted from client.js at the 0.11.1 baseline (3931c14).
 */

// ── online lyric helpers ──────────────────────────────────────────────
// The Host returns raw LRC for online tracks (local tracks get parsed lines
// from /lyrics), so the client needs a small parser of its own.
function parseLrcText(text) {
  var lines = []
  String(text || '')
    .split(/\r?\n/)
    .forEach(function (raw) {
      var match = /^\[(\d{1,2}):(\d{1,2}(?:\.\d+)?)\](.*)$/.exec(raw.trim())
      if (match === null) return
      var time = Number(match[1]) * 60 + Number(match[2])
      if (!isFinite(time)) return
      var content = match[3].trim()
      for (var i = 0; i < lines.length; i += 1) {
        if (lines[i].time === time) {
          if (lines[i].text === '' && content !== '') lines[i].text = content
          return
        }
      }
      lines.push({ time: time, text: content, translation: '' })
    })
  lines.sort(function (left, right) {
    return left.time - right.time
  })
  return lines
}

function isLyricMetadata(text) {
  var value = String(text || '').trim()
  if (value === '') return true
  if (/^(作词|作曲|编曲|制作|监制|出品|发行|录音|混音|母带|和声|吉他|贝斯|鼓|键盘|弦乐|词|曲)\s*[:：]/i.test(value)) {
    return true
  }
  return /^(lyrics?|composed|composer|arranged|arranger|producer|produced|mixed|mastered|written|music|words)\b[^:：]{0,24}[:：]/i.test(value)
}

function mergeLyricTranslation(lines, translationText) {
  var translated = parseLrcText(translationText)
  if (translated.length === 0) return lines

  // Match one translation line to one lyric line, globally nearest-first.
  // The old per-line nearest lookup reused the first translation on every
  // credit/meta line within 350ms (e.g. 作词/作曲/编曲 before the first verse).
  var candidates = []
  for (var i = 0; i < lines.length; i += 1) {
    var line = lines[i]
    if (isLyricMetadata(line.text)) continue
    for (var j = 0; j < translated.length; j += 1) {
      if (isLyricMetadata(translated[j].text)) continue
      var diff = Math.abs(translated[j].time - line.time)
      if (diff <= 0.35) candidates.push({ line: i, trans: j, diff: diff })
    }
  }
  candidates.sort(function (left, right) {
    if (left.diff !== right.diff) return left.diff - right.diff
    return left.line - right.line
  })
  var usedLines = {}
  var usedTrans = {}
  candidates.forEach(function (pair) {
    if (usedLines[pair.line] === true || usedTrans[pair.trans] === true) return
    var line = lines[pair.line]
    var text = translated[pair.trans].text
    if (isLyricMetadata(text)) return
    line.translation = text
    usedLines[pair.line] = true
    usedTrans[pair.trans] = true
  })
  return lines
}

/** Canonical `[mm:ss.xx]` used when writing translated lyrics back to a file. */
function formatLrcTime(seconds) {
  var total = Math.max(0, Number(seconds) || 0)
  var minutes = Math.floor(total / 60)
  var rest = total - minutes * 60
  var whole = Math.floor(rest)
  var centis = Math.round((rest - whole) * 100)
  if (centis >= 100) {
    centis = 0
    whole += 1
  }
  if (whole >= 60) {
    whole -= 60
    minutes += 1
  }
  return '[' + pad2(minutes) + ':' + pad2(whole) + '.' + pad2(centis) + ']'
}

/**
 * Serialize parsed lines with translations back to the common bilingual LRC
 * shape: each translation repeats the original line's timestamp.
 *
 *   [00:05.12]原词
 *   [00:05.12]翻译词
 *
 * Metadata tags ([ti:], [ar:], [offset:], ...) are carried over unchanged.
 */
function buildTranslatedLrc(lines, sourceText) {
  var prefix = String(sourceText || '')
    .split(/\r?\n/)
    .filter(function (line) {
      return /^\s*\[[A-Za-z#]+:[^\]]*\]/.test(line)
    })
  var body = []
  ;(Array.isArray(lines) ? lines : []).forEach(function (line) {
    if (!line || !isFinite(line.time) || line.time < 0) return
    var stamp = formatLrcTime(line.time)
    var text = String(line.text || '')
    var translation = String(line.translation || '')
    if (text === '' && translation === '') return
    if (text !== '') body.push(stamp + text)
    if (translation !== '') {
      translation.split(/\r?\n/).forEach(function (part) {
        if (part !== '') body.push(stamp + part)
      })
    }
  })
  return prefix.concat(body).join('\n')
}

/** Split `online:<provider>:<id>` (null when the path is a local one). */
function onlinePathOf(path) {
  var match = /^online:([^:]+):(.+)$/.exec(String(path || ''))
  return match === null ? null : { provider: match[1], id: match[2] }
}

// ── word-level (karaoke) timeline ──────────────────────────────────────
// The Host returns `lines` from `/lyric/new` (word timing in seconds) next to
// the LRC text. Attach it to the parsed lines by timestamp so the player can
// colour each word as it is sung; tracks without it keep line-level colouring.

/**
 * Merge word timelines into parsed LRC lines, nearest-first and one-to-one.
 * @param {Array<{time:number,text:string,translation:string}>} lines
 * @param {Array<{t:number,end:number,words?:Array<{t:number,end:number,text:string}>}>} wordLines
 */
function attachWordTimeline(lines, wordLines) {
  if (!Array.isArray(lines) || lines.length === 0) return lines
  if (!Array.isArray(wordLines) || wordLines.length === 0) return lines
  var pool = wordLines.filter(function (row) {
    return row && Array.isArray(row.words) && row.words.length > 0 && isFinite(Number(row.t))
  })
  if (pool.length === 0) return lines

  var used = {}
  lines.forEach(function (line) {
    if (!line || !isFinite(line.time) || line.time < 0) return
    var best = -1
    var bestDiff = Infinity
    for (var i = 0; i < pool.length; i += 1) {
      if (used[i] === true) continue
      var diff = Math.abs(Number(pool[i].t) - line.time)
      if (diff < bestDiff) {
        bestDiff = diff
        best = i
      }
    }
    // Credits and translations sit on their own timestamps; 0.6s is enough to
    // match a sung line without stealing a neighbour's timeline.
    if (best < 0 || bestDiff > 0.6) return
    used[best] = true
    line.words = pool[best].words.map(function (word) {
      return {
        t: Number(word.t) || 0,
        end: Number(word.end) || 0,
        text: String(word.text || ''),
      }
    })
    if (isFinite(Number(pool[best].end))) line.end = Number(pool[best].end)
  })
  return lines
}

/**
 * Per-word render state for the active line (null when it has no timeline).
 * @returns {Array<{text:string,sung:boolean}>|null}
 */
function wordSpans(line, atSeconds) {
  if (!line || !Array.isArray(line.words) || line.words.length === 0) return null
  var now = Number(atSeconds)
  if (!isFinite(now)) return null
  return line.words.map(function (word) {
    return { text: word.text, sung: now >= word.t - 0.02 }
  })
}
/**
 * Folia's `LyricData` → the renderer's line shape.
 *
 * Folia's parser owns word timing, translations, romanization and the staff-credit
 * policy; the player and the visualizer read `{time, end, text, translation, words}`.
 * Keeping this the only bridge means the two pipelines cannot drift.
 */
function linesFromFoliaDocument(document) {
  var source = document && Array.isArray(document.lines) ? document.lines : []
  return source
    .map(function (line) {
      if (!line || !isFinite(Number(line.startTime))) return null
      return {
        time: Number(line.startTime) || 0,
        end: Number(line.endTime) || 0,
        text: String(line.fullText || ''),
        translation: typeof line.translation === 'string' ? line.translation : '',
        words: (Array.isArray(line.words) ? line.words : [])
          .filter(function (word) {
            return word && String(word.text || '') !== ''
          })
          .map(function (word) {
            return { t: Number(word.startTime) || 0, end: Number(word.endTime) || 0, text: String(word.text || '') }
          }),
        isChorus: line.isChorus === true,
        // The original Folia Line, untouched: visualizer styles read fields the
        // renderer does not use (renderHints, wordSegments, chorusEffect, …).
        folia: line,
      }
    })
    .filter(function (line) {
      return line !== null && line.text !== ''
    })
}

/**
 * Folia's per-song manual timeline offset (lyricOffsetMemory): a number remembered
 * per song, restored when that song plays again. Online tracks had no offset control
 * at all before this; local tracks keep the host's file-level offset as the primary.
 */
function readSavedLyricOffset(path) {
  if (typeof MPFoliaLyrics === 'undefined' || MPFoliaLyrics === null) return 0
  if (typeof MPFoliaLyrics.readLyricOffset !== 'function') return 0
  var value = Number(MPFoliaLyrics.readLyricOffset(path))
  return isFinite(value) ? value : 0
}

/** Remember (0 forgets) this song's offset. */
function rememberLyricOffset(path, offsetMs) {
  if (typeof MPFoliaLyrics === 'undefined' || MPFoliaLyrics === null) return
  if (typeof MPFoliaLyrics.writeLyricOffset !== 'function') return
  MPFoliaLyrics.writeLyricOffset(path, Number(offsetMs) || 0)
}

/**
 * The listener's lyric line filters, built from the settings page's two lists:
 * ready-made presets (Folia's own ids) and free words (a line containing one goes).
 * Folia's engine (applyLyricLineRules) expects rules with ids and switches.
 */
function lyricFilterRules() {
  var state = typeof prefsStore !== 'undefined' && prefsStore !== null ? prefsStore.get() : {}
  var rules = []
  var presets = Array.isArray(state.lyricFilterPresets) ? state.lyricFilterPresets : []
  presets.forEach(function (id) {
    if (typeof id !== 'string' || id === '') return
    rules.push({ id: 'preset:' + id, on: true, shape: 'preset', text: id })
  })
  var words = String(state.lyricFilterWords || '')
  words
    .split(/[\n,，]/)
    .map(function (word) {
      return word.trim()
    })
    .filter(function (word) {
      return word !== ''
    })
    .forEach(function (word, index) {
      rules.push({ id: 'word:' + String(index), on: true, shape: 'contains', text: word })
    })
  return rules
}

/**
 * icu-folia's engines, from the Host's data (lib/assets/icu-folia, served gzipped).
 * Folia loads them as lazy Vite chunks; the plugin has one client script, so they are
 * fetched once on demand and the result is memoised. Resolves false when unavailable.
 */
var icuFoliaPromise = null
// The lyrics shown when the engines finish loading are re-baked exactly once.
var icuFoliaRebaked = false
function ensureIcuFoliaData() {
  if (typeof MPFoliaLyrics === 'undefined' || MPFoliaLyrics === null) return Promise.resolve(false)
  if (typeof MPFoliaLyrics.loadIcuFoliaFromData !== 'function') return Promise.resolve(false)
  if (icuFoliaPromise !== null) return icuFoliaPromise
  icuFoliaPromise = Promise.all([
    fetch(API + 'assets/icu-folia/dict.json.gz').then(function (response) { return response.json() }),
    fetch(API + 'assets/icu-folia/hmm.json.gz').then(function (response) { return response.json() }),
  ])
    .then(function (data) {
      return MPFoliaLyrics.loadIcuFoliaFromData({ dict: data[0], hmm: data[1] })
    })
    .catch(function () {
      return false
    })
  return icuFoliaPromise
}
