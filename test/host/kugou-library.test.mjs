/**
 * KuGou own-playlist reads use the package's user_playlist / playlist_track_all.
 */

import assert from 'node:assert/strict'
import { addSongToPlaylist, deleteSongFromPlaylist, getMyPlaylistSongs, getMyPlaylists } from '../../src/host/providers/kugou.js'
import { resetUpstreamOverride, setUpstreamOverride } from '../../src/host/services/kugou-api.js'

const calls = []
setUpstreamOverride(async (operation, params) => {
  calls.push([operation, params])
  if (operation === 'user_playlist') {
    return {
      body: {
        status: 1,
        data: {
          info: [
            { listid: 2, name: '我喜欢', is_def: 2, count: 1, global_collection_id: 'collection_3_1_2_0' },
            { listid: 18, name: 'Miku', is_def: 0, count: 1, global_collection_id: 'collection_3_1_18_0' },
          ],
        },
      },
      cookie: [],
    }
  }
  if (operation === 'playlist_track_all') {
    return {
      body: {
        status: 1,
        data: {
          count: 1,
          songs: [{
            hash: 'kg-hash',
            name: 'Ievan Polkka',
            fileid: 916,
            timelen: 180000,
            singerinfo: [{ name: 'Miku' }],
            albuminfo: { name: 'Album', cover: 'https://cover' },
          }],
        },
      },
      cookie: [],
    }
  }
  if (operation === 'playlist_tracks_add' || operation === 'playlist_tracks_del') {
    return { body: { status: 1, error_code: 0 }, cookie: [] }
  }
  throw new Error('unexpected KuGou operation: ' + operation)
})

const session = { token: 't', userid: 1, dfid: 'd', mid: '12345' }
const playlists = await getMyPlaylists(session)
assert.equal(playlists.length, 2)
assert.equal(playlists[0].globalId, 'collection_3_1_2_0')
assert.equal(playlists[0].isLike, true)

const songs = await getMyPlaylistSongs('2', session)
assert.equal(songs.length, 1)
assert.equal(songs[0].title, 'Ievan Polkka')
assert.equal(songs[0].artists[0], 'Miku')
assert.equal(songs[0].fileId, 916)
assert.equal(calls.some(([operation]) => operation === 'playlist_track_all'), true)

assert.equal(await addSongToPlaylist({ hash: 'kg-hash', title: 'Song', albumId: 1, mixSongId: 2 }, 2, session), true)
const addCall = calls.find(([operation]) => operation === 'playlist_tracks_add')
assert.equal(addCall[1].listid, '2')
assert.equal(addCall[1].data, 'Song|kg-hash|1|2')
assert.equal(await deleteSongFromPlaylist(916, 2, session), true)
const delCall = calls.find(([operation]) => operation === 'playlist_tracks_del')
assert.equal(delCall[1].fileids, '916')

resetUpstreamOverride()
console.log('kugou-library.test.mjs ok')
