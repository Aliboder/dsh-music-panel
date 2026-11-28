/**
 * `@folia/source-deps` 的插件侧替身。
 *
 * 桌面版里它指向音源模组的 deps 归档（asar）——模组用 `depsRequire.resolve(...)` 找到钉死的上游包目录，
 * 再把那个目录交给工作线程。插件没有归档，包就装在插件的 node_modules 里，所以这里用 bundle 自己的
 * `createRequire` 即可：`resolve` 出来的目录就是 node_modules 下的真实目录。
 *
 * @module dsh-music-panel/folia-adapters/source-host/source-deps
 */
import { createRequire } from 'node:module'

const requireHere = createRequire(import.meta.url)

/** 与 Electron 归档里的 require 同形：可调用，也有 resolve / cache。 */
export const depsRequire = Object.assign(
  (request: string) => requireHere(request) as unknown,
  { resolve: (request: string) => requireHere.resolve(request), cache: requireHere.cache },
)
