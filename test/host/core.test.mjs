/**
 * Unit tests for the shared core: contract helpers, error typing, port helpers.
 */

import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { capabilities, resolveQuality, SOURCE_IDS, CAPABILITIES } from '../../src/host/services/core/contract.js'
import { MusicError, statusFor, toMusicError } from '../../src/host/services/core/errors.js'
import { allocateFreePort, closeServer, waitForHttp, waitForListening } from '../../src/host/services/core/ports.js'

// ── contract ────────────────────────────────────────────────────────────────

assert.deepEqual(SOURCE_IDS, ['local', 'netease', 'qq', 'kugouLite', 'navidrome'])

const caps = capabilities({ search: true, playback: true })
assert.equal(caps.search, true)
assert.equal(caps.playback, true)
assert.equal(caps.lyrics, false, 'unspecified capabilities default to false')
assert.equal(Object.keys(caps).length, CAPABILITIES.length)

assert.equal(resolveQuality('high'), 'high')
assert.equal(resolveQuality('hires', ['standard', 'high']), 'high', 'clamps to the highest listed')
assert.equal(resolveQuality('standard', ['high', 'lossless']), 'high', 'falls back to the lowest listed')
assert.equal(resolveQuality('bogus'), 'standard')
assert.equal(resolveQuality('lossless', []), 'lossless', 'an empty ladder accepts the request')

// ── errors ──────────────────────────────────────────────────────────────────

const network = toMusicError(new Error('fetch failed'), 'qq')
assert.ok(network instanceof MusicError)
assert.equal(network.code, 'network')
assert.equal(network.sourceId, 'qq')
assert.equal(network.retryable, true)
assert.equal(statusFor(network), 502)

const timeout = toMusicError(new Error('The operation was aborted'), 'netease')
assert.equal(timeout.code, 'timeout')

const protocol = toMusicError(new Error('unexpected shape'), 'kugou')
assert.equal(protocol.code, 'protocol')
assert.equal(protocol.retryable, false)

const explicit = new MusicError('rate limited', { code: 'rate-limited', retryAfterMs: 5000, sourceId: 'netease' })
assert.equal(explicit.retryable, true, 'rate-limited is retryable')
assert.equal(explicit.retryAfterMs, 5000)
assert.equal(statusFor(explicit), 429)

const tagged = toMusicError(new MusicError('boom', { code: 'not-playable' }), 'qq')
assert.equal(tagged.sourceId, 'qq', 'a bare MusicError gets the caller source id')
assert.equal(tagged.code, 'not-playable')
assert.equal(toMusicError(tagged, 'kugou'), tagged, 'an already-tagged error is returned as-is')

assert.deepEqual(Object.keys(explicit.toJSON()).sort(), [
  'code',
  'message',
  'name',
  'retryAfterMs',
  'retryable',
  'sourceId',
  'status',
])

// ── ports ───────────────────────────────────────────────────────────────────

// Hold one listener so the allocator cannot hand back the same number: the OS is
// free to reuse a port that was just released, which makes a naive
// "two allocations differ" assertion flaky.
const holder = createServer()
holder.listen(0, '127.0.0.1')
const heldPort = await waitForListening(holder, { label: 'holder' })
const port = await allocateFreePort()
assert.ok(port > 0)
assert.notEqual(port, heldPort, 'a port already in use must not be handed out')
await closeServer(holder)

const server = createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'text/plain' })
  res.end('ok')
})
server.listen(port, '127.0.0.1')
const bound = await waitForListening(server, { label: 'test server' })
assert.equal(bound, port)

const status = await waitForHttp(`http://127.0.0.1:${bound}/`, { timeoutMs: 3000 })
assert.equal(status, 200)

await closeServer(server)
assert.equal(server.listening, false)
await closeServer(undefined)
await closeServer(server)

await assert.rejects(() => waitForListening(createServer(), { timeoutMs: 50 }), /did not start/)

console.log('core.test.mjs ok')

