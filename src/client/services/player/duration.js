/**
 * One duration for every seek surface.
 *
 * MediaSource reports only the appended prefix until more data lands, and an
 * <audio> element starts at 0 before metadata. The scanned track length is the
 * full-song ceiling; never let the smaller, still-growing media duration win.
 */
/**
 * A preview clip IS the file: its media duration is the truth for the clock and the seek
 * bar (Folia reads the stage duration from the element). Everything else keeps the larger
 * of the two, because MediaSource reports only the appended prefix until more data lands.
 */
function effectivePlayerDuration(mediaDuration, trackDuration, preview) {
  var media = Number(mediaDuration)
  var known = Number(trackDuration)
  var mediaKnown = isFinite(media) && media > 0 ? media : 0
  var trackKnown = isFinite(known) && known > 0 ? known : 0
  if (preview === true) return mediaKnown > 0 ? mediaKnown : trackKnown
  return Math.max(mediaKnown, trackKnown)
}
