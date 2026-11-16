/**
 * Navidrome ReplayGain — OpenSubsonic reports it per song, and the balance treats it
 * as the song's tag gain (the same reading Folia uses for a Navidrome track).
 */

import assert from 'node:assert/strict'
import * as ND from '../../src/host/providers/navidrome.js'

// Parsing the payload the server sends.
const parsed = ND.replayGainOf({
  replayGain: { trackGain: -6.6, albumGain: -7.9, trackPeak: 0.87, albumPeak: 0.91 },
})
assert.deepEqual(parsed, { trackGain: -6.6, albumGain: -7.9, trackPeak: 0.87, albumPeak: 0.91 })

// Strings from JSON are accepted too, and a blob with neither gain is nothing.
assert.equal(ND.replayGainOf({ replayGain: { trackGain: '-3.2' } }).trackGain, -3.2)
assert.equal(ND.replayGainOf({ replayGain: {} }), null)
assert.equal(ND.replayGainOf({}), null)
assert.equal(ND.replayGainOf(null), null)

// The song mapping keeps it, so a list can show it without a second request.
const song = ND.search.__testSongOf
if (song !== undefined) {
  const mapped = song({ id: 'n1', title: 'T', replayGain: { trackGain: -5 } })
  assert.equal(mapped.replayGain.trackGain, -5)
}

// The on-demand read goes through getSong.view and degrades to nulls.
const calls = []
const originalFetch = globalThis.fetch
globalThis.fetch = async (url) => {
  calls.push(String(url))
  const payload = {
    'subsonic-response': {
      status: 'ok',
      song: { id: 'n1', title: 'T', replayGain: { trackGain: -6.6, albumGain: -7.9 } },
    },
  }
  return {
    ok: true,
    status: 200,
    headers: { get: () => null },
    async text() {
      return JSON.stringify(payload)
    },
  }
}
try {
  const gain = await ND.songGain(
    { server: 'http://127.0.0.1:4533', username: 'u', token: 't', salt: 's' },
    'n1',
  )
  assert.deepEqual(gain, { trackGain: -6.6, albumGain: -7.9 })
  assert.ok(calls[0].includes('getSong.view'), `getSong used: ${calls[0]}`)

  globalThis.fetch = async () => {
    throw new Error('offline')
  }
  assert.deepEqual(await ND.songGain({ server: 'http://127.0.0.1:4533' }, 'n1'), {
    trackGain: null,
    albumGain: null,
  })
  assert.deepEqual(await ND.songGain({}, ''), { trackGain: null, albumGain: null })
} finally {
  globalThis.fetch = originalFetch
}

console.log('navidrome-gain.test.mjs ok')

