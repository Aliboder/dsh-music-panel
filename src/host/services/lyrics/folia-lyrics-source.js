/**
 * 音源歌词 → 本插件的歌词形状。
 *
 * 移植的五个平台（`lyrics@1.getLyrics`）交回的是 `{ main: { format, text }, wordByWord: { format, text } }`：
 * 原始文本 + 格式，不是解析好的行。Folia 的宿主在 `src/mods/folium/lyricsSource.ts` 里把它解析成
 * 应用歌词（`resolveFoliumSourceLyricsResult`），这一步现在原样移植进 `lyrics-folia` bundle。
 * 这个文件只做两件事：调那一步，再把 `LyricData` 换成本插件路由/客户端认的 `{ t, end, text, words }`。
 *
 * 另外把客户端要的原始文档一并交回（`raw`），客户端会用 Folia 的歌词管线再解析一次——
 * 这与启用前一致：能解析文档的走文档，解析不了才用这里给的行。
 *
 * @module dsh-music-panel/folia-lyrics-source
 */
import { resolveFoliumSourceLyricsResult } from '../../vendor/lyrics-folia/match.bundle.mjs'
import { linesOf } from './lyrics-folia.js'

const EMPTY = { lrc: '', lines: [], wordLevel: false, translation: '', romaji: '', raw: {} }

/**
 * @param {unknown} raw 音源 `getLyrics` 的答复
 * @param {string} label 报错/日志里出现的音源名
 */
export async function resolveSourceLyrics(raw, label) {
  if (raw === null || typeof raw !== 'object') return { ...EMPTY }
  let result
  try {
    result = await resolveFoliumSourceLyricsResult(raw, label)
  } catch (error) {
    return { ...EMPTY }
  }
  if (result === null || typeof result !== 'object') return { ...EMPTY }
  const lyrics = result.lyrics
  const converted = lyrics !== null && Array.isArray(lyrics.lines) && lyrics.lines.length > 0
    ? linesOf(lyrics)
    : { lyrics: [], wordLevel: false }
  const lines = converted.lyrics
  // 解析器会给逐行歌词补上音节级 words（estimate），那不算逐字：只认上游标出的 isWordByWord。
  const wordLevel = lyrics !== null && lyrics.isWordByWord === true
  const main = raw.main && typeof raw.main === 'object' ? raw.main : null
  const wordByWord = raw.wordByWord && typeof raw.wordByWord === 'object' ? raw.wordByWord : null
  const chosen = wordLevel ? wordByWord ?? main : main ?? wordByWord
  // 只有真的解析出歌词时才把原文交回：被上游丢掉的轨（格式不认识、文本空）不给客户端再解析一遍。
  const document = lyrics !== null && chosen !== null && typeof chosen.text === 'string' && chosen.text !== ''
    ? {
        type: 'local',
        lrcContent: chosen.text,
        ...(typeof result.translationText === 'string' && result.translationText !== '' ? { tLrcContent: result.translationText } : {}),
        ...(typeof result.romanizationText === 'string' && result.romanizationText !== '' ? { rLrcContent: result.romanizationText } : {}),
        formatHint: typeof chosen.format === 'string' ? chosen.format : '',
      }
    : null
  return {
    lrc: typeof result.mainText === 'string' && result.mainText !== ''
      ? result.mainText
      : lines.map((line) => line.text).join('\n'),
    lines,
    wordLevel,
    translation: typeof result.translationText === 'string' ? result.translationText : '',
    romaji: typeof result.romanizationText === 'string' ? result.romanizationText : '',
    ...(result.isPureMusic === true ? { pureMusic: true } : {}),
    raw: document === null ? {} : { ...document },
  }
}
