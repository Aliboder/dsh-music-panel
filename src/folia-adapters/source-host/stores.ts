/**
 * api.legacy.store 与 folium.sources.pageStore：音源的两份同步键值存储。
 *
 * 前者是上游「内置音源迁移前」的存储键（登录态、设备 id，键名由上游自己定）；后者是音源自己那条
 * 「窗口里的小存储」（账号提示一类短字符串）。桌面版分别是 electron-store 与 localStorage，
 * 插件里各自落成插件数据目录下的一个 JSON 文件。
 *
 * @module dsh-music-panel/folia-adapters/source-host/stores
 */
import { join } from 'node:path'
import { createJsonFile } from './jsonFile'

export interface LegacyStore {
  get(key: string): unknown
  set(key: string, value: unknown): void
  has(key: string): boolean
  delete(key: string): void
}

export const createLegacyStore = (options: { dir: string, name: string }): LegacyStore => {
  const file = createJsonFile<Record<string, unknown>>(join(options.dir, options.name + '-legacy-store.json'), () => ({}))
  return {
    get(key) {
      const data = file.read()
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : undefined
    },
    set(key, value) { file.write({ ...file.read(), [key]: value }) },
    has(key) { return Object.prototype.hasOwnProperty.call(file.read(), key) },
    delete(key) {
      const data = { ...file.read() }
      if (!Object.prototype.hasOwnProperty.call(data, key)) return
      delete data[key]
      file.write(data)
    },
  }
}

export interface PageStore {
  get(key: string): string | null
  set(key: string, value: string | null): void
  keys(): string[]
}

export type PageStoreFactory = (sourceId: string) => PageStore

export const createPageStoreFactory = (options: { dir: string, name: string }): PageStoreFactory => {
  const file = createJsonFile<Record<string, Record<string, string>>>(join(options.dir, options.name + '-page-store.json'), () => ({}))
  const stores = new Map<string, PageStore>()
  return (sourceId: string): PageStore => {
    const existing = stores.get(sourceId)
    if (existing) return existing
    const ofSource = (): Record<string, string> => file.read()[sourceId] ?? {}
    const store: PageStore = {
      get(key) {
        const all = ofSource()
        return Object.prototype.hasOwnProperty.call(all, key) ? all[key] : null
      },
      set(key, value) {
        const data = file.read()
        const mine = { ...(data[sourceId] ?? {}) }
        if (value === null) delete mine[key]
        else mine[key] = String(value)
        file.write({ ...data, [sourceId]: mine })
      },
      keys() { return Object.keys(ofSource()) },
    }
    stores.set(sourceId, store)
    return store
  }
}
