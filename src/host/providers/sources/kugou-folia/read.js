/**
 * 占位：这一块的映射正在写（read.js）。导入与派工表先接好，
 * 真实现替换本文件即可，dispatch.js 与门面不需要再动。
 *
 * @module dsh-music-panel/sources/kugou-folia/read
 */
import { MusicError } from '../../../services/core/errors.js'

const pending = () => {
  throw new MusicError('酷狗移植源的 read 映射尚未接入', { code: 'unavailable', sourceId: 'kugouLite' })
}

export const search = pending
export const searchPage = pending
export const searchAlbums = pending
export const searchPlaylists = pending
export const artistSongs = pending
export const albumSongs = pending
export const artistAlbums = pending
export const songs = pending
export const nativeSongs = pending
export const artists = pending
export const albums = pending
export const dailySongs = pending
export const recommendedCollections = pending
export const personalFm = pending
export const cloudSongs = pending
export const listeningRank = pending
export const historyDates = pending
export const historySongs = pending
