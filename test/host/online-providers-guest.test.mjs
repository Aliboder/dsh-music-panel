/**
 * `/online/providers`：登录态以移植源自己的账号为准。
 *
 * 迁移前写进 sessions.json 的网易云/QQ 等条目在移植后已经失效，如果继续信它，界面会把
 * 未登录显示成已登录（账号菜单出现「退出登录」、歌单页把平台报错当正文）。这里用两个替身源固定
 * 三条行为：移植源要核对、核对失败时清掉旧快照、非移植源保持原来的口径。
 */

import assert from 'node:assert/strict'
import { createOnlineRoutes } from '../../src/host/http/routes/online.js'
import { registry } from '../../src/host/providers/sources/index.js'
import { fakeReq, fakeRes } from '../helpers.mjs'

registry.register({ id: 'folia-guest', kind: 'online', displayName: 'Folia Guest', capabilities: { search: true }, folia: true })
registry.register({ id: 'folia-live', kind: 'online', displayName: 'Folia Live', capabilities: { search: true }, folia: true })
registry.register({ id: 'legacy-kept', kind: 'online', displayName: 'Legacy Kept', capabilities: { search: true } })

const summaries = {
  'folia-guest': { loggedIn: true, nickname: '旧昵称', avatarUrl: 'https://old/avatar', accountId: '9' },
  'folia-live': { loggedIn: true },
  'legacy-kept': { loggedIn: true, nickname: '旧昵称' },
}

const routes = createOnlineRoutes({
  settings: { get: () => ({}), read: async () => ({ roots: [] }) },
  providerStore: {
    summary: async () => summaries,
    cookie: async () => '',
    session: async () => ({}),
    setSession: async () => {},
  },
  accountStore: { summary: async () => ({}) },
  accountReads: undefined,
  // 移植源核对账号：guest 的源里没有账号，live 的有。
  profileState: async (id) => (id === 'folia-live' ? { nickname: '新昵称', avatarUrl: 'https://new/avatar', accountId: '7' } : null),
  vipInfoState: async () => ({ vip: null, expiresAt: '' }),
  vipState: async () => null,
  invalidateProviderCaches: () => {},
})

async function providers() {
  const res = fakeRes()
  const url = new URL('http://127.0.0.1/music/online/providers')
  await routes(fakeReq(url.pathname, 'GET', { host: '127.0.0.1:1' }), res, {
    url,
    pathname: '/online/providers',
    method: 'GET',
    params: url.searchParams,
  })
  assert.equal(res.status, 200)
  return res.json().providers
}

const rows = await providers()

// 1) 移植源自称登录、但源内没有账号 → 按匿名处理，旧昵称/头像不显示。
assert.notEqual(rows['folia-guest'].loggedIn, true)
assert.equal(rows['folia-guest'].status, 'anonymous')
assert.equal(rows['folia-guest'].nickname || '', '')
assert.equal(rows['folia-guest'].avatarUrl || '', '')
assert.equal(rows['folia-guest'].user, null)

// 2) 移植源里真有账号 → 已登录，并用源内资料覆盖旧快照。
assert.equal(rows['folia-live'].loggedIn, true)
assert.equal(rows['folia-live'].status, 'authenticated')
assert.equal(rows['folia-live'].nickname, '新昵称')
assert.equal(rows['folia-live'].avatarUrl, 'https://new/avatar')

// 3) 非移植源保持原口径：仍读会话快照，不额外问账号。
assert.equal(rows['legacy-kept'].loggedIn, true)
assert.equal(rows['legacy-kept'].status, 'authenticated')

console.log('online-providers-guest.test ok')
