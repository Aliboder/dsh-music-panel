/**
 * ReplayGain — the gains written into a file's tags, for the 音频增益 row.
 *
 * FLAC keeps them as Vorbis comments (`REPLAYGAIN_TRACK_GAIN` / `..._ALBUM_GAIN`);
 * MP3 keeps them as TXXX frames with the same descriptions. Values look like
 * `-6.60 dB`, so only the number is taken.
 */

const REPLAYGAIN_TRACK_KEY = 'replaygain_track_gain'
const REPLAYGAIN_ALBUM_KEY = 'replaygain_album_gain'

function parseGainDb(value) {
  if (value === undefined || value === null) return null
  const match = String(value).match(/-?\d+(?:\.\d+)?/)
  if (match === null) return null
  const parsed = Number(match[0])
  return Number.isFinite(parsed) ? parsed : null
}

function pickGainFromMap(tagMap) {
  if (tagMap === null || typeof tagMap !== 'object') return { trackGain: null, albumGain: null }
  const lower = {}
  for (const key of Object.keys(tagMap)) lower[String(key).toLowerCase()] = tagMap[key]
  const trackValue = lower[REPLAYGAIN_TRACK_KEY]
  const albumValue = lower[REPLAYGAIN_ALBUM_KEY]
  return {
    trackGain: parseGainDb(Array.isArray(trackValue) ? trackValue[0] : trackValue),
    albumGain: parseGainDb(Array.isArray(albumValue) ? albumValue[0] : albumValue),
  }
}

function pickGainFromId3(id3) {
  const frames = []
  const raw = id3 === null || typeof id3 !== 'object' ? null : id3.userDefinedText
  if (Array.isArray(raw)) frames.push(...raw)
  else if (raw && typeof raw === 'object') frames.push(raw)
  const byDescription = {}
  for (const frame of frames) {
    if (frame === null || typeof frame !== 'object') continue
    const description = String(frame.description || frame.id || '').toLowerCase()
    const text = frame.text !== undefined ? frame.text : frame.value
    if (description === REPLAYGAIN_TRACK_KEY) byDescription.track = text
    if (description === REPLAYGAIN_ALBUM_KEY) byDescription.album = text
  }
  return { trackGain: parseGainDb(byDescription.track), albumGain: parseGainDb(byDescription.album) }
}

/**
 * @param {string} file absolute path already validated against the roots
 * @returns {Promise<{ trackGain: number | null, albumGain: number | null }>}
 */
export async function readReplayGain(file) {
  const format = formatOf(file)
  if (format === null) return { trackGain: null, albumGain: null }
  try {
    if (format === 'flac') {
      const { tagMap } = await readFlacTags(file)
      return pickGainFromMap(tagMap)
    }
    const id3 = NodeID3.read(file, { exclude: ['APIC'] })
    return pickGainFromId3(id3)
  } catch {
    return { trackGain: null, albumGain: null }
  }
}
