/**
 * Listening rank + playback report host adapters, with the upstream call stubbed.
 */

import assert from 'node:assert/strict'
import { listeningRank, reportPlayback } from '../../src/host/providers/index.js'
import { resetUpstreamOverride, setUpstreamOverride } from '../../src/host/services/netease-api.js'

const calls = []
setUpstreamOverride(async (route, params) => {
  calls.push([route, params])
  if (route === '/user/account') {
    return { code: 200, profile: { userId: 7, nickname: 'Alice' } }
  }
  if (route === '/user/record') {
    return {
      code: 200,
      weekData: [{
        playCount: 42,
        song: { id: 9, name: '晴天', ar: [{ name: '周杰伦' }], al: { id: 1, name: '叶惠美', picUrl: 'https://c' }, dt: 269000 },
      }],
      allData: [],
    }
  }
  if (route === '/scrobble/v1') return { code: 200 }
  return { code: 500 }
})

const songs = await listeningRank('netease', 'week', 'MUSIC_U=cookie')
assert.equal(songs.length, 1)
assert.equal(songs[0].id, '9')
assert.equal(songs[0].listenCount, 42)
assert.equal(calls[0][0], '/user/account')
assert.equal(calls[1][0], '/user/record')
assert.equal(calls[1][1].uid, 7)
assert.equal(calls[1][1].type, 1)

assert.equal(await reportPlayback('netease', { id: '9', title: '晴天', artist: '周杰伦' }, {
  playedSeconds: 35,
  totalSeconds: 269,
  quality: 'high',
}, 'MUSIC_U=cookie'), true)
const scrobble = calls.find(([route]) => route === '/scrobble/v1')
assert.equal(scrobble[1].time, 35)
assert.equal(scrobble[1].level, 'exhigh')
assert.equal(scrobble[1].bitrate, 320)

await assert.rejects(
  () => reportPlayback('netease', { id: 'cloud-track', title: 'x' }, { playedSeconds: 40 }, 'c'),
  /不能上报/,
)
await assert.rejects(() => reportPlayback('qq', { id: '1' }, { playedSeconds: 40 }, 'c'), /不接受/)

resetUpstreamOverride()
console.log('playback-reports.test.mjs ok')
