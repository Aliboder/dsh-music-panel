/**
 * api.media：宿主侧的媒体规则与媒体路由。
 *
 * 桌面版这是 Electron 的跨域头注入 + folia-mod:// 媒体协议；插件的播放器只经 Host 的
 * /music/online/stream 代理取流，浏览器从不直接访问平台域，所以：
 *   - `allow` 照收上游给的规则（hosts / test / followRedirects / ttlMs / resourceTypes），只回一个
 *     可撤销、可 add 的登记对象——真正的放行在 Host 的取流层；
 *   - `serve` / `url` 是给「音源自己签发媒体地址」的平台用的（酷狗/波点/QQ 等），本插件不走那条路，
 *     碰到就抛错，避免静默把地址交出去。
 *
 * @module dsh-music-panel/folia-adapters/source-host/media
 */
import { MusicError } from '../../host/services/core/errors.js'

export interface MediaAllowRule {
  hosts?: readonly string[]
  test?: (request: unknown) => boolean
  followRedirects?: boolean
  ttlMs?: number
  resourceTypes?: readonly string[]
}

export interface AllowedMedia {
  (): void
  add(url: string): void
}

const notServed = (what: string) => {
  throw new MusicError('这个音源不需要宿主媒体路由（' + what + '）', { code: 'unavailable' })
}

export const createMedia = () => ({
  allow(_rule: MediaAllowRule): AllowedMedia {
    const allowed = (() => {}) as AllowedMedia
    allowed.add = () => {}
    return allowed
  },
  parseRange(header: string | null | undefined, size: number) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(String(header ?? '').trim())
    if (match === null) return null
    const start = match[1] === '' ? size - Number(match[2]) : Number(match[1])
    const end = match[1] === '' || match[2] === '' ? size - 1 : Number(match[2])
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start) return 'unsatisfiable' as const
    return { start, end: Math.min(end, size - 1) }
  },
  serve(name: string) {
    notServed('serve ' + name)
    return () => {}
  },
  url(name: string, rest = '') {
    notServed('url ' + name)
    return 'folia-mod://' + name + '/' + rest
  },
})
