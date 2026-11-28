/**
 * VIP 角标（插件自己的特性，不属于 Folia）：平台字段 → `qualityHint: 'VIP'` → 客户端角标。
 *
 * 移植前规则在旧 provider 映射里：netease fee===1、qq payplay===1、bodian payInfo.feeType.vip==='1'、
 * qishui commerce_info.icon_info.type 是 vip/svip。移植后原始字段由音源归一化留在 `data` 上，
 * 这里验证映射与 DTO 两层，防止再次丢失。
 */

import assert from 'node:assert/strict'
import { vipOfSong } from '../../src/host/providers/sources/song-vip.js'
import { songOf } from '../../src/host/providers/sources/folia-bridge/dto.js'

const track = (data) => ({ id: 'x1', title: '歌', artists: [{ name: '歌手' }], album: { id: 'a1', name: '专辑' }, durationMs: 1000, data })

// 网易云：fee === 1（旧规则），以及 privilege.fee === 1。
assert.equal(vipOfSong('netease', track({ fee: 1 })), true)
assert.equal(vipOfSong('netease', track({ fee: 0 })), false)
assert.equal(vipOfSong('netease', track({ privilege: { fee: 1 } })), true)

// QQ / 波点 / 汽水：音源归一化留下的 data.vip。
for (const sourceId of ['qq', 'bodian', 'qishui', 'kugouLite']) {
  assert.equal(vipOfSong(sourceId, track({ vip: true })), true, sourceId + ' vip flag')
  assert.equal(vipOfSong(sourceId, track({})), false, sourceId + ' without flag')
}

// DTO 把 VIP 放进 qualityHint（客户端据此画角标），没有 VIP 时保留 availability 文案。
assert.equal(songOf(track({ fee: 1 }), 'netease', null).qualityHint, 'VIP')
assert.equal(songOf(track({ vip: true }), 'qq', null).qualityHint, 'VIP')
assert.equal(songOf(track({ vip: true }), 'bodian', null).qualityHint, 'VIP')
assert.equal(songOf(track({ vip: true }), 'qishui', null).qualityHint, 'VIP')
assert.equal(
  songOf({ id: 'x1', title: '歌', artists: [], album: { id: 'a1', name: '专辑' }, durationMs: 1000, availability: { label: '试听' } }, 'qq', null).qualityHint,
  '试听',
  'a non-VIP row keeps its availability label',
)

console.log('song-vip.test ok')
