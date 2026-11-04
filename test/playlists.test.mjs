import assert from 'node:assert/strict'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createPlaylists } from '../lib/playlists.js'

const dir = await mkdtemp(join(tmpdir(), 'dsh-music-pl-'))
const store = createPlaylists({ dir })

assert.deepEqual(await store.list(), [])

const created = await store.create('  My Mix  ')
assert.equal(created.name, 'My Mix')
assert.equal(created.trackPaths.length, 0)
assert.ok(created.id.length > 0)

// Name fallback and trimming.
const unnamed = await store.create('   ')
assert.equal(unnamed.name, '新建播放列表')

// Adding tracks de-duplicates and keeps order.
const added = await store.update(created.id, {
  add: ['D:/a.flac', 'D:/b.flac', 'D:/a.flac'],
})
assert.deepEqual(added.trackPaths, ['D:/a.flac', 'D:/b.flac'])

// Removing tracks.
const removedTrack = await store.update(created.id, { remove: ['D:/a.flac'] })
assert.deepEqual(removedTrack.trackPaths, ['D:/b.flac'])

// Rename.
const renamed = await store.update(created.id, { name: 'Renamed' })
assert.equal(renamed.name, 'Renamed')

// Unknown ids are reported, not thrown.
assert.equal(await store.update('missing', { name: 'x' }), null)
assert.equal(await store.remove('missing'), false)

// Persisted as a readable JSON file.
const raw = JSON.parse(await readFile(join(dir, 'playlists.json'), 'utf8'))
assert.equal(raw.playlists.length, 2)

// A fresh instance reads the same data back from disk.
const reopened = createPlaylists({ dir })
const listed = await reopened.list()
assert.equal(listed.length, 2)
assert.equal(listed.find((row) => row.id === created.id).name, 'Renamed')

// Deleting removes the entry.
assert.equal(await reopened.remove(created.id), true)
assert.equal((await reopened.list()).length, 1)

// A corrupt file degrades to an empty list instead of throwing.
const brokenDir = await mkdtemp(join(tmpdir(), 'dsh-music-pl-bad-'))
const { writeFile } = await import('node:fs/promises')
await writeFile(join(brokenDir, 'playlists.json'), '{ not json')
const broken = createPlaylists({ dir: brokenDir })
assert.deepEqual(await broken.list(), [])

console.log('playlists.test.mjs ok')
