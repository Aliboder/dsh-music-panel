import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createPlayback, sanitizePlayback } from '../../src/host/services/playback/playback.js'

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
assert.equal(sanitizePlayback({ queue: ['a'], loop: 'bogus' }).loop, 'none', 'an unknown loop falls back to the play mode')
assert.equal(sanitizePlayback({ queue: ['a'], order: 'bogus' }).order, 'list')
assert.equal(sanitizePlayback('nope'), null)

// 播放模式：顺序 / 单曲 / 随机；随机时 queue 是随机表、baseQueue 是原顺序。
assert.equal(sanitizePlayback({ queue: ['a'] }).playMode, 'sequence')
assert.equal(sanitizePlayback({ queue: ['a'], loop: 'one' }).playMode, 'one', 'old saves migrate by loop')
assert.equal(sanitizePlayback({ queue: ['a'], order: 'random' }).playMode, 'random', 'old saves migrate by order')
assert.equal(sanitizePlayback({ queue: ['a'], playMode: 'bogus' }).playMode, 'sequence')
assert.deepEqual(sanitizePlayback({ queue: ['a'] }).baseQueue, ['a'], 'baseQueue defaults to the queue')
const randomState = sanitizePlayback({ queue: ['c', 'a'], baseQueue: ['a', 'c'], playMode: 'random' })
assert.equal(randomState.playMode, 'random')
assert.deepEqual(randomState.queue, ['c', 'a'], 'the random table is kept for a restart')
assert.deepEqual(randomState.baseQueue, ['a', 'c'], 'the original order comes back with it')
assert.equal(sanitizePlayback({ queue: ['a'], baseQueue: 'nope' }).baseQueue.length, 1)

// Queue is capped so a runaway client cannot bloat the file.
const many = Array.from({ length: 600 }, (_, index) => `p${index}`)
assert.equal(sanitizePlayback({ queue: many }).queue.length, 500)

// Queue entries with online metadata survive a write/read cycle.
const objectState = sanitizePlayback({
  queue: [
    { path: 'D:/a.flac', title: 'A', artist: 'Artist', durationSec: 180 },
    {
      path: 'online:kugou:abc',
      title: 'Online',
      artist: 'Provider',
      durationSec: 200,
      onlineProvider: 'kugou',
      onlineId: 'abc',
      qualityHint: 'VIP',
    },
  ],
  index: 1,
})
assert.equal(objectState.queue.length, 2)
assert.equal(objectState.queue[1].onlineProvider, 'kugou')
assert.equal(objectState.queue[1].onlineId, 'abc')
assert.equal(objectState.queue[1].qualityHint, 'VIP')

console.log('playback.test.mjs ok')

