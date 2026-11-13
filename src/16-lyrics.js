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
