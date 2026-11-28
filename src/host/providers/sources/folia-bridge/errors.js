/**
 * 上游音源的错 → 本插件的 MusicError。
 *
 * 上游 code 与 MusicError 是同一套词汇（auth-required / rate-limited / not-playable / network /
 * timeout / unavailable / not-configured），原样保留；没有 code 的按 toMusicError 的规则归类。
 *
 * @module dsh-music-panel/sources/folia-bridge/errors
 */
import { MusicError, toMusicError } from '../../../services/core/errors.js'

export function foliaError(error, sourceId) {
  if (error instanceof MusicError) return error
  const code = typeof error?.code === 'string' ? error.code : ''
  if (code !== '') {
    return new MusicError(error.message || code, {
      code,
      sourceId,
      retryAfterMs: Number(error.retryAfterMs) || 0,
      status: Number(error.httpStatus) || 0,
      cause: error,
    })
  }
  return toMusicError(error, sourceId)
}

/** 某个能力族里有没有这个方法。 */
export const hasMethod = (family, name) => Boolean(family) && typeof family[name] === 'function'
