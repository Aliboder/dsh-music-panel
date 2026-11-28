/**
 * 网易云音源 Host bundle 的入口。
 *
 * 上游两个入口原样 import；宿主面除了四平台共用的 source-host，还用到 rpc.send、diagnostics、
 * reportError、onBeforeUnload/onBeforeQuit 与 @folia/source-deps（构建时别名到 source-host/source-deps.ts）。
 * main 入口一加载就开工作线程并拉起网易云 API，所以这里一 import 就会启动它。
 *
 * 产物：src/host/vendor/netease-folia/source.bundle.mjs，外加同目录的 worker.cjs 与它 require 的兄弟文件
 * （由 scripts/build-folia-source.mjs 从镜像复制）。
 *
 * @module dsh-music-panel/folia-build/netease-host-entry
 */
import activateMain from '../../folia/sources/netease/main/index'
import activateClient from '../../folia/sources/netease/client/index'
import zhCN from '../../folia/sources/netease/locales/zh-CN.json'
import en from '../../folia/sources/netease/locales/en.json'
import inLocale from '../../folia/sources/netease/locales/in.json'
import vi from '../../folia/sources/netease/locales/vi.json'
import { createSourceHost } from '../folia-adapters/source-host/host'
import { isPureMusicLyricText } from '../../folia/src/utils/lyrics/pureMusic'

export interface FoliaNeteaseOptions {
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

export const createFoliaNetease = (options: FoliaNeteaseOptions): FoliaSourceModule => {
  const host = createSourceHost({
    modId: 'netease',
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
  if (!definition) throw new Error('the NetEase source registered no definition')
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
