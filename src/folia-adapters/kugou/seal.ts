/**
 * api.seal 的插件侧实现：用 AES-256-GCM 封酷狗会话（上游桥用 seal 加密 KUGOU_API_SESSION_V2）。
 *
 * 桌面版这一层是 Electron 的 safeStorage（系统钥匙串）；本插件在 DSH 的 Node 里跑，没有那个接口，
 * 所以密钥落在一个只有本机用户可读的文件里，密文仍然是 AES-256-GCM。available() 只在密钥能落盘时为真，
 * 这时桥才会写加密后的会话，否则它只把会话留在内存里（和上游「加密不可用」时的行为一致）。
 *
 * @module dsh-music-panel/folia-adapters/kugou/seal
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const KEY_FILE = 'kugou-seal.key'
const ALGORITHM = 'aes-256-gcm'
const IV_BYTES = 12
const TAG_BYTES = 16

/** Folium 的 FoliumSourceSeal。 */
export interface Seal {
  available(): boolean
  seal(text: string): string
  open(sealed: string): string
}

export const createSeal = (options: { dir: string }): Seal => {
  const file = join(options.dir, KEY_FILE)
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
        try { chmodSync(file, 0o600) } catch { /* Windows 上没有 POSIX 权限位 */ }
        hex = created.toString('hex')
      }
      const loaded = Buffer.from(hex, 'hex')
      if (loaded.length !== 32) throw new Error('the KuGou seal key is not 32 bytes')
      key = loaded
      return loaded
    } catch (error) {
      failure = error instanceof Error ? error : new Error(String(error))
      throw failure
    }
  }

  return {
    available() {
      try {
        loadKey()
        return true
      } catch {
        return false
      }
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
      const iv = raw.subarray(0, IV_BYTES)
      const tag = raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES)
      const body = raw.subarray(IV_BYTES + TAG_BYTES)
      const decipher = createDecipheriv(ALGORITHM, loadKey(), iv)
      decipher.setAuthTag(tag)
      return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8')
    },
  }
}
