import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createPlayback, sanitizePlayback } from '../lib/playback.js'

const dir = await mkdtemp(join(tmpdir(), 'dsh-music-playback-'))
const playback = createPlayback({ dir })
assert.equal(await playback.read(), null, 'missing file reads as null')

const written = await playback.write({
  queue: ['D:/a.flac', 'D:/b.flac'],
  index: 1,
  positionSec: 42.36,
  durationSec: 200,
  loop: 'one',
  order: 'random',
})
assert.equal(written.queue.length, 2)
assert.equal(written.index, 1)
assert.equal(written.positionSec, 42.4)
assert.ok(written.updatedAt > 0)

const reopened = createPlayback({ dir })
const again = await reopened.read()
assert.deepEqual(again.queue, ['D:/a.flac', 'D:/b.flac'])
assert.equal(again.loop, 'one')
assert.equal(again.order, 'random')

// Invalid payloads are rejected or clamped instead of crashing.
assert.equal(await reopened.write(null), null)
assert.equal(sanitizePlayback({ queue: ['x'], index: 99 }).index, 0)
assert.equal(sanitizePlayback({ queue: ['x'], positionSec: 500, durationSec: 100 }).positionSec, 100)
assert.equal(sanitizePlayback({ queue: ['', 1, 'a'], index: 0 }).queue.join(','), 'a')
assert.equal(sanitizePlayback({ queue: [], index: 3 }).index, -1)
assert.equal(sanitizePlayback({ queue: ['a'], loop: 'bogus' }).loop, 'all')
assert.equal(sanitizePlayback({ queue: ['a'], order: 'bogus' }).order, 'list')
assert.equal(sanitizePlayback('nope'), null)

// Queue is capped so a runaway client cannot bloat the file.
const many = Array.from({ length: 600 }, (_, index) => `p${index}`)
assert.equal(sanitizePlayback({ queue: many }).queue.length, 500)

console.log('playback.test.mjs ok')
