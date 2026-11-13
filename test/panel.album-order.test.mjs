/**
 * Guard: an album's tracks must keep the album's own running order.
 *
 * The server returns album children in disc/track sequence. The online views
 * share one sort helper (sortOnlineTracks, which honours the user's
 * title/duration preference), so routing the album branch through it silently
 * scrambles every album — the list looks sorted, just not the way the album was
 * authored. The album branch therefore maps the server order straight through
 * and plays that same array.
 *
 * Upstream owns the album view and rewrote it once; this test keys off the
 * invariants rather than exact line shapes so it survives that churn.
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const FILE = join('src', 'ui', '09-online.js')
const source = readFileSync(FILE, 'utf8')
const lines = source.split('\n')

/** Lines of the `nav === '<name>'` branch, up to the next sibling branch. */
function branchOf(name) {
  const start = lines.findIndex((line) => new RegExp(`^\\s*\\} else if \\(nav === '${name}'\\) \\{`).test(line))
  assert.ok(start !== -1, `branch nav === '${name}' not found in ${FILE}`)
  const indent = lines[start].match(/^\s*/)[0].length
  const out = []
  for (let i = start + 1; i < lines.length; i++) {
    if (new RegExp(`^\\s{${indent}}\\} else`).test(lines[i])) break
    out.push(lines[i])
  }
  return out.join('\n')
}

// Each view must exist exactly once: a duplicated `else if (nav === 'album')`
// compiles fine and silently makes the second one dead.
for (const name of ['album', 'songs']) {
  const count = (source.match(new RegExp(`\\} else if \\(nav === '${name}'\\) \\{`, 'g')) || []).length
  assert.equal(count, 1, `nav === '${name}' must have exactly one branch, found ${count}`)
}
// The artist / album cards share one branch, so each of those view keys must
// appear in exactly one `nav` test — a stray second branch would be dead code.
for (const name of ['artist', 'artists', 'albums']) {
  const count = (source.match(new RegExp(`\\} else if \\(nav === '${name}'\\) \\{`, 'g')) || []).length
  assert.equal(count, 0, `nav === '${name}' must not have its own branch, found ${count}`)
}
assert.equal(
  (source.match(/\} else if \(nav === 'artists' \|\| nav === 'albums' \|\| nav === 'artist'\) \{/g) || [])
    .length,
  1,
  'the artist and album cards share exactly one branch',
)

const album = branchOf('album')
const songs = branchOf('songs')

// ── album: server order, and playback from the same array ────────────────
assert.match(
  album,
  /\.map\(onlineTrackOf\)/,
  'the album branch must build its tracks by mapping the server order',
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
  /playOnlineResults\(albumSongs,/,
  'album playback must use the same order as the rendered list',
)

// ── the songs view keeps honouring the user's preference ────────────────
assert.match(
  songs,
  /sortOnlineTracks/,
  'the songs view must keep the user sort preference; only albums are order-fixed',
)

console.log('  ok  every online branch appears exactly once')
console.log('  ok  the album branch preserves the server (disc/track) order')
console.log('  ok  album playback uses the same array as the rendered list')
console.log('  ok  the songs view still honours the user sort preference')
console.log('\npanel.album-order.test.mjs ok')
