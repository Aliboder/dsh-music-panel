/**
 * QQ playlist paging resolves its metadata before it pages.
 *
 * The page route needs the tid/dirid the account list carries. A playlist opened from a restored
 * view or a search result can arrive before that list was read in this process; the route used to
 * fall straight to the anonymous whole-list read (wrong route for an owned playlist, and one full
 * download per page). It now asks the account list once, then pages; the whole-list fallback for a
 * playlist it cannot page is kept for a moment so "load more" does not re-download it.
 */
import assert from 'node:assert/strict'
import { playlistSongsPage } from '../../src/host/providers/index.js'
import { resetUpstreamOverride, setUpstreamOverride } from '../../src/host/services/qq-api.js'

const calls = []
const total = 150

function row(index) {
  return { mid: 'm' + index, name: 'Track ' + index, singer: [], album: {} }
}

setUpstreamOverride(async (route, params) => {
  calls.push({ route, params })
  if (route === '/user/playlist') {
    return { playlist: [{ dirId: 105, tid: 105, dirName: 'Owned', songnum: total, picUrl: '' }] }
  }
  if (route === '/user/playlist-detail') {
    const offset = Number(params.offset) || 0
    const limit = Number(params.limit) || 100
    const count = Math.max(0, Math.min(limit, total - offset))
    return { songs: Array.from({ length: count }, (_, index) => row(offset + index)), total, more: offset + count < total }
  }
  throw new Error('unexpected QQ route: ' + route)
})

const originalFetch = globalThis.fetch

try {
  const first = await playlistSongsPage('qq', '105', '', {}, { limit: 100, offset: 0 })
  assert.equal(first.songs.length, 100)
  assert.equal(first.trackCount, total)
  assert.equal(first.hasMore, true)
  assert.equal(first.songs[0].title, 'Track 0')
  const listCalls = calls.filter((call) => call.route === '/user/playlist').length
  assert.equal(listCalls, 1, 'the account list is read once to learn the tid')
  const detail = calls.filter((call) => call.route === '/user/playlist-detail')
  assert.equal(detail.length, 1)
  assert.equal(String(detail[0].params.offset), '0')
  assert.equal(String(detail[0].params.tid), '105')

  calls.length = 0
  const second = await playlistSongsPage('qq', '105', '', {}, { limit: 100, offset: 100 })
  assert.equal(second.songs.length, 50)
  assert.equal(second.hasMore, false)
  assert.equal(calls.filter((call) => call.route === '/user/playlist').length, 0, 'the known metadata is not re-read')
  assert.equal(String(calls.filter((call) => call.route === '/user/playlist-detail')[0].params.offset), '100')

  // A playlist the account list does not know falls back to the whole-list read; two pages of
  // one session must not download it twice.
  let wholeReads = 0
  globalThis.fetch = async () => {
    wholeReads += 1
    const body = JSON.stringify({
      cdlist: [{ dissname: 'Public', songnum: 2, songlist: [{ songmid: 'a', songname: 'A', singer: [], interval: 1 }, { songmid: 'b', songname: 'B', singer: [], interval: 1 }] }],
    })
    return {
      ok: true,
      status: 200,
      text: async () => 'MusicJsonCallback(' + body + ')',
      json: async () => JSON.parse(body),
    }
  }
  calls.length = 0
  const pageA = await playlistSongsPage('qq', 'public-9', '', {}, { limit: 1, offset: 0 })
  const pageB = await playlistSongsPage('qq', 'public-9', '', {}, { limit: 1, offset: 1 })
  assert.equal(pageA.songs.length, 1)
  assert.equal(pageB.songs.length, 1)
  assert.equal(wholeReads, 1, 'the whole-list fallback is kept across the page session')
  console.log('qq-playlist-page.test.mjs ok')
} finally {
  globalThis.fetch = originalFetch
  resetUpstreamOverride()
}
