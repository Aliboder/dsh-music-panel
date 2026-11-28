/**
 * 音源宿主面用的小 JSON 文件：同步读一次、写时整体落盘（先写 .tmp 再改名）。
 *
 * api.legacy.store 与 pageStore 要求同步读写；Electron 里那是 electron-store，这里用一个文件顶上。
 *
 * @module dsh-music-panel/folia-adapters/source-host/jsonFile
 */
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

export interface JsonFile<T> {
  read(): T
  write(value: T): void
}

export const createJsonFile = <T extends object>(file: string, empty: () => T): JsonFile<T> => {
  let cache: T | null = null
  const read = (): T => {
    if (cache) return cache
    try {
      const parsed = JSON.parse(readFileSync(file, 'utf8')) as unknown
      cache = parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as T) : empty()
    } catch {
      cache = empty()
    }
    return cache
  }
  const write = (value: T): void => {
    cache = value
    const temporary = file + '.tmp'
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(temporary, JSON.stringify(value, null, 2), 'utf8')
    try {
      renameSync(temporary, file)
    } catch (error) {
      try { rmSync(temporary, { force: true }) } catch { /* 下一次写还会再试 */ }
      throw error
    }
  }
  return { read, write }
}
