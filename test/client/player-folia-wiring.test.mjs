/**
 * Player wiring guard: the graph half now goes through Folia.
 *
 * The full client smoke test mounts UI, not an AudioContext. This source guard
 * pins the boundary so a later edit cannot quietly restore the old private
 * limiter/preamp graph inside `player.js`.
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..')
const player = readFileSync(join(ROOT, 'src/client/services/player/player.js'), 'utf8')

assert.match(player, /foliaGraph = createFoliaGraph\(\)/, 'attachAudio creates the Folia graph')
assert.match(player, /foliaGraph\.attach\(el\)/, 'attachAudio hands the element to the graph')
assert.match(player, /foliaGraph\.ensure\(\)/, 'ensureAnalyser delegates to the Folia graph')
assert.match(player, /foliaGraph\.setVolume\(state\.volume\)/, 'volume goes to the Folia master gain')
assert.match(player, /foliaGraph\.setMuted\(state\.muted\)/, 'mute goes to the Folia master gain')
assert.match(player, /balanceMeter\.tick\(audioContext/, 'the Folia meter receives its audio clock')

assert.doesNotMatch(player, /createDynamicsCompressor/, 'no private limiter is created')
assert.doesNotMatch(player, /preampNode = audioContext\.createGain/, 'no private preamp is created')
assert.doesNotMatch(player, /limiterNode = audioContext/, 'no private limiter node is wired')
assert.doesNotMatch(player, /tail\.connect\(limiterNode\)/, 'the old limiter chain is gone')

console.log('player-folia-wiring.test.mjs ok')
