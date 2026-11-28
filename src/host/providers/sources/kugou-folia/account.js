/**
 * 登录、账号与会员：门面的 loginStart / loginStatus / vip / profile 等。
 *
 * 上游把账号放在自己的会话仓库里（主入口的 bridge 用 api.legacy.store + api.seal 加密存），
 * 二维码四个状态由 auth@1.checkLogin 直接给（expired / waiting / scanned / confirmed / error），
 * 所以这里只做词汇与信封的翻译，不碰凭据。
 *
 * 本插件原来的会话文件（sessions.json 里的 kugouLite 那几项）从这次起不再写；登录态只在上游桥里。
 *
 * @module dsh-music-panel/sources/kugou-folia/account
 */
import { MusicError } from '../../../services/core/errors.js'
import { SOURCE_ID, kugouCall, kugouDefinition, kugouError } from './instance.js'

const auth = () => kugouDefinition().capabilities['auth@1']

/** 上游的二维码状态 → 本插件登录页认的五个词。 */
const STATUS_OF_STATE = {
  expired: 'expired',
  waiting: 'waiting',
  scanned: 'scanned',
  confirmed: 'success',
  error: 'failed',
}

const MESSAGE_OF_STATE = {
  expired: '二维码已过期',
  waiting: '等待扫码中',
  scanned: '已扫码，请在酷狗音乐中确认',
  confirmed: '登录成功',
}

/** 上游 createQr 交回的可以是 data: URL、http 地址或裸 base64；按形状放进门面两个字段。 */
function qrOf(value) {
  const text = String(value ?? '')
  if (text.startsWith('data:')) return { imageDataUrl: text, url: '' }
  if (/^https?:\/\//i.test(text)) return { imageDataUrl: '', url: text }
  if (text === '') return { imageDataUrl: '', url: '' }
  return { imageDataUrl: 'data:image/png;base64,' + text, url: '' }
}

/** 开始一次扫码登录：先要二维码的 key，再要图。 */
export async function loginStart(provider, session = {}, mode = 'qq') {
  try {
    const key = await auth().startLogin()
    if (!key) throw new MusicError('酷狗音乐没有给出二维码', { code: 'invalid-response', sourceId: SOURCE_ID })
    const image = await auth().createQr(key)
    return { key, ...qrOf(image), expiresAt: 0 }
  } catch (error) {
    throw kugouError(error)
  }
}

/** 轮询一次扫码结果；成功时把账号一并交回（凭据留在上游桥里）。 */
export async function loginStatus(provider, key, mode = 'qq') {
  try {
    const result = await auth().checkLogin(String(key))
    const state = String(result?.state ?? 'error')
    const status = STATUS_OF_STATE[state] ?? 'failed'
    if (status !== 'success') {
      return {
        status,
        message: MESSAGE_OF_STATE[state] ?? String(result?.message ?? '状态未知'),
        ...(result?.failure ? { case: String(result.failure) } : {}),
        cookie: '',
        token: '',
        userid: '',
      }
    }
    // 确认之后立刻读一次账号，登录页就能显示昵称与头像（读不到也不影响这次登录）。
    let user = null
    try {
      user = await auth().getLoginStatus()
    } catch {
      user = null
    }
    return {
      status: 'success',
      message: MESSAGE_OF_STATE.confirmed,
      cookie: '',
      token: '',
      userid: String(user?.id ?? ''),
      nickname: String(user?.nickname ?? ''),
      avatarUrl: String(user?.avatarUrl ?? ''),
      vipType: Number(user?.vipType) || 0,
      vipToken: '',
      platform: 'kugou',
    }
  } catch (error) {
    throw kugouError(error)
  }
}

/** 登录着的账号；没登录时 null。 */
export async function providerProfile() {
  try {
    const user = await auth().getLoginStatus()
    if (!user) return null
    return {
      nickname: String(user.nickname ?? ''),
      avatarUrl: String(user.avatarUrl ?? ''),
      accountId: String(user.id ?? ''),
      vipType: Number(user.vipType) || 0,
    }
  } catch (error) {
    // 「未登录」不是失败：路由把它读成没有账号，而不是把音源标成不可用。
    if (error?.code === 'auth-required') return null
    throw kugouError(error)
  }
}

/** 是不是会员：上游把会员档位放在账号的 vipType 上。 */
export async function providerVip() {
  const profile = await providerProfile()
  if (!profile) return null
  return Number(profile.vipType) > 0
}

/** 会员信息：上游只给档位不给到期时间，到期时间如实答 0。 */
export async function providerVipInfo() {
  const profile = await providerProfile()
  if (!profile) return { vip: false, expiresAt: 0 }
  return { vip: Number(profile.vipType) > 0, expiresAt: 0 }
}

/**
 * 设备标识：从这次起由上游桥自己管（dfid/mid 都在它的会话里），门面这一项只是路由的分支形状。
 * 路由只在 session.mid 为空时来要一次，拿到一个非空标记就不会再走「未登录、补设备」那一段。
 */
export function createKugouDevice() {
  return { mid: 'folia-bridge', dfid: '', guid: '' }
}

/** 登出：上游桥清掉自己的会话与账号缓存。 */
export async function logout() {
  try {
    const fn = auth().logout
    if (typeof fn === 'function') await fn()
    return true
  } catch (error) {
    throw kugouError(error)
  }
}

/** 忘记 token：上游的会话就是凭据，等同一次登出。 */
export function forgetProviderTokens() {
  return true
}

/** 上游有登录通道时，rpc 名里会有 login_qr_key 一类操作；测试用它确认接线。 */
export const KUGOU_LOGIN_OPERATIONS = ['login_qr_key', 'login_qr_create', 'login_qr_check']

export { kugouCall }
