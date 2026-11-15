/**
 * Lyric source registry — a port of Folia's `src/utils/lyrics/lyricSources.ts`.
 *
 * One entry per place a song's lyrics can come from, in the order the automatic
 * pick asks them after the preferred one. Every list, order and capability check
 * about a source is read from here.
 *
 * @module dsh-music-panel/lyrics-sources
 */

/**
 * @typedef {object} LyricSourceEntry
 * @property {string} id
 * @property {boolean} platform        the platform's own catalogue (searched by text)
 * @property {boolean} [needsAccount]  usable only while signed in
 * @property {boolean} [needsConfiguredProvider]
 * @property {boolean} [linesOnly]     line-level lyrics only, no word timing
 * @property {boolean} [localMetadataIdentity]
 * @property {boolean} [platformLyricSearch] true when the source is searched via its platform search
 */

/** @type {readonly LyricSourceEntry[]} */
export const LYRIC_SOURCES = [
  // Folia's order: netease → amll → qq → kugou, with our Bodian source after it.
  { id: 'netease', platform: false, localMetadataIdentity: true, platformLyricSearch: true },
  // AMLL TTML DB keeps lyrics under NetEase / QQ song ids and is reached through them.
  { id: 'amll', platform: false },
  { id: 'qq', platform: false, localMetadataIdentity: true, platformLyricSearch: true },
  { id: 'kugou', platform: false, localMetadataIdentity: true, platformLyricSearch: true },
  { id: 'bodian', platform: false, platformLyricSearch: true },
]

export const LYRIC_SOURCE_IDS = LYRIC_SOURCES.map((source) => source.id)

const BY_ID = new Map(LYRIC_SOURCES.map((source) => [source.id, source]))

export function isLyricSource(id) {
  return BY_ID.has(id)
}

export function getLyricSource(id) {
  return BY_ID.get(id)
}

/** The source whose lyrics a song of `providerId` has as its own. */
export function getPlatformLyricSource(providerId) {
  const source = BY_ID.get(String(providerId ?? ''))
  return source !== undefined && source.platformLyricSearch === true ? source : undefined
}

/**
 * Preferred source first, then the registry order, skipping what is not offered.
 *
 * @param {string} [preferred]
 * @param {(source: LyricSourceEntry) => boolean} [isOffered]
 */
export function buildLyricSourceOrder(preferred, isOffered) {
  const allowed = typeof isOffered === 'function' ? isOffered : () => true
  const order = []
  const wanted = BY_ID.get(String(preferred ?? ''))
  if (wanted !== undefined && allowed(wanted)) order.push(wanted)
  for (const source of LYRIC_SOURCES) {
    if (source.id === wanted?.id) continue
    if (allowed(source)) order.push(source)
  }
  return order
}

/**
 * Which sources may be asked right now.
 *
 * @param {{ platform: string, hasAccount?: boolean, configured?: Record<string, boolean> }} context
 */
export function offeredSources(context) {
  return buildLyricSourceOrder(context.platform, (source) => {
    if (source.id === 'amll') return true
    if (source.needsConfiguredProvider === true && context.configured?.[source.id] === false) return false
    if (source.needsAccount === true && context.hasAccount !== true) return false
    return LYRIC_SOURCES.some((entry) => entry.id === source.id)
  }).map((source) => source.id)
}
