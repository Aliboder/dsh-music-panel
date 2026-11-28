/**
 * Folia 的宿主手里握着完整的 FoliumSourceSong（omni.getAudioSource 收的是整首歌）。
 * 本插件的 HTTP 边界只传得动 provider + id，可平台取流要的键并不都在 id 里：
 *   QQ    songmid 在 lyricIds.qq / data.songMid，mediaMid 在 data.mediaMid（id 是数字 songid）；
 *   波点  data.freeSign；
 *   酷狗  data.albumId / albumAudioId、variant=cloud。
 * 只给 id 时 QQ 会直接报「QQ song has no songmid」，其余平台会缺字段。
 *
 * 这里按 provider+id 记下取流/歌词/写歌单需要的最小侧车（data / lyricIds / variant），
 * 落盘到数据目录（online-songs.json），重启后仍能播恢复队列里的歌；LRU 上限与单条大小都有界。
 *
 * @module dsh-music-panel/sources/song-registry
 */

import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const LIMIT = 3000
const SIDE_CAR_MAX_BYTES = 4000
const SAVE_DELAY_MS = 800

let dirPath = ''
let cache = null
let clock = 0
let saveTimer = null

const providerKey = (sourceId) => (sourceId === 'kugou' ? 'kugouLite' : String(sourceId ?? ''))
const keyOf = (sourceId, id) => providerKey(sourceId) + '\u0000' + String(id ?? '')

function filePath() {
  return dirPath === '' ? '' : join(dirPath, 'online-songs.json')
}

/** 只留取流/歌词/写歌单读的几项；其余字段（标题、封面）客户端本来就有。 */
function sideCarOf(value) {
  if (value === null || typeof value !== 'object') return null
  const id = String(value.id ?? value.onlineId ?? '')
  if (id === '') return null
  const data = value.data && typeof value.data === 'object' && !Array.isArray(value.data) ? value.data : null
  const lyricIds = value.lyricIds && typeof value.lyricIds === 'object' ? value.lyricIds : null
  const variant = typeof value.variant === 'string' && value.variant !== '' ? value.variant : ''
  if (data === null && lyricIds === null && variant === '') return null
  const sideCar = {
    id,
    ...(data === null ? {} : { data }),
    ...(lyricIds === null ? {} : { lyricIds }),
    ...(variant === '' ? {} : { variant }),
  }
  try {
    if (JSON.stringify(sideCar).length > SIDE_CAR_MAX_BYTES) return null
  } catch {
    return null
  }
  return sideCar
}

function load() {
  if (cache !== null) return cache
  cache = new Map()
  const file = filePath()
  if (file !== '') {
    try {
      const parsed = JSON.parse(readFileSync(file, 'utf8'))
      const songs = parsed && typeof parsed === 'object' && Array.isArray(parsed.songs) ? parsed.songs : []
      for (const entry of songs) {
        if (entry === null || typeof entry !== 'object') continue
        const sideCar = sideCarOf(entry)
        if (sideCar === null) continue
        const at = Number(entry.at) || 0
        clock = Math.max(clock, at)
        cache.set(keyOf(entry.provider, sideCar.id), { ...sideCar, at })
      }
    } catch {
      // 第一次运行、文件坏了或被清空：从空表开始。
    }
  }
  return cache
}

function scheduleSave() {
  if (filePath() === '' || saveTimer !== null) return
  saveTimer = setTimeout(function () {
    saveTimer = null
    const file = filePath()
    if (file === '') return
    const songs = []
    for (const entry of load().values()) {
      songs.push({ provider: entry.provider, id: entry.id, at: entry.at, ...sideCarOf(entry) })
    }
    try {
      writeFileSync(file, JSON.stringify({ version: 1, songs }))
    } catch {
      // 落盘尽力而为：内存里的侧车仍然有效。
    }
  }, SAVE_DELAY_MS)
  if (saveTimer !== null && typeof saveTimer.unref === 'function') saveTimer.unref()
}

/** 宿主装配时给数据目录；'' 表示只留内存。 */
export function initSongRegistry(dir) {
  dirPath = typeof dir === 'string' ? dir : ''
  cache = null
}

/** 见过一首歌就记下它的侧车（列表、搜索、详情都会经过 dto）。 */
export function rememberSong(sourceId, value) {
  if (sourceId === null || sourceId === undefined) return
  const sideCar = sideCarOf(value)
  if (sideCar === null) return
  const map = load()
  clock += 1
  const key = keyOf(sourceId, sideCar.id)
  map.delete(key)
  map.set(key, { ...sideCar, provider: providerKey(sourceId), at: clock })
  while (map.size > LIMIT) {
    const oldest = map.keys().next().value
    if (oldest === undefined) break
    map.delete(oldest)
  }
  scheduleSave()
}

/** 取流/歌词/写操作要用整首歌时，按 id 找回侧车；没有则 null。 */
export function playbackSongOf(sourceId, id) {
  const found = load().get(keyOf(sourceId, id))
  if (found === undefined) return null
  return {
    id: found.id,
    ...(found.data ? { data: found.data } : {}),
    ...(found.lyricIds ? { lyricIds: found.lyricIds } : {}),
    ...(found.variant ? { variant: found.variant } : {}),
  }
}

/** 清空插件数据：删文件并把内存表清掉。 */
export function clearSongRegistry() {
  const file = filePath()
  cache = new Map()
  clock = 0
  if (saveTimer !== null) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  if (file === '') return
  try {
    rmSync(file, { force: true })
  } catch {
    // 删不掉时下一次 reset 还会再试。
  }
}

/** 立即落盘（测试与退出前想确保写下去时用），跳过防抖定时器。 */
export function flushSongRegistry() {
  const file = filePath()
  if (file === '') return
  if (saveTimer !== null) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  const songs = []
  for (const entry of load().values()) {
    songs.push({ provider: entry.provider, id: entry.id, at: entry.at, ...sideCarOf(entry) })
  }
  try {
    writeFileSync(file, JSON.stringify({ version: 1, songs }))
  } catch {
    // 尽力而为。
  }
}

/** 测试用：丢掉内存表，下一次访问重新读盘。 */
export function reloadSongRegistryForTest() {
  cache = null
}
