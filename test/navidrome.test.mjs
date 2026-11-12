/**
 * Navidrome / Subsonic provider: auth, URL building, search normalisation.
 *
 * No network: `fetch` is stubbed per test so the suite stays hermetic and
 * never touches the developer's real server.
 */

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import * as ND from '../lib/providers/navidrome.js'

const tests = []
function test(name, fn) {
  tests.push({ name, fn })
}

/** Install a fetch stub for the duration of one test; always restored. */
async function withFetch(handler, fn) {
  const original = globalThis.fetch
  globalThis.fetch = handler
  try {
    return await fn()
  } finally {
    globalThis.fetch = original
  }
}

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    text: async () => JSON.stringify(body),
    json: async () => body,
  }
}

const okBody = (extra) => ({ 'subsonic-response': { status: 'ok', version: '1.16.1', ...extra } })
const cfg = { server: 'https://nd.example.com', username: 'alice', salt: 'abc123', token: 'deadbeef' }

// ── token ────────────────────────────────────────────────────────────────

test('makeToken uses md5(password + salt)', () => {
  const { salt, token } = ND.makeToken('secret', 'abc')
  assert.equal(salt, 'abc')
  assert.equal(token, createHash('md5').update('secretabc').digest('hex'))
})

test('makeToken generates a random salt when none is given', () => {
  const a = ND.makeToken('x')
  const b = ND.makeToken('x')
  assert.notEqual(a.salt, b.salt)
  assert.equal(a.salt.length, 16)
  assert.equal(a.token, createHash('md5').update('x' + a.salt).digest('hex'))
})

// ── server normalisation ─────────────────────────────────────────────────

test('normalizeServer strips trailing slashes and keeps a sub-path', () => {
  assert.equal(ND.normalizeServer('https://nd.example.com/'), 'https://nd.example.com')
  assert.equal(ND.normalizeServer('  https://nd.example.com/music/  '), 'https://nd.example.com/music')
  assert.equal(ND.normalizeServer('https://nd.example.com:8443'), 'https://nd.example.com:8443')
})

test('normalizeServer rejects empty and non-http(s) input', () => {
  assert.equal(ND.normalizeServer(''), '')
  assert.equal(ND.normalizeServer('   '), '')
  assert.equal(ND.normalizeServer('ftp://nd.example.com'), '')
  assert.equal(ND.normalizeServer('not a url'), '')
  assert.equal(ND.normalizeServer(null), '')
})

// ── auth query ───────────────────────────────────────────────────────────

test('authQuery carries the salted token, never a password', () => {
  const q = ND.authQuery(cfg)
  const params = new URLSearchParams(q)
  assert.equal(params.get('u'), 'alice')
  assert.equal(params.get('t'), 'deadbeef')
  assert.equal(params.get('s'), 'abc123')
  assert.equal(params.get('v'), '1.16.1')
  assert.equal(params.get('c'), 'dsh-music-panel')
  assert.equal(params.get('f'), 'json')
  assert.equal(params.get('p'), null, 'plaintext password must never be sent')
})

test('authQuery merges extra parameters', () => {
  const params = new URLSearchParams(ND.authQuery(cfg, { id: 's1', maxBitRate: '320' }))
  assert.equal(params.get('id'), 's1')
  assert.equal(params.get('maxBitRate'), '320')
})

// ── ping ─────────────────────────────────────────────────────────────────

test('ping reports server identity', async () => {
  await withFetch(
    async () => jsonResponse(okBody({ type: 'navidrome', serverVersion: '0.64.2', openSubsonic: true })),
    async () => {
      const info = await ND.ping(cfg)
      assert.equal(info.type, 'navidrome')
      assert.equal(info.serverVersion, '0.64.2')
      assert.equal(info.openSubsonic, true)
    },
  )
})

test('ping surfaces a subsonic error', async () => {
  await withFetch(
    async () =>
      jsonResponse({
        'subsonic-response': {
          status: 'failed',
          error: { code: 40, message: 'Wrong username or password' },
        },
      }),
    async () => {
      await assert.rejects(() => ND.ping(cfg), /40.*Wrong username or password/)
    },
  )
})

test('ping rejects an http error status', async () => {
  await withFetch(
    async () => jsonResponse({}, 503),
    async () => {
      await assert.rejects(() => ND.ping(cfg), /HTTP 503/)
    },
  )
})

// ── search ───────────────────────────────────────────────────────────────

test('search normalises songs from search3', async () => {
  const captured = []
  await withFetch(
    async (url) => {
      captured.push(String(url))
      return jsonResponse(
        okBody({
          searchResult3: {
            song: [
              {
                id: 's1',
                title: '霸王别姬',
                artist: '薛之谦',
                artists: [{ name: '薛之谦' }, { name: '张靓颖' }],
                album: '霸王别姬',
                duration: 230,
                coverArt: 'mf-s1',
              },
            ],
          },
        }),
      )
    },
    async () => {
      const songs = await ND.search(cfg, '霸王别姬')
      assert.equal(songs.length, 1)
      const song = songs[0]
      assert.equal(song.provider, 'navidrome')
      assert.equal(song.id, 's1')
      assert.equal(song.title, '霸王别姬')
      assert.equal(song.artist, '薛之谦 / 张靓颖', 'multiple artists joined with " / "')
      assert.equal(song.durationSec, 230)
      assert.equal(song.coverArtId, 'mf-s1')
    },
  )
  assert.match(captured[0], /\/rest\/search3\.view\?/, 'uses the ID3 search view')
  assert.match(captured[0], /query=/, 'forwards the query')
})

test('search returns [] for an empty or blank query without touching the network', async () => {
  let called = false
  await withFetch(
    async () => {
      called = true
      return jsonResponse(okBody({}))
    },
    async () => {
      assert.deepEqual(await ND.search(cfg, ''), [])
      assert.deepEqual(await ND.search(cfg, '   '), [])
    },
  )
  assert.equal(called, false)
})

test('search skips rows without an id', async () => {
  await withFetch(
    async () =>
      jsonResponse(
        okBody({
          searchResult3: { song: [{ title: 'no id' }, { id: 'ok', title: 't' }] },
        }),
      ),
    async () => {
      const songs = await ND.search(cfg, 'x')
      assert.equal(songs.length, 1)
      assert.equal(songs[0].id, 'ok')
    },
  )
})

test('search falls back to the legacy view when search3 is rejected', async () => {
  const seen = []
  await withFetch(
    async (url) => {
      seen.push(String(url))
      if (String(url).includes('search3.view')) {
        return jsonResponse({
          'subsonic-response': { status: 'failed', error: { code: 70, message: 'not found' } },
        })
      }
      return jsonResponse(okBody({ searchResult: { song: [{ id: 'legacy', title: 'L' }] } }))
    },
    async () => {
      const songs = await ND.search(cfg, 'x')
      assert.equal(songs.length, 1)
      assert.equal(songs[0].id, 'legacy')
    },
  )
  assert.equal(seen.length, 2)
  assert.match(seen[1], /search\.view/)
})

// ── stream ───────────────────────────────────────────────────────────────

test('resolveStream builds an authenticated stream URL', async () => {
  const { url, quality } = await ND.resolveStream(cfg, 's1', 'high')
  const params = new URLSearchParams(url.split('?')[1])
  assert.match(url, /\/rest\/stream\.view\?/)
  assert.equal(params.get('id'), 's1')
  assert.equal(params.get('t'), 'deadbeef')
  assert.equal(params.get('s'), 'abc123')
  assert.equal(params.get('maxBitRate'), '320')
  assert.equal(quality, '320k')
})

test('resolveStream caps bitrate for standard quality and omits it for lossless', async () => {
  const std = new URLSearchParams((await ND.resolveStream(cfg, 's1', 'standard')).url.split('?')[1])
  assert.equal(std.get('maxBitRate'), '128')
  const lossless = new URLSearchParams((await ND.resolveStream(cfg, 's1', 'lossless')).url.split('?')[1])
  assert.equal(lossless.get('maxBitRate'), null)
})

test('resolveStream returns an empty url for a blank id', async () => {
  assert.deepEqual(await ND.resolveStream(cfg, '', 'high'), { url: '', quality: '' })
})

// ── cover art ────────────────────────────────────────────────────────────

test('coverArtUrl is authenticated and empty without an id', () => {
  const url = ND.coverArtUrl(cfg, 'mf-s1')
  assert.match(url, /\/rest\/getCoverArt\.view\?/)
  assert.equal(new URLSearchParams(url.split('?')[1]).get('id'), 'mf-s1')
  assert.equal(new URLSearchParams(url.split('?')[1]).get('t'), 'deadbeef')
  assert.equal(ND.coverArtUrl(cfg, ''), '')
})

// ── playlists ────────────────────────────────────────────────────────────

test('myPlaylists shapes the playlist list', async () => {
  await withFetch(
    async () =>
      jsonResponse(
        okBody({
          playlists: { playlist: [{ id: 'p1', name: 'Favourites', songCount: 12 }] },
        }),
      ),
    async () => {
      const list = await ND.myPlaylists(cfg)
      assert.equal(list.length, 1)
      assert.equal(list[0].id, 'p1')
      assert.equal(list[0].name, 'Favourites')
      assert.equal(list[0].trackCount, 12)
      assert.equal(list[0].provider, 'navidrome')
    },
  )
})

test('playlistSongs maps entries', async () => {
  await withFetch(
    async () =>
      jsonResponse(okBody({ playlist: { entry: [{ id: 'e1', title: 'T', artist: 'A', duration: 5 }] } })),
    async () => {
      const songs = await ND.playlistSongs(cfg, 'p1')
      assert.equal(songs.length, 1)
      assert.equal(songs[0].id, 'e1')
      assert.equal(songs[0].durationSec, 5)
    },
  )
})

// ── lyrics ───────────────────────────────────────────────────────────────

test('lyric formats structured lyrics into LRC', async () => {
  await withFetch(
    async () =>
      jsonResponse(
        okBody({
          lyricsList: {
            structuredLyrics: [{ line: [{ start: 12.5, value: 'hello' }] }],
          },
        }),
      ),
    async () => {
      const out = await ND.lyric(cfg, 's1')
      assert.equal(out.lrc, '[00:12.50]hello')
      assert.equal(out.translation, '')
    },
  )
})

test('lyric degrades to empty when the server has no lyrics', async () => {
  await withFetch(
    async () => jsonResponse({ 'subsonic-response': { status: 'failed', error: { code: 70, message: 'nope' } } }),
    async () => {
      assert.deepEqual(await ND.lyric(cfg, 's1'), { lrc: '', translation: '' })
    },
  )
})

// ── library-wide song list ───────────────────────────────────────────────

test('songs uses getRandomSongs and normalises the rows', async () => {
  const seen = []
  await withFetch(
    async (url) => {
      seen.push(String(url))
      return jsonResponse(
        okBody({
          randomSongs: {
            song: [
              { id: 'a1', title: 'Alpha', artist: 'A', album: 'Al', duration: 100 },
              { title: 'no id' },
              { id: 'a2', title: 'Beta', duration: 200 },
            ],
          },
        }),
      )
    },
    async () => {
      const list = await ND.songs(cfg)
      assert.equal(list.length, 2, 'rows without an id are dropped')
      assert.equal(list[0].id, 'a1')
      assert.equal(list[0].provider, 'navidrome')
      assert.equal(list[0].durationSec, 100)
      assert.equal(list[1].id, 'a2')
    },
  )
  assert.match(seen[0], /\/rest\/getRandomSongs\.view\?/, 'uses the random-songs view')
  assert.match(seen[0], /size=200/, 'defaults to 200 rows')
})

test('songs clamps the requested size and returns [] when the server has none', async () => {
  const seen = []
  await withFetch(
    async (url) => {
      seen.push(String(url))
      return jsonResponse(okBody({ randomSongs: {} }))
    },
    async () => {
      assert.deepEqual(await ND.songs(cfg, 9999), [])
      assert.deepEqual(await ND.songs(cfg, 0), [])
    },
  )
  assert.match(seen[0], /size=500/, 'size is capped at 500')
  assert.match(seen[1], /size=200/, 'a falsy size falls back to the 200 default')
})

test('songs surfaces a subsonic failure', async () => {
  await withFetch(
    async () =>
      jsonResponse({ 'subsonic-response': { status: 'failed', error: { code: 40, message: 'denied' } } }),
    async () => {
      await assert.rejects(() => ND.songs(cfg), /40.*denied/)
    },
  )
})

// ── runner ───────────────────────────────────────────────────────────────

let failed = 0
for (const { name, fn } of tests) {
  try {
    await fn()
    console.log('  ok  ' + name)
  } catch (error) {
    failed += 1
    console.error('  FAIL ' + name)
    console.error('       ' + (error instanceof Error ? error.message : String(error)))
  }
}

if (failed > 0) {
  console.error('\nnavidrome.test.mjs: ' + failed + ' failed')
  process.exit(1)
}
console.log('\nnavidrome.test.mjs ok (' + tests.length + ' tests)')
