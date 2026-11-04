/**
 * Test helpers: a real WAV file music-metadata can parse, without fixtures.
 */

import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/** Build a mono 16-bit PCM WAV of `seconds` of silence. */
export function wavBuffer(seconds = 1, sampleRate = 44100) {
  const channels = 1
  const bits = 16
  const frames = Math.max(1, Math.round(seconds * sampleRate))
  const dataSize = frames * channels * (bits / 8)
  const buffer = Buffer.alloc(44 + dataSize)
  buffer.write('RIFF', 0, 'latin1')
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write('WAVE', 8, 'latin1')
  buffer.write('fmt ', 12, 'latin1')
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(channels, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE((sampleRate * channels * bits) / 8, 28)
  buffer.writeUInt16LE((channels * bits) / 8, 32)
  buffer.writeUInt16LE(bits, 34)
  buffer.write('data', 36, 'latin1')
  buffer.writeUInt32LE(dataSize, 40)
  return buffer
}

/** Write one WAV into a fresh temp directory and return its path. */
export async function tempWav(name = 'sample.wav', seconds = 1) {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-music-'))
  const file = join(dir, name)
  await writeFile(file, wavBuffer(seconds))
  return file
}

/** A fake HTTP response that records status, headers and body. */
export function fakeRes() {
  return {
    status: 0,
    headers: null,
    body: '',
    writableEnded: false,
    destroyed: false,
    writeHead(status, headers) {
      this.status = status
      this.headers = headers
    },
    write(chunk) {
      this.body += String(chunk)
      return true
    },
    end(chunk) {
      if (chunk !== undefined && chunk !== null) this.body += String(chunk)
      this.writableEnded = true
    },
    destroy() {
      this.destroyed = true
    },
    json() {
      return JSON.parse(this.body)
    },
  }
}

/** A fake node request good enough for the routes under test. */
export function fakeReq(url, method = 'GET', headers = {}) {
  return {
    url,
    method,
    headers,
    socket: { remoteAddress: '127.0.0.1' },
    on() {},
    destroy() {},
  }
}
