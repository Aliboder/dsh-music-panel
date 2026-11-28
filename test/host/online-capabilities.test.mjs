/**
 * 能力声明与实现必须一致。
 *
 * 这张表里每个「能力 → 方法」都来自 contract.js 的 METHOD_CAPABILITY：能力声明为 true，
 * 调用就必须能到达该平台；只有两种结果算失败——facade 的「未知平台」（说明没有这个平台
 * 分支）和 adapter 的「does not support」（说明能力门挡住了自己声明的东西）。其余任何
 * 报错（缺参数、未登录、上游不通）都说明分支存在，算通过。
 *
 * 这能挡住「能力写了、实现没有」的一类偏差（酷狗概念版声明过 playlistAdd 却没声明
 * playlistTrackMutations 就是这样：实现存在，入口与路由永远被挡住）。
 */
import assert from 'node:assert/strict'
import { ONLINE_SPECS, registry } from '../../src/host/providers/sources/index.js'

const reached = (what) => {
  const error = new Error('reached upstream: ' + what)
  error.reached = true
  throw error
}
// 这张表只走 ONLINE_SPECS（酷狗概念版 / Navidrome）：网易云与 QQ 是各自注册的
// Folia 源对象，不经过改编器，能力一致性由它们自己的源测试守住。
const realFetch = globalThis.fetch
globalThis.fetch = async (url) => reached('fetch ' + String(url))

const GATE = {
  search: 'search', searchPage: 'search',
  searchAlbums: 'searchAlbums', searchPlaylists: 'searchPlaylists',
  artists: 'artists', artistSongs: 'artists', artistAlbums: 'artists',
  albums: 'albums', albumSongs: 'albums',
  songs: 'search', nativeSongs: 'search',
  myPlaylists: 'userPlaylists',
  playlistSongs: 'playlistSongs', playlistSongsPage: 'playlistSongs',
  liked: 'likes', likedIds: 'likes', setLiked: 'likeWrite',
  addToPlaylist: 'playlistAdd',
  removeFromPlaylist: 'playlistTrackMutations',
  subscriptionStatus: 'playlistSubscription', subscribeCollection: 'playlistSubscription',
  stream: 'playback', lyric: 'lyrics', chorus: 'lyrics',
  listeningRank: 'listeningRank',
  dailySongs: 'recommendations', recommendedCollections: 'recommendations', personalFm: 'recommendations',
  historyDates: 'historyRecommendations', historySongs: 'historyRecommendations',
  cloudSongs: 'userCloud',
  reportPlayback: 'playbackReports',
  vip: 'vip', vipInfo: 'vip',
}

const ARGS = {
  search: ['测试', {}], searchPage: ['测试', {}, 1],
  searchAlbums: ['测试', {}, 1], searchPlaylists: ['测试', {}, 1],
  artists: [{}], artistSongs: ['测试', {}, ''], artistAlbums: ['1', {}],
  albums: [{}, 10], albumSongs: ['1', {}],
  songs: [{}, 10], nativeSongs: [{}, {}],
  myPlaylists: [{}],
  playlistSongs: ['1', {}], playlistSongsPage: ['1', {}, { limit: 5, offset: 0 }],
  liked: ['1', {}], likedIds: [{}], setLiked: [{ id: '1' }, true, {}],
  addToPlaylist: [{ id: '1' }, '1', {}],
  removeFromPlaylist: [{ id: '1' }, '1', {}],
  subscriptionStatus: ['playlist', '1', {}], subscribeCollection: ['playlist', '1', true, {}],
  stream: ['1', {}, 'standard'], lyric: ['1', {}], chorus: ['1', {}],
  listeningRank: ['week', {}],
  dailySongs: [{}], recommendedCollections: [{}, 2], personalFm: [{}],
  historyDates: [{}], historySongs: [{}, '2026-01-01'],
  cloudSongs: [{}, 1],
  reportPlayback: [{ id: '1' }, { playedSeconds: 1 }, {}],
  vip: [{}], vipInfo: [{}],
}

function refusalOf(provider, method, error) {
  const message = String((error && error.message) || error)
  if (message.includes('未知平台')) return 'facade has no ' + provider + ' branch for ' + method
  if (message.includes('does not support')) return 'the capability gate blocks its own declared method ' + provider + '.' + method
  return ''
}

// 判定器本身不能是空转：两种真正的偏差必须被认出来，普通的上游/参数错误必须放过。
assert.match(refusalOf('kugouLite', 'removeFromPlaylist', new Error('KuGou Music does not support removeFromPlaylist')), /capability gate/)
assert.match(refusalOf('kugouLite', 'playlistSongs', new Error('未知平台：kugouLite')), /no kugouLite branch/)
assert.equal(refusalOf('kugouLite', 'playlistSongs', new Error('reached upstream: kugou /playlist/detail')), '')
assert.equal(refusalOf('kugouLite', 'addToPlaylist', new Error('缺少歌单或歌曲 id')), '')

const failures = []
const perProvider = new Map()
let checked = 0
try {
  for (const spec of ONLINE_SPECS) {
    const source = registry.require(spec.id)
    const caps = source.capabilities || {}
    for (const [method, gate] of Object.entries(GATE)) {
      if (caps[gate] !== true) continue
      const args = ARGS[method]
      if (args === undefined) throw new Error('the test has no arguments for ' + method)
      if (typeof source[method] !== 'function') {
        failures.push(spec.id + ' declares ' + gate + ' but the adapter has no ' + method)
        continue
      }
      checked += 1
      perProvider.set(spec.id, (perProvider.get(spec.id) || 0) + 1)
      try {
        await source[method](...args)
      } catch (error) {
        const reason = refusalOf(spec.id, method, error)
        if (reason !== '') failures.push(spec.id + ': ' + reason)
      }
    }
  }
} finally {
  globalThis.fetch = realFetch
}

assert.deepEqual(failures, [], 'every declared capability reaches its implementation')
assert.ok(checked > 40, 'the check really walked the surface (' + checked + ' calls)')
for (const spec of ONLINE_SPECS) {
  assert.ok((perProvider.get(spec.id) || 0) >= 10, spec.id + ' exercises a real share of its declared surface')
}
console.log('online-capabilities.test.mjs ok (' + checked + ' capability calls)')