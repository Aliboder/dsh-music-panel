/**
 * 移植源的排行行必须能直接进队列：provider + 时长 + 封面 + listenCount。
 * Folia 在音源边界归一化排行行；这里守住同一条契约（酷狗走门面 → 移植源）。
 */
import assert from 'node:assert/strict'
import { listeningRank } from '../../src/host/providers/index.js'
import { installKugouFoliaStub, resetKugouFolia } from './helpers/kugou-folia-stub.mjs'

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
