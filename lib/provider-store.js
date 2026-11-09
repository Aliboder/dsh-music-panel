/**
 * Persistence for online-provider login state (cookies).
 *
 * Cookies live in `<DSH_HOME>/music/providers.json` with mode 0600. They are
 * never logged, never sent to the client, and never written to the repo.
 *
 * @module dsh-music-panel/provider-store
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

const EMPTY = {
  netease: { cookie: '', nickname: '', loggedIn: false },
  qq: { cookie: '', nickname: '', loggedIn: false },
  kugou: { cookie: '', mid: '', dfid: '', guid: '', token: '', userid: 0, nickname: '', loggedIn: false },
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
      try {
        const text = await readFile(file, 'utf8')
        const data = JSON.parse(text)
        cache = {
          netease: { ...EMPTY.netease, ...(data.netease || {}) },
          qq: { ...EMPTY.qq, ...(data.qq || {}) },
          kugou: { ...EMPTY.kugou, ...(data.kugou || {}) },
        }
      } catch {
        cache = JSON.parse(JSON.stringify(EMPTY))
      }
      loading = null
      return cache
    })()
    return loading
  }

  async function save() {
    await mkdir(options.dir, { recursive: true })
    await writeFile(file, JSON.stringify(cache, null, 2), { encoding: 'utf8', mode: 0o600 })
  }

  return {
    /** Public summary for the settings UI (no cookies). */
    async summary() {
      const data = await load()
      return {
        netease: { loggedIn: data.netease.loggedIn === true, nickname: data.netease.nickname || '' },
        qq: { loggedIn: data.qq.loggedIn === true, nickname: data.qq.nickname || '' },
        kugou: { loggedIn: data.kugou.loggedIn === true, nickname: data.kugou.nickname || '' },
      }
    },
    /** Cookie for one provider ('' when signed out). */
    async cookie(provider) {
      const data = await load()
      return provider === 'netease' || provider === 'qq' || provider === 'kugou'
        ? data[provider].cookie || ''
        : ''
    },
    /** KuGou needs its device identity as well. */
    async session(provider) {
      const data = await load()
      if (provider !== 'kugou') return {}
      return {
        mid: data.kugou.mid || '',
        dfid: data.kugou.dfid || '',
        guid: data.kugou.guid || '',
        token: data.kugou.token || '',
        userid: Number(data.kugou.userid) || 0,
      }
    },
    /** Persist a successful login. */
    async setLogin(provider, value) {
      const data = await load()
      if (provider !== 'netease' && provider !== 'qq' && provider !== 'kugou') return
      data[provider] = { ...data[provider], ...value, loggedIn: true }
      await save()
    },
    /** Persist device identity (KuGou needs a stable mid). */
    async setSession(provider, value) {
      const data = await load()
      if (provider !== 'kugou') return
      data.kugou = {
        ...data.kugou,
        mid: String(value.mid ?? data.kugou.mid ?? ''),
        userid: Number(value.userid ?? data.kugou.userid ?? 0) || 0,
      }
      await save()
    },
    /** Clear one provider (or all when omitted). */
    async clear(provider) {
      const data = await load()
      if (provider === undefined) {
        cache = JSON.parse(JSON.stringify(EMPTY))
      } else if (provider === 'netease' || provider === 'qq' || provider === 'kugou') {
        data[provider] = JSON.parse(JSON.stringify(EMPTY[provider]))
      }
      await save()
    },
  }
}
