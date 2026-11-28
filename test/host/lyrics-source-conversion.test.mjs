/**
 * 音源歌词 → 应用歌词（Folia 宿主步骤 `mods/folium/lyricsSource.ts` 的移植）。
 *
 * 上游 `lyrics@1.getLyrics` 给的是 `{ main: { format, text }, wordByWord: { format, text } }`：
 * 原始文本 + 格式。这个测试把每种格式都走一遍，并固定住「旧的行形状不算数」这条契约——
 * 之前测试桩返回 `{ main: { lines } }`，与上游不符，导致平台歌词在真机上被整段丢掉。
 */

import assert from 'node:assert/strict'
import { resolveSourceLyrics } from '../../src/host/services/lyrics/folia-lyrics-source.js'

// ── 逐行 LRC：行有时间，没有真逐字 ─────────────────────────────────────────
{
  const resolved = await resolveSourceLyrics({ main: { format: 'lrc', text: '[00:01.000]第一行\n[00:02.500]第二行' } }, 'test')
  assert.equal(resolved.lines.length, 2)
  assert.equal(resolved.lines[0].t, 1)
  assert.equal(resolved.lines[0].text, '第一行')
  assert.equal(resolved.wordLevel, false, '解析器补的音节级 words 不算逐字')
  assert.equal(resolved.raw.formatHint, 'lrc', '原文随结果回给客户端，客户端用同一条管线再解析')
  assert.match(resolved.raw.lrcContent, /第一行/)
}

// ── 逐字 KRC：字相对行首，行/字时间都换成秒 ─────────────────────────────
{
  const resolved = await resolveSourceLyrics({
    main: { format: 'krc', text: '[1000,1500]<0,500,0>a<500,1000,0>b' },
    wordByWord: { format: 'krc', text: '[1000,1500]<0,500,0>a<500,1000,0>b' },
  }, 'test')
  assert.equal(resolved.wordLevel, true)
  assert.equal(resolved.lines[0].t, 1)
  assert.equal(resolved.lines[0].end, 2.5)
  assert.equal(resolved.lines[0].text, 'ab')
  assert.equal(resolved.lines[0].words[0].t, 1)
  assert.equal(resolved.lines[0].words[0].end, 1.5)
  assert.equal(resolved.raw.formatHint, 'krc')
}

// ── 逐字轨借逐行轨的翻译（上游合并规则）─────────────────────────────────
{
  const resolved = await resolveSourceLyrics({
    main: { format: 'lrc', text: '[00:01.000]hello', translationText: '[00:01.000]你好' },
    wordByWord: { format: 'enhanced-lrc', text: '[00:01.00]<00:01.00>hel<00:01.50>lo' },
  }, 'test')
  assert.equal(resolved.wordLevel, true)
  assert.equal(resolved.translation, '[00:01.000]你好')
  assert.equal(resolved.lines[0].translation, '你好', '逐字轨没有自己的翻译时，行上带着借来的翻译')
}

// ── 纯音乐：不下发任何行 ──────────────────────────────────────────────────
{
  const resolved = await resolveSourceLyrics({ isPureMusic: true }, 'test')
  assert.equal(resolved.pureMusic, true)
  assert.equal(resolved.lines.length, 0)
}

// ── 坏轨被丢掉，不抛错 ────────────────────────────────────────────────────
{
  const resolved = await resolveSourceLyrics({ main: { format: 'bogus', text: 'x' } }, 'test')
  assert.equal(resolved.lines.length, 0)
  assert.equal(resolved.raw.formatHint, undefined)
}

// ── 旧契约（解析好的 lines）不是上游给的形状：不能被当成歌词 ─────────────
{
  const resolved = await resolveSourceLyrics({
    main: { lines: [{ startTime: 0, endTime: 1000, text: '一行' }] },
  }, 'test')
  assert.equal(resolved.lines.length, 0, '上游只给 { format, text }；缺 format/text 的答复是空的')
}

console.log('lyrics-source-conversion.test ok')
