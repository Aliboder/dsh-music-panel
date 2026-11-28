/**
 * api.seal：用每个音源自己的一份 AES-256-GCM 密钥封存会话。
 *
 * 桌面版这层是 Electron 的 safeStorage；插件在 DSH 的 Node 里跑，没有那个接口，所以密钥落在插件数据
 * 目录（只有本机用户可读）。available() 只在密钥能落盘时为真，否则上游只把会话留在内存里，
 * 与它们「加密不可用」时的分支一致。
 *
 * @module dsh-music-panel/folia-adapters/source-host/seal
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ALGORITHM = 'aes-256-gcm'
const IV_BYTES = 12
const TAG_BYTES = 16

/** Folium 的 FoliumSourceSeal。 */
export interface Seal {
  available(): boolean
  seal(text: string): string
  open(sealed: string): string
}

export const createSeal = (options: { dir: string, name: string }): Seal => {
  const file = join(options.dir, options.name + '-seal.key')
  let key: Buffer | null = null
  let failure: Error | null = null
  const loadKey = (): Buffer => {
    if (key) return key
    if (failure) throw failure
    try {
      mkdirSync(options.dir, { recursive: true })
      let hex: string
      try {
        hex = readFileSync(file, 'utf8').trim()
      } catch {
        const created = randomBytes(32)
        writeFileSync(file, created.toString('hex'), { mode: 0o600 })
        try { chmodSync(file, 0o600) } catch { /* Windows 没有 POSIX 权限位 */ }
        hex = created.toString('hex')
      }
      const loaded = Buffer.from(hex, 'hex')
      if (loaded.length !== 32) throw new Error('the seal key of ' + options.name + ' is not 32 bytes')
      key = loaded
      return loaded
    } catch (error) {
      failure = error instanceof Error ? error : new Error(String(error))
      throw failure
    }
  }
  return {
    available() {
      try { loadKey(); return true } catch { return false }
    },
    seal(text) {
      const iv = randomBytes(IV_BYTES)
      const cipher = createCipheriv(ALGORITHM, loadKey(), iv)
      const sealed = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()])
      return Buffer.concat([iv, cipher.getAuthTag(), sealed]).toString('base64')
    },
    open(sealed) {
      const raw = Buffer.from(String(sealed), 'base64')
      if (raw.length <= IV_BYTES + TAG_BYTES) throw new Error('the sealed text is too short')
      const decipher = createDecipheriv(ALGORITHM, loadKey(), raw.subarray(0, IV_BYTES))
      decipher.setAuthTag(raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES))
      return Buffer.concat([decipher.update(raw.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]).toString('utf8')
    },
  }
}
