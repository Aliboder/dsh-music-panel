import assert from 'node:assert/strict'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createFavorites, sanitizeFavorites } from '../lib/favorites.js'

const dir = await mkdtemp(join(tmpdir(), 'dsh-music-fav-'))
const favorites = createFavorites({ dir })

assert.deepEqual(await favorites.list(), [])
assert.equal(await favorites.has('D:/a.flac'), false)

const added = await favorites.toggle('D:/a.flac')
assert.equal(added.favorite, true)
assert.equal(added.favorites.length, 1)
assert.equal(await favorites.has('D:/a.flac'), true)

const removed = await favorites.toggle('D:/a.flac')
assert.equal(removed.favorite, false)
assert.equal(removed.favorites.length, 0)

await favorites.toggle('D:/b.flac')
const reopened = createFavorites({ dir })
const list = await reopened.list()
assert.equal(list.length, 1)
assert.equal(list[0].path, 'D:/b.flac')
assert.ok(list[0].addedAt > 0)

// Garbage entries are dropped or normalised instead of crashing.
const badDir = await mkdtemp(join(tmpdir(), 'dsh-music-fav-bad-'))
await writeFile(
  join(badDir, 'favorites.json'),
  JSON.stringify({ favorites: { 'D:/x.flac': 1, 'D:/y.flac': 0, 'D:/z.flac': null, '': 5 } }),
)
const bad = createFavorites({ dir: badDir })
const badList = await bad.list()
assert.equal(badList.length, 3)
assert.ok(badList.every((entry) => typeof entry.addedAt === 'number' && entry.addedAt > 0))
assert.equal(sanitizeFavorites('nope') && Object.keys(sanitizeFavorites('nope')).length, 0)

console.log('favorites.test.mjs ok')
