/**
 * api.net：上游取数据用的两种请求。
 *
 * 桌面版是 Electron 的 net（Chromium 网络栈）。插件里换成 Node：
 *   - `fetch`：a web fetch，Node 自带；
 *   - `request`：Electron 的 ClientRequest（波点要用 GET 带 JSON 正文，web fetch 发不了），
 *     这里用 node:http/https 的 ClientRequest 顶上——它本来就有 on('response') / setHeader / end / destroy，
 *     上游包正是按这几个方法用的。
 *
 * @module dsh-music-panel/folia-adapters/source-host/net
 */
import http from 'node:http'
import https from 'node:https'

/** 上游把 Electron 的默认超时当成 15 s；Node 没有默认，这里补上。 */
const FETCH_TIMEOUT_MS = 15_000

export interface SourceNet {
  fetch(url: string, init?: Record<string, unknown>): Promise<Response>
  request(options: Record<string, unknown>): unknown
}

export const createNet = (options: { fetchImpl?: typeof fetch } = {}): SourceNet => {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  return {
    async fetch(url, init = {}) {
      const { session: _session, ...rest } = init
      const timeout = AbortSignal.timeout(FETCH_TIMEOUT_MS)
      const signal = rest.signal === undefined ? timeout : AbortSignal.any([rest.signal as AbortSignal, timeout])
      return fetchImpl(String(url), { ...rest, signal } as RequestInit)
    },
    request(requestOptions) {
      const url = new URL(String(requestOptions.url))
      const method = String(requestOptions.method ?? 'GET').toUpperCase()
      const headers = requestOptions.headers && typeof requestOptions.headers === 'object'
        ? requestOptions.headers as Record<string, string>
        : undefined
      const transport = url.protocol === 'https:' ? https : http
      return transport.request(url, { method, ...(headers === undefined ? {} : { headers }) })
    },
  }
}
