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
}

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
      }
    },
    /** Cookie for one provider ('' when signed out). */
    async cookie(provider) {
      const data = await load()
      return provider === 'netease' || provider === 'qq' || provider === 'kugou' || provider === 'kugouLite'
        ? data[provider].cookie || ''
        : ''
    },
    /** KuGou needs its device identity as well. */
    async session(provider) {
      const data = await load()
      if (provider !== 'kugou' && provider !== 'kugouLite') return {}
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
      if (provider !== 'netease' && provider !== 'qq' && provider !== 'kugou' && provider !== 'kugouLite') return
      data[provider] = { ...data[provider], ...value, loggedIn: true }
      await save()
    },
    /** Persist device identity (KuGou needs a stable mid). */
    async setSession(provider, value) {
      const data = await load()
      if (provider !== 'kugou' && provider !== 'kugouLite') return
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
      } else if (provider === 'netease' || provider === 'qq' || provider === 'kugou' || provider === 'kugouLite') {
        data[provider] = JSON.parse(JSON.stringify(EMPTY[provider]))
      }
      await save()
    },
  }
}
