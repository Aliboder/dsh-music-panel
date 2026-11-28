/**
 * 歌手页 / 专辑页 / 搜索分页的契约，现在只剩移植源一条路：
 * 门面（providers/index.js）的酷狗委派 → sources/kugou-folia → 上游 catalog@1 / search@1。
 *
 * 网易云与 QQ 由各自的 Folia 源对象直连 bridge，分页与形状契约在
 * test/host/folia-bridge.test.mjs 里验证。
 */

import assert from 'node:assert/strict'
import { albumSongs, artistAlbums, artistSongs, searchPage } from '../../src/host/providers/index.js'
import { installKugouFoliaStub, resetKugouFolia } from './helpers/kugou-folia-stub.mjs'

// ── KuGou（Folia 移植源）：catalog@1 的歌手歌曲 / 专辑详情+曲目 / 歌手详情+专辑 ──
{
  const calls = []
  const kgSong = {
    id: 'kg-song',
    title: '晴天',
    artists: [{ id: '3520', name: '周杰伦' }],
    album: { id: 'kg-album', name: '叶惠美', coverUrl: 'https://cover' },
    durationMs: 269000,
    data: { hash: 'kg-song' },
  }
  installKugouFoliaStub({
    'catalog@1': {
      async getArtistSongs(id, limit, offset) {
        calls.push(['getArtistSongs', id])
        return { items: [kgSong], hasMore: false, total: 1, nextOffset: 1 }
      },
      async getAlbumDetail(id) {
        calls.push(['getAlbumDetail', id])
        return { id, type: 'album', name: '叶惠美', coverUrl: 'https://cover', artists: [{ id: '3520', name: '周杰伦' }], trackCount: 1 }
      },
      async getAlbumTracks(id, limit, offset) {
        calls.push(['getAlbumTracks', id])
        return { items: [kgSong], hasMore: false, total: 1, nextOffset: 1 }
      },
      async getArtistDetail(id) {
        calls.push(['getArtistDetail', id])
        return { id, type: 'artist', name: '周杰伦', coverUrl: 'https://a', description: 'bio' }
      },
      async getArtistAlbums(id, limit, offset) {
        calls.push(['getArtistAlbums', id])
        return { items: [{ id: 'kg-album', type: 'album', name: '叶惠美', coverUrl: 'https://cover', artists: [{ id: '3520', name: '周杰伦' }], trackCount: 1 }], hasMore: false }
      },
    },
  })

  const artistPage = await artistSongs('kugou', '周杰伦', '', {}, '12345', { limit: 10, offset: 0 })
  assert.equal(artistPage.songs[0].id, 'kg-song')
  assert.equal(artistPage.hasMore, false)
  assert.equal(calls[0][0], 'getArtistSongs')

  const album = await albumSongs('kugou', 'kg-album', '', {})
  assert.equal(album.name, '叶惠美')
  assert.equal(album.songs[0].id, 'kg-song')
  assert.equal(calls.some(([operation]) => operation === 'getAlbumDetail'), true)
  assert.equal(calls.some(([operation]) => operation === 'getAlbumTracks'), true)

  const artist = await artistAlbums('kugou', '12345', '', {})
  assert.equal(artist.artist.name, '周杰伦')
  assert.equal(artist.albums[0].id, 'kg-album')
  assert.equal(calls.some(([operation]) => operation === 'getArtistDetail'), true)
  assert.equal(calls.some(([operation]) => operation === 'getArtistAlbums'), true)
  resetKugouFolia()
}

// ── 翻页：歌手页按「这一页吃掉的原始行」前进，搜索只在自己能翻页时报 hasMore ──
{
  // 移植源的歌手页分页：游标按上游这一页实际给的行数前进（上游 pageOf 已这么定），
  // 我们只保证 nextOffset 原样传到下一页，并且下一页真的换了 offset。
  const calls = []
  installKugouFoliaStub({
    'catalog@1': {
      async getArtistSongs(id, limit, offset) {
        calls.push([id, limit, offset])
        const rows = Array.from({ length: limit }, (_, index) => {
          const n = offset + index
          return { id: 'kg' + n, title: '歌 ' + n, artists: [{ id: '1', name: '歌手' }], durationMs: 200000, data: { hash: 'kg' + n } }
        })
        return { items: rows, total: 25, hasMore: offset + rows.length < 25, nextOffset: offset + rows.length }
      },
    },
  })
  const head = await artistSongs('kugou', '歌手', '', {}, '123', { limit: 10, offset: 0 })
  assert.equal(head.songs.length, 10)
  assert.equal(head.total, 25)
  assert.equal(head.hasMore, true)
  assert.equal(head.nextOffset, 10)
  const next = await artistSongs('kugou', '歌手', '', {}, '123', { limit: 10, offset: head.nextOffset })
  assert.equal(next.songs[0].id, 'kg10', 'the second page starts at the next row')
  assert.equal(calls[1][2], 10, 'the second read asks from the cursor the first one gave')
  resetKugouFolia()
}

{
  // 移植源的搜索按上游的 hasMore 答：上游说还有，Host 就说还有；上游说没有，UI 就停。
  installKugouFoliaStub({
    'search@1': {
      async searchSongs(query, limit, offset) {
        return {
          items: [{ id: 'H1', title: 'A', artists: [{ id: '1', name: '歌手' }], durationMs: 200000, data: { hash: 'H1' } }],
          total: 1,
          hasMore: false,
          nextOffset: 1,
        }
      },
    },
  })
  const page = await searchPage('kugou', '歌', '', {}, 1)
  assert.equal(page.hasMore, false, 'the source answered the last page')
  assert.equal(page.results.length, 1)
  assert.equal(page.total, 1)
  resetKugouFolia()
}

console.log('catalog-channels.test.mjs ok')
