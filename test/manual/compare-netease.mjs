/** Compare the raw upstream payload with our normalized delivery. */
import { callUpstream } from '../../lib/services/netease-api.js'
import { search } from '../../lib/providers/netease.js'

const raw = await callUpstream('/cloudsearch', { keywords: '晴天', type: 1, limit: 1, offset: 0 }, {})
const rawSong = raw.result?.songs?.[0] ?? {}
const rawKeys = Object.keys(rawSong).sort()

const ours = await search('晴天', '', 1, 1)
const ourSong = ours.results?.[0] ?? {}
const ourKeys = Object.keys(ourSong).sort()

console.log('RAW upstream song keys (' + rawKeys.length + '):')
console.log(rawKeys.join(', '))
console.log('\nOUR delivered item keys (' + ourKeys.length + '):')
console.log(ourKeys.join(', '))
console.log('\nRAW extras we drop:')
console.log(rawKeys.filter((k) => !ourKeys.includes(k)).join(', '))
console.log('\nSample raw fields:')
console.log(JSON.stringify({
  id: rawSong.id, name: rawSong.name, fee: rawSong.fee,
  ar: (rawSong.ar ?? []).map((a) => a?.name),
  al: rawSong.al && { id: rawSong.al.id, name: rawSong.al.name, picUrl: rawSong.al.picUrl && 'yes' },
  dt: rawSong.dt, privilege: rawSong.privilege,
  alia: rawSong.alia, tns: rawSong.tns,
}, null, 2).slice(0, 900))
process.exit(0)
