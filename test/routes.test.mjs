import assert from 'node:assert/strict'
import { dirname } from 'node:path'
import { createRoutes, parseRange, resolveTrack } from '../lib/routes.js'
import { fakeReq, fakeRes, tempWav } from './helpers.mjs'

const file = await tempWav('song.wav', 1)
const root = dirname(file)
const outside = await tempWav('outside.wav', 1)

const settings = {
  read: async () => ({ roots: [root], depth: 2, extensions: ['wav'] }),
  write: async (patch) => ({ roots: [], depth: 4, extensions: ['wav'], ...patch }),
  home: 'C:/dsh-home',
  file: 'C:/dsh-home/music/settings.json',
}
const library = {
  scan: async () => ({
    tracks: [{ path: file, title: 'song' }],
    roots: [root],
    warnings: [],
    truncated: false,
    empty: false,
    scannedAt: 0,
  }),
}
const handle = createRoutes({ settings, library })

// config
let res = fakeRes()
await handle(fakeReq('/music/config'), res)
assert.equal(res.status, 200)
assert.equal(res.json().ok, true)
assert.equal(res.json().config.depth, 2)

// library
res = fakeRes()
await handle(fakeReq('/music/library'), res)
assert.equal(res.status, 200)
assert.equal(res.json().tracks.length, 1)

// stream outside every configured root is refused
res = fakeRes()
await handle(fakeReq('/music/stream?path=' + encodeURIComponent(outside)), res)
assert.equal(res.status, 404)
assert.equal(res.json().error.code, 'NOT_FOUND')

// cover for a file with no artwork
res = fakeRes()
await handle(fakeReq('/music/cover?path=' + encodeURIComponent(file)), res)
assert.equal(res.status, 404)

// unknown route
res = fakeRes()
await handle(fakeReq('/music/nope'), res)
assert.equal(res.status, 404)

// non-loopback peers are rejected
res = fakeRes()
const remote = fakeReq('/music/config')
remote.socket.remoteAddress = '10.0.0.8'
await handle(remote, res)
assert.equal(res.status, 403)

// resolveTrack: inside vs outside, and extension filtering
assert.equal(await resolveTrack(file, [root]), file)
assert.equal(await resolveTrack(outside, [root]), null)
assert.equal(await resolveTrack('', [root]), null)

// Range parsing, including the edge cases browsers actually send
assert.deepEqual(parseRange('bytes=0-99', 1000), { start: 0, end: 99 })
assert.deepEqual(parseRange('bytes=500-', 1000), { start: 500, end: 999 })
assert.deepEqual(parseRange('bytes=-100', 1000), { start: 900, end: 999 })
assert.deepEqual(parseRange('bytes=2000-', 1000), { invalid: true })
assert.equal(parseRange('', 1000), null)
assert.equal(parseRange('pages=1', 1000), null)

console.log('routes.test.mjs ok')
