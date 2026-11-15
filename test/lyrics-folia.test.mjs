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

console.log('lyrics-folia.test.mjs ok')
