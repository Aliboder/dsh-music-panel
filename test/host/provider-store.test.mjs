/**
 * The provider store facade: old API, new storage.
 *
 * These assertions are the contract the ~50 existing call sites rely on, plus the
 * explicit promise that an old `providers.json` is ignored (sign-ins are discarded).
 */

import assert from 'node:assert/strict'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createProviderStore, DEVICE_PROVIDERS, QR_PROVIDERS } from '../../src/host/providers/provider-store.js'

assert.deepEqual(QR_PROVIDERS, ['netease', 'qq', 'kugouLite', 'bodian', 'qishui'])
assert.deepEqual(DEVICE_PROVIDERS, ['kugouLite'])

const dir = await mkdtemp(join(tmpdir(), 'dsh-music-providers-'))
const store = createProviderStore({ dir })

// ── signed out ─────────────────────────────────────────────────────────────

const empty = await store.summary()
for (const provider of ['netease', 'qq', 'kugouLite', 'navidrome', 'bodian', 'qishui']) {
  assert.equal(empty[provider].loggedIn, false, `${provider} starts signed out`)
  assert.equal(empty[provider].nickname, '')
}
assert.equal(await store.cookie('netease'), '')
assert.deepEqual(await store.session('netease'), {})
assert.deepEqual(await store.session('navidrome'), {
  server: '', username: '', salt: '', token: '', password: '', nativeSongs: false,
})
assert.deepEqual(await store.session('kugouLite'), {
  mid: '', dfid: '', guid: '', token: '', vipType: '', vipToken: '', userid: 0, refreshedAt: 0,
})

// ── QR provider ────────────────────────────────────────────────────────────

await store.setLogin('netease', { cookie: 'MUSIC_U=secret', nickname: 'Alice', avatarUrl: 'https://a' })
assert.equal(await store.cookie('netease'), 'MUSIC_U=secret')
const signedIn = await store.summary()
assert.equal(signedIn.netease.loggedIn, true)
assert.equal(signedIn.netease.nickname, 'Alice')
assert.equal(signedIn.netease.avatarUrl, 'https://a')
assert.equal(JSON.stringify(signedIn).includes('MUSIC_U'), false, 'summary never leaks the cookie')

await store.markExpired('netease')
const expired = await store.summary()
assert.equal(expired.netease.loggedIn, false, 'markExpired keeps the row but flags it signed out')
assert.equal(await store.cookie('netease'), 'MUSIC_U=secret', 'cookie itself is not wiped by markExpired')

// ── device provider ────────────────────────────────────────────────────────

await store.setSession('kugouLite', { mid: 'mid-1', userid: 42 })
const device = await store.session('kugouLite')
assert.equal(device.mid, 'mid-1')
assert.equal(device.userid, 42)

await store.setLogin('kugouLite', {
  cookie: 'kg=1', token: 'tok', mid: 'mid-1', dfid: 'd', guid: 'g',
  userid: 42, nickname: 'KG', vip_type: 'v', vip_token: 'vt',
})
const kugouLiteSession = await store.session('kugouLite')
assert.equal(kugouLiteSession.token, 'tok')
assert.equal(kugouLiteSession.vipType, 'v')
assert.equal(kugouLiteSession.vipToken, 'vt')
assert.equal(kugouLiteSession.userid, 42)
assert.ok(kugouLiteSession.refreshedAt > 0, 'a KuGou login records its refresh time')

// setSession must not disturb the token.
await store.setSession('kugouLite', { mid: 'mid-2' })
assert.equal((await store.session('kugouLite')).mid, 'mid-2')
assert.equal((await store.session('kugouLite')).token, 'tok')

// ── Navidrome ──────────────────────────────────────────────────────────────

await store.setLogin('navidrome', {
  server: 'https://nd.example.com', username: 'bob', salt: 's', token: 't',
  password: '', nativeSongs: false, nickname: 'bob',
})
const nd = await store.session('navidrome')
assert.equal(nd.server, 'https://nd.example.com')
assert.equal(nd.token, 't')
assert.equal((await store.summary()).navidrome.nativeSongs, false)
assert.equal((await store.summary()).navidrome.server, 'https://nd.example.com')

// ── opaque session provider (Bodian) ───────────────────────────────────────

await store.setLogin('bodian', { token: 'bd-token', devices: ['d1'], nickname: 'Bodian User' })
const bodian = await store.summary()
assert.equal(bodian.bodian.loggedIn, true)
assert.equal(bodian.bodian.nickname, 'Bodian User')
const bodianEntry = await store.getEntry('bodian')
assert.equal(bodianEntry.credentials.token, 'bd-token')
assert.deepEqual(bodianEntry.credentials.devices, ['d1'])
assert.equal(bodianEntry.credentials.loggedIn, true)
assert.equal(JSON.stringify(bodian).includes('bd-token'), false, 'summary never leaks Bodian credentials')

// ── clearing ───────────────────────────────────────────────────────────────

await store.clear('netease')
assert.equal((await store.summary()).netease.loggedIn, false)
assert.equal(await store.cookie('netease'), '')

await store.clear()
for (const provider of ['qq', 'kugouLite', 'navidrome']) {
  assert.equal((await store.summary())[provider].loggedIn, false, `${provider} cleared`)
}
assert.deepEqual(await store.session('kugouLite'), {
  mid: '', dfid: '', guid: '', token: '', vipType: '', vipToken: '', userid: 0, refreshedAt: 0,
})

// ── the old file is ignored on purpose ─────────────────────────────────────

const legacyDir = await mkdtemp(join(tmpdir(), 'dsh-music-providers-legacy-'))
await writeFile(join(legacyDir, 'providers.json'), JSON.stringify({
  netease: { cookie: 'OLD=1', loggedIn: true, nickname: 'Old' },
}), 'utf8')
const legacy = createProviderStore({ dir: legacyDir })
assert.equal(await legacy.cookie('netease'), '', 'providers.json is not migrated')
assert.equal((await legacy.summary()).netease.loggedIn, false)

// An unknown provider is a no-op rather than a crash.
await store.setLogin('spotify', { cookie: 'x' })
assert.equal((await store.summary()).spotify, undefined)

console.log('provider-store.test.mjs ok')

