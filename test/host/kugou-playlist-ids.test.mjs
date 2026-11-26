/**
 * 酷狗歌单 id 的三套空间必须各走各的读取器（第一性原理：id 的语义决定它能被哪个接口读）。
 *
 * 1. 推荐卡（Folia 的 top_card_youth 虚拟歌单，id 形如 kugou-card-3006）：读卡本身；
 * 2. 账号云歌单：cloudlist 读取器；
 * 3. 公开歌单：只有网页 specialid。概念版 cloudlist 读取器要 global_collection_id，
 *    传 specialid 会回 error_code 20010——就是「点进推荐歌单马上加载失败」的那条报错。
 */
import assert from 'node:assert/strict'
import { setUpstreamOverride, resetUpstreamOverride } from '../../src/host/services/kugou-api.js'
import * as KG from '../../src/host/providers/kugou.js'
import { playlistSongs, playlistSongsPage } from '../../src/host/providers/index.js'

const jsonResponse = (body) => ({
  ok: true,
  status: 200,
  async text() { return JSON.stringify(body) },
  async json() { return body },
})

// 真实 Host 给概念版 providers 的会话带设备标识（mid/dfid）与登录态；缺 mid 时
// liteRequest 连发都不发，就演练不到 20010 那条上游拒绝。
const session = { mid: 'test-mid', dfid: 'test-dfid', token: 'test-token', userid: '1' }

const requested = []
const songRow = (hash, name) => ({
  hash,
  filename: '歌手 - ' + name,
  timelen: 200000,
  album_id: '11',
  album_audio_id: '22',
  privilege: 0,
  pay_type: 0,
})

globalThis.fetch = async (url) => {
  const href = String(url)
  requested.push(href)
  // 酷狗对「拿 specialid 当 global_collection_id」的回答：error_code 20010（参数错误），
  // 并且没有 error_msg —— 所以界面上只剩一句「酷狗概念版请求失败（code=20010）」。
  if (href.includes('/pubsongs/v2/get_other_list_file_nofilt')) {
    return jsonResponse({ status: 1, error_code: 20010, error_msg: '', data: {} })
  }
  if (href.includes('/v3/special/info')) {
    return jsonResponse({ status: 1, data: { specialname: '国漫精选', imgurl: '', global_specialid: '' } })
  }
  if (href.includes('/v3/special/song')) {
    return jsonResponse({ status: 1, data: { total: 165, info: [songRow('AAA', '第一首'), songRow('BBB', '第二首')] } })
  }
  if (href.includes('/v7/get_all_list')) return jsonResponse({ status: 0, error: 'no login' })
  throw new Error('unexpected upstream: ' + href)
}

const cardCalls = []
const cardRow = (hash, name) => ({
  hash,
  ori_audio_name: name,
  authors: [{ author_id: '1', author_name: '歌手' }],
  album_info: { album_name: '专辑', album_id: '9', sizable_cover: 'http://imge.kugou.com/stdmusic/{size}/cover.jpg' },
  audio_info: { timelength: '200000', privilege: '10', pay_type: 3, hash_320: 'H320', hash_flac: 'HFLAC' },
  album_audio_id: '123',
  mixsongid: 123,
  fileid: '456',
})

// 概念版 playlist_track_all 的分页夹具：按 page/pagesize 切一段「原始行」。
// collection_page_raw 的第一页里有一行没有 hash —— normalizePackageSong 会把它丢掉，
// 游标必须仍然按这一页吃掉的 100 行走，否则下一请求会落回第 1 页（重复歌单的根因）。
const pageRawAll = Array.from({ length: 130 }, (_, index) => ({
  hash: 'PAGERAW' + String(index).padStart(3, '0'),
  filename: '歌手 - 第 ' + String(index + 1) + ' 首',
  timelen: 180000,
}))
pageRawAll[3] = { filename: '坏行没有 hash', timelen: 1000 }
// collection_page_cap 模拟上游把 pagesize 压到 30：要 100 也只给 30。
const pageCapAll = Array.from({ length: 60 }, (_, index) => ({
  hash: 'PAGECAP' + String(index).padStart(3, '0'),
  filename: '歌手 - C' + String(index),
  timelen: 1000,
}))
const pageCalls = []
function pagingFixture(id, params) {
  const pagesize = Number(params.pagesize) || 30
  const page = Number(params.page) || 1
  const capped = id === 'collection_page_cap' && pagesize > 30
  const served = capped ? 30 : pagesize
  pageCalls.push({ id, page, pagesize })
  const all = id === 'collection_page_raw' ? pageRawAll : pageCapAll
  const start = (page - 1) * served
  return {
    status: 200,
    body: { status: 1, error_code: 0, data: { count: all.length, songs: all.slice(start, start + served) } },
    cookie: [],
  }
}

setUpstreamOverride((operation, params) => {
  cardCalls.push({ operation, params })
  if (operation === 'top_card_youth') {
    return {
      status: 200,
      body: {
        status: 1,
        error_code: 0,
        data: {
          song_count: 2,
          card_info: { card_title: '卡 ' + String(params.card_id), card_id: params.card_id },
          song_list: [cardRow('CARDAAA', '卡内第一首'), cardRow('CARDBBB', '卡内第二首')],
        },
      },
      cookie: [],
    }
  }
  // 概念版把 specialid 送进 playlist_track_all 时包直接失败（真实环境是 502）。
  if (operation === 'playlist_track_all') {
    const id = String(params.id || '')
    if (id.startsWith('collection_page_')) return pagingFixture(id, params)
    const error = new Error('KuGou request failed')
    error.status = 502
    throw error
  }
  throw new Error('unexpected operation: ' + operation)
})

try {
  // 1. 卡 id 的解析只认自己的写法，数字 specialid 不会被误当卡片。
  assert.equal(KG.kugouRecommendationCardId('kugou-card-3006'), 3006)
  assert.equal(KG.kugouRecommendationCardId('3006'), undefined)
  assert.equal(KG.kugouRecommendationCardId('kugou-card-x'), undefined)

  // 2. 推荐 = 概念版自己的卡（Folia getRecommendedCollections），不是网页歌单行。
  const cards = await KG.getRecommendedCollections('lite', 30)
  assert.equal(cards.length, 6, 'every card with songs is listed')
  assert.equal(cards[0].id, 'kugou-card-3006')
  assert.equal(cards[0].name, '卡 3006', 'the card names itself')
  assert.equal(cards[0].trackCount, 2)
  assert.match(cards[0].cover, /^https:\/\/imge\.kugou\.com\/stdmusic\/240\//, 'the cover comes off the card songs')

  // 3. 点进卡：读卡本身，绝不再把卡 id 当歌单 id 送给上游。
  const cardPage = await playlistSongsPage('kugouLite', 'kugou-card-3006', '', session, { limit: 1, offset: 1 })
  assert.equal(cardPage.name, '卡 3006')
  assert.equal(cardPage.trackCount, 2)
  assert.equal(cardPage.songs.length, 1)
  assert.equal(cardPage.songs[0].title, '卡内第二首')
  assert.equal(cardPage.songs[0].artist, '歌手')
  assert.equal(cardPage.songs[0].durationSec, 200)
  assert.equal(cardPage.songs[0].qualityHint, 'VIP')
  assert.equal(cardPage.hasMore, false)
  assert.equal(cardPage.nextOffset, 2)
  assert.equal(
    cardCalls.filter((call) => call.operation === 'playlist_track_all').length,
    0,
    'a card id never reaches the playlist-track reader',
  )

  // 4. 公开歌单（网页 specialid）：概念版读取器回 20010 之后仍要能读到歌。
  const publicPage = await playlistSongsPage('kugouLite', '8700677', '', session, { limit: 10, offset: 0 })
  assert.equal(publicPage.name, '国漫精选')
  assert.equal(publicPage.trackCount, 165)
  assert.equal(publicPage.songs.length, 2)
  assert.equal(publicPage.songs[0].title, '第一首')
  assert.equal(publicPage.songs[0].artist, '歌手')
  assert.ok(
    requested.some((url) => url.includes('get_other_list_file_nofilt')),
    'the concept reader really was asked first (that is the 20010 the user saw)',
  )
  assert.ok(
    requested.some((url) => url.includes('/v3/special/song') && url.includes('specialid=8700677')),
    'the public playlist reads through the reader that takes a specialid',
  )

  // 5. 同一条公开歌单走「一次读全」的路径也一样。
  const fullList = await playlistSongs('kugouLite', '8700677', '', session)
  assert.equal(fullList.name, '国漫精选')
  assert.equal(fullList.trackCount, 165)
  assert.equal(fullList.songs.length, 2)
  // 5. 分页游标：被 normalize 丢掉的坏行不能让 offset 少走一格（否则下一请求回到第 1 页）。
  const raw0 = await playlistSongsPage('kugouLite', 'collection_page_raw', '', session, { limit: 100, offset: 0 })
  assert.equal(raw0.songs.length, 99, 'the bad row is not shown')
  assert.equal(raw0.nextOffset, 100, 'the cursor advances by the rows the page consumed')
  assert.equal(raw0.hasMore, true)
  const raw1 = await playlistSongsPage('kugouLite', 'collection_page_raw', '', session, { limit: 100, offset: raw0.nextOffset })
  assert.equal(raw1.songs.length, 30)
  assert.equal(raw1.songs[0].id, 'pageraw100', 'the second page starts where the first one ended')
  assert.equal(raw1.nextOffset, 130)
  assert.equal(raw1.hasMore, false)
  const rawCalls = pageCalls.filter((call) => call.id === 'collection_page_raw')
  assert.equal(rawCalls[1].page, 2, 'offset 100 on a 100-row page really asks for page 2')
  const rawIds = raw0.songs.concat(raw1.songs).map((song) => song.id)
  assert.equal(new Set(rawIds).size, rawIds.length, 'no song is shown twice')

  // 6. 上游把 pagesize 压到 30 时，游标按 30 走，页号跟着 offset 走（不是跟着「要了 100」走）。
  const cap0 = await playlistSongsPage('kugouLite', 'collection_page_cap', '', session, { limit: 100, offset: 0 })
  assert.equal(cap0.songs.length, 30)
  assert.equal(cap0.nextOffset, 30)
  const cap1 = await playlistSongsPage('kugouLite', 'collection_page_cap', '', session, { limit: 100, offset: cap0.nextOffset })
  const capCalls = pageCalls.filter((call) => call.id === 'collection_page_cap')
  assert.equal(capCalls[1].page, 2, 'offset 30 on a 30-row page is page 2')
  assert.equal(capCalls[1].pagesize, 30, 'the learned stride is the size actually asked for')
  assert.equal(cap1.songs[0].id, 'pagecap030')
  assert.equal(cap1.nextOffset, 60)

} finally {
  resetUpstreamOverride()
}

console.log('kugou-playlist-ids.test.mjs ok')