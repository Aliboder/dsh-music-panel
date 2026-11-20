import assert from 'node:assert/strict'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { serializeLrc, shiftLrc, writeEmbeddedLyrics } from '../../src/host/services/lyrics/lyrics-write.js'
import { readTags } from '../../src/host/services/media/tags.js'

// Timestamps move by the requested offset.
assert.equal(shiftLrc('[00:01.00]a', 500), '[00:01.50]a')
assert.equal(shiftLrc('[00:10.00]a\n[00:20.00]b', 1500), '[00:11.50]a\n[00:21.50]b')
assert.equal(shiftLrc('[00:00.50]a', -1000), '[00:00.00]a', 'negative times clamp to zero')
assert.equal(shiftLrc('no stamps', 1000), 'no stamps')
assert.equal(shiftLrc('[01:02.34]x', 0), '[01:02.34]x')

// Parsed lines round-trip back to LRC, including translations.
assert.equal(
  serializeLrc([
    { time: 1.23, text: 'a', translation: '' },
    { time: 2, text: 'b', translation: 'c' },
  ]),
  '[00:01.23]a\n[00:02.00]b\n[00:02.00]c',
)
assert.equal(serializeLrc([{ time: -1, text: 'plain', translation: '' }]), 'plain')

// Formats without a safe JS writer are refused instead of corrupted.
await assert.rejects(writeEmbeddedLyrics('D:/x.m4a', '[00:00.00]a'), /不支持/)

// Enhanced LRC survives the MP3 USLT writer byte-for-byte: the local parser
// needs the angle-bracket word stamps to rebuild word timing.
const dir = await mkdtemp(join(tmpdir(), 'dsh-lyrics-write-'))
const mp3 = join(dir, 'word.mp3')
await writeFile(mp3, Buffer.alloc(0))
const enhanced = '[00:01.00]<00:01.00>晴<00:01.50>天<00:02.00>'
await writeEmbeddedLyrics(mp3, enhanced)
const written = await readTags(mp3)
assert.equal(written.format, 'id3')
assert.equal(written.tags.lyrics, enhanced)

console.log('lyrics-write.test.mjs ok')

