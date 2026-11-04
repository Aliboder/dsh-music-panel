import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createStats } from '../lib/stats.js'

const dir = await mkdtemp(join(tmpdir(), 'dsh-music-stats-'))
const stats = createStats({ dir })

assert.deepEqual(await stats.snapshot(), {})

// First-seen registration stamps addedAt once.
const ensured = await stats.ensure(['D:/a.flac', 'D:/b.flac'])
assert.ok(ensured['D:/a.flac'].addedAt > 0)
assert.equal(ensured['D:/a.flac'].plays, 0)

const firstAddedAt = ensured['D:/a.flac'].addedAt
await new Promise((resolve) => setTimeout(resolve, 5))
const again = await stats.ensure(['D:/a.flac', 'D:/c.flac'])
assert.equal(again['D:/a.flac'].addedAt, firstAddedAt, 'addedAt is stable')
assert.ok(again['D:/c.flac'].addedAt > 0, 'new file gets its own stamp')

// Play counting.
const first = await stats.recordPlay('D:/a.flac')
assert.equal(first.plays, 1)
const second = await stats.recordPlay('D:/a.flac')
assert.equal(second.plays, 2)
assert.equal((await stats.get('D:/a.flac')).plays, 2)

// Persisted and readable by a fresh instance.
const reopened = createStats({ dir })
assert.equal((await reopened.get('D:/a.flac')).plays, 2)
assert.ok((await reopened.get('D:/b.flac')) !== null)

// Garbage entries are dropped instead of crashing the scan.
const { writeFile } = await import('node:fs/promises')
const brokenDir = await mkdtemp(join(tmpdir(), 'dsh-music-stats-bad-'))
await writeFile(join(brokenDir, 'stats.json'), '{"tracks":{"x":null,"y":{"addedAt":"nope"}}}')
const broken = createStats({ dir: brokenDir })
const brokenMap = await broken.snapshot()
assert.equal(brokenMap.x, undefined)
assert.ok(brokenMap.y.addedAt > 0)

console.log('stats.test.mjs ok')
