/**
 * Issue #31 guard: long online audio must not be appended into MediaSource, and a
 * failed MSE session must keep the listener's play intent and position.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (file) => readFileSync(join(root, file), 'utf8')
const helpers = read('src/client/services/player/online-fallback.js')
const player = read('src/client/services/player/player.js')
const host = read('src/host/http/routes/online.js')
const api = read('src/client/services/api/api.js')

function headersOf(values) {
  return { get: (key) => (values[key] === undefined ? null : String(values[key])) }
}

test('the MSE size guard uses Content-Range total before partial length', () => {
  const sandbox = { isFinite }
  vm.runInNewContext(helpers, sandbox)
  assert.equal(sandbox.mpStreamTotalBytes(headersOf({ 'content-length': '15409154' })), 15409154)
  assert.equal(
    sandbox.mpStreamTotalBytes(headersOf({ 'content-length': '4096', 'content-range': 'bytes 0-4095/15409154' })),
    15409154,
    'a partial Content-Length must not hide the real file size',
  )
  assert.equal(sandbox.mpStreamTotalBytes(headersOf({ 'content-range': 'bytes 0-99/*' })), null)
  assert.equal(sandbox.mpMseStreamTooLarge(headersOf({ 'content-length': '15409154' })), true)
  assert.equal(sandbox.mpMseStreamTooLarge(headersOf({ 'content-length': String(9 * 1024 * 1024) })), false)
})

test('a fallback keeps play intent and the position where MSE stopped', () => {
  const sandbox = { isFinite }
  vm.runInNewContext(helpers, sandbox)
  assert.equal(JSON.stringify(sandbox.mpFallbackPlaybackState({ pendingAutoplay: true, playing: false, paused: true, ended: false, currentTime: 0 })), JSON.stringify({ shouldResume: true, resumeAt: null }))
  assert.equal(JSON.stringify(sandbox.mpFallbackPlaybackState({ pendingAutoplay: false, playing: true, paused: false, ended: false, currentTime: 42.5 })), JSON.stringify({ shouldResume: true, resumeAt: 42.5 }))
  assert.equal(JSON.stringify(sandbox.mpFallbackPlaybackState({ pendingAutoplay: false, playing: false, paused: true, ended: false, currentTime: 42.5 })), JSON.stringify({ shouldResume: false, resumeAt: 42.5 }), 'a deliberate pause stays paused but keeps the position')
  assert.equal(sandbox.mpFallbackPlaybackState({ pendingAutoplay: false, playing: false, paused: true, currentTime: 0.2 }).resumeAt, null)
})

test('the player uses the guard and preserves state on every MSE fallback', () => {
  assert.match(player, /mpMseStreamTooLarge\(response\.headers\)/)
  assert.match(player, /function startOnlineBlob\(item, token, loudness, headers\)/)
  assert.match(player, /function playOnlineEntry\(item, token, loudness\)/)
  assert.match(player, /info && info\.cached === true/)
  assert.match(player, /loadActiveSource\(objectUrl\)/)
  assert.match(api, /direct === true \? '&direct=1'/)
  assert.match(player, /if \(captureMseFallbackIntent\(\)\) pendingAutoplay = true/)
  assert.match(player, /sourceBuffer\.addEventListener\('error'/)
  assert.match(player, /fallbackToDirect\(error\)/)
  assert.match(player, /var fallbackPlaying = captureMseFallbackIntent\(/)
})

test('a Range request never drops quality mid-resource', () => {
  assert.match(host, /const nextQuality = refreshed === 0 \|\| hasRange \|\| directStream \? quality : nextLowerOnlineQuality\(quality\)/)
})
console.log('mse-fallback.test.mjs ok')
