/**
 * NetEase playlist paging: one detail page is not the whole playlist.
 */

import assert from 'node:assert/strict'
import { getPlaylistSongs, getPlaylistSongsPage } from '../../src/host/providers/netease.js'
import { playlistSongsPage } from '../../src/host/providers/index.js'
import { resetUpstreamOverride, setUpstreamOverride } from '../../src/host/services/netease-api.js'

const total = 1200
const calls = []

function rawSong(index) {
  return {
    id: String(100000 + index),
    name: 'Track ' + index,
    ar: [{ name: 'Artist' }],
    al: { id: 1, name: 'Album', picUrl: '' },
    dt: 180000,
    fee: 0,
  }
}

setUpstreamOverride(async (route, params) => {
  if (route === '/playlist/detail') {
    return {
      playlist: {
        id: '77',
        name: 'Long playlist',
        creator: { nickname: 'Owner' },
        description: '',
        coverImgUrl: '',
        trackCount: total,
        // The detail route is allowed to omit everything past its first page.
        tracks: [],
      },
    }
  }
  if (route === '/playlist/track/all') {
    const limit = Number(params.limit) || 500
    const offset = Number(params.offset) || 0
    calls.push({ limit, offset })
    const count = Math.max(0, Math.min(limit, total - offset))
    return {
      songs: Array.from({ length: count }, (_, index) => rawSong(offset + index)),
    }
  }
  throw new Error('unexpected route: ' + route)
})

try {
  const playlist = await getPlaylistSongs('77', 'MUSIC_U=test')
  assert.equal(playlist.trackCount, total)
  assert.equal(playlist.songs.length, total, 'all pages are drained')
  assert.deepEqual(calls.map((call) => call.offset), [0, 500, 1000], 'paging follows the returned page size')
  assert.equal(playlist.songs[0].title, 'Track 0')
  assert.equal(playlist.songs[total - 1].title, 'Track ' + (total - 1))
  console.log('netease-playlist.test.mjs ok')
} finally {
  resetUpstreamOverride()
}
// The page route asks for one page and keeps the offset contract.
{
  const pageCalls = []
  setUpstreamOverride(async (route, params) => {
    if (route === '/playlist/detail') {
      return { playlist: { id: '77', name: 'Long playlist', coverImgUrl: '', trackCount: 1200 } }
    }
    if (route === '/playlist/track/all') {
      pageCalls.push({ limit: params.limit, offset: params.offset })
      const offset = Number(params.offset) || 0
      const count = Math.max(0, Math.min(Number(params.limit) || 100, 1200 - offset))
      return { songs: Array.from({ length: count }, (_, index) => rawSong(offset + index)) }
    }
    throw new Error('unexpected route: ' + route)
  })
  try {
    const first = await getPlaylistSongsPage('77', 100, 0, 'MUSIC_U=test')
    assert.equal(first.songs.length, 100)
    assert.equal(first.trackCount, 1200)
    assert.equal(first.hasMore, true)
    assert.equal(first.nextOffset, 100)
    const last = await getPlaylistSongsPage('77', 100, 1100, 'MUSIC_U=test')
    assert.equal(last.songs.length, 100)
    assert.equal(last.hasMore, false)
    assert.deepEqual(pageCalls.map((call) => call.offset), [0, 1100])
    const shaped = await playlistSongsPage('netease', '77', 'MUSIC_U=test', {}, { limit: 100, offset: 0 })
    assert.equal(shaped.songs.length, 100)
    assert.equal(shaped.songs[0].id, '100000')
    assert.equal(shaped.hasMore, true)
    assert.equal(shaped.nextOffset, 100)
  } finally {
    resetUpstreamOverride()
  }
}

