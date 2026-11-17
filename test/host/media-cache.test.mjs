/**
 * The media cache store: layout, migration, per-song entries, covers, LRU pruning and
 * the categorised stats/clear the storage page reads.
 */

import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createMediaCache, MIN_CACHEABLE_AUDIO_BYTES } from '../../src/host/stores/media-cache.js'

const audioBytes = (size) => Buffer.alloc(size, 7)
const PROVIDER = 'netease'
const ID = '1473228889'

const dataDir = await mkdtemp(join(tmpdir(), 'dsh-music-media-cache-'))

// The old layout this store replaces: written while streaming, with URL-keyed covers and
// lyric bodies. It must disappear on the first ensure() and never come back.
await mkdir(join(dataDir, 'cache', 'online', PROVIDER), { recursive: true })
await writeFile(join(dataDir, 'cache', 'online', PROVIDER, ID + '.mp3'), audioBytes(2048))

const cache = createMediaCache({ dir: dataDir })
await cache.ensure()

assert.equal(
  await readdir(join(dataDir, 'cache', 'online')).then(() => true, () => false),
  false,
  'the legacy cache directory is removed',
)
const version = JSON.parse(await readFile(join(dataDir, 'cache', 'version.json'), 'utf8'))
assert.equal(version.v, 2)

// ── audio entries ──────────────────────────────────────────────────────────

assert.equal(await cache.lookup(PROVIDER, ID), null, 'nothing is cached yet')

const stored = await cache.store({
  provider: PROVIDER,
  id: ID,
  quality: 'high',
  mime: 'audio/mpeg',
  buffer: audioBytes(MIN_CACHEABLE_AUDIO_BYTES + 4096),
  durationSec: 299,
})
assert.ok(stored && stored.file.endsWith('.mp3'))

const hit = await cache.lookup(PROVIDER, ID)
assert.ok(hit, 'the stored song is found')
assert.equal(hit.quality, 'high')
assert.equal(hit.durationSec, 299)
assert.equal(hit.mime, 'audio/mpeg')
assert.ok(hit.size >= MIN_CACHEABLE_AUDIO_BYTES)

// A file below the floor is not stored at all.
assert.equal(
  await cache.store({
    provider: PROVIDER,
    id: 'tiny',
    quality: 'high',
    mime: 'audio/mpeg',
    buffer: audioBytes(100),
  }),
  null,
)

// Unusable ids never reach the disk.
assert.equal(await cache.store({ provider: '', id: ID, quality: 'high', mime: 'audio/mpeg', buffer: audioBytes(20000) }), null)
assert.equal(await cache.lookup('', ID), null)

// ── LRU: touch then prune ──────────────────────────────────────────────────

const other = await cache.store({
  provider: 'qq',
  id: 'song-2',
  quality: 'standard',
  mime: 'audio/flac',
  buffer: audioBytes(MIN_CACHEABLE_AUDIO_BYTES + 2048),
})
assert.ok(other)

const before = await cache.lookup(PROVIDER, ID)
await new Promise((resolve) => setTimeout(resolve, 15))
await cache.touch(PROVIDER, ID)
const after = await cache.lookup(PROVIDER, ID)
assert.ok(after.usedAt >= before.usedAt, 'touching makes it the most recently played')

let stats = await cache.stats()
assert.equal(stats.songs, 2)
assert.equal(stats.categories.audio.files, 2)
assert.equal(stats.files, stats.categories.audio.files + stats.categories.cover.files)

// Limit 0 means no ceiling: nothing is thrown away.
assert.equal(await cache.prune(0), 0)

// A ceiling smaller than one song prunes from the least recently played.
const pruned = await cache.prune(audioBytes(MIN_CACHEABLE_AUDIO_BYTES + 4096).length + 1024)
assert.ok(pruned >= 1, 'pruning removes at least the oldest entry')
const survivors = await cache.entries()
assert.equal(survivors.length, 1)
assert.equal(survivors[0].id, ID, 'the song played most recently survives')

// ── covers ─────────────────────────────────────────────────────────────────

assert.equal(await cache.hasCover(PROVIDER, ID), false)
await cache.writeCover({ provider: PROVIDER, id: ID, mime: 'image/png', ext: 'png', buffer: audioBytes(4096) })
const cover = await cache.coverFile(PROVIDER, ID)
assert.ok(cover && cover.mime === 'image/png')
assert.ok(await cache.hasCover(PROVIDER, ID))

stats = await cache.stats()
assert.equal(stats.categories.cover.files, 1)
assert.ok(stats.bytes > stats.categories.audio.bytes, 'cover bytes are counted in the total')

// ── stats and clears ───────────────────────────────────────────────────────

const removedAudio = await cache.clear('audio')
assert.ok(removedAudio > 0)
assert.equal((await cache.stats()).categories.audio.files, 0)
assert.ok(await cache.hasCover(PROVIDER, ID), 'clearing audio leaves the cover category alone')

// A cleared store can still be used.
await cache.store({ provider: PROVIDER, id: ID, quality: 'high', mime: 'audio/mpeg', buffer: audioBytes(MIN_CACHEABLE_AUDIO_BYTES + 4096) })
assert.ok(await cache.lookup(PROVIDER, ID))

const removedAll = await cache.clear('all')
assert.ok(removedAll > 0)
stats = await cache.stats()
assert.equal(stats.songs, 0)
assert.equal(stats.bytes, 0)

// Removing one song's entry takes its cover with it.
await cache.store({ provider: PROVIDER, id: ID, quality: 'high', mime: 'audio/mpeg', buffer: audioBytes(MIN_CACHEABLE_AUDIO_BYTES + 4096) })
await cache.writeCover({ provider: PROVIDER, id: ID, mime: 'image/jpeg', ext: 'jpg', buffer: audioBytes(2048) })
const removedOne = await cache.remove(PROVIDER, ID)
assert.ok(removedOne >= 2)
assert.equal(await cache.lookup(PROVIDER, ID), null)
assert.equal(await cache.hasCover(PROVIDER, ID), false)

// A meta that is not ours (another version) is ignored, not trusted.
const metaDir = join(dataDir, 'cache', 'audio', PROVIDER)
await mkdir(metaDir, { recursive: true })
await writeFile(join(metaDir, 'stale.json'), JSON.stringify({ v: 99, id: 'stale' }))
assert.equal(await cache.lookup(PROVIDER, 'stale'), null)

console.log('media-cache.test.mjs ok')
