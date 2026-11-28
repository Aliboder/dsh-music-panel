/**
 * QQ 音乐音源 Host bundle 的入口。
 *
 * 上游两个入口原样 import（sources/qq/main/index.ts 与 client/index.ts）；宿主面除了四平台共用的
 * source-host，还用到它的 rpc.send、paths.legacy、diagnostics 与 onBeforeUnload/onBeforeQuit。
 * qq-music-api 由上游在第一次 `status` 时动态加载（包在加载时就监听端口），所以这里不预热。
 *
 * 产物：src/host/vendor/qq-folia/source.bundle.mjs。
 *
 * @module dsh-music-panel/folia-build/qq-host-entry
 */
import activateMain from '../folia-mods/sources/qq/main/index'
import activateClient from '../folia-mods/sources/qq/client/index'
import zhCN from '../folia-mods/sources/qq/locales/zh-CN.json'
import en from '../folia-mods/sources/qq/locales/en.json'
import inLocale from '../folia-mods/sources/qq/locales/in.json'
import vi from '../folia-mods/sources/qq/locales/vi.json'
import { createSourceHost } from '../folia-adapters/source-host/host'
import { isPureMusicLyricText } from '../folia/utils/lyrics/pureMusic'

export interface FoliaQqOptions {
  dir: string
  language?: string
  fetchImpl?: typeof fetch
}

export interface FoliaSourceModule {
  definition: Record<string, unknown> & { id: string, capabilities: Record<string, unknown> }
  call<T>(name: string, ...args: unknown[]): Promise<T>
  host: ReturnType<typeof createSourceHost>
  dispose(): Promise<void>
}

export const createFoliaQq = (options: FoliaQqOptions): FoliaSourceModule => {
  const host = createSourceHost({
    modId: 'qq',
    dir: options.dir,
    language: options.language,
    fetchImpl: options.fetchImpl,
    locales: { 'zh-CN': zhCN, en, id: inLocale, in: inLocale, vi },
  })
  activateMain(host.api as never)
  let definition: FoliaSourceModule['definition'] | null = null
  const facade = host.clientFacade({
    isPureMusicText: (text) => isPureMusicLyricText(text ?? null),
    onRegister: (definitions) => {
      const first = definitions[0] as FoliaSourceModule['definition'] | undefined
      if (first) definition = first
    },
  })
  const disposeClient = activateClient(facade as never)
  if (!definition) throw new Error('the QQ source registered no definition')
  return {
    definition,
    call: (name, ...args) => host.rpc.call(name, ...args),
    host,
    async dispose() {
      try {
        if (typeof disposeClient === 'function') disposeClient()
      } finally {
        await host.dispose()
      }
    },
  }
}
