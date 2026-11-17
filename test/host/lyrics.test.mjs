import assert from 'node:assert/strict'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseLrc, parseLyricsText, parseSyncText, readLyricsFor, readSidecarLyrics } from '../../src/host/services/lyrics/lyrics.js'

// Metadata tags are skipped; timestamps become seconds.
const basic = parseLrc('[ti:Demo]\n[ar:Someone]\n[00:01.50]first line\n[00:12.00]second line\n')
assert.equal(basic.length, 2)
assert.equal(basic[0].time, 1.5)
assert.equal(basic[0].text, 'first line')
assert.equal(basic[1].time, 12)

// Several stamps on one line produce several entries.
const multi = parseLrc('[00:05.00][00:15.00]chorus\n')
assert.equal(multi.length, 2)
assert.deepEqual(
  multi.map((row) => row.time),
  [5, 15],
)

// Original + translation with (almost) the same stamp fold into one row.
const paired = parseLrc('[00:10.00]原文です\n[00:10.05]这是翻译\n[00:20.00]next\n')
assert.equal(paired.length, 2)
assert.equal(paired[0].text, '原文です')
assert.equal(paired[0].translation, '这是翻译')
assert.equal(paired[1].translation, '')

// Timed credits stay separate and never masquerade as a translation.
const credited = parseLrc(
  '[00:00.00]作词 : 宮本浩次\n[00:00.14]作曲 : 宮本浩次\n[00:00.28]编曲 : 小林武史/宮本浩次\n[00:01.00]原文\n[00:01.05]这是翻译\n',
)
assert.equal(credited.length, 4)
assert.equal(credited[0].text, '作词 : 宮本浩次')
assert.equal(credited[0].translation, '')
assert.equal(credited[1].translation, '')
assert.equal(credited[2].translation, '')
assert.equal(credited[3].translation, '这是翻译')

// Three languages on one stamp stay together, one translation per line.
const trilingual = parseLrc('[00:10.00]原文\n[00:10.00]translation\n[00:10.00]romaji\n')
assert.equal(trilingual.length, 1)
assert.equal(trilingual[0].text, '原文')
assert.equal(trilingual[0].translation, 'translation\nromaji')

// Synced frames with identical stamps fold the same way.
const syncMulti = parseSyncText(
  [
    { timestamp: 0, text: 'a' },
    { timestamp: 0, text: 'b' },
    { timestamp: 0, text: 'c' },
    { timestamp: 2000, text: 'next' },
  ],
  2,
)
assert.equal(syncMulti.lines.length, 2)
assert.equal(syncMulti.lines[0].text, 'a')
assert.equal(syncMulti.lines[0].translation, 'b\nc')

// Lines without a timestamp and empty input are ignored.
assert.deepEqual(parseLrc('no stamp\n\n[00:01.00]\n'), [])
assert.deepEqual(parseLrc(''), [])
assert.deepEqual(parseLrc(null), [])

// Embedded payloads: timed LRC vs plain text.
const timedEmbedded = parseLyricsText('[00:01.00]a\n[00:02.00]b', 'embedded')
assert.equal(timedEmbedded.timed, true)
assert.equal(timedEmbedded.source, 'embedded')
assert.equal(timedEmbedded.lines.length, 2)

const plainEmbedded = parseLyricsText('first line\nsecond line\n', 'embedded')
assert.equal(plainEmbedded.timed, false)
assert.equal(plainEmbedded.lines.length, 2)
assert.equal(plainEmbedded.lines[0].time, -1)
assert.equal(plainEmbedded.lines[1].text, 'second line')

// Synced frames (ID3 SYLT / FLAC SYNCEDLYRICS) are millisecond stamps.
const synced = parseSyncText(
  [
    { timestamp: 1500, text: 'second' },
    { timestamp: 0, text: 'first' },
    { timestamp: 90000, text: 'third' },
  ],
  2,
)
assert.equal(synced.timed, true)
assert.equal(synced.source, 'embedded')
assert.deepEqual(
  synced.lines.map((line) => [line.time, line.text]),
  [
    [0, 'first'],
    [1.5, 'second'],
    [90, 'third'],
  ],
)

// MPEG-frame timestamps cannot be converted without the frame duration.
assert.equal(parseSyncText([{ timestamp: 10, text: 'x' }], 1), null)
assert.equal(parseSyncText([], 2), null)
assert.equal(parseSyncText(null, 2), null)

// Sidecar lookup next to the audio file, case-insensitive on the extension.
const dir = await mkdtemp(join(tmpdir(), 'dsh-music-lrc-'))
const audio = join(dir, 'Song One.mp3')
await writeFile(audio, 'not really audio')
await writeFile(join(dir, 'song one.LRC'), '[00:01.00]hello\n')

const found = await readLyricsFor(audio)
assert.equal(found.lines.length, 1)
assert.equal(found.lines[0].text, 'hello')
assert.ok(found.file !== null)

// A track without a sidecar is an empty result, not an error.
const missing = await readLyricsFor(join(dir, 'nothing.ogg'))
assert.deepEqual(missing.lines, [])
assert.equal(missing.file, null)

// The raw text goes to the client so it can run Folia's parser: the timeline of a
// synced tag is written out as LRC, keeping millisecond precision and the translations.
assert.match(synced.raw, /^\[00:00\.000\]first\n\[00:01\.500\]second\n\[01:30\.000\]third$/)
const syncedPair = parseSyncText(
  [
    { timestamp: 2000, text: '原文' },
    { timestamp: 2000, text: '翻译' },
  ],
  2,
)
assert.equal(syncedPair.raw, '[00:02.000]原文')
assert.equal(syncedPair.translation, '[00:02.000]翻译')

// Untimed sidecars stay on the Host's plain lines: a timed parser would return none.
await writeFile(join(dir, 'plain.mp3'), 'not really audio')
await writeFile(join(dir, 'plain.lrc'), 'just some words\nno timestamps\n')
const plainSidecar = await readLyricsFor(join(dir, 'plain.mp3'))
assert.equal(plainSidecar.timed, false)
assert.equal(plainSidecar.raw, '')
assert.equal(plainSidecar.lines.length, 2)

// A timed LRC sidecar is handed over both ways: the parsed lines and the raw text.
const timedSidecar = await readLyricsFor(audio)
assert.equal(timedSidecar.raw, '[00:01.00]hello\n')
assert.equal(timedSidecar.formatHint, '')

// Format priority follows Folia's order: an .lrc outranks a .ttml next to the same track.
await writeFile(join(dir, 'song one.ttml'), '<tt xmlns="http://www.w3.org/ns/ttml"></tt>')
assert.equal((await readLyricsFor(audio)).raw, '[00:01.00]hello\n')
await writeFile(join(dir, 'only.ttml'), '<tt xmlns="http://www.w3.org/ns/ttml"><body/></tt>')
await writeFile(join(dir, 'only.mp3'), 'not really audio')
const onlyTtml = await readLyricsFor(join(dir, 'only.mp3'))
assert.equal(onlyTtml.formatHint, 'ttml')
assert.deepEqual(onlyTtml.lines, [])

// A \`<stem>.t.<ext>\` sibling is the translation of the same timeline.
await writeFile(join(dir, 'paired.mp3'), 'not really audio')
await writeFile(join(dir, 'paired.yrc'), '[1000,2000](1000,500,0)晴')
await writeFile(join(dir, 'paired.t.yrc'), '[1000,2000](1000,500,0)sunny')
const pairedSidecar = await readLyricsFor(join(dir, 'paired.mp3'))
assert.equal(pairedSidecar.formatHint, 'yrc')
assert.equal(pairedSidecar.translation, '[1000,2000](1000,500,0)sunny')

// `track.mp3.lrc` is the second name Folia accepts beside `track.lrc`.
await writeFile(join(dir, 'named.mp3'), 'not really audio')
await writeFile(join(dir, 'named.mp3.lrc'), '[00:01.00]named\n')
const namedSidecar = await readLyricsFor(join(dir, 'named.mp3'))
assert.equal(namedSidecar.lines[0].text, 'named')

// A translation may use a different format from the main lyric (Folia keeps them apart).
await writeFile(join(dir, 'cross.mp3'), 'not really audio')
await writeFile(join(dir, 'cross.lrc'), '[00:01.00]main\n')
await writeFile(join(dir, 'cross.t.vtt'), 'WEBVTT\n\n00:01.000 --> 00:02.000\ntrans\n')
const crossSidecar = await readLyricsFor(join(dir, 'cross.mp3'))
assert.equal(crossSidecar.raw, '[00:01.00]main\n')
assert.ok(crossSidecar.translation.includes('trans'))

// The listener's format order decides which sidecar wins; `.fia` always outranks it.
await writeFile(join(dir, 'ordering.mp3'), 'not really audio')
await writeFile(join(dir, 'ordering.lrc'), '[00:01.00]lrc\n')
await writeFile(join(dir, 'ordering.yrc'), '[1000,2000](1000,500,0)yrc')
assert.equal((await readSidecarLyrics(join(dir, 'ordering.mp3'))).formatHint, '')
assert.equal((await readSidecarLyrics(join(dir, 'ordering.mp3'), { formatOrder: ['yrc', 'lrc'] })).formatHint, 'yrc')
await writeFile(join(dir, 'ordering.fia'), '{"lines":[{"fullText":"x","startTime":0,"endTime":1}]}')
assert.equal((await readSidecarLyrics(join(dir, 'ordering.mp3'), { formatOrder: ['yrc', 'lrc'] })).file.endsWith('ordering.fia'), true)

console.log('lyrics.test.mjs ok')

