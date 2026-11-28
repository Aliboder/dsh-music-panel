/**
 * 旧「酷狗本地服务」那几项在移植源里的对应物。
 *
 * 以前酷狗是两个 worker（标准版/概念版），路由能查状态、能重启、能定时校验登录。
 * 移植源把 KuGouMusicApi 直接跑在 Host 里（bundle 内），没有可启停的服务：
 *   - 状态恒为 running（模块在插件启动时就装好了）；
 *   - 重启没有意义，答同一份状态；
 *   - 登录态校验就是读一次上游账号（读不到就当没登录）。
 *
 * @module dsh-music-panel/sources/kugou-folia/status
 */
import { kugouDefinition, kugouError, kugouUserId } from './instance.js'

/** 与旧 kugouServiceStatus 同形状：{ running, starting, error }。 */
export async function kugouServiceStatus() {
  return { running: true, starting: false, error: null }
}

/** 与旧 restartKugouService 同形状。 */
export async function restartKugouService() {
  return await kugouServiceStatus()
}

/** 读一次上游账号；成功返回账号，未登录或读不到返回 null（调用方按「没有账号」处理）。 */
export async function refreshKugouAccount() {
  // 没有账号提示就没有可刷新的账号：不为此发一次 user_detail。
  if (kugouUserId() === '') return null
  try {
    return await kugouDefinition().capabilities['auth@1'].getLoginStatus()
  } catch (error) {
    const translated = kugouError(error)
    if (translated.code === 'auth-required') return null
    return null
  }
}
