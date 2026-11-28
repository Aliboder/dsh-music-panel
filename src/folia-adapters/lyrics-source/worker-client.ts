/**
 * `utils/lyrics/workerClient` 的插件侧替身。
 *
 * 上游把歌词解析放进 Web Worker（`workers/lyricsParser.worker.ts`），宿主是浏览器；插件在 Node 里，
 * 没有 Worker，所以这里用同一个 `parseLyricsByFormat` 在进程内解析，格式归一与传参照抄上游 worker：
 *   normalizeWorkerFormat(format) → parseLyricsByFormat(format, content, translation, options, romanization)
 * 失败与 worker 的 error 分支一致：回 null，让调用方走 main 轨或空歌词。
 *
 * @module dsh-music-panel/folia-adapters/lyrics-source/worker-client
 */
import { parseLyricsByFormat, type LyricParseFormat } from '../../folia/utils/lyrics/parserCore'

type LyricProcessingOptions = Record<string, unknown>

/** 与上游 worker 的 normalizeWorkerFormat 一致：未知格式按 lrc 解析。 */
export const normalizeWorkerFormat = (format: string): LyricParseFormat => {
  if (format === 'yrc' || format === 'qrc' || format === 'krc' || format === 'awlrc' || format === 'enhanced-lrc' || format === 'vtt' || format === 'ttml') {
    return format
  }
  return 'lrc'
}

/** 上游把编排用的值挡在结构化克隆边界外；进程内没有边界，原样透传。 */
export const toWorkerLyricProcessingOptions = (options?: LyricProcessingOptions): LyricProcessingOptions | undefined => (
  options === undefined ? undefined : { ...options }
)

/** 上游 worker 的 `parse` 请求 → 同一份解析结果；异常按 worker 的 error 分支回 null。 */
export const parseLyricsAsync = (
  format: string,
  content: string,
  translation?: string,
  options?: LyricProcessingOptions,
  romanization?: string,
): Promise<unknown> => {
  try {
    return Promise.resolve(parseLyricsByFormat(normalizeWorkerFormat(format), content, translation || '', options, romanization || ''))
  } catch {
    return Promise.resolve(null)
  }
}
