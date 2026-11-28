/**
 * `utils/lyrics/providers/amllDbProvider` 的插件侧替身。
 *
 * 上游匹配链用它：① 从平台的歌推算 AMLL 库里可能用的 id（QQ 可能按 mid 或数字 id 收录）；
 * ② 取一份 TTML；③ 手动窗口里按文字搜 AMLL。前两件在桌面版是直接发请求，插件把网络访问
 * 统一收在 Host 的 AMLL 客户端里（与歌词匹配服务现在用的是同一个），这里只留注入口。
 *
 * `getAmllDbMusicIds` 与上游实现一致（照抄它的 id 规则），其余是会交给 Host 的壳。
 *
 * @module dsh-music-panel/folia-adapters/lyrics-match/amll-db-provider
 */

export interface AmllDbHooks {
  /** 按文字搜 AMLL 官方搜索；null 表示这次搜不到（上游据此停止兜底）。 */
  search?: (params: unknown, pageSize: number) => Promise<unknown[] | null>
  /** 取某个平台 id 下的 TTML，返回我们的行形状（{lines, lrc}）。 */
  fetchLyrics?: (platform: 'ncm' | 'qq', ids: string[]) => Promise<unknown | null>
}

let hooks: AmllDbHooks = {}

export const configureAmllDb = (next: AmllDbHooks): void => {
  hooks = { ...next }
}

type AmllDbMusicId = number | string | null | undefined

const normalizeMusicIds = (ids: readonly AmllDbMusicId[]): string[] => ids
  .map((id) => String(id ?? '').trim())
  .filter((id, index, all) => id !== '' && all.indexOf(id) === index)

/** 与上游一样：QQ 先试 mid，再试数字 id（模组把数字 id 放在 sourceRef.providerData.songId）。 */
export function getAmllDbMusicIds(
  platform: 'ncm' | 'qq',
  song: { id: number | string; qqMid?: string; sourceRef?: { kind?: string; providerData?: Record<string, unknown> } | null },
): string[] {
  const sourceRef = song?.sourceRef ?? null
  const raw = sourceRef && sourceRef.kind === 'online' ? sourceRef.providerData?.songId : undefined
  const numeric: AmllDbMusicId = typeof raw === 'number' || typeof raw === 'string' ? raw : undefined
  return normalizeMusicIds(platform === 'qq' ? [song.qqMid, song.id, numeric] : [song.id])
}

export async function fetchAmllDbLyrics(platform: 'ncm' | 'qq', ids: string[]): Promise<unknown | null> {
  if (typeof hooks.fetchLyrics !== 'function') return null
  const ordered = ids.filter((id) => id !== '')
  if (ordered.length === 0) return null
  try {
    return await hooks.fetchLyrics(platform, ordered)
  } catch {
    return null
  }
}

export async function searchAmllDbSongs(params: unknown, pageSize: number): Promise<unknown[] | null> {
  if (typeof hooks.search !== 'function') return null
  try {
    return await hooks.search(params, pageSize)
  } catch {
    return null
  }
}

export function clearAmllDbLyricsCache(): void {}

export type { AmllDbMusicId }
