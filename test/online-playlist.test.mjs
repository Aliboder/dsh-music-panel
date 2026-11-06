import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isPlaylistUrl, parseM3U, parsePLS } from '../lib/online-playlist.js'

test('parseM3U reads EXTINF entries and resolves relative urls', () => {
  const text = [
    '#EXTM3U',
    '#EXTINF:123,Artist - Song A',
    'song-a.mp3',
    '#EXTINF:-1,Radio Live',
    'https://radio.example/stream',
    '# comment',
    'song-b.flac',
  ].join('\n')
  const tracks = parseM3U(text, 'https://cdn.example/lists/list.m3u')
  assert.equal(tracks.length, 3)
  assert.deepEqual(tracks[0], {
    name: 'Song A',
    artist: 'Artist',
    durationSec: 123,
    url: 'https://cdn.example/lists/song-a.mp3',
  })
  assert.equal(tracks[1].name, 'Radio Live')
  assert.equal(tracks[1].durationSec, 0)
  assert.equal(tracks[2].url, 'https://cdn.example/lists/song-b.flac')
  assert.equal(tracks[2].name, 'song-b.flac')
})

test('parseM3U tolerates urls without EXTINF metadata', () => {
  const tracks = parseM3U('https://a.example/x.mp3\nhttps://a.example/y.mp3', 'https://a.example/')
  assert.equal(tracks.length, 2)
  assert.equal(tracks[0].name, 'x.mp3')
  assert.equal(tracks[1].artist, '')
})

test('parsePLS reads File/Title/Length in order', () => {
  const text = [
    '[playlist]',
    'NumberOfEntries=2',
    'File1=https://a.example/one.mp3',
    'Title1=First - Track One',
    'Length1=42',
    'File2=https://a.example/two.mp3',
    'Title2=Second',
    'Length2=-1',
  ].join('\n')
  const tracks = parsePLS(text, 'https://a.example/list.pls')
  assert.equal(tracks.length, 2)
  assert.deepEqual(tracks[0], {
    name: 'Track One',
    artist: 'First',
    durationSec: 42,
    url: 'https://a.example/one.mp3',
  })
  assert.equal(tracks[1].name, 'Second')
  assert.equal(tracks[1].durationSec, 0)
})

test('isPlaylistUrl distinguishes playlists from audio files', () => {
  assert.equal(isPlaylistUrl('https://a.example/list.m3u'), true)
  assert.equal(isPlaylistUrl('https://a.example/list.m3u8'), true)
  assert.equal(isPlaylistUrl('https://a.example/list.pls'), true)
  assert.equal(isPlaylistUrl('https://a.example/song.mp3'), false)
  assert.equal(isPlaylistUrl('not a url'), false)
})

test('empty input parses to an empty list', () => {
  assert.deepEqual(parseM3U(null, 'https://a.example/'), [])
  assert.deepEqual(parsePLS('', 'https://a.example/'), [])
})
