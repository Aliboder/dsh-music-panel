import assert from 'node:assert/strict'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createStats, dayKey, playThreshold } from '../lib/stats.js'

const dir = await mkdtemp(join(tmpdir(), 'dsh-music-stats-'))
const stats = createStats({ dir })

assert.deepEqual(await stats.snapshot(), {})

// First-seen registration stamps addedAt once and starts at zero.
const ensured = await stats.ensure(['D:/a.flac', 'D:/b.flac'])
assert.ok(ensured['D:/a.flac'].addedAt > 0)
assert.equal(ensured['D:/a.flac'].plays, 0)
assert.equal(ensured['D:/a.flac'].playSeconds, 0)
assert.equal(ensured['D:/a.flac'].lastPlayedAt, null)

const firstAddedAt = ensured['D:/a.flac'].addedAt
await new Promise((resolve) => setTimeout(resolve, 5))
const again = await stats.ensure(['D:/a.flac', 'D:/c.flac'])
assert.equal(again['D:/a.flac'].addedAt, firstAddedAt, 'addedAt is stable')
assert.ok(again['D:/c.flac'].addedAt > 0, 'new file gets its own stamp')

// Play counting.
const first = await stats.recordPlay('D:/a.flac')
assert.equal(first.plays, 1)
assert.ok(first.lastPlayedAt > 0, 'recordPlay stamps lastPlayedAt')
const second = await stats.recordPlay('D:/a.flac')
assert.equal(second.plays, 2)
assert.equal((await stats.get('D:/a.flac')).plays, 2)

// Actually-listened seconds accumulate; invalid values are ignored.
const timed = await stats.addPlayTime('D:/a.flac', 12.5)
assert.equal(timed.playSeconds, 12.5)
assert.equal((await stats.addPlayTime('D:/a.flac', 7)).playSeconds, 19.5)
assert.equal((await stats.addPlayTime('D:/a.flac', -1)), null)
assert.equal((await stats.addPlayTime('D:/a.flac', 0)), null)

// Per-track resume point (used when "remember per track" is on).
const positioned = await stats.setPosition('D:/a.flac', 73.456)
assert.equal(positioned.lastPositionSec, 73.5)
assert.equal((await stats.setPosition('D:/a.flac', -2)), null)

// Lyrics calibration offset is clamped to ±60s and persisted.
assert.equal((await stats.setLyricOffset('D:/a.flac', 1200)).lyricOffsetMs, 1200)
assert.equal((await stats.setLyricOffset('D:/a.flac', -99_999)).lyricOffsetMs, -60_000)
assert.equal((await stats.setLyricOffset('D:/a.flac', 500)).lyricOffsetMs, 500)

// Last.fm / MusicBee threshold (half the track or 4 minutes, whichever first).
assert.equal(playThreshold(300), 150)
assert.equal(playThreshold(900), 240)
assert.equal(playThreshold(20), 20.5)
assert.equal(playThreshold(0), 240)

// Range aggregation.
const all = await stats.summarize('all')
assert.equal(all['D:/a.flac'].playSeconds, 19.5)
assert.equal(all['D:/a.flac'].plays, 2)
assert.equal((await stats.summarize('week'))['D:/a.flac'].playSeconds, 19.5)
assert.equal((await stats.summarize('month'))['D:/a.flac'].plays, 2)

// Persisted and readable by a fresh instance.
const reopened = createStats({ dir })
assert.equal((await reopened.get('D:/a.flac')).plays, 2)
assert.equal((await reopened.get('D:/a.flac')).playSeconds, 19.5)
assert.ok((await reopened.get('D:/b.flac')) !== null)

// Garbage entries are dropped instead of crashing the scan.
const brokenDir = await mkdtemp(join(tmpdir(), 'dsh-music-stats-bad-'))
await writeFile(join(brokenDir, 'stats.json'), '{"tracks":{"x":null,"y":{"addedAt":"nope"}}}')
const broken = createStats({ dir: brokenDir })
const brokenMap = await broken.snapshot()
assert.equal(brokenMap.x, undefined)
assert.ok(brokenMap.y.addedAt > 0)
assert.equal(brokenMap.y.playSeconds, 0)
assert.deepEqual(brokenMap.y.days, {})

// Old daily buckets fall out of week/month but stay in the all-time total.
const oldDir = await mkdtemp(join(tmpdir(), 'dsh-music-stats-old-'))
const oldDay = dayKey(Date.now() - 40 * 86_400_000)
await writeFile(
  join(oldDir, 'stats.json'),
  JSON.stringify({
    tracks: { z: { addedAt: 1, plays: 5, playSeconds: 300, days: { [oldDay]: { plays: 5, seconds: 300, lastAt: 1 } } } },
  }),
)
const oldStats = createStats({ dir: oldDir })
assert.deepEqual(await oldStats.summarize('week'), {})
assert.equal((await oldStats.summarize('all')).z.playSeconds, 300)

console.log('stats.test.mjs ok')
