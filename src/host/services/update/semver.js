/**
 * Version parsing and comparison for the new-version check.
 *
 * The installed version and the registry's `latest` are both plain semver here, but the
 * comparison keeps the prerelease channels ordered (alpha < beta < rc < release) so a
 * preview build never looks newer than the release it precedes.
 *
 * @module dsh-music-panel/update/semver
 */

const CHANNEL_RANK = { alpha: 1, beta: 2, rc: 3 }
const RELEASE_RANK = 4

/**
 * @param {unknown} value
 * @returns {{major: number, minor: number, patch: number, rank: number, serial: number} | null}
 */
export function parseVersion(value) {
  if (typeof value !== 'string') return null
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+)(?:\.(\d+))?)?(?:\+[0-9A-Za-z.-]+)?$/i.exec(value.trim())
  if (match === null) return null
  const channel = match[4] === undefined ? '' : match[4].toLowerCase()
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    rank: channel === '' ? RELEASE_RANK : CHANNEL_RANK[channel] ?? 0,
    serial: match[5] === undefined ? 0 : Number(match[5]),
  }
}

function compareParsed(a, b) {
  if (a.major !== b.major) return a.major - b.major
  if (a.minor !== b.minor) return a.minor - b.minor
  if (a.patch !== b.patch) return a.patch - b.patch
  if (a.rank !== b.rank) return a.rank - b.rank
  return a.serial - b.serial
}

/** -1 / 0 / 1; 0 when either side is not a version we understand. */
export function compareVersions(left, right) {
  const a = parseVersion(left)
  const b = parseVersion(right)
  if (a === null || b === null) return 0
  return Math.sign(compareParsed(a, b))
}

/** Whether `latest` is a strictly newer release than `current`. */
export function isNewerRelease(latest, current) {
  return compareVersions(latest, current) > 0
}
