/**
 * 酷狗音源模组要的宿主面，按本插件的形态实现。
 *
 * 上游两端各要一个宿主对象（main 入口的 api、client 入口的 folium）。桌面版这两个对象由 Electron 宿主给，
 * 本插件在 Host 里跑，所以这里只实现酷狗模组真正用到的那几个成员：
 *   api.media.allow / api.legacy.store / api.seal / api.net.fetch / api.rpc
 *   folium.modId / folium.sources.register|error|pageStore / folium.i18n.key|text / folium.lyrics.isPureMusicText / folium.rpc.call
 * 其余成员（窗口、缓存目录、系统浏览器、证书例外……）酷狗模组不碰；真被碰到时会因 undefined 而立刻报错，
 * 不会静默走错路。
 *
 * @module dsh-music-panel/folia-adapters/kugou/host
 */
import { join } from 'node:path'
import { createLegacyStore, type LegacyStore } from './legacyStore'
import { createPageStoreFactory, type PageStoreFactory } from './pageStore'
import { createRpcRegistry, type RpcRegistry } from './rpc'
import { createSeal, type Seal } from './seal'
import { createSourceError, type SourceErrorFactory } from './errors'
import { createSourceTexts, type SourceTexts, type FoliumText } from './texts'

/** 一个真正实现出来的宿主对象；类型由上游声明，这里是结构上的最小实现。 */
export interface FoliaKugouHost {
  /** main 入口的 api（Sources 侧）。 */
  api: Record<string, unknown>
  rpc: RpcRegistry
  seal: Seal
  legacyStore: LegacyStore
  pageStore: PageStoreFactory
  error: SourceErrorFactory
  texts: SourceTexts
  /** 停用：清掉登记态（本插件不热卸载音源，留给测试与将来）。 */
  dispose(): void
}

export interface FoliaKugouHostOptions {
  /** 插件数据目录：会话、页面存储、密钥都落在这里。 */
  dir: string
  /** 界面语言，默认简体中文（Host 侧的文案本来就是中文）。 */
  language?: string
  /** 测试用：换掉 fetch。 */
  fetchImpl?: typeof fetch
}

/** api.media.allow 的返回：一个 disposer，加一个 add。 */
const createAllowed = (): (() => void) & { add(url: string): void } => Object.assign(() => {}, { add() {} })

export const createFoliaKugouHost = (options: FoliaKugouHostOptions): FoliaKugouHost => {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  const rpc = createRpcRegistry()
  const seal = createSeal({ dir: options.dir })
  const legacyStore = createLegacyStore({ file: join(options.dir, 'kugou-legacy-store.json') })
  const pageStore = createPageStoreFactory({ file: join(options.dir, 'kugou-page-store.json') })
  const texts = createSourceTexts(options.language)

  const api: Record<string, unknown> = {
    // Electron 的 net 面：酷狗只用到 fetch（匿名搜索、旧的手机版播放信息接口），没有 partition、没有拦截。
    net: {
      fetch: async (url: string, init: Record<string, unknown> = {}) => {
        const { session: _session, ...rest } = init
        return fetchImpl(String(url), rest as RequestInit)
      },
    },
    // 跨域放行：本插件所有的播放地址都经 Host 自己的 /music/online/stream 代理，浏览器不去碰平台域，
    // 所以上游给的那些 host 规则在这里无事可做，只要不挡它的登记。
    media: { allow: () => createAllowed() },
    legacy: { store: legacyStore },
    seal: {
      available: () => seal.available(),
      seal: (text: string) => seal.seal(text),
      open: (sealed: string) => seal.open(sealed),
    },
    rpc: { handle: (name: string, handler: (...args: unknown[]) => unknown) => rpc.handle(name, handler) },
  }

  return {
    api,
    rpc,
    seal,
    legacyStore,
    pageStore,
    error: createSourceError,
    texts,
    dispose() {}
  }
}

/** client 入口的 folium，只要酷狗模组用到的成员。 */
export interface FoliaClientFacade {
  modId: string
  sources: {
    register<T>(def: T): { id: string; unregister(): void }
    supports(id: string, version: number): boolean
    error: SourceErrorFactory
    pageStore(id: string): { get(key: string): string | null; set(key: string, value: string | null): void; keys(): string[] }
  }
  i18n: { key(key: string, params?: Record<string, string | number>): FoliumText; text(key: string, params?: Record<string, string | number>): string }
  lyrics: { isPureMusicText(text: string | null | undefined): boolean }
  rpc: { call<T>(name: string, ...args: unknown[]): Promise<T> }
}

export interface CreateClientFacadeOptions {
  modId: string
  host: FoliaKugouHost
  isPureMusicText: (text: string | null | undefined) => boolean
  onRegister: (definitions: unknown[]) => void
}

export const createClientFacade = ({ modId, host, isPureMusicText, onRegister }: CreateClientFacadeOptions): FoliaClientFacade => ({
  modId,
  sources: {
    register(def) {
      const definitions = Array.isArray(def) ? def : [def]
      onRegister(definitions)
      const first = definitions[0] as { id?: unknown } | undefined
      return { id: typeof first?.id === 'string' ? first.id : modId, unregister() {} }
    },
    supports: () => true,
    error: host.error,
    pageStore: (id: string) => host.pageStore(id),
  },
  i18n: {
    key: (key, params) => host.texts.key(key, params),
    text: (key, params) => host.texts.text(key, params),
  },
  lyrics: { isPureMusicText: text => isPureMusicText(text) },
  rpc: { call: <T>(name: string, ...args: unknown[]) => host.rpc.call<T>(name, ...args) },
})
