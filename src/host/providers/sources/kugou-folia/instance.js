/**
 * 移植过来的酷狗音源在本插件里的唯一实例。
 *
 * bundle（src/host/vendor/kugou-folia/source.bundle.mjs）导出 createFoliaKugou：上游的 main 入口与 client
 * 入口原样跑一遍，交回音源定义与那条 rpc。这个文件只负责生命周期与错误翻译：
 *   - 插件启动时 registerKugouSource 调 configureKugouFolia({ dir })，dir 是插件数据目录；
 *   - 门面（providers/index.js）的酷狗分支经 kugouDefinition() 取能力，经 kugouCall() 走 rpc；
 *   - 上游的 SourceError 带 code/httpStatus/retryAfterMs，这里翻成本插件的 MusicError，路由照旧读 code。
 *
 * @module dsh-music-panel/sources/kugou-folia/instance
 */
import { createFoliaKugou } from '../../../vendor/kugou-folia/source.bundle.mjs'
import { MusicError, toMusicError } from '../../../services/core/errors.js'

/** 客户端与路由看到的源 id：沿用插件里的 kugouLite，存下来的歌、歌单、历史都认它。 */
export const SOURCE_ID = 'kugouLite'

let current = null

/** 插件启动时调一次；dir 是插件数据目录（会话、页面存储、密钥都落在这里）。 */
export function configureKugouFolia(options = {}) {
  current = createFoliaKugou({ dir: options.dir, language: options.language || 'zh-CN' })
  return current
}

/** 现在的实例；没初始化就报「音源没起来」，与未加载的源一致。 */
export function kugouFolia() {
  if (current === null) throw new MusicError('酷狗音源尚未初始化', { code: 'unavailable', sourceId: SOURCE_ID })
  return current
}

/** 上游的音源定义（能力族都在它的 capabilities 上）。 */
export function kugouDefinition() {
  return kugouFolia().definition
}

/** 上游 client→main 的 rpc（request / anonymousSearch / legacyPlayInfo）。 */
export function kugouCall(name, ...args) {
  return kugouFolia().call(name, ...args)
}

/** 上游宿主面的文案表：把 FoliumText 解析成当前语言的字符串。 */
export function kugouTexts() {
  return kugouFolia().host.texts
}

/**
 * 上游的错 → 本插件的错。上游 code 与 MusicError 的 code 是同一套词汇
 * （auth-required / rate-limited / not-playable / network / timeout / unavailable / not-configured），
 * 原样保留；没有 code 的按 toMusicError 的规则归类。
 */
export function kugouError(error) {
  if (error instanceof MusicError) return error
  const code = typeof error?.code === 'string' ? error.code : ''
  if (code !== '') {
    return new MusicError(error.message || code, {
      code,
      sourceId: SOURCE_ID,
      retryAfterMs: Number(error.retryAfterMs) || 0,
      status: Number(error.httpStatus) || 0,
      cause: error,
    })
  }
  return toMusicError(error, SOURCE_ID)
}

/** 测试用：丢掉当前实例。 */
export function resetKugouFolia() {
  current = null
}
