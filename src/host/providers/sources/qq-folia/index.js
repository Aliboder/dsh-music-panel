/**
 * QQ 音乐：Folia 音源模组的移植源。
 *
 * 与波点/汽水同一套：bundle 里跑上游 main/client 入口（main 里第一次问 `status` 时才拉起内嵌的
 * qq-music-api），定义交给 folia-bridge。停用时调 dispose()：先让上游的 client 入口收尾，再跑
 * onBeforeUnload / onBeforeQuit（上游在那里关掉后端）。
 *
 * @module dsh-music-panel/sources/qq-folia
 */
import { createFoliaQq } from '../../../vendor/qq-folia/source.bundle.mjs'
import { createFoliaSource } from '../folia-bridge/bridge.js'

export const SOURCE_ID = 'qq'

let current = null

export function configureQqFolia(options = {}) {
  current = createFoliaQq({ dir: options.dir, language: options.language || 'zh-CN' })
  return current
}

export function qqFolia() {
  if (current === null) throw new Error('QQ 音乐音源尚未初始化')
  return current
}

export function createQqFoliaSource() {
  const module = qqFolia()
  return createFoliaSource({
    definition: module.definition,
    sourceId: SOURCE_ID,
    texts: module.host.texts,
    displayName: 'QQ Music',
    qualityLevels: ['standard', 'high', 'lossless', 'hires'],
  })
}

/** 停用：关掉上游内嵌的后端。 */
export async function disposeQqFolia() {
  const module = current
  current = null
  if (module) await module.dispose()
}

export function resetQqFolia() {
  current = null
}
