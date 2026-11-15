/**
 * QQ upstream transport tests.
 *
 * Pure mapping always runs; the live block is gated behind DSH_MUSIC_UPSTREAM=1.
 */

import assert from 'node:assert/strict'
import { toLegacyResult } from '../lib/providers/qq.js'
import { assertOk, ensureQqService, stopQqService } from '../lib/services/qq-api.js'

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

// ── QR poll status codes ────────────────────────────────────────────────────
//
// `/login/qr/check` answers 800/801/802/803 for expired/waiting/scanned/signed-in.
// `skipCodeCheck` keeps that scan state; without it the first poll throws
// "Waiting for QR scan" and the login window calls it a refused sign-in.

assert.equal(assertOk({ code: 200, items: [] }, '/search').items.length, 0)
assert.throws(() => assertOk({ code: 801, message: 'Waiting for QR scan' }, '/login/qr/check'), /Waiting for QR scan/)
assert.equal(assertOk({ code: 801, message: 'Waiting for QR scan' }, '/login/qr/check', { skipCodeCheck: true }).code, 801)
assert.equal(assertOk({ code: 803, cookie: 'qqmusic_session=x' }, '/login/qr/check', { skipCodeCheck: true }).cookie, 'qqmusic_session=x')

if (process.env.DSH_MUSIC_UPSTREAM === '1') {
  const { search, getLyric, createQRLogin, checkQRLogin } = await import('../lib/providers/qq.js')

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
