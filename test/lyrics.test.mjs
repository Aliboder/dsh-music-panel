import assert from 'node:assert/strict'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseLrc, parseLyricsText, parseSyncText, readLyricsFor } from '../lib/lyrics.js'

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

console.log('lyrics.test.mjs ok')
