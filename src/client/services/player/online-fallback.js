/**
 * Pure decisions for an online stream that cannot stay in MediaSource.
 *
 * Chromium gives an audio SourceBuffer roughly 12 MiB. A long 320 kbps track is
 * larger than that, so the player must stream it through the media element instead
 * of appending the whole file. These helpers keep the threshold and the resume
 * decision testable without a browser.
 */

var MP_MSE_MAX_STREAM_BYTES = 10 * 1024 * 1024

/** Total bytes of the resource; Content-Range's total wins over a partial length. */
function mpStreamTotalBytes(headers) {
  if (!headers || typeof headers.get !== 'function') return null
  var range = headers.get('content-range')
  if (typeof range === 'string' && range !== '') {
    var slash = range.lastIndexOf('/')
    if (slash >= 0) {
      var total = Number(range.slice(slash + 1))
      if (isFinite(total) && total > 0) return total
    }
  }
  var length = Number(headers.get('content-length'))
  return isFinite(length) && length > 0 ? length : null
}

function mpMseStreamTooLarge(headers, limit) {
  var cap = typeof limit === 'number' && isFinite(limit) && limit > 0 ? limit : MP_MSE_MAX_STREAM_BYTES
  var total = mpStreamTotalBytes(headers)
  return total !== null && total > cap
}

/**
 * What the listener asked for at the moment MSE failed. A pending autoplay, an
 * already-playing deck, or an element that is mid-play all mean "keep going"; a
 * deliberate pause means "stay paused". The position is kept separately so direct
 * playback can resume where MSE stopped.
 */
function mpFallbackPlaybackState(input) {
  var source = input || {}
  var shouldResume = source.pendingAutoplay === true || source.playing === true ||
    (source.paused === false && source.ended !== true)
  var seconds = Number(source.currentTime)
  var resumeAt = isFinite(seconds) && seconds > 0.5 ? seconds : null
  return { shouldResume: shouldResume, resumeAt: resumeAt }
}
