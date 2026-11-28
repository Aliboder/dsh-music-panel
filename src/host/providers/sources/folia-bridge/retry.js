/**
 * 会话凭据过期时的「续期一次再重试」：给上游定义套一层。
 *
 * 汽水的 ticket guard 约 6 小时过期（错误码 28001008）。上游 qishui-music-api 只在 login_status 里续期，
 * 上游音源模组也没有「失败 → 续期 → 重放」这一步（它靠宿主读账号时顺带续期）；本插件原来的实现在
 * qishui/index.js 里自己做这一步。原样移植之后这层会丢，所以在映射层补回来：
 * 某个能力族的方法报出「凭据过期」时，先读一次账号（等于续期），再重试一次；第二次失败照常抛出。
 *
 * 这是唯一一处「上游没有、我们必须加」的行为，写在这里而不是改镜像。
 *
 * @module dsh-music-panel/sources/folia-bridge/retry
 */

/** 能力族对象里每个函数都包一层；非函数成员原样带上。 */
const retryingFamily = (family, retry) => {
  if (!family || typeof family !== 'object') return family
  const wrapped = {}
  for (const [name, value] of Object.entries(family)) {
    wrapped[name] = typeof value === 'function'
      ? (...args) => retry(() => value.apply(family, args))
      : value
  }
  return wrapped
}

/**
 * @param {{ capabilities?: Record<string, unknown> }} definition 上游定义
 * @param {{ shouldRefresh: (error: unknown) => boolean, refresh: () => Promise<unknown> }} options
 */
export function withAuthRetry(definition, options) {
  if (!definition || typeof definition !== 'object') return definition
  const capabilities = {}
  for (const [familyName, family] of Object.entries(definition.capabilities ?? {})) {
    capabilities[familyName] = retryingFamily(family, async (run) => {
      try {
        return await run()
      } catch (error) {
        if (!options.shouldRefresh(error)) throw error
        try { await options.refresh() } catch { throw error }
        return await run()
      }
    })
  }
  return { ...definition, capabilities }
}
