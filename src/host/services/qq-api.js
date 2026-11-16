/**
 * QQ upstream service: `@yakult-green-tea/qq-music-api` in a worker thread.
 *
 * That package starts a Koa server **at require time**, reading `PORT` then. Its
 * config schema rejects `port <= 0`, so the adapter must allocate a free port and
 * set it before the module is loaded — both handled inside the worker.
 *
 * @module dsh-music-panel/services/qq-api
 */

import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { Worker } from 'node:worker_threads'
import { MusicError, toMusicError } from './core/errors.js'
import { allocateFreePort } from './core/ports.js'

const READY_TIMEOUT_MS = 30_000
const REQUEST_TIMEOUT_MS = 20_000

const WORKER_SOURCE = `
const { parentPort, workerData } = require('node:worker_threads')
const { createRequire } = require('node:module')
const request = createRequire(workerData.base)

;(async () => {
  try {
    // The package listens on require; PORT must already be valid (> 0).
    process.env.PORT = String(workerData.port)
    process.env.HOST = '127.0.0.1'

    const mod = request(workerData.entryPath)
    const server = mod.server
    if (!server) throw new Error('QQ upstream did not expose a server')

    await new Promise((resolve, reject) => {
      if (server.listening) return resolve()
      server.once('listening', resolve)
      server.once('error', reject)
      setTimeout(() => reject(new Error('listen() timed out')), 15000)
    })

    const address = server.address()
    parentPort.postMessage({ type: 'ready', port: address && address.port })
  } catch (error) {
    parentPort.postMessage({ type: 'error', message: String((error && error.stack) || error) })
  }
})()
`

/** @type {Promise<{ port: number }> | null} */
let pending = null

/** Test seam: replaces the whole transport. */
let upstreamOverride = null

export function setUpstreamOverride(fn) {
  upstreamOverride = fn
}

export function resetUpstreamOverride() {
  upstreamOverride = null
}

function resolveEntry() {
  const base = fileURLToPath(import.meta.url)
  const require = createRequire(base)
  try {
    return { base, entryPath: require.resolve('@yakult-green-tea/qq-music-api') }
  } catch (error) {
    throw new MusicError('the QQ Music API package is not installed', {
      code: 'not-configured',
      sourceId: 'qq',
      cause: error,
    })
  }
}

async function start() {
  const entry = resolveEntry()
  const port = await allocateFreePort()

  return new Promise((resolve, reject) => {
    const worker = new Worker(WORKER_SOURCE, {
      eval: true,
      workerData: { ...entry, port },
      stdout: true,
      stderr: true,
    })

    let settled = false
    const stop = async () => {
      pending = null
      try {
        await worker.terminate()
      } catch {
        // Already gone.
      }
    }
    const fail = (error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      void stop()
      reject(error)
    }
    const timer = setTimeout(() => {
      fail(new MusicError('the QQ Music API service did not start in time', {
        code: 'timeout',
        sourceId: 'qq',
        retryable: true,
      }))
    }, READY_TIMEOUT_MS)

    worker.on('message', (message) => {
      if (message === null || typeof message !== 'object') return
      if (message.type === 'ready' && typeof message.port === 'number') {
        if (settled) return
        settled = true
        clearTimeout(timer)
        worker.stdout?.resume()
        worker.stderr?.resume()
        resolve({ port: message.port, stop })
      } else if (message.type === 'error') {
        fail(new MusicError(message.message ?? 'the QQ Music API service failed to start', {
          code: 'protocol',
          sourceId: 'qq',
        }))
      }
    })
    worker.on('error', (error) => {
      fail(new MusicError(error.message, { code: 'protocol', sourceId: 'qq', cause: error }))
    })
    worker.on('exit', (code) => {
      if (!settled) {
        fail(new MusicError(`the QQ Music API worker exited with code ${code}`, { code: 'protocol', sourceId: 'qq' }))
      } else {
        pending = null
      }
    })
    worker.unref()
  })
}

export function ensureQqService() {
  if (pending === null) {
    pending = start().catch((error) => {
      pending = null
      throw error
    })
  }
  return pending
}

export async function stopQqService() {
  const current = pending
  pending = null
  if (current === null) return
  try {
    const handle = await current
    await handle.stop()
  } catch {
    // Never-ready handles clean themselves up.
  }
}

/**
 * Call one upstream route.
 *
 * `skipCodeCheck` is for routes whose `code` is *content* instead of an outcome.
 * The QR login poll answers 801/802/803 for waiting / scanned / signed-in (and
 * 800 for a dead code); the generic "code must be 200 or 0" gate would turn every
 * waiting answer into an error, so the caller has to opt out of it explicitly.
 *
 * @param {string} route
 * @param {Record<string, string|number|boolean|undefined>} [params]
 * @param {{ cookie?: string, timeoutMs?: number, skipCodeCheck?: boolean }} [options]
 */
export async function callUpstream(route, params = {}, options = {}) {
  if (upstreamOverride !== null) return upstreamOverride(route, params, options)
  const handle = await ensureQqService()

  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue
    query.set(key, String(value))
  }
  const suffix = query.toString() === '' ? '' : `?${query.toString()}`
  const url = `http://127.0.0.1:${handle.port}${route}${suffix}`

  const headers = { accept: 'application/json' }
  if (typeof options.cookie === 'string' && options.cookie !== '') headers.cookie = options.cookie

  let response
  try {
    response = await fetch(url, { headers, signal: AbortSignal.timeout(options.timeoutMs ?? REQUEST_TIMEOUT_MS) })
  } catch (error) {
    throw toMusicError(error, 'qq')
  }

  const text = await response.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    throw new MusicError(`QQ API returned non-JSON for ${route}`, { code: 'invalid-response', sourceId: 'qq' })
  }
  if (!response.ok) {
    throw new MusicError(json?.message ?? `QQ API answered HTTP ${response.status}`, {
      code: response.status === 401 ? 'auth-required' : 'protocol',
      sourceId: 'qq',
      status: response.status,
    })
  }
  return assertOk(json, route, options)
}

/**
 * Upstream answers 200 (Koa) or 0 (its own routes) for success and carries a real
 * failure in `code`. QR-login routes carry a scan state there instead;
 * `skipCodeCheck` hands that state back untouched.
 */
export function assertOk(json, route, options = {}) {
  if (options.skipCodeCheck === true) return json
  const code = Number(json?.code)
  if (Number.isFinite(code) && code !== 200 && code !== 0) {
    throw new MusicError(json?.message ?? `QQ API code ${code} (${route})`, {
      code: code === 301 ? 'auth-required' : 'protocol',
      sourceId: 'qq',
      status: code,
    })
  }
  return json
}
