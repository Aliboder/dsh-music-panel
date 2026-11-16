/**
 * Rich-field alignment: the provider layer must not drop entity fields, and the
 * word-level lyric timeline must survive parsing.
 */

import assert from 'node:assert/strict'
import { normalizeSong } from '../../src/host/providers/netease-legacy.js'
import { parseYrc } from '../../src/host/providers/yrc.js'

const song = normalizeSong({
  id: 42,
  name: '<em>晴天</em>',
  ar: [{ id: 6452, name: '周杰伦', alias: ['Jay'], tns: ['Jay Chou'] }],
  al: { id: 18915, name: '叶惠美', picUrl: 'https://p/1.jpg', pic_str: 'pic1', tns: ['Ye Hui Mei'] },
  dt: 269000,
  fee: 8,
  alia: ['Sunny Day'],
  tns: ['Sunny Day (EN)'],
  publishTime: 1057776000000,
  pop: 100,
  t: 0,
  mv: 123,
  ftype: 0,
  copyright: 1,
  resourceState: false,
  noCopyrightRcmd: { typeDesc: '无版权' },
  privilege: { st: 0, pl: 320000, dl: 0, maxbr: 999000, plLevel: 'exhigh', maxBrLevel: 'jymaster', dlLevel: 'none' },
})

// Legacy keys stay untouched (the client depends on them).
assert.equal(song.id, '42')
assert.equal(song.title, '晴天')
assert.deepEqual(song.artists, ['周杰伦'])
assert.equal(song.album, '叶惠美')
assert.equal(song.interval, 269)

// New entity fields.
assert.equal(song.durationMs, 269000)
assert.deepEqual(song.artistsDetail, [{ id: '6452', name: '周杰伦', aliases: ['Jay'], translatedNames: ['Jay Chou'] }])
assert.equal(song.albumDetail.id, '18915')
assert.equal(song.albumDetail.coverUrl, 'https://p/1.jpg')
assert.deepEqual(song.albumDetail.coverId, 'pic1')
assert.deepEqual(song.aliases, ['Sunny Day'])
assert.deepEqual(song.translatedNames, ['Sunny Day (EN)'])
assert.equal(song.publishTime, 1057776000000)
assert.equal(song.popularity, 100)
assert.equal(song.mvId, '123')
assert.equal(song.isVideo, true, 'a track with an MV id is flagged as video')
assert.equal(song.copyright, 1)
assert.equal(song.resourceState, false)
assert.deepEqual(song.noCopyright, { typeDesc: '无版权' })
assert.equal(song.privilegeDetail.plLevel, 'exhigh')
assert.deepEqual(song.availableQualities, ['exhigh', 'jymaster'])

// A bare payload must not throw and must fill safe defaults.
const bare = normalizeSong({ id: 7 })
assert.deepEqual(bare.artistsDetail, [])
assert.deepEqual(bare.aliases, [])
assert.equal(bare.publishTime, 0)
assert.equal(bare.isVideo, false)
assert.equal(bare.resourceState, null)
assert.deepEqual(bare.availableQualities, [])

// ── word-level lyrics ───────────────────────────────────────────────────────

const yrc = [
  '[ti:晴天]',
  '[1000,1500](1000,500,0)故(1500,1000,0)事',
  '[4000,2000](4000,2000,0)从出生那年就飘着',
].join('\n')

const parsed = parseYrc(yrc)
assert.ok(parsed !== null)
assert.equal(parsed.lines.length, 2)
assert.equal(parsed.wordLevel, true)
assert.equal(parsed.lines[0].text, '故事')
assert.equal(parsed.lines[0].words.length, 2)
assert.equal(parsed.lines[0].words[0].text, '故')
assert.equal(parsed.lines[0].words[0].t, 1, 'word timing is converted to seconds')
assert.equal(parsed.lines[0].words[0].end, 1.5)
// A line without word tags still parses, just without a word timeline.
assert.equal(parsed.lines[1].words.length, 1)

assert.equal(parseYrc(''), null)
assert.equal(parseYrc('plain text only'), null)

console.log('rich-fields.test.mjs ok')

// ── QQ and KuGou speak the same entity contract ─────────────────────────────

{
  const { toLegacyResult } = await import('../../src/host/providers/qq.js')
  const qq = toLegacyResult({
    mid: '0039MnYb0qxYhV',
    title: '晴天',
    subtitle: 'Sunny Day',
    singer: [{ mid: '0025NhlN2yWrP4', name: '周杰伦' }],
    album: { id: 8220, mid: '000MkMni19ClKG', name: '叶惠美', subtitle: '', time_public: '2003-07-31' },
    interval: 269,
    pay: { payplay: 1 },
    file: { size_128mp3: 4300000, size_320mp3: 10700000, size_flac: 0, size_hires: 0 },
    mv: { vid: 'abc123' },
    bpm: 69,
    type: 0,
  })
  assert.equal(qq.interval, 269)
  assert.equal(qq.durationMs, 269000)
  assert.deepEqual(qq.artistsDetail, [{ id: '0025NhlN2yWrP4', name: '周杰伦' }])
  assert.equal(qq.albumDetail.id, '8220')
  assert.equal(qq.albumDetail.mid, '000MkMni19ClKG')
  assert.ok(qq.albumDetail.coverUrl.includes('000MkMni19ClKG'))
  assert.deepEqual(qq.aliases, ['Sunny Day'])
  assert.equal(qq.mvId, 'abc123')
  assert.equal(qq.isVideo, true)
  assert.equal(qq.popularity, 69)
  assert.deepEqual(qq.availableQualities, ['standard', 'high'])
  assert.equal(qq.privilegeDetail.payplay, 1)

  const { normalizeSong: normalizeKugou } = await import('../../src/host/providers/kugou.js')
  const kg = normalizeKugou({
    FileHash: 'B3A52A7A958BF0AED0EBFBA2E9A818B7',
    FileName: '周杰伦 - 晴天',
    SingerName: '周杰伦',
    Singers: [{ id: 3520, name: '周杰伦' }],
    AlbumID: 966846,
    AlbumName: '叶惠美',
    AlbumImage: 'https://imge.kugou.com/album/1.jpg',
    Duration: 269,
    HQFileHash: 'HQHASH',
    SQFileHash: 'SQHASH',
    MixSongID: 32100650,
    PublishTime: 1057776000000,
    HeatLevel: 9,
    PayType: 3,
  }, { hashKey: 'FileHash', durationKey: 'Duration' })
  assert.equal(kg.interval, 269)
  assert.equal(kg.durationMs, 269000)
  assert.deepEqual(kg.artistsDetail, [{ id: '3520', name: '周杰伦' }])
  assert.equal(kg.albumDetail.id, '966846')
  assert.ok(kg.albumDetail.coverUrl.includes('imge.kugou.com'))
  assert.equal(kg.publishTime, 1057776000000)
  assert.equal(kg.popularity, 9)
  assert.deepEqual(kg.availableQualities, ['standard', 'high', 'lossless'])
  assert.equal(kg.privilegeDetail.payType, 3)
}
// Mixed stream: `/lyric/new` interleaves rich JSON documents with classic lines.
{
  const mixed = [
    '{"t":0,"c":[{"tx":"作词: "},{"tx":"唐恬"}]}',
    '[24810,5690](24810,270,0)他(25080,150,0)们',
  ].join('\n')
  const parsedMixed = parseYrc(mixed)
  assert.equal(parsedMixed.lines.length, 2, 'rich JSON lines are kept instead of skipped')
  assert.equal(parsedMixed.lines[0].text, '作词: 唐恬')
  assert.equal(parsedMixed.lines[0].t, 0)
  assert.equal(parsedMixed.lines[1].words.length, 2, 'classic lines still carry word timing')
  assert.equal(parsedMixed.wordLevel, true)
}
