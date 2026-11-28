/**
 * `services/onlineMusic/providerRegistry` 的插件侧替身。
 *
 * 上游的匹配链按 provider id 取平台：`search.searchSongs(query, limit, offset)`、
 * `lyrics.getLyrics(song)`、`lyrics.getChorusRanges(songId)`、`lyrics.prefersOwnWordByWord`。
 * 插件里这些能力在源注册表（omni）后面，所以这里只留一张 id → provider 的表，
 * 由 Host 侧在启动时按注册表填进来。匹配算法本身一行不改。
 *
 * @module dsh-music-panel/folia-adapters/lyrics-match/provider-registry
 */

export interface LyricsMatchProvider {
  search?: {
    searchSongs(query: string, limit: number, offset: number): Promise<{ items?: unknown[] } | null | undefined>
  }
  lyrics?: {
    getLyrics(song: unknown): Promise<unknown> | unknown
    getChorusRanges?(songId: number | string): Promise<unknown> | unknown
    prefersOwnWordByWord?: boolean
  }
}

const providers = new Map<string, LyricsMatchProvider>()

/** 登记/替换一个平台的 provider；返回撤销函数。 */
export const registerLyricsMatchProvider = (id: string, provider: LyricsMatchProvider): (() => void) => {
  providers.set(String(id), provider)
  return () => { if (providers.get(String(id)) === provider) providers.delete(String(id)) }
}

export const getOnlineMusicProvider = (id: unknown): LyricsMatchProvider | undefined => (
  providers.get(String(id ?? ''))
)

export const listOnlineMusicProviders = (): LyricsMatchProvider[] => [...providers.values()]

/** 测试用：清空。 */
export const clearLyricsMatchProviders = (): void => { providers.clear() }
