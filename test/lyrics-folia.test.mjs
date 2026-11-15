/**
 * Folia's lyric pipeline (the ported `src/utils/lyrics/**`) as the plugin bundles it.
 *
 * Loads the generated `lyrics.bundle.js` the way the client does and checks that each
 * format Folia parses comes out with the same document shape the renderer reads:
 * lines with `{startTime, endTime, fullText}` and word-level `words`.
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const here = dirname(fileURLToPath(import.meta.url))
const bundle = readFileSync(join(here, '..', 'src', 'render', 'lyrics', 'lyrics.bundle.js'), 'utf8')

const sandbox = { console, Intl, TextDecoder, TextEncoder, URL, setTimeout, clearTimeout }
sandbox.globalThis = sandbox
sandbox.window = sandbox
vm.createContext(sandbox)
vm.runInContext(bundle, sandbox, { filename: 'lyrics.bundle.js' })

const lyrics = sandbox.MPFoliaLyrics
assert.ok(lyrics && typeof lyrics.parse === 'function', 'the bundle exports parse')

// The bundle runs in its own realm: its arrays are not this realm's arrays, so compare
// plain JSON copies (the assertion is about the document, not the prototypes).
const parseDocument = async (source, options) => JSON.parse(JSON.stringify(await lyrics.parse(source, options)))
assert.ok(typeof lyrics.LyricParserFactory?.parse === 'function', 'and the parser factory itself')

// ── LRC with per-character word tags (Folia's enhanced LRC) ────────────────
{
  const doc = await parseDocument({ type: 'local', lrcContent: '[00:01.00]<00:01.00>晴<00:01.50>天\n[00:05.00]第二行' })
  assert.equal(doc.lines.length, 2)
  const first = doc.lines[0]
  assert.ok(Math.abs(first.startTime - 1) < 0.01)
  assert.equal(first.fullText, '晴天')
  assert.deepEqual(first.words.map((word) => word.text), ['晴', '天'])
}

// ── QRC (QQ; the same document KRC decrypts to) ────────────────────────────
{
  const doc = await parseDocument({ type: 'qrc', qrcContent: '[0,5000]晴(0,800)天(800,900)' })
  assert.equal(doc.lines.length, 1)
  const words = doc.lines[0].words
  assert.deepEqual(words.map((word) => word.text), ['晴', '天'])
  assert.equal(words[0].startTime, 0)
  assert.equal(words[1].startTime, 0.8)
  assert.equal(words[1].endTime, 1.7)
}

// ── YRC (NetEase;) ─────────────────────────────────────────────────────────
{
  const doc = await parseDocument({ type: 'local', lrcContent: '[1000,2000](1000,500,0)晴(1500,500,0)天', formatHint: 'yrc' })
  assert.equal(doc.lines.length, 1)
  assert.deepEqual(doc.lines[0].words.map((word) => [word.text, word.startTime, word.endTime]), [['晴', 1, 1.5], ['天', 1.5, 2]])
}

// ── TTML (AMLL) ────────────────────────────────────────────────────────────
{
  const ttml = '<?xml version="1.0" encoding="UTF-8"?><tt xmlns="http://www.w3.org/ns/ttml"><body><div>'
    + '<p begin="1.0s" end="3.0s"><span begin="1.0s" end="1.5s">晴</span><span begin="1.5s" end="3.0s">天</span></p>'
    + '</div></body></tt>'
  const doc = await parseDocument({ type: 'local', lrcContent: ttml, formatHint: 'ttml' })
  assert.equal(doc.lines.length, 1)
  assert.deepEqual(doc.lines[0].words.map((word) => [word.text, word.startTime, word.endTime]), [['晴', 1, 1.5], ['天', 1.5, 3]])
}

// ── the format detector ────────────────────────────────────────────────────
// Folia only auto-detects line-level formats; QRC / YRC / KRC are always named by the
// caller (the provider hands the format hint over).
{
  assert.equal(lyrics.detectNonTtmlTimedLyricFormat('[00:01.00]a'), 'lrc')
  assert.equal(lyrics.detectNonTtmlTimedLyricFormat('[00:01.00]<00:01.50>a'), 'enhanced-lrc')
  assert.equal(lyrics.detectNonTtmlTimedLyricFormat('WEBVTT\n\n00:00.000 --> 00:01.000\na'), 'vtt')
  assert.equal(lyrics.detectNonTtmlTimedLyricFormat('<tt xmlns="http://www.w3.org/ns/ttml"></tt>'), 'lrc')
}

// ── the display-time pass (Folia's createLyricsSetter) ─────────────────────
{
  const credits = '[00:00.00]作词: A\n[00:00.20]作曲: B\n[00:00.40]编曲: C\n[00:20.00]第一句\n[00:24.00]第二句'
  const parsed = await parseDocument({ type: 'local', lrcContent: credits })
  assert.ok(parsed.lines.length >= 5, 'the credits are lines of the document')
  const hidden = JSON.parse(JSON.stringify(lyrics.prepare(parsed, { policy: 'hide' })))
  assert.ok(hidden.lines.length < parsed.lines.length, 'the dense credit block is dropped')
  assert.equal(hidden.lines.some((line) => /作词|作曲|编曲/.test(line.fullText)), false, 'no credit line survives')
  assert.ok(hidden.lines.some((line) => line.fullText === '第一句'), 'the sung lines stay')
  const kept = JSON.parse(JSON.stringify(lyrics.prepare(parsed, { policy: 'keep' })))
  assert.equal(kept.lines.length, parsed.lines.length, 'keep leaves the credits alone')
}

{
  // A line sung three times is what Folia's text-repetition detector calls a chorus.
  const body = ['副歌一', '副歌一', '副歌一'].map((text, index) => '[' + String(10 + index * 4).padStart(2, '0') + ':00.00]' + text).join('\n')
  const verses = ['主歌一', '主歌二', '主歌三', '主歌四'].map((text, index) => '[' + String(30 + index * 4).padStart(2, '0') + ':00.00]' + text).join('\n')
  const parsed = await parseDocument({ type: 'local', lrcContent: body + '\n' + verses })
  const prepared = JSON.parse(JSON.stringify(lyrics.prepare(parsed, { policy: 'keep' })))
  assert.ok(prepared.lines.some((line) => line.isChorus === true), 'a repeated line is marked as chorus')
}

// ── pure music ─────────────────────────────────────────────────────────────
// Folia's rule: only a line that *is* the notice counts; the word appearing inside
// a sung line does not.
{
  assert.equal(lyrics.isPureMusicLyricText('纯音乐，请欣赏'), true)
  assert.equal(lyrics.isPureMusicLyricText('此歌曲为没有填词的纯音乐，请您欣赏'), true)
  assert.equal(lyrics.isPureMusicLyricText('这首纯音乐很好听'), false)
  const notice = await parseDocument({ type: 'local', lrcContent: '[00:00.00]纯音乐，请欣赏' })
  assert.equal(lyrics.isPureMusicLyricLines(notice.lines), true)
  const sung = await parseDocument({ type: 'local', lrcContent: '[00:01.00]第一句' })
  assert.equal(lyrics.isPureMusicLyricLines(sung.lines), false)
}

console.log('lyrics-folia.test.mjs ok')
