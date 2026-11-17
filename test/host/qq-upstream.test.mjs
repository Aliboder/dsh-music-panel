/**
 * QQ upstream transport tests.
 *
 * Pure mapping always runs; the live block is gated behind DSH_MUSIC_UPSTREAM=1.
 */

import assert from 'node:assert/strict'
import { toLegacyResult } from '../../src/host/providers/qq.js'
import { assertOk, ensureQqService, resetUpstreamOverride, setUpstreamOverride, stopQqService } from '../../src/host/services/qq-api.js'
import * as QQ from '../../src/host/providers/qq.js'
import { parseQrc } from '../../src/host/providers/qrc.js'
import { loginStatus, providerProfile } from '../../src/host/providers/index.js'

const item = toLegacyResult({
  mid: '0039MnYb0qxYhV',
  id: 97773,
  name: '晴天 &amp; 雨',
  singer: [{ name: '周杰伦' }, { name: '某人' }],
  album: { mid: '000MkMni19ClKG', name: '叶惠美' },
  interval: 269,
  type: 0,
})
assert.equal(item.id, '0039MnYb0qxYhV')
assert.equal(item.songmid, '0039MnYb0qxYhV')
assert.equal(item.title, '晴天 & 雨', 'HTML entities are decoded')
assert.deepEqual(item.artists, ['周杰伦', '某人'])
assert.equal(item.album, '叶惠美')
assert.equal(item.albummid, '000MkMni19ClKG')
assert.equal(item.interval, 269)
assert.equal(item.source, 'qq')

assert.equal(toLegacyResult({ name: 'no mid' }), null)
assert.equal(toLegacyResult(null), null)
assert.equal(toLegacyResult({ mid: '', name: 'x' }), null)

// QQ's own payload marks a VIP-only song with `pay.pay_play` (snake_case); the badge
// reads the row's `payplay`, so the mapping has to resolve both spellings.
assert.equal(
  toLegacyResult({ mid: 'vip-1', name: 'vip', singer: [], pay: { pay_play: 1 } }).payplay,
  1,
)
assert.equal(
  toLegacyResult({ mid: 'free-1', name: 'free', pay: { pay_play: 0, payplay: 0 } }).payplay,
  0,
)
assert.equal(
  toLegacyResult({ mid: 'camel-1', name: 'camel', pay: { payplay: 1 } }).payplay,
  1,
  'the older camelCase shape still counts',
)

// The row the client receives is shaped by the provider layer: the badge follows
// `qualityHint`, which was empty for QQ before this fix.
{
  const { search: searchProvider } = await import('../../src/host/providers/index.js')
  setUpstreamOverride(async (route) => {
    if (route !== '/search') throw new Error('unexpected route: ' + route)
    return {
      items: [
        { mid: 'vip-2', name: '晴天', singer: [{ name: '周杰伦' }], album: { mid: 'm', name: 'a' }, interval: 269, pay: { pay_play: 1 } },
        { mid: 'free-2', name: '免费歌', singer: [{ name: '某人' }], album: { mid: 'm2', name: 'b' }, interval: 200, pay: { pay_play: 0 } },
      ],
      total: 2,
      page: 1,
    }
  })
  try {
    const results = await searchProvider('qq', '晴天')
    assert.equal(results[0].qualityHint, 'VIP', 'a pay_play song gets the VIP badge')
    assert.equal(results[1].qualityHint, '', 'a free song does not')
  } finally {
    resetUpstreamOverride()
  }
}


// ── word-level QRC ──────────────────────────────────────────────────────────
//
// The provider hands the client a word timeline only if the parser keeps one.
// QRC plaintext: [startMs,durMs]晴(0,800)天(800,900)

{
  const parsed = parseQrc('[0,5000]晴(0,800)天(800,900)\n[5000,4000]故(0,500)事(500,700)')
  assert.equal(parsed.length, 2)
  assert.equal(parsed[0].text, '晴天')
  assert.deepEqual(parsed[0].words.map((word) => [word.text, word.startMs, word.durMs]), [['晴', 0, 800], ['天', 800, 900]])
  assert.equal(parsed[1].words.length, 2, 'a second line keeps its own timeline')
}

// ── login hints ─────────────────────────────────────────────────────────────
//
// The package recognises some refusals (loginHints): device limit, rate limit, wrong
// scan app, restricted account. The plugin carries the hint and maps it to Folia's
// login case so the window can name the reason.

{
  setUpstreamOverride(async (route) => {
    if (route !== '/login/qr/check') throw new Error('unexpected route: ' + route)
    return {
      code: 800,
      message: 'Too many login attempts.',
      failureHint: { key: 'login.rate-limited', message: 'Too many login attempts.' },
      retryAfterMs: 30_000,
      failureStage: 'qr-poll',
    }
  })
  try {
    const polled = await QQ.checkQRLogin('k1')
    assert.equal(polled.status, 'expired', 'the package\'s 800 is the QR having expired')
    assert.equal(polled.extra.hint, 'login.rate-limited')
    assert.equal(polled.extra.retryAfterMs, 30000)

    const status = await loginStatus('qq', 'k1')
    assert.equal(status.case, 'retry-later', 'the hint becomes a named case')
    assert.equal(status.retryAfterMs, 30000, 'the wait the platform asked for is carried')

    setUpstreamOverride(async () => ({ code: 9999, message: 'nope', failureHint: { key: 'login.device-limit' } }))
    const refused = await loginStatus('qq', 'k2')
    assert.equal(refused.status, 'failed', 'an unknown code is a plain failure')
    assert.equal(refused.case, 'device-limit')
  } finally {
    // The live block below (and every later caller) needs the real transport back.
    resetUpstreamOverride()
  }
}

// ── QR poll status codes ────────────────────────────────────────────────────
//
// `/login/qr/check` answers 800/801/802/803 for expired/waiting/scanned/signed-in.
// `skipCodeCheck` keeps that scan state; without it the first poll throws
// "Waiting for QR scan" and the login window calls it a refused sign-in.

assert.equal(assertOk({ code: 200, items: [] }, '/search').items.length, 0)
assert.throws(() => assertOk({ code: 801, message: 'Waiting for QR scan' }, '/login/qr/check'), /Waiting for QR scan/)
assert.equal(assertOk({ code: 801, message: 'Waiting for QR scan' }, '/login/qr/check', { skipCodeCheck: true }).code, 801)
assert.equal(assertOk({ code: 803, cookie: 'qqmusic_session=x' }, '/login/qr/check', { skipCodeCheck: true }).cookie, 'qqmusic_session=x')

// A QQ session may carry no cookie uin (wx login stores only qqmusic_session); the
// stored userid still names the account, so the profile keeps its nickname and qlogo avatar.
{
  const profile = await providerProfile('qq', '', { userid: '12345', nickname: '' })
  assert.equal(profile.accountId, '12345')
  assert.equal(profile.avatarUrl, 'https://q.qlogo.cn/headimg_dl?dst_uin=12345&spec=100')
  assert.equal(profile.nickname, 'QQ 12345')
}

if (process.env.DSH_MUSIC_UPSTREAM === '1') {
  const { search, getLyric, createQRLogin, checkQRLogin } = await import('../../src/host/providers/qq.js')

  const service = await ensureQqService()
  assert.ok(service.port > 0, 'the local QQ service must report a bound port')

  const found = await search('晴天', '', 1)
  assert.ok(found.results.length > 0, 'search must return at least one song')
  assert.ok(found.total > 0)
  const first = found.results[0]
  assert.ok(first.songmid !== '')
  assert.ok(first.title !== '')

  const lyric = await getLyric(first.songmid, '')
  assert.ok(lyric.lyric.includes('['), 'lyric must be LRC text')

  const qr = await createQRLogin()
  assert.ok(qr.key !== '')
  assert.ok(qr.expiresAt > Date.now())
  assert.ok(qr.imageDataUrl === '' || qr.imageDataUrl.startsWith('data:'), 'QR image is a data URL when present')

  // The first poll after the code appears must be a scan state, not an error.
  const polled = await checkQRLogin(qr.key)
  assert.equal(polled.status, 'waiting', `an unscanned code polls as waiting, got ${polled.status}`)

  await stopQqService()
  console.log('qq-upstream.test.mjs ok (live)')
} else {
  await stopQqService()
  console.log('qq-upstream.test.mjs ok (pure only)')
}

