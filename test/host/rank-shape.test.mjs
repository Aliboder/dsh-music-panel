/**
 * Every listening-rank row must be queue-playable: provider + duration + cover.
 * Folia normalises rank rows at the provider boundary; this guards the same contract.
 */
import assert from 'node:assert/strict'
import { listeningRank } from '../../src/host/providers/index.js'
import { resetUpstreamOverride as resetNetease, setUpstreamOverride as setNetease } from '../../src/host/services/netease-api.js'
import { resetUpstreamOverride as resetQq, setUpstreamOverride as setQq } from '../../src/host/services/qq-api.js'
import { resetUpstreamOverride as resetKugou, setUpstreamOverride as setKugou } from '../../src/host/services/kugou-api.js'

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

setKugou(async (operation, params) => {
  assert.equal(operation, 'user_listen')
  assert.equal(params.type, 0)
  return { body: { data: { lists: [{ hash: 'KGHASH', songname: 'Kugou song', singername: 'C', duration: 188, listen_count: 5 }] } } }
})
try {
  const [song] = await listeningRank('kugou', 'week', '', { userid: '9' })
  assert.equal(song.provider, 'kugou')
  assert.equal(song.id, 'kghash')
  assert.equal(song.durationSec, 188)
  assert.equal(song.listenCount, 5)
} finally {
  resetKugou()
}

console.log('rank-shape.test ok')
