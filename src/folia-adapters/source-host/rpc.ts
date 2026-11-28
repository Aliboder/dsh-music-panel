/**
 * folium.rpc / api.rpc：上游 client 入口与 main 入口之间那条调用通道。
 *
 * 桌面版两端在不同进程里；插件两端都在 Host，所以这里就是一张名字到函数的表。规则与上游一致：
 * 名字匹配 /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/，同名第二次登记抛错。beforeCall 用来在每次真正调用前挂
 * 包需要的全局补丁（KuGouMusicApi 的 generateWebGLHash 就是这种）。
 *
 * @module dsh-music-panel/folia-adapters/source-host/rpc
 */
const NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/

export interface RpcRegistry {
  handle(name: string, handler: (...args: unknown[]) => unknown): void
  call<T>(name: string, ...args: unknown[]): Promise<T>
  names(): string[]
}

export const createRpcRegistry = (options: { beforeCall?: () => void } = {}): RpcRegistry => {
  const handlers = new Map<string, (...args: unknown[]) => unknown>()
  return {
    handle(name, handler) {
      if (typeof name !== 'string' || !NAME_PATTERN.test(name)) throw new TypeError('rpc: a name like /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/')
      if (typeof handler !== 'function') throw new TypeError('rpc: a function')
      if (handlers.has(name)) throw new Error('rpc: a handler is already registered for ' + name)
      handlers.set(name, handler)
    },
    async call<T>(name: string, ...args: unknown[]): Promise<T> {
      options.beforeCall?.()
      const handler = handlers.get(name)
      if (!handler) throw new Error('rpc: no handler for ' + name)
      return (await handler(...args)) as T
    },
    names() { return [...handlers.keys()] },
  }
}
