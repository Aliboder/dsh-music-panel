/**
 * Every listening-rank row must be queue-playable: provider + duration + cover.
 * Folia normalises rank rows at the provider boundary; this guards the same contract.
 */
import assert from 'node:assert/strict'
import { listeningRank } from '../../src/host/providers/index.js'
import { resetUpstreamOverride as resetNetease, setUpstreamOverride as setNetease } from '../../src/host/services/netease-api.js'
import { resetUpstreamOverride as resetQq, setUpstreamOverride as setQq } from '../../src/host/services/qq-api.js'
import { installKugouFoliaStub, resetKugouFolia } from './helpers/kugou-folia-stub.mjs'

setNetease(async (route) => {
  if (route === '/user/account') return { code: 200, profile: { userId: 7 } }
  if (route === '/user/record') {
    return { code: 200, weekData: [{ playCount: 3, song: { id: 9, name: 'Netease', ar: [{ name: 'A' }], al: { id: 1, name: 'Album', picUrl: 'https://cover/nc' }, dt: 200000 } }], allData: [] }
  }
  throw new Error('unexpected netease route: ' + route)
})
try {
  const [song] = await listeningRank('netease', 'week', 'cookie')
  assert.equal(song.provider, 'netease')
  assert.equal(song.durationSec, 200)
  assert.equal(song.coverUrl, 'https://cover/nc')
  assert.equal(song.listenCount, 3)
} finally {
  resetNetease()
}

setQq(async (route, params) => {
  assert.equal(route, '/user/listening-rank')
  assert.equal(params.range, 'year')
  return { items: [{ listenCount: 7, track: { mid: 'QQMID', name: 'QQ song', singer: [{ name: 'B' }], album: { mid: 'ALBUM' }, interval: 211 } }] }
})
try {
  const [song] = await listeningRank('qq', 'all', 'cookie')
  assert.equal(song.provider, 'qq')
  assert.equal(song.id, 'QQMID')
  assert.equal(song.durationSec, 211)
  assert.match(String(song.coverUrl), /ALBUM/)
  assert.equal(song.listenCount, 7)
} finally {
  resetQq()
}

// 酷狗现在是 Folia 移植源：排行行来自上游 catalog@1.getListeningRankTracks，
// 替身直接给上游的 Song 形状（毫秒时长、hash 大写、listenCount 挂在 row 上）。
installKugouFoliaStub({
  'catalog@1': {
    async getListeningRankTracks(range, limit, offset) {
      assert.equal(range, 'week')
      return {
        items: [{
          id: 'KGHASH',
          title: 'Kugou song',
          artists: [{ id: '1', name: 'C' }],
          durationMs: 188000,
          coverUrl: 'https://cover/kg',
          row: { listenCount: 5 },
          data: { hash: 'KGHASH' },
        }],
        hasMore: false,
      }
    },
  },
})
try {
  const [song] = await listeningRank('kugou', 'week', '', { userid: '9' })
  assert.equal(song.provider, 'kugouLite')
  assert.equal(song.id, 'kghash')
  assert.equal(song.durationSec, 188)
  assert.equal(song.listenCount, 5)
} finally {
  resetKugouFolia()
}

console.log('rank-shape.test ok')
