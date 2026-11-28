/**
 * 酷狗音源 Host bundle 的入口。
 *
 * 上游两个入口原样 import 进来（sources/kugou/main/index.ts 与 client/index.ts），中间只换宿主面：
 * 它们的 activate(api) / activate(folium) 拿到的对象由 src/folia-adapters/kugou 提供。
 * 上游 core 的 createSource 也被 client 入口原样调用，所以这里不复制任何一行上游逻辑。
 *
 * 产物：src/host/vendor/kugou-folia/source.bundle.mjs（scripts/build-kugou-folia.mjs）。
 *
 * @module dsh-music-panel/folia-build/kugou-host-entry
 */
import activateMain from '../folia-mods/sources/kugou/main/index'
import activateClient from '../folia-mods/sources/kugou/client/index'
import { KUGOU_OPERATIONS } from '../folia-mods/sources/kugou/core/index'
import { createClientFacade, createFoliaKugouHost, type FoliaKugouHost, type FoliaKugouHostOptions } from '../folia-adapters/kugou/host'
import { isPureMusicLyricText } from '../folia/utils/lyrics/pureMusic'

export { KUGOU_OPERATIONS }
export type { FoliaKugouHost, FoliaKugouHostOptions }

/** 上游音源定义里本插件会用到的形状（其余成员按需读，不在这里穷举）。 */
export interface KugouSourceDefinition {
  id: string
  displayName?: string
  shortName?: unknown
  capabilities: Record<string, Record<string, unknown> | boolean | undefined>
  getAvailability?: () => { configured: boolean; reason?: string }
  [key: string]: unknown
}

export interface FoliaKugou {
  /** 上游注册进来的音源定义（capabilities 就是它的公开契约）。 */
  definition: KugouSourceDefinition
  /** 上游 client → main 的那条 rpc（`request` / `anonymousSearch` / `legacyPlayInfo`）。 */
  call<T>(name: string, ...args: unknown[]): Promise<T>
  host: FoliaKugouHost
}

/** 起一份酷狗音源：登记 main 入口的 rpc，再让 client 入口把定义注册进来。 */
export const createFoliaKugou = (options: FoliaKugouHostOptions): FoliaKugou => {
  const host = createFoliaKugouHost(options)
  activateMain(host.api as never)
  let definition: KugouSourceDefinition | null = null
  const facade = createClientFacade({
    modId: 'kugou',
    host,
    isPureMusicText: text => isPureMusicLyricText(text ?? null),
    onRegister: definitions => {
      const first = definitions[0] as KugouSourceDefinition | undefined
      if (first) definition = first
    },
  })
  activateClient(facade as never)
  if (!definition) throw new Error('the KuGou source registered no definition')
  return { definition, call: (name, ...args) => host.rpc.call(name, ...args), host }
}
