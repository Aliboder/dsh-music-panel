/**
 * Guard: self-hosted artwork must travel with the track, end to end.
 *
 * Navidrome identifies artwork by an opaque id (`mf-<songId>` for a song,
 * `al-<albumId>` for an album) and the host proxies it with the stored token.
 * A URL-based cover therefore never applies, and the id has to survive four
 * separate hops: the API result, the queue track, the persisted queue and the
 * recent-history entry. Dropping it at any one of them shows blank artwork for
 * exactly that surface, which is easy to miss by eye and hard to unit-test
 * through the render mock.
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (path) => readFileSync(join(...path.split('/')), 'utf8')

// ── 1. the API layer resolves navidrome artwork by id, not by URL ─────────
const api = read('src/20-api.js')
assert.match(
  api,
  /onlineProvider === 'navidrome'\) return subsonicCoverUrl\(track\.coverArtId\)/,
  'trackCoverSrc must resolve navidrome covers through the id proxy',
)
assert.match(
  api,
  /coverArtId: result\.coverArtId \|\| ''/,
  'onlineTrackOf must carry coverArtId into the queue track',
)
assert.match(
  api,
  /function subsonicCoverUrl\(coverArtId\)[\s\S]*?online\/subsonic-cover\?provider=navidrome&id=/,
  'subsonicCoverUrl must target the authenticated proxy route',
)

// ── 2. the queue track keeps it through persistence and restore ───────────
const player = read('src/50-player.js')
assert.match(
  player,
  /coverArtId: track\.coverArtId \|\| ''/,
  'playbackTrackSnapshot must persist coverArtId or the restored queue loses covers',
)
assert.match(
  player,
  /coverArtId: entry\.coverArtId \|\| ''/,
  'trackFromSaved must restore coverArtId',
)

// ── 3. recent history keeps it across a reload ───────────────────────────
const online = read('src/70-online.js')
assert.match(
  online,
  /coverArtId: track\.coverArtId \|\| ''/,
  'rememberOnline must store coverArtId for the recent list',
)

// ── 4. the host sanitiser must not strip it ──────────────────────────────
const playback = read('lib/playback.js')
assert.match(
  playback,
  /coverArtId: textField\(value\.coverArtId, 256\)/,
  'sanitizeQueueEntry must keep coverArtId instead of dropping it',
)

console.log('  ok  trackCoverSrc resolves navidrome artwork by id')
console.log('  ok  coverArtId survives the API result, queue snapshot and restore')
console.log('  ok  recent history and the host queue sanitiser keep coverArtId')
console.log('\npanel.cover.test.mjs ok')
