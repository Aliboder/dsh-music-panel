/**
 * 未登录的在线源在面板里的两处表现（源码级守卫，配合 page 渲染测试）：
 *   - 账号菜单只属于已登录的源：`p3SourceLoggedIn` 不能再把「已配置」当「已登录」；
 *   - 在线页加载失败不再把平台原始报错当正文：统一走 `p3FailureEmpty`，未登录给登录按钮。
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const read = (p) => readFileSync(join(root, p), 'utf8')

const core = read('src/client/panel-v3/p3-core.js')
const pages = read('src/client/panel-v3/p3-pages.js')
const strings = read('src/client/i18n/strings.js')
const routes = read('src/host/http/routes/online.js')

// ── 登录判定 ────────────────────────────────────────────────────────────
const loggedIn = /function p3SourceLoggedIn\(source\) \{([\s\S]*?)\n\}/.exec(core)
assert.ok(loggedIn, 'p3SourceLoggedIn is defined')
assert.match(loggedIn[1], /info\.loggedIn === true/, 'only loggedIn counts')
assert.doesNotMatch(loggedIn[1], /info\.configured === true/, 'configured must not mean signed in')

// ── 失败状态统一入口 ────────────────────────────────────────────────────
assert.match(pages, /function p3FailureEmpty\(options\) \{/)
assert.match(pages, /t\('p3\.loginRequired'\)/)
assert.match(pages, /t\('p3\.loginRequiredHint'\)/)
assert.match(pages, /t\('p3\.failureHint'\)/)
// 原始报错只放进 title，不再作为正文 hint 直接给出
assert.match(pages, /hintTitle: String\(options\.error \|\| ''\)/)
for (const raw of ['hint: state.error', 'hint: props.online.error', 'hint: props.online.albumError', 'hint: props.online.artistError', 'hint: props.online.artistAllError']) {
  assert.equal(pages.includes(raw), false, 'raw error must go through p3FailureEmpty: ' + raw)
}

// ── Host 侧：移植源的登录态以源内账号为准 ──────────────────────────────
assert.match(routes, /source\.folia === true && storedSignedIn \? await profileState\(source\.id\) : null/)
assert.match(routes, /source\.folia === true \? storedSignedIn && liveProfile !== null : storedSignedIn/)

// ── i18n：中英两份都要有 ───────────────────────────────────────────────
for (const key of ['p3.loginRequired', 'p3.loginRequiredHint', 'p3.failureHint']) {
  const hits = strings.split("'" + key + "'").length - 1
  assert.equal(hits >= 2, true, 'missing a language for ' + key)
}

console.log('online-guest-ui.test ok')
