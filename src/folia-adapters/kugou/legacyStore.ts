/**
 * api.legacy.store：酷狗会话（KUGOU_API_SESSION_V2 / V1）的持久化。
 *
 * 上游桥只按键读写整个值（先是 JSON 字符串，后来是加密后的信封），值本身由桥自己解释，
 * 所以这里就是一个键值文件，键名与上游受信表认领的一致。
 *
 * @module dsh-music-panel/folia-adapters/kugou/legacyStore
 */
import { createJsonFile } from './jsonFile'

/** 上游桥认领的两个键（kugou/main/kugouApiBridge.cjs 的 SESSION_KEY / LEGACY_SESSION_KEY）。 */
export const LEGACY_SESSION_KEY = 'KUGOU_API_SESSION_V1'
export const SESSION_KEY = 'KUGOU_API_SESSION_V2'

/** Folium 的 FoliumSourceLegacyStore。 */
export interface LegacyStore {
  get(key: string): unknown
  set(key: string, value: unknown): void
  has(key: string): boolean
  delete(key: string): void
}

export const createLegacyStore = (options: { file: string }): LegacyStore => {
  const file = createJsonFile<Record<string, unknown>>(options.file, () => ({}))
  return {
    get(key) {
      const data = file.read()
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : undefined
    },
    set(key, value) {
      const data = { ...file.read(), [key]: value }
      file.write(data)
    },
    has(key) {
      return Object.prototype.hasOwnProperty.call(file.read(), key)
    },
    delete(key) {
      const data = { ...file.read() }
      if (!Object.prototype.hasOwnProperty.call(data, key)) return
      delete data[key]
      file.write(data)
    },
  }
}
