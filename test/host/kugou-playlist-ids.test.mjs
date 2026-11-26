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
} finally {
  resetUpstreamOverride()
}

console.log('kugou-playlist-ids.test.mjs ok')