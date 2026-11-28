/**
 * 播放与歌词：门面的 resolveStream / resolveLegacyStream / lyric / chorus / requiresVip。
 *
 * 上游把整套退路都写在 playback.audio@1.getAudioSource 里（VIP 地址 → 按音质降级 → 云盘地址 →
 * 试听），所以这里只做两件事：把门面的音质词汇翻成上游的，把上游的答复翻回门面的形状。
 * 上游歌词交回 lines/wordByWord 行轨加 chorusRanges，门面认的是 { lrc, lines, raw }。
 *
 * @module dsh-music-panel/sources/kugou-folia/playback
 */
import { kugouDefinition, kugouError } from './instance.js'
import { foliaSongOf } from './cache.js'
import { resolveSourceLyrics } from '../../../services/lyrics/folia-lyrics-source.js'

/** 门面的音质档 → 上游的档位。上游把 hires 归到 high，我们自己也没有更高的酷狗档。 */
export function qualityOf(quality) {
  if (quality === 'lossless' || quality === 'hires') return 'lossless'
  if (quality === 'standard') return 'standard'
  return 'high'
}

/** 上游的档位 → 门面的档位（门面只有 standard/high/lossless）。 */
export function facadeQualityOf(quality) {
  if (quality === 'lossless') return 'lossless'
  if (quality === 'standard') return 'standard'
  return 'high'
}

/** 取一首歌的播放地址；上游没有地址时答 null，由路由按它自己的退路处理。 */
export async function resolveStream(provider, id, cookie = '', session = {}, quality = 'high') {
  try {
    const source = await kugouDefinition().capabilities['playback.audio@1'].getAudioSource(foliaSongOf({ id }), qualityOf(quality))
    if (!source || typeof source.url !== 'string' || source.url === '') return { url: '', quality: '', replayGain: null }
    return {
      url: source.url,
      quality: source.quality ? facadeQualityOf(source.quality) : qualityOf(quality),
      replayGain: source.replayGain ?? null,
      ...(source.preview === true ? { preview: true } : {}),
    ...(source.preview === true && Number.isFinite(source.clipStartMs) && source.clipStartMs > 0
      ? { clipStartMs: source.clipStartMs }
      : {}),
    }
  } catch (error) {
    throw kugouError(error)
  }
}

/**
 * 旧接口的退路：上游的 getAudioSource 内部已经含了这一路，所以门面这里不需要再单独跑；
 * 路由的 legacy=1 重放仍会问一次，直接给 null 让它按「没有更低的退路」处理。
 */
export async function resolveLegacyStream() {
  return null
}

/** 上游的行轨 → 门面的行（{t,end,text,words}），行时间从毫秒换成秒。 */
function linesOf(track) {
  const lines = Array.isArray(track?.lines) ? track.lines : []
  return lines
    .map((line) => ({
      t: (Number(line.startTime) || 0) / 1000,
      end: line.endTime === undefined ? undefined : (Number(line.endTime) || 0) / 1000,
      text: String(line.text ?? ''),
      words: Array.isArray(line.words)
        ? line.words.map((word) => ({
            t: (Number(word.startTime) || 0) / 1000,
            end: word.endTime === undefined ? undefined : (Number(word.endTime) || 0) / 1000,
            text: String(word.text ?? ''),
          }))
        : undefined,
    }))
    .filter((line) => line.text !== '' || (line.words && line.words.length > 0))
}

const textOfTrack = (track) => (Array.isArray(track?.lines) ? track.lines.map((line) => String(line.text ?? '')).join('\n') : '')

/** 一首歌的歌词：门面形状 { lrc, lines, wordLevel, raw, translation }。 */
export async function lyric(provider, id, cookie = '', session = {}) {
  try {
    const raw = await kugouDefinition().capabilities['lyrics@1'].getLyrics(foliaSongOf({ id }))
    // 上游给的是 { main: { format, text }, wordByWord: { format, text } }：解析交给移植的
    // Folia 宿主步骤（mods/folium/lyricsSource.ts），这里只换成门面/路由认的形状。
    const resolved = await resolveSourceLyrics(raw, 'kugouLite')
    return {
      lrc: resolved.lrc,
      lines: resolved.lines,
      wordLevel: resolved.wordLevel,
      translation: resolved.translation || '',
      romaji: resolved.romaji || '',
      ...(resolved.pureMusic === true ? { pureMusic: true } : {}),
      raw: { ...(resolved.raw || {}), chorusRanges: raw && Array.isArray(raw.chorusRanges) ? raw.chorusRanges : [] },
    }
  } catch (error) {
    throw kugouError(error)
  }
}
/** 副歌区间；上游有 getChorusRanges，门面原来恒 null，这里如实给出来。 */
export async function chorus(provider, id) {
  const capabilities = kugouDefinition().capabilities['lyrics@1']
  if (typeof capabilities.getChorusRanges !== 'function') return null
  try {
    return await capabilities.getChorusRanges(String(id).toLowerCase())
  } catch {
    return null
  }
}

/** 会员标记：门面只用来给歌打 VIP 角标，拿不到就当不知道。 */
export function requiresVip(provider, id) {
  return null
}
/** 平台自己的失败说法（上游音源定义的 describeFailure）：宿主据此分情况提示。 */
export function describeFailure(operation, error) {
  try {
    const definition = kugouDefinition()
    return typeof definition.describeFailure === 'function' ? definition.describeFailure(operation, error) ?? null : null
  } catch {
    return null
  }
}
