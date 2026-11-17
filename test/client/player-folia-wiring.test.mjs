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
const settings = readFileSync(join(ROOT, 'src/client/components/ui/settings.js'), 'utf8')

assert.match(player, /foliaGraph = createFoliaGraph\(\)/, 'attachAudio creates the Folia graph')
assert.match(player, /foliaGraph\.attach\(el\)/, 'attachAudio hands the element to the graph')
assert.match(player, /createFoliaTransport\(\{/, 'attachAudio creates the Folia transport')
assert.match(player, /onState: transportStateChanged/, 'transport state drives the player state')
assert.match(player, /onTime: transportTimeChanged/, 'transport time drives the player clock')
assert.match(player, /onEnded: transportEnded/, 'transport ended drives the player advance')
assert.match(player, /onError: transportFailed/, 'transport errors reach the player')
assert.match(player, /foliaTransport\.load\(foliaTransport\.getActiveDeck\(\)/, 'loadActiveSource uses the transport')
assert.match(player, /foliaTransport\.play\(foliaTransport\.getActiveDeck\(\)\)/, 'autoplay uses the transport')
assert.match(player, /foliaTransport\.pause\(foliaTransport\.getActiveDeck\(\)\)/, 'pause uses the transport')
assert.match(player, /foliaTransport\.seek\(foliaTransport\.getActiveDeck\(\), target\)/, 'seek uses the transport')
assert.match(player, /foliaGraph\.ensure\(\)/, 'ensureAnalyser delegates to the Folia graph')
assert.match(player, /foliaGraph\.setVolume\(state\.volume\)/, 'volume goes to the Folia master gain')
assert.match(player, /foliaGraph\.setMuted\(state\.muted\)/, 'mute goes to the Folia master gain')
assert.match(player, /balanceMeter\.tick\(audioContext/, 'the Folia meter receives its audio clock')
assert.match(player, /setPositionState/, 'Media Session progress is published')
assert.match(player, /audioSession\.type = 'playback'/, 'the audio session is playback')
assert.match(player, /setOutputDevice/, 'the player exposes output-device selection')
assert.match(player, /setPlaybackFade/, 'the player exposes the playback fade switch')
assert.match(settings, /playbackFade/, 'the settings UI exposes the playback fade switch')
assert.match(settings, /setSinkId/, 'the settings UI feature-detects setSinkId')
assert.match(settings, /audioOutputDeviceId/, 'the selected sink is persisted')

// Folia starts the audio once the song's first lyric is resolved. The gate is a step of
// `playAfterLoudness`, before the transport is asked to play, and it is always a no-op
// when the loader is absent (tests, a client without the lyric surface).
assert.match(player, /function whenLyricReady\(/, 'the lyric gate is a named step')
assert.match(player, /MPLyricLoader/, 'the gate uses the shared lyric loader')
const gateBody = player.slice(
  player.indexOf('function playAfterLoudness'),
  player.indexOf('\n  }', player.indexOf('foliaTransport.play(', player.indexOf('function playAfterLoudness'))),
)
assert.ok(
  gateBody.indexOf('whenLyricReady(currentItem())') < gateBody.indexOf('foliaTransport.play('),
  'the lyric gate runs before the transport starts the song',
)
const manifestSource = readFileSync(join(ROOT, 'src/client/manifest.json'), 'utf8')
assert.match(manifestSource, /services\/lyrics\/loader\.js/, 'the loader is part of the client bundle')
const loaderSource = readFileSync(join(ROOT, 'src/client/services/lyrics/loader.js'), 'utf8')
assert.match(loaderSource, /function whenReady\(/, 'the loader exposes the gate')
assert.match(loaderSource, /GATE_TIMEOUT_MS/, 'a slow network cannot hold playback forever')
assert.match(loaderSource, /inflight/, 'concurrent loads of one song share the request')

assert.doesNotMatch(player, /createDynamicsCompressor/, 'no private limiter is created')
assert.doesNotMatch(player, /preampNode/, 'the private preamp is gone')
assert.doesNotMatch(player, /limiterNode/, 'the private limiter node is gone')
assert.doesNotMatch(player, /buildEqNodes/, 'the private EQ graph builder is gone')
assert.doesNotMatch(player, /ensureSecondary|wireSecondary/, 'the private spare-deck graph is gone')

console.log('player-folia-wiring.test.mjs ok')
