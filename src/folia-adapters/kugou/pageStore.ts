/**
 * folium.sources.pageStore：音源自己那条「窗口里的小存储」（上游在桌面版用页面 localStorage）。
 *
 * 酷狗音源只用它记登录账号 id 一类的短字符串；本插件在 Host 里跑，就落到插件数据目录下的一个 JSON 文件，
 * 按音源 id 分开，读写同步。
 *
 * @module dsh-music-panel/folia-adapters/kugou/pageStore
 */
import { createJsonFile } from './jsonFile'

/** Folium 的 FoliumSourcePageStore。 */
export interface PageStore {
  get(key: string): string | null
  set(key: string, value: string | null): void
  keys(): string[]
}

export type PageStoreFactory = (sourceId: string) => PageStore

export const createPageStoreFactory = (options: { file: string }): PageStoreFactory => {
  const file = createJsonFile<Record<string, Record<string, string>>>(options.file, () => ({}))
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
      keys() {
        return Object.keys(ofSource())
      },
    }
    stores.set(sourceId, store)
    return store
  }
}
