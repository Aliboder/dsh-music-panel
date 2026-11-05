import assert from 'node:assert/strict'
import {
  SOURCES,
  itunesCandidate,
  musicBrainzCandidate,
  neteaseCandidate,
  qqCandidate,
  scoreCandidate,
} from '../lib/online.js'

assert.deepEqual(SOURCES, ['netease', 'qq', 'itunes', 'musicbrainz'])

const netease = neteaseCandidate({
  id: 1,
  name: '红山果',
  duration: 278000,
  artists: [{ name: '安与骑兵' }],
  album: { name: '安与骑兵', publishTime: 1666800000000, picUrl: 'https://p1.music.126.net/x.jpg' },
})
assert.equal(netease.title, '红山果')
assert.equal(netease.artist, '安与骑兵')
assert.equal(netease.album, '安与骑兵')
assert.equal(netease.year, '2022')
assert.equal(netease.coverUrl, 'https://p1.music.126.net/x.jpg')

const qq = qqCandidate({
  songname: '红山果',
  singer: [{ name: '安与骑兵' }],
  albumname: '安与骑兵',
  albummid: '001xOM5Q2mxxUw',
  interval: 278,
  pubtime: 1376323200,
  songid: 2,
})
assert.equal(qq.year, '2013')
assert.match(qq.coverUrl, /001xOM5Q2mxxUw/)
assert.equal(qq.disc, '', 'cdIdx is not a disc number')

const itunes = itunesCandidate({
  trackId: 3,
  trackName: 'Song',
  artistName: 'A',
  collectionName: 'B',
  releaseDate: '2013-08-12T07:00:00Z',
  trackNumber: 9,
  discNumber: 1,
  primaryGenreName: 'Pop',
  artworkUrl100: 'https://x/100x100bb.jpg',
  trackTimeMillis: 200000,
})
assert.equal(itunes.year, '2013')
assert.equal(itunes.track, '9')
assert.match(itunes.coverUrl, /600x600/)

const mb = musicBrainzCandidate({
  id: 'r',
  title: 'Song',
  'artist-credit': [{ name: 'A' }],
  releases: [{ id: 'rel', title: 'B', date: '2012-01-01', media: [{ track: [{ number: '3' }] }] }],
})
assert.equal(mb.year, '2012')
assert.equal(mb.track, '3')
assert.match(mb.coverUrl, /coverartarchive\.org\/release\/rel/)

const input = { title: '红山果', artist: '安与骑兵' }
const exact = scoreCandidate({ title: '红山果', artist: '安与骑兵', coverUrl: 'x' }, input)
const weak = scoreCandidate({ title: '红山果', artist: '别人', coverUrl: '' }, input)
assert.ok(exact > weak, 'exact title+artist ranks above a partial match')

console.log('online.test.mjs ok')
