/**
 * Non-VIP accounts may receive a preview clip; the Host marks it instead of
 * rejecting the row or caching it as a whole song.
 */

import assert from 'node:assert/strict'
import { resolveStream } from '../../src/host/providers/index.js'
import { resetUpstreamOverride as resetNetease, setUpstreamOverride as setNetease } from '../../src/host/services/netease-api.js'
import { resetUpstreamOverride as resetQq, setUpstreamOverride as setQq } from '../../src/host/services/qq-api.js'

setNetease(async (route) => {
  if (route !== '/song/url/v1') throw new Error('unexpected NetEase route: ' + route)
  return {
    code: 200,
    data: [{
      url: 'https://cdn.example/preview.mp3',
      level: 'standard',
      br: 128000,
      fee: 1,
      code: 200,
      freeTrialInfo: { start: 0, end: 30 },
    }],
  }
})
const netease = await resolveStream('netease', '1', 'MUSIC_U=cookie', {}, 'standard')
assert.equal(netease.url, 'https://cdn.example/preview.mp3')
assert.equal(netease.preview, true)
resetNetease()

let qqCalls = 0
setQq(async (route, params) => {
  if (route !== '/getMusicPlay/mid-1') throw new Error('unexpected QQ route: ' + route)
  qqCalls += 1
  if (params.preview === 1) {
    return { data: { playUrl: { 'mid-1': { url: 'https://cdn.example/qq-preview.mp3', preview: true } } } }
  }
  return { data: { playUrl: { 'mid-1': { url: '' } } } }
})
const qq = await resolveStream('qq', 'mid-1', 'qqmusic_session=sealed', {}, 'standard')
assert.equal(qq.url, 'https://cdn.example/qq-preview.mp3')
assert.equal(qq.preview, true)
assert.equal(qqCalls, 2)
resetQq()

console.log('preview-stream.test.mjs ok')
