/**
 * Login bridge: the state machine wired to real platform adapters.
 *
 * The bridge owns one `createLoginState` per source and turns a platform's raw
 * `loginStatus` answer into the credential row the rest of the plugin persists.
 * Persistence is injected (`store`), so the call site can keep using the legacy
 * provider store today and switch to `login/store.js` without touching the routes.
 *
 * @module dsh-music-panel/login/bridge
 */

import { accountSessionOf, createLoginState } from './state.js'

/**
 * Map a provider `loginStatus` answer onto the credential row stored on disk.
 * Mirrors what the route persisted before the bridge existed.
 *
 * @param {object} result
 */
export function credentialsOf(result) {
  const device = result?.device ?? {}
  return {
    cookie: String(result?.cookie ?? ''),
    token: String(result?.token ?? ''),
    mid: String(device.mid ?? ''),
    dfid: String(device.dfid ?? ''),
    guid: String(device.guid ?? ''),
    userid: Number(result?.userid) || 0,
    nickname: String(result?.nickname ?? result?.extra?.nickname ?? ''),
    avatarUrl: String(result?.avatarUrl ?? ''),
    vip_type: String(result?.vipType ?? ''),
    vip_token: String(result?.vipToken ?? ''),
  }
}

/**
 * QR adapter over a source's `loginStart` / `loginStatus`.
 *
 * @param {{
 *   sourceId: string,
 *   omni: { loginStart: Function, loginStatus: Function },
 *   getSession: () => Promise<object>,
 *   mode?: string,
 * }} options
 */
export function createQrAdapter(options) {
  const mode = options.mode ?? 'qq'
  return {
    mode,
    async start() {
      const session = await options.getSession()
      const qr = await options.omni.loginStart(options.sourceId, { session }, mode)
      return {
        key: String(qr?.key ?? ''),
        imageDataUrl: String(qr?.imageDataUrl ?? ''),
        url: String(qr?.url ?? ''),
        expiresAt: Number(qr?.expiresAt) || 0,
      }
    },
    async poll(key) {
      const result = await options.omni.loginStatus(options.sourceId, key, mode)
      const status = String(result?.status ?? 'failed')
      if (status !== 'success') {
        return {
          status,
          message: String(result?.message ?? ''),
          // A provider that named the case (QQ's package does) hands it over here.
          case: String(result?.case ?? ''),
          retryAfterMs: Number(result?.retryAfterMs) || 0,
        }
      }
      return {
        status,
        session: credentialsOf(result),
        user: {
          id: String(result?.userid ?? ''),
          nickname: String(result?.nickname ?? ''),
          avatarUrl: String(result?.avatarUrl ?? ''),
        },
      }
    },
  }
}

/**
 * @param {{
 *   adapters: Record<string, object>,
 *   store: { save: (sourceId: string, credentials: object, user: object|null) => Promise<void>, clear: (sourceId: string) => Promise<void> },
 * }} options
 */
export function createLoginBridge(options) {
  const adapters = options.adapters ?? {}
  const store = options.store ?? { save: async () => {}, clear: async () => {} }
  const states = new Map()

  /**
   * One state per source. `adapters[id]` may be an adapter or a factory
   * `(kind) => adapter`, so a per-request mode (qq vs wx) can be honoured.
   */
  function stateFor(sourceId, kind) {
    let state = states.get(sourceId)
    if (state !== undefined) return state
    const entry = adapters[sourceId]
    const adapter = typeof entry === 'function' ? entry(kind) : (entry ?? {})
    state = createLoginState({ sourceId, adapter })
    states.set(sourceId, state)
    return state
  }

  return {
    stateFor,
    snapshot: (sourceId) => stateFor(sourceId).getSnapshot(),
    sessionOf: (sourceId) => accountSessionOf(stateFor(sourceId).getSnapshot()),

    async start(sourceId, kind) {
      // Rebuild the adapter so a changed mode takes effect on the next attempt.
      states.delete(sourceId)
      return stateFor(sourceId, kind).start(kind)
    },

    /** Poll once and persist the credentials on success. */
    async poll(sourceId) {
      const state = stateFor(sourceId, undefined)
      const snapshot = await state.poll()
      if (snapshot.status === 'authenticated' && snapshot.session !== null) {
        await store.save(sourceId, snapshot.session, snapshot.user)
      }
      return snapshot
    },


    async logout(sourceId) {
      states.delete(sourceId)
      await store.clear(sourceId)
    },
  }
}
