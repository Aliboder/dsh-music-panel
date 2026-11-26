/**
 * QQ「加入歌单」的两条事实：
 *  1. 歌单卡片拿的是 tid，而音乐库里的文件夹号是 dirId（1–199）。包的写入路由
 *     /user/playlist/tracks 按 tid 自己解析 dirId（Folia 也走它）；旧实现把 tid 当 dirId
 *     发给 musicu.AddSonglist，等于往一个不存在的文件夹里写。
 *  2. 「我喜欢」是红心（201），收藏的歌单不属于自己——两者都不是可写入的目标，
 *     Folia 的 canAddToPlaylist 在这里拒绝，选择框也不该列出来。
 */
import assert from 'node:assert/strict'
import { setUpstreamOverride, resetUpstreamOverride } from '../../src/host/services/qq-api.js'
import * as QQ from '../../src/host/providers/qq.js'
import { addOnlineSongToPlaylist, myPlaylists } from '../../src/host/providers/index.js'

const cookie = 'uin=123; qm_keyst=abc'
const calls = []

setUpstreamOverride(async (route, params, options) => {
  calls.push({ route, params, method: options?.method || 'GET', body: options?.body })
  if (route === '/user/playlist') {
    return {
      playlist: [
        { dirId: 5, tid: '9001', dirName: '我的歌单', songNum: 3, dirType: 0 },
        { dirId: 201, tid: '', dirName: '我喜欢', songNum: 12 },
        { dirId: 36, tid: '7777', name: '收藏的歌单', songnum: 9, orderTime: 1 },
      ],
    }
  }
  if (route === '/user/playlist/tracks') return { changed: true }
  if (route === '/user/song/like') return { liked: options?.body?.liked === true }
  throw new Error('unexpected QQ route: ' + route)
})

// 歌曲详情是匿名 CGI：写歌单要先拿到数字 songid。
globalThis.fetch = async (url) => {
  const href = String(url)
  if (href.includes('fcg_play_single_song')) {
    return { ok: true, status: 200, async json() { return { data: [{ id: 55, name: '歌' }] } }, async text() { return JSON.stringify({ data: [{ id: 55 }] }) } }
  }
  throw new Error('unexpected fetch: ' + href)
}

try {
  const rows = await myPlaylists('qq', cookie)
  assert.deepEqual(rows.map((row) => row.id), ['9001', '201', '7777'])
  assert.deepEqual(rows.map((row) => row.addable), [true, false, false], 'only the owned ordinary playlist is a target')

  assert.deepEqual(await QQ.qqPlaylistWriteTarget('9001'), { dirId: 5, tid: '9001', liked: false })
  assert.deepEqual(await QQ.qqPlaylistWriteTarget('201'), { tid: '', liked: true })
  await assert.rejects(() => QQ.qqPlaylistWriteTarget('7777'), /收藏的歌单/)

  // 自建歌单：写入按 tid 走包路由，不再把 tid 当 dirId。
  calls.length = 0
  assert.equal(await addOnlineSongToPlaylist('qq', { id: 'MID1', title: '歌' }, '9001', cookie), true)
  const write = calls.find((call) => call.route === '/user/playlist/tracks')
  assert.ok(write, 'the write goes through the package route')
  assert.deepEqual(write.body, { tid: '9001', op: 'add', songs: [{ id: 55, type: 0 }] }, 'the card id is sent as the tid')
  assert.equal(calls.some((call) => call.route === '/user/playlist/tracks' && call.body?.dirId !== undefined), false, 'no dirId is invented from the tid')

  // 「我喜欢」走红心。
  calls.length = 0
  assert.equal(await addOnlineSongToPlaylist('qq', { id: 'MID1', title: '歌' }, '201', cookie), true)
  const like = calls.find((call) => call.route === '/user/song/like')
  assert.ok(like, 'the liked list is the heart')
  assert.equal(like.body.liked, true)
  assert.equal(calls.some((call) => call.route === '/user/playlist/tracks'), false, 'the heart is not a playlist write')

  // 收藏的歌单：拒绝，不发写请求。
  calls.length = 0
  await assert.rejects(
    () => addOnlineSongToPlaylist('qq', { id: 'MID1', title: '歌' }, '7777', cookie),
    /收藏的歌单/,
  )
  assert.equal(calls.some((call) => call.route === '/user/playlist/tracks'), false)
} finally {
  resetUpstreamOverride()
}

console.log('qq-playlist-write.test.mjs ok')