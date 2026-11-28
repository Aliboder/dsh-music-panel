/**
 * 汽水：Folia 音源模组的移植源（注册在源注册表里的那个对象）。
 *
 * 与波点同一套：bundle 里跑上游 main/client 入口，映射交给 folia-bridge。唯一多出的一层是
 * ticket guard 续期——上游模组没有「失败 → 续期 → 重放」，而这层原来在我方实现里（踩坑 123），
 * 所以给定义套上 withAuthRetry：报出 28001008 或 auth-required 时读一次账号再重试一次。
 *
 * @module dsh-music-panel/sources/qishui-folia
 */
import { createFoliaQishui } from '../../../vendor/qishui-folia/source.bundle.mjs'
import { createFoliaSource } from '../folia-bridge/bridge.js'
import { withAuthRetry } from '../folia-bridge/retry.js'

export const SOURCE_ID = 'qishui'

// The ticket guard of the car-machine client lapses about every six hours.
const GUARD_CODE = /28001008/

let current = null

export function configureQishuiFolia(options = {}) {
  current = createFoliaQishui({ dir: options.dir, language: options.language || 'zh-CN' })
  return current
}

export function qishuiFolia() {
  if (current === null) throw new Error('汽水音源尚未初始化')
  return current
}

export function createQishuiFoliaSource() {
  const module = qishuiFolia()
  const definition = withAuthRetry(module.definition, {
    shouldRefresh: (error) => Boolean(error) && (error.code === 'auth-required' || GUARD_CODE.test(String(error.message ?? ''))),
    // 读一次账号等于让包续期（包的续期只挂在 login_status 上）。
    refresh: () => module.definition.capabilities['auth@1'].getLoginStatus(),
  })
  return createFoliaSource({
    definition,
    sourceId: SOURCE_ID,
    texts: module.host.texts,
    displayName: 'Qishui Music',
    qualityLevels: ['standard', 'high', 'lossless'],
  })
}

export function resetQishuiFolia() {
  current = null
}
