/**
 * NetEase upstream transport tests.
 *
 * The pure mapping tests always run. The live block starts the local API service
 * and talks to the real upstream, so it is gated behind DSH_MUSIC_UPSTREAM=1.
 */

import assert from 'node:assert/strict'
import { plain, songOf } from '../../src/host/providers/netease.js'
import { assertOk, ensureNeteaseService, stopNeteaseService } from '../../src/host/services/netease-api.js'
import {
  createLoginQrCheck,
  installClientIpPolicy,
  installUpstreamPolicies,
  isUpstreamNetworkFailure,
  withoutImplicitClientIp,
  withQrNetworkRetry,
} from '../../src/host/services/netease-upstream.js'

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


// ── the QR policies ─────────────────────────────────────────────────────────
//
// Folia's other two startup policies (electron/netease/neteaseApiStartup.cjs): the QR
// steps retry once on a network-level failure, and the package's own login_qr_check is
// replaced because its catch clause reads a variable that only exists in the try.

{
  assert.equal(isUpstreamNetworkFailure({ status: 502, body: { msg: 'socket hang up' } }), true)
  assert.equal(isUpstreamNetworkFailure({ status: 502, body: { msg: 'getaddrinfo ENOTFOUND interface.music.163.com' } }), true)
  assert.equal(isUpstreamNetworkFailure({ status: 502, body: { msg: 'some other error' } }), false)
  assert.equal(isUpstreamNetworkFailure({ status: 503, body: { msg: 'socket hang up' } }), false)
  assert.equal(isUpstreamNetworkFailure(null), false)

  // A reset on the QR key step is retried once, with fresh copies of data/options.
  let attempts = 0
  const sent = []
  const flaky = async (uri, data, options) => {
    attempts += 1
    sent.push({ uri, data, options })
    if (attempts === 1) throw { status: 502, body: { msg: 'socket hang up' } }
    return { uri, data }
  }
  const retried = withQrNetworkRetry(flaky, { sleep: async () => {}, logger: { warn() {} } })
  const data = { key: 'k' }
  const options = { cookie: { a: 'b' }, ip: '' }
  await retried('/api/login/qrcode/unikey', data, options)
  assert.equal(attempts, 2, 'the QR step is sent twice')
  assert.notEqual(sent[1].data, data, 'each attempt gets its own payload copy')
  assert.notEqual(sent[1].options.cookie, options.cookie, 'each attempt gets its own option copy')

  // Any other route, or any other failure, is answered as it came.
  let otherAttempts = 0
  const other = withQrNetworkRetry(async () => {
    otherAttempts += 1
    throw { status: 502, body: { msg: 'socket hang up' } }
  }, { sleep: async () => {}, logger: { warn() {} } })
  await assert.rejects(() => other('/song/url/v1', {}, {}))
  assert.equal(otherAttempts, 1, 'non-QR routes are not retried')

  // The replacement answers the real body, and a refusal keeps its status/body.
  const check = createLoginQrCheck((query) => ({ key: query.key }))
  const answered = await check({ key: 'k' }, async () => ({ body: { code: 803 }, cookie: ['a=1', 'b=2'] }))
  assert.equal(answered.status, 200)
  assert.equal(answered.body.code, 803)
  assert.equal(answered.body.cookie, 'a=1;b=2')
  await assert.rejects(
    () => check({ key: 'k' }, async () => { throw { status: 503, body: { code: -460, msg: 'refused' } } }),
    (error) => error.status === 503 && error.body.code === -460,
  )

  // Installing replaces both modules the package reads.
  const cache = {}
  const requestOriginal = async (uri, data, options) => ({ uri, ip: options.ip })
  const qrOriginal = async () => { throw new Error('the upstream one') }
  const fakeRequire = (path) => {
    if (cache[path] === undefined) {
      cache[path] = { exports: path.endsWith('login_qr_check.js') ? qrOriginal : path.endsWith('option.js') ? (() => ({})) : requestOriginal }
    }
    return cache[path].exports
  }
  fakeRequire.cache = cache
  const paths = { requestPath: '/pkg/util/request.js', qrCheckPath: '/pkg/module/login_qr_check.js', optionPath: '/pkg/util/option.js' }
  assert.deepEqual(installUpstreamPolicies(fakeRequire, paths), { clientIpPolicy: true, loginQrCheck: true })
  const patchedRequest = cache[paths.requestPath].exports
  assert.equal((await patchedRequest('/x', {}, { ip: '127.0.0.1' })).ip, '', 'the installed request carries the IP policy')
  assert.notEqual(cache[paths.qrCheckPath].exports, qrOriginal, 'the QR poll module is replaced')
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
  const { search, getLyric, getDownloadURL, getChorus, createQRLogin, checkQRLogin, findArtistId, getArtistSongs } = await import('../../src/host/providers/netease.js')
  const providers = await import('../../src/host/providers/index.js')

  const service = await ensureNeteaseService()
  assert.ok(service.port > 0, 'the local service must report a bound port')
  assert.equal(service.policies?.clientIpPolicy, true, 'the upstream request export carries the client-IP policy')
  assert.equal(service.policies?.loginQrCheck, true, 'the QR poll module is the fixed one')

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
  const { parseYrc } = await import('../../src/host/providers/yrc.js')
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

  // Artist songs: Folia's path. The id is resolved (or comes from the song) and the
  // artist's songs are one request, not up to ten pages of a name search.
  const artistId = await findArtistId('周杰伦', '')
  assert.match(artistId, /^[0-9]+$/, 'the artist name resolves to an id')
  assert.equal(await findArtistId('周杰伦', ''), artistId, 'the resolution is cached')
  const artistPage = await getArtistSongs(artistId, '', { limit: 50 })
  assert.ok(artistPage.songs.length > 0, 'the artist has songs')
  assert.ok(artistPage.total >= artistPage.songs.length)
  assert.ok(artistPage.songs[0].title !== '' && artistPage.songs[0].id !== '')
  const viaId = await providers.artistSongs('netease', '周杰伦', '', {}, artistId)
  assert.ok(viaId.length > 0, 'the provider answers with the id the song carries')
  assert.ok(viaId.every((song) => song.id && song.title !== ''), 'every row is a full song')
  // Folia's artist page opens with ten songs; the rest pages in behind it.
  const head = await providers.artistSongs('netease', '周杰伦', '', {}, artistId, { limit: 10 })
  assert.equal(head.length, 10, 'the first page is ten songs')
  const next = await providers.artistSongs('netease', '周杰伦', '', {}, artistId, { limit: 10, offset: 10 })
  assert.equal(next.length, 10, 'the second page is ten songs')
  assert.notEqual(next[0].id, head[0].id, 'paging moves the window')

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

