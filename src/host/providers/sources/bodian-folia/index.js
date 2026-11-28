/**
 * 波点：Folia 音源模组的移植源（注册在源注册表里的那个对象）。
 *
 * 上游 folia/sources/bodian 的 main/client 入口原样跑在 bundle 里（src/host/vendor/bodian-folia），
 * 这里只做三件事：起一个实例、把定义交给共用映射（folia-bridge）、登记进注册表。
 * 平台逻辑一行都不在本文件里。
 *
 * @module dsh-music-panel/sources/bodian-folia
 */
import { createFoliaBodian } from '../../../vendor/bodian-folia/source.bundle.mjs'
import { createFoliaSource } from '../folia-bridge/bridge.js'

export const SOURCE_ID = 'bodian'

let current = null

/** 起一次实例（插件启动时调一次）。 */
export function configureBodianFolia(options = {}) {
  current = createFoliaBodian({ dir: options.dir, language: options.language || 'zh-CN' })
  return current
}

export function bodianFolia() {
  if (current === null) throw new Error('波点音源尚未初始化')
  return current
}

/** 注册表要的源对象。 */
export function createBodianFoliaSource() {
  const module = bodianFolia()
  return createFoliaSource({
    definition: module.definition,
    sourceId: SOURCE_ID,
    texts: module.host.texts,
    displayName: 'Bodian Music',
    qualityLevels: ['original'],
  })
}

/** 测试用。 */
export function resetBodianFolia() {
  current = null
}
