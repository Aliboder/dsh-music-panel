/**
 * Smart balance parity: the local fallback must make the same decisions as the
 * Folia audio bundle for every input Folia's balanceRules accepts.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..')
const bundle = readFileSync(join(ROOT, 'src/client/audio/engine.bundle.js'), 'utf8')
const sandbox = { console }
vm.runInNewContext(bundle, sandbox, { filename: 'engine.bundle.js' })
const audio = sandbox.__mpAudioBundle()

const source = readFileSync(join(ROOT, 'src/client/services/player/effects/volume-balance.js'), 'utf8')
const local = new Function(
  'createStore',
  source + '\nreturn { chooseBalance, planBalanceMove, whyNotWholePlay }',
)(() => ({ set() {} }))

const close = (left, right, label) => {
  assert.ok(Math.abs(left - right) < 1e-9, label + ': ' + left + ' != ' + right)
}
const compare = (inputs, label) => {
  const expected = audio.chooseBalance(inputs)
  const actual = local.chooseBalance(inputs)
  assert.equal(actual.reading, expected.reading, label + ': reading')
  close(actual.gainDb, expected.gainDb, label + ': gainDb')
  close(actual.effectiveGainDb, expected.effectiveGainDb, label + ': effectiveGainDb')
  assert.equal(actual.estimated, expected.estimated, label + ': estimated')
}

compare({ file: { loudness: -20.4, peak: 0.73 }, typicalDb: -5 }, 'file')
compare({ played: { loudness: -18.2, peak: 0.51 }, tag: { gainDb: -6, peak: 0.9 }, typicalDb: -5 }, 'played')
compare({ profile: { loudness: -16.4, peak: 0.42 }, typicalDb: -5 }, 'profile')
compare({ tag: { gainDb: -6.4, peak: 0.82 }, typicalDb: -5 }, 'tag')
compare({ head: -13.3, typicalDb: -5 }, 'head')
compare({ platformDb: -2.7, typicalDb: -5 }, 'platform')
compare({ live: -11.6, typicalDb: -5 }, 'live')
compare({ typicalDb: -6.4 }, 'typical')
compare({}, 'default typical')

for (const question of [
  { playSec: 0, moved: false, currentDb: 0, nextDb: -4, blendAudible: false },
  { playSec: 5, moved: false, currentDb: 0, nextDb: -4, blendAudible: false },
  { playSec: 5, moved: false, currentDb: 0, nextDb: -4, blendAudible: true },
  { playSec: 20, moved: false, currentDb: 0, nextDb: -4, blendAudible: false },
  { playSec: 20, moved: false, currentDb: 0, nextDb: -2, blendAudible: false },
  { playSec: 5, moved: true, currentDb: 0, nextDb: -4, blendAudible: false },
]) {
  const actual = local.planBalanceMove(question)
  const expected = audio.planBalanceMove(question)
  if (expected === null || typeof expected === 'string') {
    assert.equal(actual, expected, 'planBalanceMove parity')
  } else {
    assert.equal(typeof actual, 'object', 'planBalanceMove returns a ramp object')
    close(actual.rampSec, expected.rampSec, 'planBalanceMove rampSec')
  }
}

const whole = { loudness: -15, peak: 0.8, heardSec: 180, fromSec: 0.4, toSec: 178, broken: null }
for (const question of [
  { duration: 180 },
  { duration: 0 },
  { duration: 180, clip: 'half' },
  { duration: 180, leadInSec: 3 },
]) {
  assert.equal(local.whyNotWholePlay(whole, question), audio.whyNotWholePlay(whole, question), 'whyNotWholePlay parity')
}

console.log('volume-balance-parity.test.mjs ok')
