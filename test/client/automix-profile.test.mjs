import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import vm from 'node:vm'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..')
const sandbox = { console, performance, setTimeout, clearTimeout }
vm.runInNewContext(readFileSync(join(ROOT, 'src/client/services/automix/profile.bundle.js'), 'utf8'), sandbox, { filename: 'profile.bundle.js' })
const api = sandbox.__mpProfileBundle()
assert.ok(api && typeof api.analyseTrack === 'function', 'profile bundle exports analyseTrack')
const rate = 22050
const seconds = 4
const mono = new Float32Array(rate * seconds)
for (let index = 0; index < mono.length; index += 1) {
  mono[index] = 0.2 * Math.sin((2 * Math.PI * 220 * index) / rate)
}
const profile = await api.analyseTrack(mono, rate, { partial: false, side: null })
assert.ok(profile, 'profile is measured')
assert.equal(profile.partial, false)
assert.ok(typeof profile.programLoudness === 'number' && profile.programLoudness > -90)
assert.ok(typeof profile.leadIn === 'number')
assert.ok(typeof profile.bpm === 'number' && profile.bpm > 0)
assert.ok(typeof profile.key === 'number')
assert.ok(Array.isArray(profile.sections))
const head = await api.analyseTrack(mono, rate, { partial: true, side: null })
assert.ok(head && head.partial === true)
const beats = Array.from({ length: 16 }, (_, index) => index * 0.5)
const grid = api.gridFromBeats({ beats, downbeats: [0, 2, 4, 6] }, { partial: false })
assert.ok(grid)
assert.ok(Math.abs(grid.bpm - 120) < 1e-9)
assert.equal(grid.beatsPerBar, 4)
assert.equal(api.gridFromBeats({ beats: [0, 0.5], downbeats: [] }, {}), null)
const style = api.chooseTransitionStyle({
  from: { bpm: 120, outroBpm: 120, outroSlope: -2, endsHot: false, tailDb: -22, key: 0, major: true, keyConfidence: 0.8 },
  to: { bpm: 120, leadIn: 3, startsHot: false, headDb: -20, introSlope: 0.1, key: 0, major: true, keyConfidence: 0.8 },
})
assert.equal(style.style, 'bassSwap')
assert.equal(style.relation, 'compatible')
const shaped = api.shapeBlend({
  style: style.style,
  room: 10,
  overlap: 6,
  crossover: 0.5,
  nextBeatIn: 0.2,
  periodSec: 0.5,
  incomingLeadIn: 3,
})
assert.equal(typeof shaped.overlap, 'number')
assert.equal(typeof shaped.hold, 'number')
assert.equal(typeof shaped.together, 'number')
console.log('automix-profile.test.mjs ok')
