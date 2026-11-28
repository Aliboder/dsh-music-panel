/**
 * 网易云音乐：Folia 音源模组的移植源。
 *
 * 与其它三个平台同一套；不同的是它的后端（@neteasecloudmusicapienhanced/api）跑在工作线程里，
 * 线程是 bundle 旁边的 worker.cjs，由上游 main 入口在加载时就拉起。停用时 dispose() 结束线程。
 *
 * @module dsh-music-panel/sources/netease-folia
 */
import { createFoliaNetease } from '../../../vendor/netease-folia/source.bundle.mjs'
import { createFoliaSource } from '../folia-bridge/bridge.js'

export const SOURCE_ID = 'netease'

let current = null

export function configureNeteaseFolia(options = {}) {
  current = createFoliaNetease({ dir: options.dir, language: options.language || 'zh-CN' })
  return current
}

export function neteaseFolia() {
  if (current === null) throw new Error('网易云音源尚未初始化')
  return current
}

export function createNeteaseFoliaSource() {
  const module = neteaseFolia()
  return createFoliaSource({
    definition: module.definition,
    sourceId: SOURCE_ID,
    texts: module.host.texts,
    displayName: 'NetEase Cloud Music',
    qualityLevels: ['standard', 'high', 'lossless', 'hires'],
  })
}

export async function disposeNeteaseFolia() {
  const module = current
  current = null
  if (module) await module.dispose()
}

export function resetNeteaseFolia() {
  current = null
}
