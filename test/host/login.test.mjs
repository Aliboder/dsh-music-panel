/**
 * Login state machine + credential store tests. No network, no platform modules.
 */

import assert from 'node:assert/strict'
import { mkdtemp, readFile, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { accountSessionOf, createLoginState, LOGIN_STATUS } from '../../src/host/providers/login/state.js'
import { createLoginStore, SESSION_VERSION } from '../../src/host/providers/login/store.js'
import { caseIdOf, loginFailureOf } from '../../src/host/services/core/login-failure.js'
import { fail } from '../../src/host/http/http.js'
import { fakeRes } from '../helpers.mjs'

// ── state machine ───────────────────────────────────────────────────────────

{
  const calls = []
  const state = createLoginState({
    sourceId: 'demo',
    now: () => 1000,
    adapter: {
      start: async (kind) => {
        calls.push(['start', kind])
        return { key: 'k1', imageDataUrl: 'data:image/png;base64,xx', url: 'https://qr', expiresAt: 5000 }
      },
      poll: async (key) => {
        calls.push(['poll', key])
        return { status: 'waiting' }
      },
      readUser: async () => ({ id: 'u1', nickname: 'Alice' }),
    },
  })

  assert.equal(state.getSnapshot().status, LOGIN_STATUS.UNKNOWN)

  const started = await state.start('qr')
  assert.equal(started.status, LOGIN_STATUS.PENDING)
  assert.equal(started.key, 'k1')
  assert.equal(started.expiresAt, 5000)

  const waiting = await state.poll()
  assert.equal(waiting.status, LOGIN_STATUS.PENDING)

  state.getSnapshot()
  // Flip the adapter to success by rebuilding with a success poll.
  const success = createLoginState({
    sourceId: 'demo',
    adapter: {
      start: async () => ({ key: 'k2', expiresAt: 0 }),
      poll: async () => ({ status: 'success', session: { cookie: 'c' } }),
      readUser: async () => ({ id: 'u1', nickname: 'Alice' }),
    },
  })
  await success.start('qr')
  const done = await success.poll()
  assert.equal(done.status, LOGIN_STATUS.AUTHENTICATED)
  assert.deepEqual(done.session, { cookie: 'c' })
  assert.equal(done.user.nickname, 'Alice')
  assert.deepEqual(calls[0], ['start', 'qr'])
}

{
  // A late cancel belongs to its own attempt: it must not clear a newer key.
  const cancelled = []
  const state = createLoginState({
    sourceId: 'demo',
    adapter: {
      start: async () => ({ key: 'current', expiresAt: 0 }),
      poll: async () => ({ status: 'waiting' }),
      cancel: async (key) => {
        cancelled.push(key)
      },
    },
  })
  await state.start('qr')
  const kept = await state.cancel('older')
  assert.equal(kept.status, LOGIN_STATUS.PENDING)
  assert.equal(kept.key, 'current', 'the newer attempt survives a stale cancel')
  assert.deepEqual(cancelled, ['older'])
  const cleared = await state.cancel()
  assert.equal(cleared.key, '')
  assert.deepEqual(cancelled, ['older', 'current'])
}

{
  // Expiry wins over polling.
  const state = createLoginState({
    sourceId: 'demo',
    now: () => 10_000,
    adapter: { start: async () => ({ key: 'k', expiresAt: 2000 }), poll: async () => ({ status: 'waiting' }) },
  })
  await state.start('qr')
  assert.equal((await state.poll()).status, LOGIN_STATUS.EXPIRED)
}

{
  // Adapter-reported expiry and hard failure.
  const expired = createLoginState({
    sourceId: 'demo',
    adapter: { start: async () => ({ key: 'k' }), poll: async () => ({ status: 'expired', message: 'gone' }) },
  })
  await expired.start('qr')
  assert.equal((await expired.poll()).status, LOGIN_STATUS.EXPIRED)

  const failed = createLoginState({
    sourceId: 'demo',
    adapter: { start: async () => ({ key: 'k' }), poll: async () => ({ status: 'failed', message: 'nope' }) },
  })
  await failed.start('qr')
  const snapshot = await failed.poll()
  assert.equal(snapshot.status, LOGIN_STATUS.ERROR)
  assert.equal(snapshot.failure.code, 'auth-required')
}

{
  // Thrown errors are classified, not swallowed into a string.
  const state = createLoginState({
    sourceId: 'demo',
    adapter: {
      start: async () => {
        throw new Error('fetch failed')
      },
    },
  })
  const snapshot = await state.start('qr')
  assert.equal(snapshot.status, LOGIN_STATUS.ERROR)
  assert.equal(snapshot.failure.code, 'network')
  assert.equal(snapshot.failure.retryable, true)
}

{
  // Password flow.
  const state = createLoginState({
    sourceId: 'navidrome',
    adapter: {
      submit: async (form) => (form.password === 'ok'
        ? { status: 'success', session: { token: 't' } }
        : { status: 'failed', message: 'bad password' }),
    },
  })
  const good = await state.submit({ password: 'ok' })
  assert.equal(good.status, LOGIN_STATUS.AUTHENTICATED)

  const bad = await state.submit({ password: 'no' })
  assert.equal(bad.status, LOGIN_STATUS.ERROR)
  assert.equal(bad.message, 'bad password')
}

{
  // Missing capability is reported, not thrown.
  const state = createLoginState({ sourceId: 'x', adapter: {} })
  const snapshot = await state.start()
  assert.equal(snapshot.status, LOGIN_STATUS.ERROR)
  assert.equal(snapshot.failure.code, 'unavailable')
}

{
  // Restore / refresh / reset.
  const state = createLoginState({
    sourceId: 'demo',
    adapter: {
      isExpired: (session) => session.expired === true,
      refresh: async (session) => (session.renewable ? { cookie: 'new' } : null),
    },
  })
  assert.equal((await state.restore({ cookie: 'a' }, { nickname: 'A' })).status, LOGIN_STATUS.AUTHENTICATED)
  assert.equal((await state.restore({ expired: true })).status, LOGIN_STATUS.EXPIRED)
  assert.equal((await state.restore(null)).status, LOGIN_STATUS.ANONYMOUS)

  await state.restore({ cookie: 'a', renewable: true })
  assert.equal((await state.refresh()).session.cookie, 'new')

  await state.restore({ cookie: 'a', renewable: false })
  assert.equal((await state.refresh()).status, LOGIN_STATUS.EXPIRED)

  assert.equal(state.reset().status, LOGIN_STATUS.ANONYMOUS)
}

// ── credential store ────────────────────────────────────────────────────────

{
  const dir = await mkdtemp(join(tmpdir(), 'dsh-music-login-'))
  const store = createLoginStore({ dir })

  assert.equal(await store.get('netease'), null)
  assert.deepEqual(await store.summary(), {})

  await store.save('netease', { cookie: 'MUSIC_U=secret' }, { nickname: 'Alice' })
  const entry = await store.get('netease')
  assert.deepEqual(entry.credentials, { cookie: 'MUSIC_U=secret' })
  assert.equal(entry.profile.nickname, 'Alice')
  assert.equal(typeof entry.updatedAt, 'number')

  const summary = await store.summary()
  assert.equal(summary.netease.signedIn, true)
  assert.equal(JSON.stringify(summary).includes('MUSIC_U'), false, 'summary never leaks credentials')

  // Profile updates keep the credentials.
  await store.saveProfile('netease', { nickname: 'Alice 2' })
  const updated = await store.get('netease')
  assert.deepEqual(updated.credentials, { cookie: 'MUSIC_U=secret' })
  assert.equal(updated.profile.nickname, 'Alice 2')

  const raw = JSON.parse(await readFile(store.file, 'utf8'))
  assert.equal(raw.version, SESSION_VERSION)
  assert.ok(raw.sessions.netease)

  if (process.platform !== 'win32') {
    const mode = (await stat(store.file)).mode & 0o777
    assert.equal(mode, 0o600, 'credential file must be 0600')
  }

  await store.clear('netease')
  assert.equal(await store.get('netease'), null)

  await store.save('a', { c: 1 })
  await store.save('b', { c: 2 })
  await store.clearAll()
  assert.deepEqual(await store.summary(), {})

  // A file from an older/unknown schema is treated as empty rather than trusted.
  const legacyDir = await mkdtemp(join(tmpdir(), 'dsh-music-login-legacy-'))
  const legacy = createLoginStore({ dir: legacyDir })
  const { writeFile } = await import('node:fs/promises')
  await writeFile(legacy.file, JSON.stringify({ netease: { cookie: 'old' } }), 'utf8')
  assert.equal(await legacy.get('netease'), null)
}

console.log('login.test.mjs ok')

// ── bridge (state machine wired to a platform) ──────────────────────────────

{
  const { createLoginBridge, createQrAdapter, credentialsOf } = await import('../../src/host/providers/login/bridge.js')

  const calls = []
  const omni = {
    loginStart: async (id, ctx, mode) => {
      calls.push(['start', id, mode, ctx.session])
      return { key: 'k1', imageDataUrl: 'data:img', url: 'https://qr', expiresAt: 0 }
    },
    loginStatus: async (id, key, mode) => {
      calls.push(['status', id, key, mode])
      return {
        status: 'success',
        cookie: 'MUSIC_U=x',
        token: 'tk',
        device: { mid: 'm', dfid: 'd', guid: 'g' },
        userid: 7,
        nickname: 'Alice',
        avatarUrl: 'https://a',
        vipType: 'vip',
        vipToken: 'vt',
      }
    },
  }

  const saved = []
  const cleared = []
  const bridge = createLoginBridge({
    adapters: {
      netease: (mode) => createQrAdapter({ sourceId: 'netease', omni, mode: mode || 'qq', getSession: async () => ({ cookie: 'old' }) }),
    },
    store: {
      save: async (id, credentials, user) => saved.push([id, credentials, user]),
      clear: async (id) => cleared.push(id),
    },
  })

  const started = await bridge.start('netease', 'wx')
  assert.equal(started.status, LOGIN_STATUS.PENDING)
  assert.equal(started.key, 'k1')
  assert.deepEqual(calls[0], ['start', 'netease', 'wx', { cookie: 'old' }])

  const polled = await bridge.poll('netease')
  assert.equal(polled.status, LOGIN_STATUS.AUTHENTICATED)
  assert.equal(saved.length, 1)
  assert.equal(saved[0][0], 'netease')
  assert.deepEqual(saved[0][1], {
    cookie: 'MUSIC_U=x',
    token: 'tk',
    mid: 'm',
    dfid: 'd',
    guid: 'g',
    userid: 7,
    nickname: 'Alice',
    avatarUrl: 'https://a',
    vip_type: 'vip',
    vip_token: 'vt',
  })
  assert.equal(saved[0][2].nickname, 'Alice')

  await bridge.logout('netease')
  assert.deepEqual(cleared, ['netease'])

  // Waiting keeps the pending status and exposes the raw platform status.
  const waiting = createLoginBridge({
    adapters: {
      qq: () => createQrAdapter({ sourceId: 'qq', omni: { loginStart: async () => ({ key: 'k' }), loginStatus: async () => ({ status: 'scanned', message: 'scan now' }) }, mode: 'qq', getSession: async () => ({}) }),
    },
    store: { save: async () => { throw new Error('must not persist while pending') }, clear: async () => {} },
  })
  await waiting.start('qq', 'qq')
  const paused = await waiting.poll('qq')
  assert.equal(paused.status, LOGIN_STATUS.PENDING)
  assert.equal(paused.detail, 'scanned')
  assert.equal(paused.message, 'scan now')

  // credentialsOf tolerates a minimal answer.
  assert.deepEqual(credentialsOf({}), {
    cookie: '', token: '', mid: '', dfid: '', guid: '', userid: 0, nickname: '', avatarUrl: '', vip_type: '', vip_token: '',
  })

  // An opaque session (Bodian) is persisted whole, not flattened into cookie/token.
  {
    const bodianSaved = []
    const bodian = createLoginBridge({
      adapterFor: () => createQrAdapter({
        sourceId: 'bodian',
        omni: {
          loginStart: async () => ({ key: 'bk', expiresAt: Date.now() + 60_000 }),
          loginStatus: async () => ({ status: 'success', session: { token: 'bd', devices: ['d'] }, user: { id: 'u', nickname: 'B' } }),
          cancelLogin: async () => {},
        },
        mode: 'qq',
        getSession: async () => ({}),
      }),
      store: { save: async (id, credentials, user) => bodianSaved.push([id, credentials, user]), clear: async () => {} },
    })
    await bodian.start('bodian', 'qq')
    const done = await bodian.poll('bodian')
    assert.equal(done.status, LOGIN_STATUS.AUTHENTICATED)
    assert.deepEqual(bodianSaved[0][1], { token: 'bd', devices: ['d'] })
    assert.equal(bodianSaved[0][2].nickname, 'B')
  }
}

// Folia-shaped account session view over the host state machine.
{
  const pending = accountSessionOf({
    sourceId: 'netease',
    status: LOGIN_STATUS.PENDING,
    detail: 'scanned',
    imageDataUrl: 'data:image/png;base64,x',
    key: 'k1',
    failure: null,
  })
  assert.equal(pending.providerId, 'netease')
  assert.equal(pending.phase, 'scanned')
  assert.equal(pending.codeImage, 'data:image/png;base64,x')
  assert.equal(pending.failure, null)

  const auth = accountSessionOf({ sourceId: 'qq', status: LOGIN_STATUS.AUTHENTICATED, failure: null })
  assert.equal(auth.phase, 'account')

  const failed = accountSessionOf({
    sourceId: 'kugou',
    status: LOGIN_STATUS.ERROR,
    failure: { code: 'network', message: 'offline', at: 123 },
  })
  assert.equal(failed.phase, 'failed')
  assert.equal(failed.failure.case.id, 'network')
  assert.equal(failed.failure.facts.message, 'offline')

  assert.equal(accountSessionOf({ sourceId: 'qq', status: LOGIN_STATUS.UNKNOWN }), null)
}


// ── failure cases（Folia 的 case 词表） ─────────────────────────────────────

{
  const of = (step, error) => loginFailureOf(step, error)

  assert.equal(of('start', { code: 'not-configured' }).case.id, 'local-service-unavailable')
  assert.equal(of('start', { code: 'network' }).case.id, 'unreachable')
  assert.equal(of('start', { message: 'boom' }).case.id, 'unknown')
  assert.equal(of('check', { code: 'network' }).case.id, 'unreachable')
  assert.equal(of('check', { status: 502 }).case.id, 'unreachable')
  assert.equal(of('check', { status: 403 }).case.id, 'refused')
  assert.equal(of('check', { code: 'auth-required' }).case.id, 'refused')
  assert.equal(of('check', { code: 'rate-limited' }).case.id, 'retry-later')
  assert.equal(of('check', { status: 429 }).case.id, 'retry-later')
  assert.equal(of('check', { status: 502, retryAfterMs: 30000 }).case.id, 'retry-later')
  assert.equal(of('wait', { scanned: true }).case.id, 'expired-after-scan')
  assert.equal(of('wait', {}).case.id, 'code-expired')
  assert.equal(of('account', {}).case.id, 'account-not-read')
  // A provider that already knows says so; the table supplies kind/action.
  const named = of('check', { case: 'device-limit' })
  assert.equal(named.case.id, 'device-limit')
  assert.equal(named.case.kind, 'C')
  assert.equal(named.case.action, 'retry')
  assert.equal(named.message.includes('设备'), true)
  // Facts are carried through so the window can show the detail.
  const facts = of('check', { status: 502, message: 'socket hang up' })
  assert.equal(facts.facts.httpStatus, 502)
  assert.equal(facts.facts.messageText, 'socket hang up')
  assert.equal(caseIdOf(facts.facts), 'unreachable')
}

{
  // fail() hands the case to the client beside the message the window shows.
  const failure = loginFailureOf('start', { code: 'network' })
  const res = fakeRes()
  fail(res, 502, 'LOGIN_START_FAILED', failure.message, { failure: failure.case, facts: failure.facts })
  const body = res.json()
  assert.equal(body.ok, false)
  assert.equal(body.error.code, 'LOGIN_START_FAILED')
  assert.equal(body.error.message, failure.message)
  assert.equal(body.error.failure.id, 'unreachable')
  assert.equal(body.error.facts.step, 'start')
}

// ── transient poll / cancel ────────────────────────────────────────────────

{
  let cancelled = 0
  const state = createLoginState({
    sourceId: 'demo',
    adapter: {
      start: async () => ({ key: 'k', expiresAt: Date.now() + 60_000 }),
      poll: async () => ({ status: 'failed', transient: true, message: 'socket reset' }),
      cancel: async () => { cancelled += 1 },
    },
  })
  await state.start('qr')
  const first = await state.poll()
  assert.equal(first.status, LOGIN_STATUS.PENDING)
  assert.equal(first.transient, true)
  const second = await state.poll()
  assert.equal(second.status, LOGIN_STATUS.PENDING)
  const third = await state.poll()
  assert.equal(third.status, LOGIN_STATUS.ERROR)

  await state.start('qr')
  await state.cancel()
  assert.equal(cancelled, 1)
  assert.equal(state.getSnapshot().status, LOGIN_STATUS.ANONYMOUS)
}

{
  // The Folia-shaped session view carries the fields the wide window needs.
  const view = accountSessionOf({
    sourceId: 'qq',
    sessionId: 4,
    status: LOGIN_STATUS.PENDING,
    detail: 'waiting',
    key: 'k',
    expiresAt: 1234,
    methods: [{ id: 'qq' }, { id: 'wx' }],
    selectedMethodId: 'wx',
    failure: null,
  })
  assert.equal(view.sessionId, 4)
  assert.equal(view.expiresAt, 1234)
  assert.deepEqual(view.methods, [{ id: 'qq' }, { id: 'wx' }])
  assert.equal(view.selectedMethodId, 'wx')
}

console.log('login-session.test ok')

// ── account snapshot ───────────────────────────────────────────────────────

{
  const { createAccountStore } = await import('../../src/host/stores/accounts.js')
  const { createAccountReads } = await import('../../src/host/services/account-read.js')
  const { createProviderStore } = await import('../../src/host/providers/provider-store.js')

  const dir = await mkdtemp(join(tmpdir(), 'dsh-music-accounts-'))
  const accountStore = createAccountStore({ dir })
  const providerStore = createProviderStore({ dir })
  await providerStore.setLogin('netease', { cookie: 'MUSIC_U=secret', nickname: 'Alice' })

  let failProfile = false
  const omni = {
    capabilities: () => ({ userPlaylists: true, likes: true }),
    profile: async () => {
      if (failProfile) throw new Error('offline')
      return { nickname: 'Alice', avatarUrl: 'https://a', accountId: 'u1' }
    },
    myPlaylists: async () => [{ id: 'p1', name: 'Mine' }],
    likedIds: async () => ['online:netease:1'],
  }
  const reads = createAccountReads({ accountStore, providerStore, omni })

  const first = await reads.read('netease', 'sign-in')
  assert.equal(first.user.nickname, 'Alice')
  assert.equal(first.collections[0].id, 'p1')
  assert.deepEqual(first.likedSongIds, ['online:netease:1'])
  assert.equal(first.freshness, 'fresh')

  const raw = await readFile(accountStore.file, 'utf8')
  assert.equal(raw.includes('MUSIC_U'), false, 'account snapshot never holds credentials')

  failProfile = true
  const failed = await reads.read('netease', 'sync')
  assert.equal(failed.user.nickname, 'Alice', 'a failed read keeps the last account')
  assert.equal(failed.freshness, 'error')
  assert.equal(failed.error, 'offline')

  await reads.signOut('netease')
  assert.equal(await accountStore.get('netease'), null)
}

console.log('account-read.test ok')
