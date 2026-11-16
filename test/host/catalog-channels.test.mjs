/**
 * Artist/album channels that moved to the Folia-pinned upstream routes, with
 * fake package servers.
 */

import assert from 'node:assert/strict'
import { albumSongs, artistAlbums, artistSongs } from '../../src/host/providers/index.js'
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

  const songs = await artistSongs('qq', '周杰伦', 'cookie', {}, 'qq-artist', { limit: 10, offset: 0 })
  assert.equal(songs[0].id, 'qq-song')
  assert.equal(songs[0].title, '晴天')
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

  const songs = await artistSongs('kugou', '周杰伦', '', {}, '12345', { limit: 10, offset: 0 })
  assert.equal(songs[0].id, 'kg-song')
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

console.log('catalog-channels.test.mjs ok')
