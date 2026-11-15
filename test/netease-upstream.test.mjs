/**
 * NetEase upstream transport tests.
 *
 * The pure mapping tests always run. The live block starts the local API service
 * and talks to the real upstream, so it is gated behind DSH_MUSIC_UPSTREAM=1.
 */

import assert from 'node:assert/strict'
import { plain, songOf } from '../lib/providers/netease.js'
import { assertOk, ensureNeteaseService, stopNeteaseService } from '../lib/services/netease-api.js'
import { installClientIpPolicy, withoutImplicitClientIp } from '../lib/services/netease-upstream.js'

// ── pure mapping ────────────────────────────────────────────────────────────

assert.equal(plain('<em>晴天</em>'), '晴天')
assert.equal(plain('a <em class="x">b</em> c'), 'a b c')
assert.equal(plain(undefined), '')
assert.equal(plain(null), '')

const modern = songOf({
  id: 42,
  name: '<em>Test</em> Song',
  ar: [{ name: 'Artist A' }, { name: 'Artist B' }],
  al: { id: 7, name: 'Album', picUrl: 'https://p/1.jpg' },
  dt: 210000,
  fee: 8,
})
assert.equal(modern.id, '42')
assert.equal(modern.title, 'Test Song')
assert.deepEqual(modern.artists, ['Artist A', 'Artist B'])
assert.equal(modern.album, 'Album')
assert.equal(modern.interval, 210)
assert.equal(modern.fee, 8)
assert.equal(modern.cover, 'https://p/1.jpg')

// A few upstream routes still answer the old field names.
const legacyShape = songOf({
  id: 43,
  name: 'Old Shape',
  artists: [{ name: 'C' }],
  album: { id: 9, name: 'Old Album', picUrl: 'https://p/2.jpg' },
  duration: 60000,
  fee: 0,
})
assert.equal(legacyShape.id, '43')
assert.deepEqual(legacyShape.artists, ['C'])
assert.equal(legacyShape.album, 'Old Album')
assert.equal(legacyShape.interval, 60)

assert.equal(songOf(null), null)
assert.equal(songOf(undefined), null)
assert.equal(songOf({ name: 'no id' }), null)


// ── the client-IP policy ────────────────────────────────────────────────────
//
// Folia strips the caller's IP from every NetEase request (electron/netease/
// neteaseApiStartup.cjs, "withoutImplicitClientIp"): the package would otherwise
// send X-Real-IP: 127.0.0.1, which the platform can read as a spoofed source and
// which Folia measured to break the QR confirm step. The policy keeps the header
// only where a request explicitly asks for a random domestic IP.

{
  const seen = []
  const wrapped = withoutImplicitClientIp((uri, data, options) => {
    seen.push({ uri, data, options })
    return Promise.resolve('answered')
  })

  assert.equal(await wrapped('/song/url/v1', { id: 1 }, { ip: '127.0.0.1', cookie: { a: 'b' } }), 'answered')
  assert.equal(seen[0].options.ip, '', 'the implicit client IP is dropped')
  assert.deepEqual(seen[0].data, { id: 1 }, 'the payload is passed through untouched')
  assert.deepEqual(seen[0].options.cookie, { a: 'b' }, 'other options survive the policy')

  await wrapped('/song/url/v1', {}, { ip: '36.1.2.3', randomCNIP: true })
  assert.equal(seen[1].options.ip, '36.1.2.3', 'a random domestic IP is what the caller asked for')

  await wrapped('/login/qr/check', {}, {})
  assert.equal(seen[2].options.ip, '', 'a request without options still gets no IP')
}

{
  // The install replaces the module export the package's own modules will read.
  const cache = {}
  const requestPath = '/pkg/util/request.js'
  const original = (uri, data, options) => Promise.resolve({ uri, ip: options.ip })
  const fakeRequire = (path) => {
    cache[path] = { exports: original }
    return cache[path].exports
  }
  fakeRequire.cache = cache

  installClientIpPolicy(fakeRequire, requestPath)
  const patched = cache[requestPath].exports
  assert.notEqual(patched, original, 'the export is replaced, not wrapped around')
  assert.equal((await patched('/x', {}, { ip: '127.0.0.1' })).ip, '', 'the installed export carries the policy')
  assert.equal((await patched('/x', {}, { ip: '9.9.9.9', randomCNIP: true })).ip, '9.9.9.9')
}

// ── QR poll status codes ────────────────────────────────────────────────────
//
// `/login/qr/check` answers 800/801/802/803 for expired/waiting/scanned/signed-in.
// That `code` is the scan state, so the generic "code must be 200" gate has to be
// skippable — otherwise the first poll after the code appears throws and the login
// window reports "the platform refused this sign-in" with the upstream's waiting
// message. Regression: every QR sign-in failed this way.

assert.equal(assertOk({ code: 200, ok: true }, '/cloudsearch').ok, true)
assert.throws(() => assertOk({ code: 801, message: '等待扫码' }, '/login/qr/check'), /等待扫码/)
assert.equal(assertOk({ code: 801, message: '等待扫码' }, '/login/qr/check', { skipCodeCheck: true }).code, 801)
assert.equal(assertOk({ code: 803, cookie: 'MUSIC_U=x' }, '/login/qr/check', { skipCodeCheck: true }).cookie, 'MUSIC_U=x')

// ── live (opt-in) ───────────────────────────────────────────────────────────

if (process.env.DSH_MUSIC_UPSTREAM === '1') {
  const { search, getLyric, getDownloadURL, getChorus, createQRLogin, checkQRLogin } = await import('../lib/providers/netease.js')

  const service = await ensureNeteaseService()
  assert.ok(service.port > 0, 'the local service must report a bound port')
  assert.equal(service.clientIpPolicy, true, 'the upstream request export carries the client-IP policy')

  const found = await search('周杰伦 晴天', '', 1, 1)
  assert.ok(found.results.length > 0, 'search must return at least one song')
  assert.equal(found.page, 1)
  const first = found.results[0]
  assert.ok(first.id !== '')
  assert.ok(first.title !== '')

  const lyric = await getLyric(first.id, '')
  assert.equal(typeof lyric.lyric, 'string')
  assert.ok(lyric.lyric.length > 0 || lyric.yrc.length > 0, 'lyrics or yrc must be present')

  // Word-level timing is only returned when the request asks for it (`yv`), which
  // the route module never does.
  const wordLevel = await getLyric('1901371647', '')
  assert.ok(wordLevel.yrc.length > 0, 'YRC must be fetched explicitly')
  const { parseYrc } = await import('../lib/providers/yrc.js')
  const parsed = parseYrc(wordLevel.yrc)
  assert.equal(parsed.wordLevel, true)
  assert.ok(parsed.lines.some((line) => (line.words || []).length > 0), 'parsed lines carry word timelines')

  // Folia fetches the chorus window to jump to the hook.
  const chorus = await getChorus('1901371647', '')
  assert.ok(chorus !== null, 'chorus window must be returned')
  assert.ok(chorus.startMs > 0 && chorus.endMs > chorus.startMs)
  assert.ok(chorus.startSec > 0)

  const audio = await getDownloadURL(first.id, '', 'high')
  assert.ok(typeof audio.url === 'string')
  assert.equal(audio.id, first.id)

  // The first poll after the code appears must be a scan state, not an error.
  const qr = await createQRLogin()
  assert.ok(qr.key !== '')
  const polled = await checkQRLogin(qr.key)
  assert.equal(polled.status, 'waiting', `an unscanned code polls as waiting, got ${polled.status}`)

  await stopNeteaseService()
  console.log('netease-upstream.test.mjs ok (live)')
} else {
  await stopNeteaseService()
  console.log('netease-upstream.test.mjs ok (pure only)')
}
