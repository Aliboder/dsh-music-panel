/**
 * 上游 KuGouMusicApi 的加载前置：把仓库里 vendor 的那份接到 ESM 运行时上。
 *
 * 上游 main 入口自己 `await import('kugoumusicapi')`（桌面版从 asar 装的那个包加载）。插件的这份
 * 在 `src/host/vendor/kugoumusicapi`（与上游 v1.6.0 逐字节相同，只少了仓库自带的 Docker/文档文件），
 * bundle 里那条 import 被构建脚本改写成相对路径 `../kugoumusicapi/main.js`，装到 profile 里也还是同一相对位置。
 *
 * 还有一件事不能少：包里的 `util/generate_simulate.js` 直接调用 `generateWebGLHash` 却没 import 它，
 * 桌面宿主启动时会先把这个函数挂到 globalThis（插件原来的 kugou worker 也是这么做的）。这里照做，
 * 并且在第一次 rpc 之前挂好——包本身是懒加载的，挂早挂晚没有代价。
 *
 * @module dsh-music-panel/folia-adapters/kugou/packageReady
 */
import { createRequire } from 'node:module'

const requireHere = createRequire(import.meta.url)

let ready = false

/** 幂等；包不存在时什么也不做，让桥自己按 api=unloaded 报错。 */
export const ensureKugouPackageReady = (): void => {
  if (ready) return
  ready = true
  try {
    const util = requireHere('../kugoumusicapi/util/util.js') as { generateWebGLHash?: () => string }
    const global = globalThis as { generateWebGLHash?: () => string }
    if (typeof util?.generateWebGLHash === 'function' && typeof global.generateWebGLHash !== 'function') {
      global.generateWebGLHash = util.generateWebGLHash
    }
  } catch {
    // 没有这份包时桥会在第一次请求时报 api=unloaded，界面读成「本地服务没在跑」，比这里抛错更接近上游。
  }
}
