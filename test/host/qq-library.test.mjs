/**
 * QQ account library reads use the Folia-pinned package routes.
 */

import assert from 'node:assert/strict'
import { myPlaylists, playlistSongs } from '../../src/host/providers/index.js'
import { addQQFav } from '../../src/host/providers/qq.js'
import { resetUpstreamOverride, setUpstreamOverride } from '../../src/host/services/qq-api.js'

const calls = []
setUpstreamOverride(async (route, params, options) => {
  calls.push([route, params, options])
  if (route === '/user/playlist') {
    return {
      playlist: [
        { dirId: 201, tid: 11, dirName: '我喜欢', songNum: 1, picUrl: 'https://liked' },
        { dirId: 1, tid: 22, dirName: 'Hatsune Miku歌词本', songNum: 2, picUrl: 'https://cover' },
      ],
    }
  }
  if (route === '/user/playlist-detail') {
    return {
      songs: [
        { mid: 'mid-1', name: 'Song 1', singer: [{ name: 'Singer' }], album: { name: 'Album', mid: 'album' }, interval: 200 },
        { mid: 'mid-2', name: 'Song 2', singer: [{ name: 'Singer' }], album: { name: 'Album', mid: 'album' }, interval: 210 },
      ],
      total: 2,
    }
  }
  if (route === '/user/liked-songs') {
    return {
      songs: [
        { mid: 'liked-1', name: 'Liked', singer: [{ name: 'Singer' }], album: { name: 'Album', mid: 'album' }, interval: 180 },
      ],
      total: 1,
      more: false,
    }
  }
  if (route === '/user/song/like') {
    return { liked: options?.body?.liked === true }
  }
  throw new Error('unexpected QQ route: ' + route)
})

const playlists = await myPlaylists('qq', 'sealed')
assert.deepEqual(playlists.map((item) => item.name), ['我喜欢', 'Hatsune Miku歌词本'])
assert.equal(playlists[0].isLike, true)
assert.equal(playlists[1].trackCount, 2)

const owned = await playlistSongs('qq', '22', 'sealed')
assert.equal(owned.songs.length, 2)
assert.equal(owned.songs[0].id, 'mid-1')
assert.equal(owned.songs[0].title, 'Song 1')
assert.equal(calls.some(([route]) => route === '/user/playlist-detail'), true)
assert.equal(calls.find(([route]) => route === '/user/playlist-detail')[1].tid, '22')

assert.equal(await addQQFav({ songmid: 'mid-1', songid: 7 }, 'sealed'), true)
const likeCall = calls.find(([route]) => route === '/user/song/like')
assert.equal(likeCall[2].method, 'POST')
assert.deepEqual(likeCall[2].body, { song: { id: 7, mid: 'mid-1', type: 0 }, liked: true })

resetUpstreamOverride()
console.log('qq-library.test.mjs ok')
