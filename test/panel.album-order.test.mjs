/**
 * Guard: an album's tracks must keep the album's own running order.
 *
 * Navidrome returns album songs in disc/track sequence. The online views share
 * one sort helper (sortOnlineTracks, which honours the user's title/duration
 * preference), so routing the album branch through it silently scrambles every
 * album — the list looks sorted, just not the way the album was authored.
 *
 * The album branch therefore maps the server order straight through and plays
 * that same array. This test reads the source and fails if either half of that
 * pairing changes.
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const FILE = join('src', 'ui', '09-online.js')
const source = readFileSync(FILE, 'utf8')
const lines = source.split('\n')

/** Return the lines of the `nav === '<name>'` branch, up to the next branch. */
function branchOf(name) {
  const start = lines.findIndex((line) => new RegExp(`\\} else if \\(nav === '${name}'\\) \\{`).test(line))
  assert.ok(start !== -1, `branch nav === '${name}' not found in ${FILE}`)
  const out = []
  for (let i = start + 1; i < lines.length; i++) {
    if (/^\s*\} else if \(nav === '/.test(lines[i])) break
    out.push(lines[i])
  }
  return out.join('\n')
}

const album = branchOf('album')
const songs = branchOf('songs')

// ── album: server order, and playback from the same array ────────────────
assert.match(
  album,
  /albumSongsList\.map\(onlineTrackOf\)/,
  'the album branch must build its tracks by mapping the server order, not by re-sorting',
)
assert.equal(
  /sortOnlineTracks/.test(album),
  false,
  'the album branch must not call sortOnlineTracks — that applies the user sort preference and scrambles the album',
)
assert.match(
  album,
  /onlineSelectionList = albumOrder/,
  'the album track list must use the album order',
)
assert.match(
  album,
  /playOnlineResults\(albumSongsList,/,
  'album playback must use the same order as the rendered list',
)

// ── the other views keep honouring the user's preference ────────────────
assert.match(
  songs,
  /sortOnlineTracks\(allSongs\)/,
  'the songs view must keep the user sort preference; only albums are order-fixed',
)

console.log('  ok  the album branch preserves the server (disc/track) order')
console.log('  ok  album playback uses the same array as the rendered list')
console.log('  ok  other online views still honour the user sort preference')
console.log('\npanel.album-order.test.mjs ok')