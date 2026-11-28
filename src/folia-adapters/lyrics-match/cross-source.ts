/**
 * `services/onlineMusic/crossSource` 的插件侧替身（只实现匹配链用到的那两个查询）。
 *
 * 上游在这里判断「哪些源现在能参与跨源匹配」（启用、已配置、需要账号的已登录）。插件的注册表
 * 本身就是这个判断的结论：没注册的源不会出现在 registry 里，所以 Host 侧把当前可用的 id 交进来即可。
 *
 * @module dsh-music-panel/folia-adapters/lyrics-match/cross-source
 */

let readyIds: readonly string[] = []

/** Host 启动/注册表变化时调一次：当前能参与匹配的源 id（按顺序）。 */
export const setLyricsMatchParticipants = (ids: readonly string[]): void => {
  readyIds = ids.map((id) => String(id))
}

export const isParticipantReady = (feature: string, source: unknown): boolean => (
  feature === 'lyrics' && readyIds.includes(String(source ?? ''))
)

/** 上游只读 ready/skipped 用于日志与顺序；这里如实给出 ready，skipped 留空。 */
export const participants = (feature: string, _options?: { report?: boolean }) => ({
  feature,
  declared: [...readyIds],
  ready: [...readyIds],
  skipped: [] as Array<{ id: string; reason: string }>,
})

export const clearLyricsMatchParticipants = (): void => { readyIds = [] }
