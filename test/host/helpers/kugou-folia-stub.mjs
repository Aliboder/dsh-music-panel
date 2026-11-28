/**
 * 酷狗移植源的测试替身。
 *
 * 移植源的真实实现要连网（KuGouMusicApi），单元测试只给它一个定义：能力族由用例按需给，
 * 没给的族一律抛「用例没实现这个族」，免得测试悄悄跑到真的分支上。
 *
 * 用法：
 *   installKugouFoliaStub({ catalog: { getListeningRankTracks: async () => ({ items: [...], hasMore: false }) } })
 *   ... 用例 ...   finally { resetKugouFolia() }
 */
import { resetKugouFolia, useKugouFoliaForTests } from '../../../src/host/providers/sources/kugou-folia/instance.js'

const FAMILIES = [
  'search@1', 'songs@1', 'playback.audio@1', 'lyrics@1', 'auth@1',
  'library@1', 'catalog@1', 'recommendations@1', 'mutations@1',
]

/** 一个能力族：给了就用，没给的方法现抛。 */
function familyOf(name, given) {
  const methodNames = new Set(Object.keys(given ?? {}))
  return new Proxy({ ...(given ?? {}) }, {
    get(target, property) {
      if (property in target) return target[property]
      if (typeof property !== 'string') return undefined
      return () => {
        throw new Error('stub has no implementation for ' + name + '.' + property)
      }
    },
    has() { return true },
  })
}

export function installKugouFoliaStub(definition = {}) {
  const capabilities = {}
  for (const family of FAMILIES) capabilities[family] = familyOf(family, definition[family])
  const source = {
    id: definition.id ?? 'kugou',
    displayName: 'KuGou Music',
    shortName: '酷狗',
    capabilities,
    getAvailability: () => ({ configured: true }),
  }
  useKugouFoliaForTests(source)
  return source
}

export { resetKugouFolia }
