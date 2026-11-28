/**
 * 酷狗移植源的接线契约：门面 → dispatch → 移植源适配层。
 *
 * 上游 provider 的逻辑由它自己的测试与上游 repo 保证，这里只守本插件写的那一层：
 * DTO 映射（id 形式、data 侧车、时长）、分页游标透传、音质档翻译、歌词行单位、
 * 错误翻译、以及「能力表里声明的每一项都有派工」。
 */

import assert from 'node:assert/strict'
import { MusicError } from '../../src/host/services/core/errors.js'
import { kugouFacadeHas, KUGOU_FACADE_METHODS } from '../../src/host/providers/sources/kugou-folia/dispatch.js'
import { songOf, playlistRowOf, searchPageOf } from '../../src/host/providers/sources/kugou-folia/dto.js'
import { qualityOf, facadeQualityOf } from '../../src/host/providers/sources/kugou-folia/playback.js'
import { kugouServiceStatus } from '../../src/host/providers/sources/kugou-folia/status.js'
import { resolveStream, lyric } from '../../src/host/providers/index.js'
import { installKugouFoliaStub, resetKugouFolia } from './helpers/kugou-folia-stub.mjs'

// ── 派工表覆盖门面所有酷狗方法 ───────────────────────────────────────────────
for (const method of ['search', 'searchPage', 'searchAlbums', 'searchPlaylists', 'artistSongs', 'albumSongs', 'artistAlbums', 'songs', 'nativeSongs', 'artists', 'albums', 'dailySongs', 'recommendedCollections', 'personalFm', 'cloudSongs', 'listeningRank', 'historyDates', 'historySongs', 'myPlaylists', 'playlistSongs', 'playlistSongsPage', 'onlineLiked', 'onlineLikedIds', 'setOnlineLiked', 'addOnlineSongToPlaylist', 'removeOnlineSongFromPlaylist', 'subscriptionStatus', 'subscribeCollection', 'resolveStream', 'resolveLegacyStream', 'lyric', 'chorus', 'requiresVip', 'loginStart', 'loginStatus', 'providerVip', 'providerVipInfo', 'providerProfile', 'createKugouDevice', 'forgetProviderTokens']) {
  assert.equal(kugouFacadeHas(method), true, 'dispatch has no route for ' + method)
}
assert.equal(KUGOU_FACADE_METHODS.length >= 40, true)

// ── DTO：上游的歌 → 门面的歌 ────────────────────────────────────────────────
{
  const song = songOf({
    id: 'ABC123',
    title: '晴天',
    artists: [{ id: '3520', name: '周杰伦' }, { id: 'kugou-artist-1', name: '客串', ref: false }],
    album: { id: '966846', name: '叶惠美', coverUrl: 'https://cover/large' },
    durationMs: 269500,
    variant: 'cloud',
    lyricIds: { kugou: 'ABC123' },
    data: { hash: 'ABC123', fileId: 42, albumAudioId: 7, mixSongId: 9 },
    row: { listenCount: 12 },
  })
  assert.equal(song.provider, 'kugouLite')
  assert.equal(song.id, 'abc123', 'the id leaves as the lowercase hash the plugin stores')
  assert.equal(song.artist, '周杰伦 / 客串')
  assert.equal(song.album, '叶惠美')
  assert.equal(song.albumId, '966846')
  assert.equal(song.durationSec, 270, 'milliseconds round to seconds')
  assert.equal(song.durationMs, 269500)
  assert.equal(song.coverUrl, 'https://cover/large')
  assert.equal(song.fileId, 42, 'the playlist row number survives for removal')
  assert.equal(song.data.albumAudioId, 7, 'the data sidecar is kept, not flattened away')
  assert.equal(song.variant, 'cloud')
  assert.equal(song.popularity, 12)
  assert.equal(song.artistsDetail[1].ref, false, 'a made-up artist id does not open')
}

// ── 我的一张歌单行：自建 / 收藏 / 我喜欢 ────────────────────────────────────
{
  const canAdd = (collection) => collection.isOwned === true && String(collection.id) !== '2'
  const own = playlistRowOf({ id: '18', type: 'playlist', name: 'Miku', trackCount: 3, isOwned: true }, canAdd)
  assert.equal(own.isOwned, true)
  assert.equal(own.addable, true)
  assert.equal(own.isLike, false)
  const collected = playlistRowOf({ id: '99', type: 'playlist', name: '别人的歌单', isOwned: undefined }, canAdd)
  assert.equal(collected.isOwned, false, 'a collected playlist is not owned (upstream only writes true for its own)')
  assert.equal(collected.kind, 'collect')
  assert.equal(collected.addable, false)
  const liked = playlistRowOf({ id: 'collection_3_1_2_0', type: 'playlist', name: '我喜欢的音乐', data: { listId: '2' } }, canAdd)
  assert.equal(liked.isLike, true, 'the liked list is recognised by its listId')
  assert.equal(liked.isDefault, true)
}

// ── 搜索页：游标与 hasMore 原样来自上游 ─────────────────────────────────────
{
  const page = searchPageOf({ items: [{ id: 'A1', title: 'x', artists: [] }, { id: '', title: 'dropped' }], total: 30, hasMore: true, nextOffset: 20 }, 2)
  assert.equal(page.results.length, 1, 'rows without an id are dropped')
  assert.equal(page.page, 2)
  assert.equal(page.hasMore, true)
  assert.equal(page.total, 30)
}

// ── 音质档：门面 ↔ 上游 ─────────────────────────────────────────────────────
assert.deepEqual(['standard', 'high', 'lossless', 'hires'].map(qualityOf), ['standard', 'high', 'lossless', 'lossless'])
assert.deepEqual(['standard', 'high', 'lossless'].map(facadeQualityOf), ['standard', 'high', 'lossless'])

// ── 取流与歌词：走 stub 定义 ───────────────────────────────────────────────
{
  const asked = []
  installKugouFoliaStub({
    'playback.audio@1': {
      async getAudioSource(song, quality) {
        asked.push([song.id, song.data.hash, quality])
        return { url: 'https://fs.kugou.com/a.mp3', quality: 'high', replayGain: { trackGain: -3 } }
      },
    },
    'lyrics@1': {
      async getLyrics() {
        return {
          main: { lines: [{ startTime: 0, endTime: 1000, text: '第一行' }] },
          wordByWord: { lines: [{ startTime: 0, endTime: 1000, text: '第一行', words: [{ startTime: 0, endTime: 500, text: '第一' }, { startTime: 500, endTime: 1000, text: '行' }] }] },
          chorusRanges: [{ startTime: 0, endTime: 1 }],
          isPureMusic: false,
        }
      },
    },
  })
  try {
    const stream = await resolveStream('kugou', 'ABC123', '', {}, 'lossless')
    assert.equal(stream.url, 'https://fs.kugou.com/a.mp3')
    assert.equal(stream.quality, 'high', 'the level the source really served')
    assert.deepEqual(stream.replayGain, { trackGain: -3 })
    // 缓存里存着上一次读到的上游歌对象时，交回去的就是它（上游内部自己把 hash 转大写）；
    // 缓存没有时按 id 造一个最小的。两种情况下身份都是同一个 hash。
    assert.equal(asked[0][0].toLowerCase(), 'abc123')
    assert.equal(asked[0][1].toLowerCase(), 'abc123')
    assert.equal(asked[0][2], 'lossless')
    const words = await lyric('kugou', 'ABC123', '', {})
    assert.equal(words.lines.length, 1)
    assert.equal(words.wordLevel, true)
    assert.equal(words.lines[0].t, 0)
    assert.equal(words.lines[0].end, 1, 'milliseconds become seconds')
    assert.equal(words.lines[0].words[1].text, '行')
    assert.equal(words.raw.formatHint, 'krc')
    assert.deepEqual(words.raw.chorusRanges, [{ startTime: 0, endTime: 1 }])
  } finally {
    resetKugouFolia()
  }
}

// ── 错误翻译：上游的 code 原样进 MusicError ─────────────────────────────────
{
  const failure = Object.assign(new Error('需要登录'), { code: 'auth-required', httpStatus: 401 })
  installKugouFoliaStub({
    'playback.audio@1': { async getAudioSource() { throw failure } },
  })
  try {
    await assert.rejects(resolveStream('kugou', 'A1'), (error) => {
      assert.equal(error instanceof MusicError, true)
      assert.equal(error.code, 'auth-required')
      assert.equal(error.sourceId, 'kugouLite')
      assert.equal(error.status, 401)
      return true
    })
  } finally {
    resetKugouFolia()
  }
  installKugouFoliaStub({ 'playback.audio@1': { async getAudioSource() { throw new Error('boom') } } })
  try {
    await assert.rejects(resolveStream('kugou', 'A1'), (error) => error.code === 'protocol')
  } finally {
    resetKugouFolia()
  }
}

// ── 不再有可启停的本地服务 ─────────────────────────────────────────────────
{
  const status = await kugouServiceStatus()
  assert.deepEqual(status, { running: true, starting: false, error: null })
}

console.log('kugou-folia-mapping.test ok')
