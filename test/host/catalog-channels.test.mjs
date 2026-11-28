/**
 * Artist/album channels that moved to the Folia-pinned upstream routes, with
 * fake package servers.
 */

import assert from 'node:assert/strict'
import { albumSongs, artistAlbums, artistSongs, searchPage } from '../../src/host/providers/index.js'
import { resetUpstreamOverride as resetNetease, setUpstreamOverride as setNetease } from '../../src/host/services/netease-api.js'
import { resetUpstreamOverride as resetQq, setUpstreamOverride as setQq } from '../../src/host/services/qq-api.js'
import { installKugouFoliaStub, resetKugouFolia } from './helpers/kugou-folia-stub.mjs'

// ── QQ: /getSingerHotsong + /getAlbumInfo + /getSingerAlbum ────────────────
{
  const calls = []
  setQq(async (route, params) => {
    calls.push([route, params])
    if (route === '/getSingerHotsong') {
      return {
        response: {
          singer: {
            data: {
              singer_info: { singer_name: '周杰伦', singer_pic: 'https://a' },
              singer_brief: 'bio',
              songlist: [{
                mid: 'qq-song', name: '晴天', singer: [{ name: '周杰伦', mid: 'qq-artist' }],
                album: { name: '叶惠美', mid: 'qq-album' }, interval: 269,
              }],
            },
          },
        },
      }
    }
    if (route === '/getAlbumInfo') {
      return {
        response: {
          data: {
            name: '叶惠美', mid: 'qq-album', pic: 'https://cover', singername: '周杰伦',
            list: [{ songmid: 'qq-song', songname: '晴天', singer: [{ name: '周杰伦' }], albumname: '叶惠美', interval: 269 }],
          },
        },
      }
    }
    if (route === '/getSingerAlbum') {
      return {
        response: {
          singer: { data: { albumList: [{ albumMid: 'qq-album', albumName: '叶惠美', singername: '周杰伦', totalNum: 1 }] } },
        },
      }
    }
    throw new Error('unexpected QQ route: ' + route)
  })

  const artistPage = await artistSongs('qq', '周杰伦', 'cookie', {}, 'qq-artist', { limit: 10, offset: 0 })
  assert.equal(artistPage.songs[0].id, 'qq-song')
  assert.equal(artistPage.songs[0].title, '晴天')
  assert.equal(artistPage.total, 1)
  assert.equal(artistPage.hasMore, false)
  assert.equal(artistPage.nextOffset, 1)
  assert.equal(calls[0][0], '/getSingerHotsong')
  assert.equal(calls[0][1].singermid, 'qq-artist')

  const album = await albumSongs('qq', 'qq-album', 'cookie')
  assert.equal(album.name, '叶惠美')
  assert.equal(album.songs[0].id, 'qq-song')
  assert.equal(calls.some(([route]) => route === '/getAlbumInfo'), true)

  const artist = await artistAlbums('qq', 'qq-artist', 'cookie')
  assert.equal(artist.artist.name, '周杰伦')
  assert.equal(artist.albums[0].id, 'qq-album')
  assert.equal(artist.albums[0].trackCount, 1)
  assert.equal(calls.some(([route]) => route === '/getSingerAlbum'), true)
  resetQq()
}

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
  const calls = []
  setQq(async (route, params) => {
    calls.push([route, params])
    if (route === '/getSingerHotsong') {
      const pageNo = Number(params.page) || 1
      const limit = Number(params.limit) || 10
      const rows = Array.from({ length: limit }, (_, index) => {
        const n = (pageNo - 1) * limit + index
        return { mid: 'm' + n, name: '歌 ' + n, singer: [{ name: '歌手', mid: 'ar' }], album: { name: '专辑', mid: 'al' }, interval: 200 }
      })
      return { response: { singer: { data: { songlist: rows, total_song: 25 } } } }
    }
    throw new Error('unexpected QQ route: ' + route)
  })
  const head = await artistSongs('qq', '歌手', 'c', {}, 'ar', { limit: 10, offset: 0 })
  assert.equal(head.songs.length, 10)
  assert.equal(head.total, 25)
  assert.equal(head.hasMore, true, 'the artist page knows there is a second page')
  assert.equal(head.nextOffset, 10)
  const next = await artistSongs('qq', '歌手', 'c', {}, 'ar', { limit: 10, offset: head.nextOffset })
  assert.equal(next.songs[0].id, 'm10', 'the second page starts at the next row')
  assert.equal(calls[1][1].page, 2, 'the offset really asks for page 2')
  resetQq()
}

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
  const calls = []
  setNetease(async (route, params) => {
    calls.push([route, params])
    if (route === '/artist/songs') {
      const offset = Number(params.offset) || 0
      const limit = Number(params.limit) || 10
      const rows = Array.from({ length: limit }, (_, index) => ({
        id: 1000 + offset + index,
        name: '歌 ' + (offset + index),
        ar: [{ id: 1, name: '歌手' }],
        al: { id: 2, name: '专辑' },
        dt: 200000,
      }))
      return { songs: rows, more: offset + limit < 30, total: 30 }
    }
    throw new Error('unexpected NetEase route: ' + route)
  })
  const head = await artistSongs('netease', '歌手', 'MUSIC_U=test', {}, '777', { limit: 10, offset: 0 })
  assert.equal(head.total, 30)
  assert.equal(head.hasMore, true)
  assert.equal(head.nextOffset, 10)
  const next = await artistSongs('netease', '歌手', 'MUSIC_U=test', {}, '777', { limit: 10, offset: head.nextOffset })
  assert.equal(next.songs[0].id, '1010', 'the second page starts at the next row')
  assert.equal(calls[1][1].offset, 10)
  resetNetease()
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
