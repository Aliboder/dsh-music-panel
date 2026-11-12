/**
 * Persistence for online-provider login state (cookies).
 *
 * Cookies live in `<DSH_HOME>/music/providers.json` with mode 0600. They are
 * never logged, never sent to the client, and never written to the repo.
 *
 * @module dsh-music-panel/provider-store
 */

import { readJsonWithBackup, writeJsonAtomic } from './json-store.js'
import { join } from 'node:path'

const EMPTY = {
  netease: { cookie: '', nickname: '', avatarUrl: '', loggedIn: false },
  qq: { cookie: '', nickname: '', avatarUrl: '', loggedIn: false },
  kugou: { cookie: '', mid: '', dfid: '', guid: '', token: '', vip_type: '', vip_token: '', userid: 0, nickname: '', avatarUrl: '', platform: 'standard', loggedIn: false },
  kugouLite: { cookie: '', mid: '', dfid: '', guid: '', token: '', vip_type: '', vip_token: '', userid: 0, nickname: '', avatarUrl: '', loggedIn: false },
  // Navidrome normally stores only a salted token (t = md5(pass + salt)) so the
  // password never lands on disk. `password` stays empty unless the user opts in
  // to the native API for a complete song list, which needs it to mint a JWT;
  // `nativeSongs` records that choice so the host knows which list to serve.
  navidrome: { server: '', username: '', salt: '', token: '', password: '', nativeSongs: false, nickname: '', avatarUrl: '', loggedIn: false },
}

/** Providers whose session carries a KuGou-style device identity + token. */
const DEVICE_PROVIDERS = ['kugou', 'kugouLite']

/** Providers that sign in with a QR flow (Navidrome uses credentials instead). */
const QR_PROVIDERS = ['netease', 'qq', 'kugou', 'kugouLite']

/**
 * @param {{ dir: string }} options
 */
export function createProviderStore(options) {
  const file = join(options.dir, 'providers.json')
  let cache = null
  let loading = null

  async function load() {
    if (cache !== null) return cache
    if (loading !== null) return loading
    loading = (async () => {
      const data = await readJsonWithBackup(file)
      if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
        cache = {
          netease: { ...EMPTY.netease, ...(data.netease || {}) },
          qq: { ...EMPTY.qq, ...(data.qq || {}) },
          kugou: { ...EMPTY.kugou, ...(data.kugou || {}) },
          kugouLite: { ...EMPTY.kugouLite, ...(data.kugouLite || {}) },
          navidrome: { ...EMPTY.navidrome, ...(data.navidrome || {}) },
        }
      } else {
        cache = JSON.parse(JSON.stringify(EMPTY))
      }
      loading = null
      return cache
    })()
    return loading
  }

  async function save() {
    await writeJsonAtomic(file, cache, { mode: 0o600 })
  }

  return {
    /** Public summary for the settings UI (no cookies). */
    async summary() {
      const data = await load()
      return {
        netease: { loggedIn: data.netease.loggedIn === true, nickname: data.netease.nickname || '', avatarUrl: data.netease.avatarUrl || '' },
        qq: { loggedIn: data.qq.loggedIn === true, nickname: data.qq.nickname || '', avatarUrl: data.qq.avatarUrl || '' },
        kugou: { loggedIn: data.kugou.loggedIn === true, nickname: data.kugou.nickname || '', avatarUrl: data.kugou.avatarUrl || '', platform: 'standard' },
        kugouLite: { loggedIn: data.kugouLite.loggedIn === true, nickname: data.kugouLite.nickname || '', avatarUrl: data.kugouLite.avatarUrl || '' },
        navidrome: {
          loggedIn: data.navidrome.loggedIn === true,
          nickname: data.navidrome.nickname || '',
          avatarUrl: data.navidrome.avatarUrl || '',
          server: data.navidrome.server || '',
          // Tells the settings UI whether the opt-in is on. Never exposes the
          // password itself.
          nativeSongs: data.navidrome.nativeSongs === true,
        },
      }
    },
    /** Cookie for one provider ('' when signed out). */
    async cookie(provider) {
      const data = await load()
      return QR_PROVIDERS.includes(provider) ? data[provider].cookie || '' : ''
    },
    /** KuGou needs its device identity; Navidrome needs its server + token. */
    async session(provider) {
      const data = await load()
      if (provider === 'navidrome') {
        const row = data.navidrome
        return {
          server: row.server || '',
          username: row.username || '',
          salt: row.salt || '',
          token: row.token || '',
          // Server-side only: the native JWT is minted from this. It is empty
          // unless the user opted into the complete-library listing.
          password: row.password || '',
          nativeSongs: row.nativeSongs === true,
        }
      }
      if (!DEVICE_PROVIDERS.includes(provider)) return {}
      const row = data[provider]
      return {
        mid: row.mid || '',
        dfid: row.dfid || '',
        guid: row.guid || '',
        token: row.token || '',
        vipType: row.vip_type || '',
        vipToken: row.vip_token || '',
        userid: Number(row.userid) || 0,
      }
    },
    /** Persist a successful login. */
    async setLogin(provider, value) {
      const data = await load()
      if (!QR_PROVIDERS.includes(provider) && provider !== 'navidrome') return
      data[provider] = { ...data[provider], ...value, loggedIn: true }
      await save()
    },
    /** Persist device identity (KuGou needs a stable mid). */
    async setSession(provider, value) {
      const data = await load()
      if (!DEVICE_PROVIDERS.includes(provider)) return
      data[provider] = {
        ...data[provider],
        mid: String(value.mid ?? data[provider].mid ?? ''),
        userid: Number(value.userid ?? data[provider].userid ?? 0) || 0,
      }
      await save()
    },
    /** Clear one provider (or all when omitted). */
    async clear(provider) {
      const data = await load()
      if (provider === undefined) {
        cache = JSON.parse(JSON.stringify(EMPTY))
      } else if (QR_PROVIDERS.includes(provider) || provider === 'navidrome') {
        data[provider] = JSON.parse(JSON.stringify(EMPTY[provider]))
      }
      await save()
    },
  }
}
