/**
 * Folia playbackNeighbors — the pure queue index rules for next/prev.
 *
 * Ported from Folia: src/utils/playbackNeighbors.ts
 * The plugin has no FM/stage mode yet, so the index helpers are kept verbatim.
 */

/** Next queue index; -1 at the end unless list loop wraps. */
function nextQueueIndex(queueLength, currentIndex, loopMode) {
  if (queueLength <= 0) return -1
  if (currentIndex < 0) return 0
  if (currentIndex < queueLength - 1) return currentIndex + 1
  return loopMode === 'all' ? 0 : -1
}

/** Previous queue index; -1 at the start unless list loop wraps. */
function prevQueueIndex(queueLength, currentIndex, loopMode) {
  if (currentIndex > 0) return currentIndex - 1
  return loopMode === 'all' ? queueLength - 1 : -1
}

/** Whether another track follows, for crossfade/prefetch decisions. */
function hasTrackAfter(queueLength, currentIndex, loopMode) {
  return (currentIndex >= 0 && currentIndex < queueLength - 1) || (loopMode === 'all' && queueLength > 1)
}
