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
console.log('automix-profile.test.mjs ok')
