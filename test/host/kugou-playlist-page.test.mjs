/**
 * KuGou playlist paging asks the page API first.
 *
 * The old order asked the account list (one or two upstream calls) for every page, and when
 * one of those was slow or rate-limited the open fell into the legacy full-read path — the
 * "the playlist stays on skeletons until I switch away and back" report. The row's id is the
 * id playlist_track_all takes, so one call is enough.
 */
import assert from 'node:assert/strict'
import { playlistSongsPage } from '../../src/host/providers/index.js'
import { setUpstreamOverride, resetUpstreamOverride } from '../../src/host/services/kugou-api.js'

const calls = []

function rawSong(index) {
  return {
    hash: 'a'.repeat(24) + String(index).padStart(8, '0'),
    audio_name: 'Track ' + index,
    authors: [{ author_name: 'Artist' }],
    timelength: 180000,
    album_id: 1,
    album_name: 'Album',
  }
}

setUpstreamOverride(async (operation, params) => {
  calls.push(operation)
  if (operation === 'playlist_track_all') {
    const size = Number(params.pagesize) || 100
    const page = Number(params.page) || 1
    const offset = (page - 1) * size
    const total = 150
    const count = Math.max(0, Math.min(size, total - offset))
    return {
      status: 1,
      body: { data: { count: total, songs: Array.from({ length: count }, (_, index) => rawSong(offset + index)) } },
      cookie: [],
    }
  }
  throw new Error('the account list must not be asked for a playlist page: ' + operation)
})

try {
  const first = await playlistSongsPage('kugouLite', 'collection_3_1_2_0', {}, {}, { limit: 100, offset: 0 })
  assert.equal(first.songs.length, 100)
  assert.equal(first.trackCount, 150)
  assert.equal(first.hasMore, true)
  assert.equal(first.nextOffset, 100)
  assert.equal(first.songs[0].title, 'Track 0')
  assert.deepEqual(calls, ['playlist_track_all'], 'one page call, no account-list lookup')

  calls.length = 0
  const second = await playlistSongsPage('kugouLite', 'collection_3_1_2_0', {}, {}, { limit: 100, offset: 100 })
  assert.equal(second.songs.length, 50)
  assert.equal(second.hasMore, false)
  assert.deepEqual(calls, ['playlist_track_all'], 'a later page is still one call')
  console.log('kugou-playlist-page.test.mjs ok')
} finally {
  resetUpstreamOverride()
}
