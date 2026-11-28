/**
 * 「匹配歌词」的 Folia 算法 bundle 入口。
 *
 * 上游 utils/lyrics 下的匹配链（autoMatchBestLyric / lyricMatchSources / lyricSources /
 * matchScore / amllDbProvider …）逐字节镜像在 src/folia/utils/lyrics/，这里只做两件事：
 *   1. 把上游要的宿主接口（providerRegistry、crossSource）接到插件侧替身；
 *   2. 暴露上游的公开函数给 Host 调用。
 * 算法、阈值、超时、顺序全部来自镜像文件，本文件不写匹配逻辑。
 *
 * 产物：src/host/vendor/lyrics-folia/match.bundle.mjs。
 *
 * @module dsh-music-panel/folia-build/lyrics-match-host-entry
 */
import { configureAmllDb } from '../folia-adapters/lyrics-match/amll-db-provider'
import { setLyricsMatchParticipants } from '../folia-adapters/lyrics-match/cross-source'
import { registerLyricsMatchProvider } from '../folia-adapters/lyrics-match/provider-registry'
import { autoMatchBestLyric } from '../folia/utils/lyrics/autoMatchBestLyric'
import {
  fetchLyricsForMatchSource,
  getLyricSourceAccess,
  isLyricMatchSourceOffered,
  searchLyricsByMatchSource,
} from '../folia/utils/lyrics/lyricMatchSources'
import {
  getLyricSource,
  getLyricSourceIds,
  getPlatformLyricSource,
  LYRIC_SOURCES,
  registerLyricSource,
  registerLyricSourceAccess,
} from '../folia/utils/lyrics/lyricSources'
import { calculateMatchScore, calculateMatchScoreDetails } from '../folia/utils/lyrics/matchScore'
import { buildLyricSourceOrder, DEFAULT_PREFERRED_LYRIC_SOURCE } from '../folia/utils/lyrics/sourcePriority'
import { hasRenderableLyrics } from '../folia/utils/lyrics/validity'

export interface LyricsMatchSourceConfig {
  id: string
  /** 平台自己的曲库（可用作别的歌的歌词来源）；AMLL 这类不是。 */
  platform?: boolean
  /** 本地歌的元数据身份可以从这一家恢复匹配（Folia 的 localMetadataIdentity）。 */
  localMetadataIdentity?: boolean
  /** 只有登录后才作答。 */
  needsAccount?: boolean
  /** 只有逐行歌词、没有逐字。 */
  linesOnly?: boolean
  labelKey?: string
  /** 平台 provider（getOnlineMusicProvider 的那个对象）。 */
  provider?: unknown
  /** 该源自己的取法（Folia 的 registerLyricSourceAccess），一般给 AMLL 之外的平台用不到。 */
  access?: Record<string, unknown>
}

export interface LyricsMatchConfig {
  sources: LyricsMatchSourceConfig[]
  /** 当前能参与匹配的源 id（顺序即 fallback 顺序）；省略时取 sources 的顺序。 */
  ready?: string[]
}

/** 由 Host 在注册表变化时调用：把源、provider 与可参与名单交付给上游的匹配链。 */
export function configureLyricsMatch(config: LyricsMatchConfig): void {
  for (const source of config.sources) {
    registerLyricSource({
      id: source.id,
      labelKey: source.labelKey ?? 'lyricProvider.' + source.id,
      platform: source.platform !== false,
      ...(source.localMetadataIdentity === true ? { localMetadataIdentity: true } : {}),
      ...(source.needsAccount === true ? { needsAccount: true } : {}),
      ...(source.linesOnly === true ? { linesOnly: true } : {}),
    } as never)
    if (source.provider) registerLyricsMatchProvider(source.id, source.provider as never)
    if (source.access) registerLyricSourceAccess(source.id, source.access as never)
  }
  setLyricsMatchParticipants(config.ready ?? config.sources.map((source) => source.id))
}

export {
  configureAmllDb,
  autoMatchBestLyric,
  calculateMatchScore,
  calculateMatchScoreDetails,
  fetchLyricsForMatchSource,
  getLyricSourceAccess,
  isLyricMatchSourceOffered,
  searchLyricsByMatchSource,
  getLyricSource,
  getLyricSourceIds,
  getPlatformLyricSource,
  LYRIC_SOURCES,
  buildLyricSourceOrder,
  DEFAULT_PREFERRED_LYRIC_SOURCE,
  hasRenderableLyrics,
}
