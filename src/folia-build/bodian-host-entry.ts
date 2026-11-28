/**
 * 波点音源 Host bundle 的入口。
 *
 * 上游两个入口原样 import（sources/bodian/main/index.ts 与 client/index.ts），中间只换宿主面：
 * 它们拿到的 api / folium 由 src/folia-adapters/source-host 提供（四个平台共用）。
 *
 * 产物：src/host/vendor/bodian-folia/source.bundle.mjs。
 *
 * @module dsh-music-panel/folia-build/bodian-host-entry
 */
import activateMain from '../../folia/sources/bodian/main/index'
import activateClient from '../../folia/sources/bodian/client/index'
import zhCN from '../../folia/sources/bodian/locales/zh-CN.json'
import en from '../../folia/sources/bodian/locales/en.json'
import inLocale from '../../folia/sources/bodian/locales/in.json'
import vi from '../../folia/sources/bodian/locales/vi.json'
import { createSourceHost } from '../folia-adapters/source-host/host'
import { isPureMusicLyricText } from '../../folia/src/utils/lyrics/pureMusic'

export interface FoliaBodianOptions {
  dir: string
  language?: string
  fetchImpl?: typeof fetch
}

export interface FoliaSourceModule {
  definition: Record<string, unknown> & { id: string, capabilities: Record<string, unknown> }
  call<T>(name: string, ...args: unknown[]): Promise<T>
  host: ReturnType<typeof createSourceHost>
}

export const createFoliaBodian = (options: FoliaBodianOptions): FoliaSourceModule => {
  const host = createSourceHost({
    modId: 'bodian',
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
  if (!definition) throw new Error('the Bodian source registered no definition')
  return { definition, call: (name, ...args) => host.rpc.call(name, ...args), host }
}
