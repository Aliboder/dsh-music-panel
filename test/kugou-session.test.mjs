import assert from 'node:assert/strict'
import { createKugouSessionManager, isKugouAuthError } from '../lib/kugou-session.js'

function authError(code) {
  const error = new Error('auth ' + code)
  error.code = code
  return error
}

function fakeStore(row) {
  const calls = []
  let current = { ...row }
  return {
    calls,
    async session() {
      return { ...current, refreshedAt: current.token_refreshed_at || 0 }
    },
    async setLogin(_provider, value) {
      calls.push(['setLogin', value])
      current = { ...current, ...value, loggedIn: true, token_refreshed_at: Date.now() }
    },
    async markExpired() {
      calls.push(['markExpired'])
      current = { ...current, loggedIn: false, token: '' }
    },
  }
}

const base = { mid: '1', dfid: 'd', guid: 'g', token: 'old', userid: 42, token_refreshed_at: 0 }

{
  const store = fakeStore(base)
  const manager = createKugouSessionManager({
    providerStore: store,
    refresh: async (session) => ({ token: 'new', userid: String(session.userid), vipType: 'vip', vipToken: 'v' }),
    profile: async () => ({}),
    litePlaylists: async () => [],
  })
  const result = await manager.refreshIfDue('kugou')
  assert.equal(result.token, 'new')
  assert.equal(store.calls.filter((call) => call[0] === 'setLogin').length, 1)
  assert.equal(await manager.refreshIfDue('kugou'), null, 'fresh sessions are throttled')
}

{
  const store = fakeStore(base)
  const manager = createKugouSessionManager({
    providerStore: store,
    refresh: async () => { throw authError(20017) },
    profile: async () => { throw authError(20018) },
    litePlaylists: async () => [],
  })
  assert.equal(await manager.refreshIfDue('kugou'), null)
  assert.equal(store.calls.filter((call) => call[0] === 'markExpired').length, 1)
}

{
  const store = fakeStore(base)
  const manager = createKugouSessionManager({
    providerStore: store,
    refresh: async () => { throw authError(20017) },
    profile: async () => ({ nickname: 'still valid' }),
    litePlaylists: async () => [],
  })
  await manager.refreshIfDue('kugou')
  assert.equal(store.calls.filter((call) => call[0] === 'markExpired').length, 0, 'a refresh shape error must not sign the user out')
}

{
  const store = fakeStore({ ...base, token: 'lite' })
  const manager = createKugouSessionManager({
    providerStore: store,
    refresh: async () => ({}),
    profile: async () => ({}),
    litePlaylists: async () => [],
  })
  assert.equal((await manager.validate('kugouLite')).token, 'lite')
  assert.equal(store.calls.filter((call) => call[0] === 'markExpired').length, 0)
}

{
  const store = fakeStore({ ...base, token: 'lite' })
  const manager = createKugouSessionManager({
    providerStore: store,
    refresh: async () => ({}),
    profile: async () => ({}),
    litePlaylists: async () => { throw authError(20017) },
  })
  await manager.validate('kugouLite')
  assert.equal(store.calls.filter((call) => call[0] === 'markExpired').length, 1)
}

assert.equal(isKugouAuthError(authError(20017)), true)
assert.equal(isKugouAuthError(authError(20018)), true)
assert.equal(isKugouAuthError(new Error('fetch failed')), false)
console.log('kugou-session.test.mjs ok')
