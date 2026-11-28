/**
 * 汽水音源 Host bundle 的入口。
 *
 * 上游两个入口原样 import（sources/qishui/main/index.ts 与 client/index.ts），宿主面用四平台共用的
 * src/folia-adapters/source-host。产物：src/host/vendor/qishui-folia/source.bundle.mjs。
 *
 * @module dsh-music-panel/folia-build/qishui-host-entry
 */
import activateMain from '../../folia/sources/qishui/main/index'
import activateClient from '../../folia/sources/qishui/client/index'
import zhCN from '../../folia/sources/qishui/locales/zh-CN.json'
import en from '../../folia/sources/qishui/locales/en.json'
import inLocale from '../../folia/sources/qishui/locales/in.json'
import vi from '../../folia/sources/qishui/locales/vi.json'
import { createSourceHost } from '../folia-adapters/source-host/host'
import { isPureMusicLyricText } from '../../folia/src/utils/lyrics/pureMusic'

export interface FoliaQishuiOptions {
  dir: string
  language?: string
  fetchImpl?: typeof fetch
}

export interface FoliaSourceModule {
  definition: Record<string, unknown> & { id: string, capabilities: Record<string, unknown> }
  call<T>(name: string, ...args: unknown[]): Promise<T>
  host: ReturnType<typeof createSourceHost>
}

export const createFoliaQishui = (options: FoliaQishuiOptions): FoliaSourceModule => {
  const host = createSourceHost({
    modId: 'qishui',
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
  activateClient(facade as never)
  if (!definition) throw new Error('the Qishui source registered no definition')
  return { definition, call: (name, ...args) => host.rpc.call(name, ...args), host }
}
