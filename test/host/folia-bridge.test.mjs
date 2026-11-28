/**
 * folia-bridge 的映射契约：上游音源定义 → 本插件的 source 对象。
 *
 * 四平台（网易云 / QQ / 酷狗 / 波点 / 汽水）共用一个映射层，重放的原测试意图都在这里：
 *   - 取流带着上游的 preview 标记（不把试听当整首缓存）
 *   - 排行行把上游 row.listenCount 带出来，行本身可进队列（provider / 时长 / 封面）
 *   - 搜索、歌手页与歌单页按 Folia 的页形状前进（hasMore / nextOffset / total）
 *   - 专辑详情 + 曲目合成同一个返回（同一次上游读取）
 *   - reports@1 的 canReport 先挡一刀，report 才真正上报
 *   - 逐字歌词的时间轴转成秒，行级歌词保留
 *
 * 定义是手写的替身：不加载 bundle、不连网。
 */

import assert from 'node:assert/strict'
import { createFoliaSource } from '../../src/host/providers/sources/folia-bridge/bridge.js'

const texts = { resolveText: (value) => String(value ?? '') }
const song = (id, extra = {}) => ({
  id,
  title: 'Song ' + id,
  artists: [{ id: 'ar-1', name: 'Artist' }],
  album: { id: 'al-1', name: 'Album', coverUrl: 'https://cover/' + id },
  durationMs: 200000,
  data: { hash: id },
  ...extra,
})

const calls = []
let reported = null
let canReport = true

const definition = {
  capabilities: {
    'search@1': {
      async searchSongs(query, limit, offset) {
        calls.push(['searchSongs', query, limit, offset])
        const items = [song('s' + offset), song('s' + (offset + 1))]
        return { items, total: 250, hasMore: offset + items.length < 250, nextOffset: offset + items.length }
      },
      async searchAlbums(query, limit, offset) {
        return { items: [{ id: 'al-1', name: 'Album', coverUrl: 'https://c', artists: [{ name: 'Artist' }], trackCount: 2 }], total: 1, hasMore: false, nextOffset: 1 }
      },
      async searchPlaylists(query, limit, offset) {
        return { items: [{ id: 'pl-1', name: 'List', coverUrl: 'https://p', trackCount: 9 }], total: 1, hasMore: false, nextOffset: 1 }
      },
    },
    'playback.audio@1': {
      async getAudioSource(target, quality) {
        return { url: 'https://cdn.example/' + quality + '.flac', quality, preview: true }
      },
    },
    'lyrics@1': {
      async getChorusRanges(songId) {
        return [[1000, 2000]]
      },
      async getLyrics(target) {
        return {
          main: { lines: [{ startTime: 1000, endTime: 2500, text: 'line' }] },
          wordByWord: { lines: [{ startTime: 1000, endTime: 2500, text: 'ab', words: [{ startTime: 1000, endTime: 1500, text: 'a' }, { startTime: 1500, endTime: 2500, text: 'b' }] }] },
          chorusRanges: [[1000, 2000]],
        }
      },
    },
    'reports@1': {
      canReport: () => canReport,
      async report(target, report) { reported = { target, report } },
    },
    'catalog@1': {
      async getArtistSongs(artistId, limit, offset) {
        calls.push(['getArtistSongs', artistId, limit, offset])
        const count = Math.max(0, Math.min(limit, 250 - offset))
        const items = Array.from({ length: count }, (_, index) => song('a' + (offset + index)))
        return { items, total: 250, hasMore: offset + items.length < 250, nextOffset: offset + items.length }
      },
      async getArtistDetail(id) {
        return { id, name: 'Artist', coverUrl: 'https://a', description: 'bio' }
      },
      async getArtistAlbums(id, limit, offset) {
        return { items: [{ id: 'al-2', name: 'Album 2', coverUrl: 'https://a2', artists: [{ name: 'Artist' }], trackCount: 3 }], hasMore: false }
      },
      async getAlbumDetail(id) {
        return { id, name: 'Album', coverUrl: 'https://cover', artists: [{ name: 'Artist' }], trackCount: 1 }
      },
      async getAlbumTracks(id, limit, offset) {
        return { items: [song('t1')], hasMore: false, total: 1, nextOffset: 1 }
      },
      async getPlaylistDetail(id) {
        return { id, name: 'List', coverUrl: 'https://cover/pl', trackCount: 30 }
      },
      async getPlaylistTracks(id, limit, offset) {
        const items = Array.from({ length: Math.min(limit, 30 - offset) }, (_, index) => song('p' + (offset + index)))
        return { items, total: 30, hasMore: offset + items.length < 30, nextOffset: offset + items.length }
      },
      async getListeningRankTracks(range, limit, offset) {
        return {
          items: [song('r1', { row: { listenCount: 42 }, coverUrl: 'https://cover/rank' })],
          hasMore: false,
        }
      },
    },
  },
}

const source = createFoliaSource({ definition, sourceId: 'netease', texts, qualityLevels: ['standard'] })

// ── 取流：上游标了 preview 就必须带出去（试听不是整首） ─────────────────────
{
  const stream = await source.stream('s1', {}, 'lossless')
  assert.equal(stream.url, 'https://cdn.example/lossless.flac')
  assert.equal(stream.preview, true, 'the source marks a preview clip')
}

// ── 排行：row.listenCount 带出来，行可进队列 ───────────────────────────────
{
  const [row] = await source.listeningRank('week')
  assert.equal(row.provider, 'netease')
  assert.equal(row.id, 'r1')
  assert.equal(row.durationSec, 200)
  assert.equal(row.listenCount, 42)
  assert.match(String(row.coverUrl), /rank/)
}

// ── 搜索分页：按第几页换 offset，hasMore 原样 ──────────────────────────────
{
  calls.length = 0
  const page = await source.searchPage('q', {}, 2)
  assert.deepEqual(calls[0], ['searchSongs', 'q', 100, 100])
  assert.equal(page.page, 2)
  assert.equal(page.total, 250)
  assert.equal(page.hasMore, true)
  assert.deepEqual(page.results.map((row) => row.id), ['s100', 's101'])
}

// ── 歌手页：一页一页读到尾，游标按上游给的行数前进 ────────────────────────
{
  calls.length = 0
  const answered = await source.artistSongs('Artist', { artistId: 'ar-9' })
  assert.equal(answered.songs.length, 250)
  assert.equal(answered.hasMore, false)
  assert.equal(answered.nextOffset, 250)
  assert.deepEqual(calls, [
    ['getArtistSongs', 'ar-9', 100, 0],
    ['getArtistSongs', 'ar-9', 100, 100],
    ['getArtistSongs', 'ar-9', 100, 200],
  ])
}

// ── 专辑：详情与曲目同一次读取合成一个返回 ────────────────────────────────
{
  const album = await source.albumSongs('al-1', {}, {})
  assert.equal(album.id, 'al-1')
  assert.equal(album.name, 'Album')
  assert.equal(album.cover, 'https://cover')
  assert.equal(album.songs[0].id, 't1')
}

// ── 歌单页：Folia 的页形状，nextOffset 由上游这一页吃掉的行决定 ────────────
{
  const head = await source.playlistSongsPage('pl-1', {}, { limit: 10, offset: 0 })
  assert.equal(head.name, 'List')
  assert.equal(head.trackCount, 30)
  assert.equal(head.songs.length, 10)
  assert.equal(head.hasMore, true)
  assert.equal(head.nextOffset, 10)
  const next = await source.playlistSongsPage('pl-1', {}, { limit: 10, offset: head.nextOffset })
  assert.equal(next.songs[0].id, 'p10')
}

// ── 播放上报：canReport 先挡（云盘/非数字 id），挡下就不上报 ──────────────
{
  canReport = false
  assert.equal(await source.reportPlayback({ id: 'cloud-track' }, { playedSeconds: 40 }), false)
  assert.equal(reported, null, 'a refused report never reaches upstream')
  canReport = true
  assert.equal(await source.reportPlayback({ id: 'r-ok', title: 'T' }, { playedSeconds: 35 }), true)
  assert.equal(reported.report.playedSeconds, 35)
}

// ── 歌词：逐字时间轴转秒，副歌窗口保留 ────────────────────────────────────
{
  const lyric = await source.lyric('s1')
  assert.equal(lyric.wordLevel, true)
  assert.equal(lyric.lines[0].text, 'ab')
  assert.equal(lyric.lines[0].words[0].t, 1)
  assert.equal(lyric.lines[0].words[0].end, 1.5)
  assert.deepEqual(await source.chorus('s1'), [[1000, 2000]])
}

console.log('folia-bridge.test ok')
