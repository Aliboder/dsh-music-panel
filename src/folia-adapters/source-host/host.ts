/**
 * 音源模组要的宿主面，按本插件的形态实现（四个平台共用一份）。
 *
 * 上游 main 入口拿 `api`、client 入口拿 `folium`。桌面版这两个对象由 Electron 宿主给；插件在 Host 里跑，
 * 这里只实现各平台真正用到的成员，其余不实现——上游若碰到会立刻报错，而不是静默走错路。
 *
 * @module dsh-music-panel/folia-adapters/source-host/host
 */
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { createSourceError, type SourceErrorFactory } from './errors'
import { createMedia } from './media'
import { createNet, type SourceNet } from './net'
import { createRpcRegistry, type RpcRegistry } from './rpc'
import { createSeal, type Seal } from './seal'
import { createLegacyStore, createPageStoreFactory, type LegacyStore, type PageStore, type PageStoreFactory } from './stores'
import { createSourceTexts, type FoliumText, type LocaleTable, type SourceTexts } from './texts'

export interface SourceHostOptions {
  /** 模组 id（也用作数据文件前缀）。 */
  modId: string
  /** 插件数据目录。 */
  dir: string
  /** 界面语言，默认简体中文。 */
  language?: string
  /** 镜像来的 locales/*.json。 */
  locales: Record<string, LocaleTable>
  /** 测试用。 */
  fetchImpl?: typeof fetch
  /** 每次 rpc 之前的钩子（包需要的全局补丁）。 */
  beforeCall?: () => void
}

export interface SourceHost {
  modId: string
  api: Record<string, unknown>
  rpc: RpcRegistry
  seal: Seal
  store: LegacyStore
  pageStore: PageStoreFactory
  net: SourceNet
  texts: SourceTexts
  error: SourceErrorFactory
  /** client 入口要的那个 folium；register 收到定义时交给 onRegister。 */
  clientFacade(options: {
    isPureMusicText(text: string | null | undefined): boolean
    onRegister(definitions: unknown[]): void
  }): Record<string, unknown>
}

export const createSourceHost = (options: SourceHostOptions): SourceHost => {
  const rpc = createRpcRegistry({ beforeCall: options.beforeCall })
  const seal = createSeal({ dir: options.dir, name: options.modId })
  const store = createLegacyStore({ dir: options.dir, name: options.modId })
  const pageStore = createPageStoreFactory({ dir: options.dir, name: options.modId })
  const net = createNet({ fetchImpl: options.fetchImpl })
  const media = createMedia()
  const texts = createSourceTexts(options.locales, options.language)

  // 需要收尾的回调：插件停用/进程退出时按注册顺序跑（上游在 onBeforeUnload / onBeforeQuit 里关后端）。
  const beforeUnload: Array<() => void | Promise<void>> = []
  const beforeQuit: Array<() => void | Promise<void>> = []
  const diagnostics = new Map<string, unknown>()

  const api: Record<string, unknown> = {
    net,
    media,
    legacy: { store },
    seal: {
      available: () => seal.available(),
      seal: (text: string) => seal.seal(text),
      open: (sealed: string) => seal.open(sealed),
    },
    rpc: {
      handle: (name: string, handler: (...args: unknown[]) => unknown) => rpc.handle(name, handler),
      send: (name: string, payload?: unknown) => rpc.send(name, payload),
    },
    // 上游要的「受信表认领的 userData 子目录」：插件数据目录下的同名文件夹。
    paths: {
      legacy: (name: string) => {
        const folder = join(options.dir, String(name))
        mkdirSync(folder, { recursive: true })
        return folder
      },
    },
    // 诊断与自检：上游把后端对象登记进来，client 经 rpc 拿快照/自检结果，这里原样转给后端。
    diagnostics: {
      register: (name: string, backend: unknown) => {
        diagnostics.set(String(name), backend)
        return () => diagnostics.delete(String(name))
      },
      snapshot: (name: string) => {
        const backend = diagnostics.get(String(name)) as { snapshot?: () => unknown } | undefined
        return typeof backend?.snapshot === 'function' ? backend.snapshot() : null
      },
      selfCheck: (name: string) => {
        const backend = diagnostics.get(String(name)) as { selfCheck?: () => unknown } | undefined
        return typeof backend?.selfCheck === 'function' ? backend.selfCheck() : null
      },
    },
    onBeforeUnload: (handler: () => void | Promise<void>) => {
      beforeUnload.push(handler)
      return () => {
        const index = beforeUnload.indexOf(handler)
        if (index >= 0) beforeUnload.splice(index, 1)
      }
    },
    onBeforeQuit: (handler: () => void | Promise<void>) => {
      beforeQuit.push(handler)
      return () => {
        const index = beforeQuit.indexOf(handler)
        if (index >= 0) beforeQuit.splice(index, 1)
      }
    },
  }

  return {
    modId: options.modId,
    api,
    /** 插件停用/退出时调：先跑 onBeforeUnload，再跑 onBeforeQuit。 */
    async dispose() {
      for (const handler of [...beforeUnload]) { try { await handler() } catch { /* 收尾失败不挡下一个 */ } }
      for (const handler of [...beforeQuit]) { try { await handler() } catch { /* 同上 */ } }
    },
    rpc,
    seal,
    store,
    pageStore,
    net,
    texts,
    error: createSourceError,
    clientFacade({ isPureMusicText, onRegister }) {
      return {
        modId: options.modId,
        sources: {
          register(def: unknown) {
            const definitions = Array.isArray(def) ? def : [def]
            onRegister(definitions)
            const first = definitions[0] as { id?: unknown } | undefined
            return { id: typeof first?.id === 'string' ? first.id : options.modId, unregister() {} }
          },
          supports: () => true,
          error: createSourceError,
          pageStore: (id: string) => pageStore(id),
        },
        i18n: {
          key: (key: string, params?: Record<string, string | number>) => texts.key(key, params),
          text: (key: string, params?: Record<string, string | number>) => texts.text(key, params),
        },
        lyrics: { isPureMusicText: (text: string | null | undefined) => isPureMusicText(text) },
        rpc: {
          call: (name: string, ...args: unknown[]) => rpc.call(name, ...args),
          on: (name: string, listener: (payload: unknown) => void) => rpc.on(name, listener),
        },
      }
    },
  }
}

/** 门面/映射层用的共享形状。 */
export type { FoliumText, PageStore, SourceTexts }
export { join }
