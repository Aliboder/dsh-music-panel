import assert from 'node:assert/strict'
import { mkdir, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { createRoutes } from '../lib/routes.js'
import { fakeReq, fakeRes, tempWav } from './helpers.mjs'

const file = await tempWav('song.wav', 1)
const root = dirname(file)
const home = join(root, 'dsh-home')
await mkdir(home, { recursive: true })

const settings = {
  read: async () => ({ roots: [root], depth: 2, extensions: ['wav'] }),
  write: async (patch) => ({ roots: [root], depth: 4, extensions: ['wav'], ...patch }),
  home,
  dir: home,
  file: join(home, 'settings.json'),
}
const handle = createRoutes({ settings })

function post(url, body) {
  return fakeReq(url, 'POST', { 'content-type': 'application/json' }, JSON.stringify(body))
}

// Remove moves into the trash and records the original path.
let res = fakeRes()
await handle(post('/music/remove', { paths: [file] }), res)
assert.equal(res.status, 200)
assert.equal(res.json().moved.length, 1)
await assert.rejects(stat(file))

res = fakeRes()
await handle(fakeReq('/music/trash'), res)
assert.equal(res.status, 200)
const entries = res.json().entries
assert.equal(entries.length, 1)
assert.equal(entries[0].originalPath, file)
assert.equal(entries[0].name, 'song.wav')
const id = entries[0].id

// Restore puts the file back where it came from.
res = fakeRes()
await handle(post('/music/trash/restore', { id }), res)
assert.equal(res.status, 200)
assert.equal(res.json().path, file)
assert.equal((await stat(file)).isFile(), true)

res = fakeRes()
await handle(fakeReq('/music/trash'), res)
assert.deepEqual(res.json().entries, [])

// Restoring the same entry again is a 404.
res = fakeRes()
await handle(post('/music/trash/restore', { id }), res)
assert.equal(res.status, 404)

// Path traversal is refused.
res = fakeRes()
await handle(post('/music/trash/restore', { id: '../settings.json' }), res)
assert.equal(res.status, 400)
assert.equal(res.json().error.code, 'BAD_ID')

// Missing id is a 400.
res = fakeRes()
await handle(post('/music/trash/restore', {}), res)
assert.equal(res.status, 400)

console.log('trash.test.mjs ok')
