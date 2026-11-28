/**
 * folium.sources.error：上游 core 造错的唯一入口。
 *
 * 上游按 code 判情况，所以交回的必须是带 code 的 Error；本插件的映射层再把它翻成 MusicError。
 *
 * @module dsh-music-panel/folia-adapters/source-host/errors
 */

export interface SourceErrorDetails {
  httpStatus?: number
  retryAfterMs?: number
  cause?: unknown
}

export interface SourceError extends Error {
  readonly code: string
  readonly httpStatus?: number
  readonly retryAfterMs?: number
}

export type SourceErrorFactory = (code: string, message: string, details?: SourceErrorDetails) => SourceError

export const createSourceError: SourceErrorFactory = (code, message, details = {}) => {
  const error = new Error(message) as SourceError & { code: string }
  Object.defineProperty(error, 'code', { value: code, enumerable: true })
  if (details.httpStatus !== undefined) Object.defineProperty(error, 'httpStatus', { value: details.httpStatus, enumerable: true })
  if (details.retryAfterMs !== undefined) Object.defineProperty(error, 'retryAfterMs', { value: details.retryAfterMs, enumerable: true })
  if (details.cause !== undefined) Object.defineProperty(error, 'cause', { value: details.cause, enumerable: false })
  return error as SourceError
}
