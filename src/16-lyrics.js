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

function mergeLyricTranslation(lines, translationText) {
  var translated = parseLrcText(translationText)
  lines.forEach(function (line) {
    var best = null
    var bestDiff = Infinity
    for (var i = 0; i < translated.length; i += 1) {
      var diff = Math.abs(translated[i].time - line.time)
      if (diff <= 0.35 && diff < bestDiff) {
        best = translated[i]
        bestDiff = diff
      }
    }
    if (best !== null) line.translation = best.text
  })
  return lines
}

/** Split `online:<provider>:<id>` (null when the path is a local one). */
function onlinePathOf(path) {
  var match = /^online:([^:]+):(.+)$/.exec(String(path || ''))
  return match === null ? null : { provider: match[1], id: match[2] }
}
