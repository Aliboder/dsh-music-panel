/**
 * KuGou upstream bridge tests.
 *
 * Pure: the cookie vocabulary the package reads, and the login mapping through a stubbed
 * transport. Live: the real package in its worker (DSH_MUSIC_UPSTREAM=1).
 */

import assert from 'node:assert/strict'
import * as KG from '../../src/host/providers/kugou.js'
import * as KGL from '../../src/host/providers/kugou-lite.js'
import { nextLowerOnlineQuality } from '../../src/host/http/routes/online.js'
import { kugouCookies, kugouSessionPatch } from '../../src/host/providers/kugou-cookie.js'
import {
  resetUpstreamOverride,
  setUpstreamOverride,
  stopAllKugouServices,
} from '../../src/host/services/kugou-api.js'

// Folia's fallback order: only a level the account does not serve is skipped.
assert.equal(nextLowerOnlineQuality('hires'), 'lossless')
assert.equal(nextLowerOnlineQuality('lossless'), 'high')
assert.equal(nextLowerOnlineQuality('high'), 'standard')
assert.equal(nextLowerOnlineQuality('standard'), null)

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
  const nestedAlbum = KG.normalizeSong({ hash: 'h', songname: 'Title', SingerName: 'A', album_info: { album_name: 'Nested Album', album_id: 77 } })
  assert.equal(nestedAlbum.album, 'Nested Album', 'nested album objects do not become [object Object]')
  assert.equal(nestedAlbum.albumId, 77, 'a nested album id is still album identity')
  const precise = KG.normalizeSong({ hash: 'h', songname: 'Title', album_audio_id: 44, album_id: 55, mixsongid: 66 })
  assert.equal(precise.albumAudioId, 44, 'only album_audio_id becomes albumAudioId')
  assert.equal(precise.mixSongId, 66, 'mixsongid stays a song id')
  const guessed = KG.normalizeSong({ hash: 'h', songname: 'Title', Audioid: 42, audio_id: 43 })
  assert.equal(guessed.albumAudioId, 0, 'Audioid/audio_id are not album audio ids')
  const nestedPackage = KG.normalizePackageSong({
    base: { audio_name: 'Nested', album_id: 77 },
    audio_info: { hash: 'ABC' },
    album_info: { album_audio_id: 88 },
  })
  assert.equal(nestedPackage.albumAudioId, 88, 'the nested package keeps a precise album audio id')
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

// ── playback identity ──────────────────────────────────────────────────────

{
  const seen = []
  setUpstreamOverride(async (operation, params) => {
    assert.equal(operation, 'song_url')
    seen.push(params)
    const metadata = String(params.album_id) !== '0' || String(params.album_audio_id) !== '0'
    return {
      status: 200,
      body: metadata ? { data: {} } : { data: { play_url: 'https://cdn.example/a.mp3', volume: -7.5, volume_peak: -1 } },
      cookie: [],
    }
  })
  try {
    const standard = await KG.getDownloadURL({ hash: 'HASH1', albumId: 9, albumAudioId: 8 }, { token: 'T', userid: '1', mid: '123' }, ['128'])
    assert.equal(standard.url, 'https://cdn.example/a.mp3')
    assert.equal(String(seen[0].album_id), '9', 'standard playback asks with precise metadata first')
    assert.equal(String(seen[0].album_audio_id), '8', 'standard playback sends the precise album audio id')
    assert.equal(String(seen[1].album_id), '0', 'standard playback retries by hash alone')
    assert.equal(String(seen[1].album_audio_id), '0', 'standard playback retries without album ids')
    const lite = await KGL.resolveStream({ hash: 'HASH2', albumId: 9, albumAudioId: 8 }, { token: 'T', userid: '1', mid: '123' }, ['128'])
    assert.equal(lite.url, 'https://cdn.example/a.mp3')
    assert.equal(standard.replayGain.trackGain, -7.5, 'KuGou volume is kept as trackGain')
    assert.ok(Math.abs(standard.replayGain.trackPeak - Math.pow(10, -1 / 20)) < 1e-9, 'KuGou volume_peak becomes linear peak')
    assert.equal(String(seen[2].album_id), '9', 'concept playback asks with precise metadata first')
    assert.equal(String(seen[3].album_id), '0', 'concept playback retries by hash alone')
  } finally {
    resetUpstreamOverride()
  }
}

// Folia's requested-quality ladder and canonical hash: high is 320, not flac or
// the string "high"; every quality asks the primary hash, never hqHash/sqHash.
{
  const seen = []
  setUpstreamOverride(async (operation, params) => {
    assert.equal(operation, 'song_url')
    seen.push(params)
    return { status: 200, body: { data: { play_url: 'https://cdn.example/high.mp3' } }, cookie: [] }
  })
  try {
    const high = await KG.getDownloadURL(
      { hash: 'HASH1', hqHash: 'HQ', sqHash: 'SQ', albumId: 9, albumAudioId: 8 },
      { token: 'T', userid: '1', mid: '123' },
      ['320', '128'],
    )
    assert.equal(high.url, 'https://cdn.example/high.mp3')
    assert.equal(high.quality, '高音质', 'high maps to the 320 label')
    assert.equal(seen[0].quality, '320', 'high asks KuGou for 320, matching Folia')
    assert.equal(seen[0].hash, 'hash1', 'quality does not switch to hqHash/sqHash')
  } finally {
    resetUpstreamOverride()
  }
}

// A partial album identity is not precise. Album_id without album_audio_id must
// not be sent: it can resolve another file, whose CDN URL then answers 404.
{
  const seen = []
  setUpstreamOverride(async (operation, params) => {
    assert.equal(operation, 'song_url')
    seen.push(params)
    return { status: 200, body: { data: { play_url: 'https://cdn.example/hash-only.mp3' } }, cookie: [] }
  })
  try {
    await KG.getDownloadURL({ hash: 'HASH1', albumId: 9, albumAudioId: 0 }, { token: 'T', userid: '1', mid: '123' }, ['128'])
    assert.equal(String(seen[0].album_id), '0', 'standard playback starts hash-only with a partial identity')
    assert.equal(String(seen[0].album_audio_id), '0', 'standard playback never sends half an identity')
    await KGL.resolveStream({ hash: 'HASH2', albumId: 9, albumAudioId: 0 }, { token: 'T', userid: '1', mid: '123' }, ['128'])
    assert.equal(String(seen[1].album_id), '0', 'concept playback starts hash-only with a partial identity')
    assert.equal(String(seen[1].album_audio_id), '0', 'concept playback never sends half an identity')
  } finally {
    resetUpstreamOverride()
  }
}

// ── VIP badge ──────────────────────────────────────────────────────────────

{
  setUpstreamOverride(async (operation) => {
    assert.equal(operation, 'search')
    return {
      status: 200,
      body: {
        status: 1,
        data: {
          total: 3,
          lists: [
            { FileHash: 'A', FileName: 'a - one', privilege: 10 },
            { FileHash: 'B', FileName: 'b - two', pay_type: 3 },
            { FileHash: 'C', FileName: 'c - free', privilege: 0, pay_type: 0 },
          ],
        },
      },
      cookie: [],
    }
  })
  try {
    const { search: searchProvider } = await import('../../src/host/providers/index.js')
    const results = await searchProvider('kugouLite', 'x')
    assert.equal(results[0].qualityHint, 'VIP', 'privilege marks a KuGou Lite song as VIP')
    assert.equal(results[1].qualityHint, 'VIP', 'pay_type also marks a KuGou Lite song as VIP')
    assert.equal(results[2].qualityHint, '', 'a free song has no VIP badge')
  } finally {
    resetUpstreamOverride()
  }
}

// ── recommendations / cloud ─────────────────────────────────────────────────

{
  const calls = []
  setUpstreamOverride(async (operation, params) => {
    calls.push({ operation, params })
    if (operation === 'everyday_recommend') {
      return { status: 200, body: { status: 1, data: { songs: [{ FileHash: 'D1', songname: 'Daily', Singers: [{ name: 'A' }], timelen: 100 }] } }, cookie: [] }
    }
    if (operation === 'user_cloud') {
      // The real drive answers `data.list`, and each row is a flat uploaded file:
      // `name` is the filename, the hash is `hash`, identity is album_audio_id.
      return {
        status: 200,
        body: {
          status: 1,
          data: {
            type_size: { type_1: 1024 },
            list: [{
              hash: 'C1',
              name: 'A - Cloud.mp3',
              authors: [{ author_id: 5, author_name: 'A' }],
              timelen: 148000,
              fileid: 77,
              album_info: { album_id: 9, album_name: 'Album' },
            }],
          },
        },
        cookie: [],
      }
    }
    throw new Error('unexpected operation: ' + operation)
  })
  try {
    const daily = await KG.dailySongs({}, 'lite')
    assert.equal(daily[0].title, 'Daily')

    // Signed out: no request goes out, and the answer is an empty drive, not an error.
    assert.deepEqual(await KG.cloudSongs({}, 1, 100, 'lite'), [])
    assert.equal(calls.filter((call) => call.operation === 'user_cloud').length, 0)

    // Signed in: the account pair and the device cookie travel with the call. Without
    // them the package signs an empty token and KuGou answers 20010 (param error),
    // which used to read as an empty drive.
    const session = { userid: 890420605, token: 'tok', mid: '42', dfid: 'D1', guid: 'g1' }
    const cloud = await KG.cloudSongs(session, 1, 100, 'lite')
    const sent = calls.filter((call) => call.operation === 'user_cloud').at(-1).params
    assert.equal(sent.userid, '890420605')
    assert.equal(sent.token, 'tok', 'the package signs the body with the account pair')
    assert.equal(sent.cookie.KUGOU_API_MID, '42', 'the device headers come from the cookie')
    assert.equal(sent.cookie.token, 'tok')
    assert.equal(cloud[0].title, 'Cloud', 'a filename loses its extension and artist prefix')
    assert.deepEqual(cloud[0].artists, ['A'])
    assert.equal(cloud[0].album, 'Album')
    assert.equal(cloud[0].id, 'c1', 'the row hash is the id')
    assert.equal(cloud[0].interval, 148)
    assert.equal(cloud[0].variant, 'cloud')
    assert.equal(cloud[0].fileId, 77)
  } finally {
    resetUpstreamOverride()
  }
}

// A refused cloud request is reported, not shown as an empty drive.
{
  setUpstreamOverride(async (operation) => {
    assert.equal(operation, 'user_cloud')
    return { status: 200, body: { status: 0, error_code: 20010, data: '' }, cookie: [] }
  })
  try {
    await assert.rejects(
      () => KG.cloudSongs({ userid: 1, token: 'expired', mid: '42' }, 1, 100, 'lite'),
      /20010/,
    )
  } finally {
    resetUpstreamOverride()
  }
}

// ── album search ───────────────────────────────────────────────────────────

{
  setUpstreamOverride(async (operation, params) => {
    assert.equal(operation, 'search')
    assert.equal(params.type, 'album')
    assert.equal(params.keywords, '叶惠美')
    return {
      status: 200,
      body: {
        status: 1,
        data: {
          total: 1,
          lists: [{ albumid: 123, albumname: '叶惠美', singers: '周杰伦', img: 'https://img.example/a.jpg', songcount: 11 }],
        },
      },
      cookie: [],
    }
  })
  try {
    const found = await KG.searchAlbums('叶惠美', '', 1, 'lite')
    assert.equal(found.total, 1)
    assert.equal(found.results[0].id, '123')
    assert.equal(found.results[0].name, '叶惠美')
    assert.equal(found.results[0].artist, '周杰伦')
    assert.equal(found.results[0].trackCount, 11)
  } finally {
    resetUpstreamOverride()
  }
}

// ── playlist search ─────────────────────────────────────────────────────────

{
  setUpstreamOverride(async (operation, params) => {
    assert.equal(operation, 'search')
    assert.equal(params.type, 'special')
    assert.equal(params.keywords, '周杰伦')
    return {
      status: 200,
      body: {
        status: 1,
        data: {
          total: 1,
          lists: [{ specialid: 456, specialname: '周杰伦精选', nickname: '歌单作者', img: 'https://img.example/p.jpg', songcount: 30, listennum: 9000 }],
        },
      },
      cookie: [],
    }
  })
  try {
    const found = await KG.searchPlaylists('周杰伦', '', 1, 'lite')
    assert.equal(found.total, 1)
    assert.equal(found.results[0].id, '456')
    assert.equal(found.results[0].name, '周杰伦精选')
    assert.equal(found.results[0].creator, '歌单作者')
    assert.equal(found.results[0].trackCount, 30)
    assert.equal(found.results[0].playCount, 9000)
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

