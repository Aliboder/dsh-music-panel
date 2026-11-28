/**
 * 曲目是否 VIP/付费（本插件自己的角标，不属于 Folia）。
 *
 * 移植前这个判断写在旧的 provider 映射里：netease `fee===1`、qq `payplay===1`、
 * bodian `payInfo.feeType.vip==='1'`、qishui `commerce_info.icon_info.type` 是 vip/svip
 * （或 playable_condition 提到 membership_type）。移植后原始字段由各音源自己的归一化保留，
 * 这里只做「音源 → 是否 VIP」这一层，DTO 据此把 `qualityHint` 设为 'VIP'，界面照旧显示角标。
 *
 * @module dsh-music-panel/sources/song-vip
 */

/**
 * @param {string} sourceId 平台 id（netease / qq / bodian / qishui / kugouLite）
 * @param {{ data?: Record<string, unknown> }} song 上游 FoliumSourceSong
 * @returns {boolean}
 */
export function vipOfSong(sourceId, song) {
  const item = song && typeof song === 'object' ? song : {}
  const data = item.data && typeof item.data === 'object' ? item.data : {}
  // 各音源归一化统一放 `vip: true`（酷狗没有这个字段：旧实现里酷狗也没有 VIP 角标）。
  if (data.vip === true) return true
  if (sourceId === 'netease') {
    // 网易云把 fee 与 privilege 原样留在歌的 data 上；旧实现用的是 fee === 1。
    const fee = Number(data.fee) || 0
    const privilege = data.privilege && typeof data.privilege === 'object' ? data.privilege : {}
    return fee === 1 || Number(privilege.fee) === 1
  }
  return false
}
