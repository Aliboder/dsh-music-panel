/**
 * Artist/album channels that moved to the Folia-pinned upstream routes, with
 * fake package servers.
 */

import assert from 'node:assert/strict'
import { albumSongs, artistAlbums, artistSongs, searchPage } from '../../src/host/providers/index.js'
import { resetUpstreamOverride as resetNetease, setUpstreamOverride as setNetease } from '../../src/host/services/netease-api.js'
import { resetUpstreamOverride as resetQq, setUpstreamOverride as setQq } from '../../src/host/services/qq-api.js'
import { resetUpstreamOverride as resetKugou, setUpstreamOverride as setKugou } from '../../src/host/services/kugou-api.js'

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

// ── KuGou: artist_audios / album_detail + album_songs / artist_detail + artist_albums ──
{
  const calls = []
  setKugou(async (operation, params) => {
    calls.push([operation, params])
    if (operation === 'artist_audios') {
      return { body: { data: { lists: [{ hash: 'kg-song', songname: '晴天', singername: '周杰伦', albumname: '叶惠美' }] } }, cookie: [] }
    }
    if (operation === 'album_detail') {
      return { body: { data: [{ album_id: 'kg-album', album_name: '叶惠美', sizable_cover: 'https://cover', author_name: '周杰伦' }] }, cookie: [] }
    }
    if (operation === 'album_songs') {
      return {
        body: {
          total: 1,
          data: {
            total: 1,
            songs: [{
              base: { audio_name: '晴天', album_id: 966846, author_name: '周杰伦' },
              audio_info: { hash: 'kg-song', duration: 269000 },
              album_info: { album_name: '叶惠美', cover: 'https://cover' },
              authors: [{ author_id: 3520, author_name: '周杰伦' }],
            }],
          },
        },
        cookie: [],
      }
    }
    if (operation === 'artist_detail') {
      return { body: { data: { author_id: '12345', author_name: '周杰伦', sizable_avatar: 'https://a', intro: 'bio' } }, cookie: [] }
    }
    if (operation === 'artist_albums') {
      return { body: { data: { lists: [{ album_id: 'kg-album', album_name: '叶惠美', sizable_cover: 'https://cover', author_name: '周杰伦', song_count: 1 }] } }, cookie: [] }
    }
    throw new Error('unexpected KuGou operation: ' + operation)
  })

  const artistPage = await artistSongs('kugou', '周杰伦', '', {}, '12345', { limit: 10, offset: 0 })
  assert.equal(artistPage.songs[0].id, 'kg-song')
  assert.equal(artistPage.hasMore, false)
  assert.equal(calls[0][0], 'artist_audios')

  const album = await albumSongs('kugou', 'kg-album', '', {})
  assert.equal(album.name, '叶惠美')
  assert.equal(album.songs[0].id, 'kg-song')
  assert.equal(calls.some(([operation]) => operation === 'album_detail'), true)
  assert.equal(calls.some(([operation]) => operation === 'album_songs'), true)

  const artist = await artistAlbums('kugou', '12345', '', {})
  assert.equal(artist.artist.name, '周杰伦')
  assert.equal(artist.albums[0].id, 'kg-album')
  assert.equal(calls.some(([operation]) => operation === 'artist_detail'), true)
  assert.equal(calls.some(([operation]) => operation === 'artist_albums'), true)
  resetKugou()
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
  const calls = []
  setKugou(async (operation, params) => {
    calls.push([operation, params])
    if (operation === 'artist_audios') {
      const pageNo = Number(params.page) || 1
      const size = Number(params.pagesize) || 10
      const rows = Array.from({ length: size }, (_, index) => {
        const n = (pageNo - 1) * size + index
        return {
          base: { audio_name: '歌 ' + n, album_id: 1, author_name: '歌手' },
          audio_info: { hash: 'kg' + n, duration: 200000 },
          album_info: { album_name: '专辑' },
          authors: [{ author_name: '歌手' }],
        }
      })
      return { body: { data: { total: 25, lists: rows } }, cookie: [] }
    }
    throw new Error('unexpected KuGou operation: ' + operation)
  })
  const head = await artistSongs('kugouLite', '歌手', '', {}, '123', { limit: 10, offset: 0 })
  assert.equal(head.songs.length, 10)
  assert.equal(head.total, 25)
  assert.equal(head.hasMore, true)
  assert.equal(head.nextOffset, 10)
  const next = await artistSongs('kugouLite', '歌手', '', {}, '123', { limit: 10, offset: head.nextOffset })
  assert.equal(next.songs[0].id, 'kg10', 'the second page starts at the next row')
  assert.equal(calls[1][1].page, 2)
  resetKugou()
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
  // KuGou answers one capped list: the Host reports no next page, so the UI stops asking.
  setKugou(async (operation) => {
    if (operation === 'search') {
      return { body: { status: 1, data: { total: 900, lists: [{ FileHash: 'H1', SongName: 'A', SingerName: '歌手', Duration: 200 }] } }, cookie: [] }
    }
    throw new Error('unexpected KuGou operation: ' + operation)
  })
  const page = await searchPage('kugouLite', '歌', '', {}, 1)
  assert.equal(page.hasMore, false, 'a one-shot search has no next page')
  assert.equal(page.total, page.results.length, 'the total matches what was actually returned')
  resetKugou()
}

console.log('catalog-channels.test.mjs ok')
