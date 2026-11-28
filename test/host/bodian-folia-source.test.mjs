/**
 * 波点移植源：定义 → 本插件源对象的映射（替身定义，不连网）。
 */

import assert from 'node:assert/strict'
import { createFoliaSource } from '../../src/host/providers/sources/folia-bridge/bridge.js'

const texts = { resolveText: (value) => (typeof value === 'string' ? value : (value?.i18nKey ?? '')) }
const song = (id, extra = {}) => ({ id, title: 'song ' + id, artists: [{ id: '1', name: '歌手' }], durationMs: 180000, data: {}, ...extra })

// 空定义：什么都没有，就没有任何方法（声明与实现同源）。
{
  const source = createFoliaSource({ definition: { id: 'bodian', capabilities: {} }, sourceId: 'bodian', texts })
  assert.equal(source.id, 'bodian')
  assert.equal(source.capabilities.search, false)
  assert.equal(typeof source.search, 'undefined')
  assert.equal(typeof source.stream, 'undefined')
  assert.equal(source.availability().configured, true)
}

// 搜索 / 分页 / 取流 / 歌词 / 歌单 / 推荐 / 收藏 / 写入
{
  const calls = []
  const definition = {
    id: 'bodian',
    capabilities: {
      'search@1': {
        async searchSongs(query, limit, offset) {
          calls.push(['search', query, limit, offset])
          return { items: [song('s' + offset)], total: 30, hasMore: offset + 1 < 30, nextOffset: offset + 1 }
        },
        async searchAlbums() { return { items: [{ id: 'al1', type: 'album', name: '专辑' }], total: 1, hasMore: false } },
      },
      'songs@1': { async getSong(id) { return song(id) } },
      'playback.audio@1': { async getAudioSource(input, quality) { calls.push(['audio', input.id, quality]); return { url: 'https://cdn/x.mp3', quality: 'high', preview: false } } },
      'lyrics@1': {
        async getLyrics() {
          return {
            main: { lines: [{ startTime: 0, endTime: 1000, text: '一行' }] },
            wordByWord: { lines: [{ startTime: 0, endTime: 1000, text: '一行', words: [{ startTime: 0, endTime: 500, text: '一' }, { startTime: 500, endTime: 1000, text: '行' }] }] },
            chorusRanges: [{ startTime: 0, endTime: 1 }],
          }
        },
      },
      'library@1': {
        async getUserPlaylists(userId, limit, offset) {
          calls.push(['playlists', userId, limit, offset])
          return { items: [{ id: 'p1', type: 'playlist', name: '我的歌单', trackCount: 2, isOwned: true }], hasMore: false }
        },
        async getLikedSongIds() { return ['s1', 's2'] },
      },
      'catalog@1': {
        async getPlaylistTracks(id, limit, offset, collection) {
          calls.push(['tracks', id, limit, offset, collection?.data?.sidecar ?? null])
          return { items: [song('t1')], hasMore: false, total: 1 }
        },
        async getListeningRankTracks(range) {
          calls.push(['rank', range])
          return { items: [{ ...song('r1'), row: { listenCount: 7 } }], hasMore: false }
        },
      },
      'recommendations@1': {
        async getRecommendedCollections(limit) { return [{ id: 'card1', type: 'playlist', name: '推荐卡', data: { sidecar: 'x' } }] },
        async getPersonalFm() { return [song('fm1')] },
      },
      'mutations@1': {
        async likeSong(target, liked) { calls.push(['like', target.id, liked]); return true },
        async updatePlaylistTracks(operation, playlist, tracks) { calls.push(['playlist', operation, playlist.id, tracks.length]); return true },
      },
      'reports@1': { async reportPlayback() { return true } },
    },
  }
  const source = createFoliaSource({ definition, sourceId: 'bodian', texts, displayName: 'Bodian Music', qualityLevels: ['original'] })

  assert.equal(source.capabilities.search, true)
  assert.equal(source.capabilities.searchAlbums, true)
  assert.equal(source.capabilities.playback, true)
  assert.equal(source.capabilities.userPlaylists, true)
  assert.equal(source.capabilities.likeWrite, true)
  assert.equal(source.capabilities.playlistAdd, true)
  assert.equal(source.capabilities.recommendations, true)
  assert.equal(source.capabilities.playbackReports, false, 'reports@1 不在映射里，就不声明')

  const searched = await source.searchPage('歌', {}, 2)
  assert.equal(searched.page, 2)
  assert.equal(searched.results[0].id, 's100', 'page 2 asks from offset 100')
  assert.equal(calls[0][2], 100)

  const stream = await source.stream('t1', {}, 'lossless')
  assert.equal(stream.url, 'https://cdn/x.mp3')
  assert.equal(stream.quality, 'high')
  assert.deepEqual(calls.find(([kind]) => kind === 'audio'), ['audio', 't1', 'lossless'])

  const words = await source.lyric('t1')
  assert.equal(words.wordLevel, true)
  assert.equal(words.lines[0].end, 1)
  assert.equal(words.lines[0].words[1].text, '行')

  const playlists = await source.myPlaylists()
  assert.equal(playlists[0].provider, 'bodian')
  assert.equal(playlists[0].addable, true)

  // 推荐卡先登记集合，歌单页才能带着它的 data 侧车去读
  const cards = await source.recommendedCollections({}, 10)
  assert.equal(cards[0].data.sidecar, 'x')
  const tracks = await source.playlistSongsPage('card1', {}, { limit: 10, offset: 0 })
  assert.equal(tracks.songs[0].id, 't1')
  assert.equal(calls.find(([kind]) => kind === 'tracks')[4], 'x', 'the remembered collection travels with the read')

  assert.deepEqual(await source.likedIds(), ['online:bodian:s1', 'online:bodian:s2'])
  assert.equal(await source.setLiked({ id: 's1' }, true), true)
  assert.equal(await source.addToPlaylist({ id: 's1' }, 'p1'), true)
  assert.equal(await source.removeFromPlaylist({ id: 's1' }, 'p1'), true)

  const rank = await source.listeningRank('week')
  assert.equal(rank[0].listenCount, 7)
  assert.deepEqual(calls.find(([kind]) => kind === 'rank'), ['rank', 'week'])
}

console.log('bodian-folia-source.test ok')
