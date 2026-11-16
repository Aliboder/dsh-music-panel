/**
 * KuGou upstream bridge tests.
 *
 * Pure: the cookie vocabulary the package reads, and the login mapping through a stubbed
 * transport. Live: the real package in its worker (DSH_MUSIC_UPSTREAM=1).
 */

import assert from 'node:assert/strict'
import * as KG from '../../src/host/providers/kugou.js'
import { kugouCookies, kugouSessionPatch } from '../../src/host/providers/kugou-cookie.js'
import {
  resetUpstreamOverride,
  setUpstreamOverride,
  stopAllKugouServices,
} from '../../src/host/services/kugou-api.js'

// ── the cookie vocabulary ───────────────────────────────────────────────────

{
  const cookies = kugouCookies({ guid: 'g1', mid: '42', dfid: 'D1', userid: 7, token: 't' }, 'lite')
  assert.equal(cookies.KUGOU_API_PLATFORM, 'lite')
  assert.equal(cookies.KUGOU_API_GUID, 'g1')
  assert.equal(cookies.KUGOU_API_MID, '42', 'the package builds every request header from this mid')
  assert.equal(cookies.dfid, 'D1')
  assert.equal(cookies.userid, '7')
  assert.equal(cookies.token, 't')
  assert.ok(cookies.KUGOU_API_DEV && cookies.KUGOU_API_MAC && cookies.KUGOU_API_WEBGL, 'device fingerprints are never empty')
  // A session that predates the fingerprints still gets stable values for its guid.
  const older = kugouCookies({ guid: 'g1', mid: '42' }, 'standard')
  const again = kugouCookies({ guid: 'g1', mid: '42' }, 'standard')
  assert.equal(older.KUGOU_API_DEV, again.KUGOU_API_DEV)
  assert.equal(older.KUGOU_API_PLATFORM, 'standard')
  assert.equal(older.dfid, '-', 'no dfid is the package\'s own placeholder, not an empty header')
  assert.equal(older.token, undefined, 'no token means no token')
}

{
  // dfid from a registration; the token pair only as a whole, on a confirmed sign-in.
  assert.deepEqual(kugouSessionPatch(['dfid=D1', 'junk']), { dfid: 'D1' })
  assert.deepEqual(kugouSessionPatch([], { data: { dfid: 'D2' } }), { dfid: 'D2' })
  assert.deepEqual(
    kugouSessionPatch(['token=t1', 'userid=9'], { data: { status: 4, token: 't1', userid: '9' } }, { confirmedSignIn: true }),
    { token: 't1', userid: '9' },
  )
  assert.deepEqual(kugouSessionPatch([], { data: { token: 't1' } }, { confirmedSignIn: true }), {}, 'half a pair is not taken')
  assert.deepEqual(kugouSessionPatch([], { data: { token: 't1', userid: '9' } }), {}, 'a pair without a confirmation is not taken')
}

// ── title cleanup ───────────────────────────────────────────────────────────

{
  const song = KG.normalizeSong({ hash: 'h', songname: 'A、B - Title', SingerName: 'A、B' })
  assert.equal(song.title, 'Title')
  assert.deepEqual(song.artists, ['A', 'B'])
  const unrelated = KG.normalizeSong({ hash: 'h', songname: 'C - Title', SingerName: 'A、B' })
  assert.equal(unrelated.title, 'C - Title', 'an unrelated prefix is part of the title')
}

// ── login mapping ───────────────────────────────────────────────────────────

{
  const seen = []
  setUpstreamOverride(async (operation, params) => {
    seen.push({ operation, params })
    if (operation === 'login_qr_key') {
      return { status: 200, body: { data: { qrcode: 'K1', qrcode_img: 'data:image/png;base64,xx' } }, cookie: [] }
    }
    if (operation === 'login_qr_check') {
      return { status: 200, body: { data: { status: 1 } }, cookie: [] }
    }
    if (operation === 'register_dev') {
      return { status: 200, body: { data: { dfid: 'DFID' } }, cookie: ['dfid=DFID'] }
    }
    throw new Error('unexpected operation: ' + operation)
  })
  try {
    const qr = await KG.createQRLogin({ guid: 'g', mid: '9' }, 'lite')
    assert.equal(qr.key, 'K1')
    assert.equal(qr.imageDataUrl.startsWith('data:image'), true)
    assert.equal(seen[0].operation, 'login_qr_key')
    assert.equal(seen[0].params.cookie.KUGOU_API_PLATFORM, 'lite')
    assert.equal(seen[0].params.cookie.KUGOU_API_MID, '9')

    const waiting = await KG.checkQRLogin('K1', { guid: 'g', mid: '9', dfid: 'DFID' }, 'lite')
    assert.equal(waiting.status, 'waiting')
    assert.equal(waiting.device.dfid, 'DFID')

    const reg = await KG.registerDevice({ guid: 'g', mid: '9' }, 'standard')
    assert.equal(reg.dfid, 'DFID')
    assert.equal(seen.at(-1).params.cookie.KUGOU_API_PLATFORM, 'standard')
  } finally {
    resetUpstreamOverride()
  }
}

{
  // A confirmed sign-in (status 4) hands back the token pair the login store saves.
  setUpstreamOverride(async () => ({
    status: 200,
    body: { data: { status: 4, token: 'T', userid: '7', vip_type: '2' } },
    cookie: ['token=T', 'userid=7'],
  }))
  try {
    const done = await KG.checkQRLogin('K1', { guid: 'g', mid: '9' }, 'standard')
    assert.equal(done.status, 'success')
    assert.deepEqual(done.tokenInfo, { token: 'T', userid: '7', vip_type: '2', vip_token: '' })
  } finally {
    resetUpstreamOverride()
  }
}

// ── search mapping ──────────────────────────────────────────────────────────

{
  setUpstreamOverride(async (operation, params) => {
    assert.equal(operation, 'search')
    assert.equal(params.keywords, '晴天')
    assert.equal(params.cookie.KUGOU_API_PLATFORM, 'lite')
    return {
      status: 200,
      body: {
        status: 1,
        data: {
          total: 1,
          lists: [{
            FileHash: 'ABC',
            FileName: '周杰伦 - 晴天',
            OriSongName: '晴天',
            SingerName: '周杰伦',
            AlbumName: '叶惠美',
            Duration: 269,
            HQ: { Hash: 'HQ1' },
            SQ: { Hash: 'SQ1' },
            AlbumImage: 'https://img.example/1.jpg',
          }],
        },
      },
      cookie: [],
    }
  })
  try {
    const found = await KG.search('晴天', '', 1, 'lite')
    assert.equal(found.total, 1)
    const song = found.results[0]
    assert.equal(song.title, '晴天')
    assert.deepEqual(song.artists, ['周杰伦'])
    assert.equal(song.album, '叶惠美')
    assert.equal(song.interval, 269)
    assert.equal(song.hqHash, 'hq1', 'the Android shape\'s HQ.Hash becomes the hq rung')
    assert.equal(song.sqHash, 'sq1')
  } finally {
    resetUpstreamOverride()
  }
}

// ── lyrics ─────────────────────────────────────────────────────────────────

{
  setUpstreamOverride(async (operation, params) => {
    if (operation === 'search_lyric') {
      assert.equal(params.hash, 'H1')
      return { status: 200, body: { status: 200, candidates: [{ id: 'C1', accesskey: 'A1', duration: 269000, song: '晴天' }] }, cookie: [] }
    }
    if (operation === 'lyric') {
      assert.equal(params.id, 'C1')
      assert.equal(params.fmt, 'lrc')
      return { status: 200, body: { status: 200, content: Buffer.from('[00:00.000]晴天', 'utf8').toString('base64') }, cookie: [] }
    }
    throw new Error('unexpected operation: ' + operation)
  })
  try {
    const lrc = await KG.getLyric({ hash: 'H1', title: '晴天' }, 'standard')
    assert.ok(lrc.lyric.includes('晴天'), 'the downloaded lrc is decoded from base64')
  } finally {
    resetUpstreamOverride()
  }
}

// ── live (opt-in) ───────────────────────────────────────────────────────────

if (process.env.DSH_MUSIC_UPSTREAM === '1') {
  for (const platform of ['standard', 'lite']) {
    const qr = await KG.createQRLogin({}, platform)
    assert.ok(qr.key !== '', 'the package answers a QR key (' + platform + ')')
    assert.ok(qr.imageDataUrl === '' || qr.imageDataUrl.startsWith('data:image'), 'the QR picture is a data URL')
    const polled = await KG.checkQRLogin(qr.key, qr.extra.device, platform)
    assert.equal(polled.status, 'waiting', 'an unscanned code polls as waiting (' + platform + ')')
    const search = await KG.search('晴天', '', 1, platform)
    assert.ok(search.total > 0, 'anonymous search works through the bridge')
    assert.ok(search.results[0].title !== '', 'the Android result shape is mapped to the plugin\'s song')
    const lrc = await KG.getLyric({ hash: search.results[0].id, title: '晴天' }, platform)
    assert.ok(lrc.lyric.length > 0, 'lyrics are found and downloaded through the bridge')
    const word = await KG.getWordLines({ hash: search.results[0].id, title: '晴天' }, platform)
    assert.ok(word !== null && word.lines.some((line) => line.words.length > 0), 'the KRC word timeline is delivered')
  }
  await stopAllKugouServices()
  console.log('kugou-upstream.test.mjs ok (live)')
} else {
  await stopAllKugouServices()
  console.log('kugou-upstream.test.mjs ok (pure only)')
}

