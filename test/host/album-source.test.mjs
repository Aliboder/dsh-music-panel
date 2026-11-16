/**
 * NetEase album tracks come from the same `/album` response field Folia reads:
 * the top-level `songs`, not `album.songs`.
 */

import assert from 'node:assert/strict'
import { albumSongs } from '../../src/host/providers/index.js'
import { resetUpstreamOverride, setUpstreamOverride } from '../../src/host/services/netease-api.js'

const calls = []
setUpstreamOverride(async (route, params) => {
  calls.push([route, params])
  if (route !== '/album') throw new Error('unexpected route: ' + route)
  return {
    code: 200,
    songs: [{
      id: 2149887904,
      name: '春日影',
      ar: [{ id: 61341955, name: 'CRYCHIC' }],
      al: { id: 193718042, name: '春日影', picUrl: 'https://p4.music.126.net/cover.jpg' },
      dt: 258000,
    }],
    album: {
      id: 193718042,
      name: '春日影',
      picUrl: 'https://p4.music.126.net/cover.jpg',
      artist: { name: 'CRYCHIC' },
      songs: [],
    },
  }
})

const result = await albumSongs('netease', '193718042', 'MUSIC_U=cookie')
assert.equal(result.name, '春日影')
assert.equal(result.songs.length, 1)
assert.equal(result.songs[0].title, '春日影')
assert.equal(result.songs[0].id, '2149887904')
assert.equal(calls.length, 1)
assert.equal(calls[0][0], '/album')

resetUpstreamOverride()
console.log('album-source.test.mjs ok')
