/** Manual: does the adapter expose chorus end to end? */
import { registerOnlineSources, omni } from '../../lib/sources/index.js'

registerOnlineSources()
const netease = await omni.chorus('netease', '1901371647', { cookie: '' })
console.log('netease =', JSON.stringify(netease))
const bodian = await omni.chorus('bodian', '228908', { cookie: '' })
console.log('bodian  =', JSON.stringify(bodian))
