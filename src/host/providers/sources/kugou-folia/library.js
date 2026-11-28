/**
 * 占位：这一块的映射正在写（library.js）。导入与派工表先接好，
 * 真实现替换本文件即可，dispatch.js 与门面不需要再动。
 *
 * @module dsh-music-panel/sources/kugou-folia/library
 */
import { MusicError } from '../../../services/core/errors.js'

const pending = () => {
  throw new MusicError('酷狗移植源的 library 映射尚未接入', { code: 'unavailable', sourceId: 'kugouLite' })
}

export const myPlaylists = pending
export const playlistSongs = pending
export const playlistSongsPage = pending
export const onlineLiked = pending
export const onlineLikedIds = pending
export const setOnlineLiked = pending
export const addOnlineSongToPlaylist = pending
export const removeOnlineSongFromPlaylist = pending
export const subscriptionStatus = pending
export const subscribeCollection = pending
