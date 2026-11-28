/**
 * 取流侧车：Folia 宿主收的是整首歌（omni.getAudioSource(song)），本插件 HTTP 只带得动 id。
 * 这个测试重现 QQ 的故障：只给 id 时上游报「QQ song has no songmid」，
 * 宿主见过这首歌（列表/搜索/详情）后，按 id 找回 songmid/mediaMid，取流就能成。
 */
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  clearSongRegistry,
  flushSongRegistry,
  initSongRegistry,
  playbackSongOf,
  reloadSongRegistryForTest,
  rememberSong,
} from '../../src/host/providers/sources/song-registry.js'
import { songOf } from '../../src/host/providers/sources/folia-bridge/dto.js'
import { clearDataCategory } from '../../src/host/services/media/plugin-data.js'
import { createFoliaSource } from '../../src/host/providers/sources/folia-bridge/bridge.js'

const dir = mkdtempSync(join(tmpdir(), 'dsh-song-registry-'))
try {
  initSongRegistry(dir)
  // 宿主交出去过这首歌：id 是数字 songid，播放键 songmid 在 data / lyricIds 里。
  const track = songOf(
    {
      id: 12345,
      publicId: '12345',
      title: 'T',
      artists: [],
      durationMs: 1000,
      data: { songMid: 'mid-abc', mediaMid: 'media-abc' },
      lyricIds: { qq: 'mid-abc' },
    },
    'qq',
    null,
  )
  assert.equal(track.id, '12345')
  assert.equal(playbackSongOf('qq', '12345')?.data?.songMid, 'mid-abc', 'the sidecar is remembered when the song is handed out')

  // 重建 QQ 的取流：拿不到 songmid 就拒绝（上游原文），拿到就回地址。
  let received = null
  const definition = {
    id: 'qq',
    capabilities: {
      'playback.audio@1': {
        async getAudioSource(song) {
          received = song
          if (!song.data || !song.data.songMid) {
            throw Object.assign(new Error('QQ song has no songmid'), { code: 'invalid-response' })
          }
          return { url: 'https://example.test/qq.m4a', quality: 'high' }
        },
      },
    },
  }
  const source = createFoliaSource({ definition, sourceId: 'qq', texts: null })
  const stream = await source.stream('12345')
  assert.equal(stream.url, 'https://example.test/qq.m4a')
  assert.equal(received.id, '12345')
  assert.equal(received.data.songMid, 'mid-abc', 'the play request got the songmid back')
  assert.equal(received.data.mediaMid, 'media-abc', 'and the media mid for higher qualities')
  assert.equal(received.lyricIds.qq, 'mid-abc', 'lyrics see the same sidecar')

  // 没有侧车时维持最小形状（上游自己拒绝），不会伪造 songmid。
  const empty = createFoliaSource({
    definition: { id: 'qq', capabilities: { 'playback.audio@1': { async getAudioSource() { return { url: 'u', quality: 'high' } } } } },
    sourceId: 'qq',
    texts: null,
  })
  assert.equal((await empty.stream('99999')).url, 'u')

  // 重启后仍在：落盘 → 清内存 → 重新读。
  flushSongRegistry()
  assert.ok(existsSync(join(dir, 'online-songs.json')), 'the sidecars are written to the data directory')
  reloadSongRegistryForTest()
  assert.equal(playbackSongOf('qq', '12345')?.data?.songMid, 'mid-abc', 'a restart reads the sidecar back')

  // 「清空插件所有数据」的 cache 分类也认这个文件（inspectData 的分类由 plugin-data 定义）。
  await clearDataCategory(dir, 'cache')
  assert.equal(existsSync(join(dir, 'online-songs.json')), false, 'clearing the cache category removes the sidecars')
  clearSongRegistry()
  assert.equal(playbackSongOf('qq', '12345'), null)

  // 别的平台也走同一张表；kugou/kugouLite 是同一条源。
  rememberSong('bodian', { id: 'b1', data: { freeSign: 'fs' } })
  rememberSong('kugou', { id: 'h1', data: { hash: 'h1', albumId: 'a1' }, variant: 'cloud' })
  assert.equal(playbackSongOf('bodian', 'b1')?.data?.freeSign, 'fs')
  assert.equal(playbackSongOf('kugouLite', 'h1')?.variant, 'cloud')
  assert.equal(playbackSongOf('kugou', 'h1')?.data?.albumId, 'a1')
} finally {
  rmSync(dir, { recursive: true, force: true })
}

console.log('song-registry.test.mjs ok')
