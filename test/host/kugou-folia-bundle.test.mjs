/**
 * The ported Folia KuGou source, loaded the way the Host loads it: the committed bundle,
 * a temp data directory, no network. Checks that the upstream main entry registered its
 * rpc operations, that the client entry registered a definition with the expected
 * capability families, and that the plugin-side host surfaces (seal, stores, texts) work.
 */

import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createFoliaKugou } from '../../src/host/vendor/kugou-folia/source.bundle.mjs'

const dir = mkdtempSync(join(tmpdir(), 'dsh-kugou-folia-'))
try {
  const { definition, call, host } = createFoliaKugou({ dir, language: 'zh-CN' })

  // ── the definition the upstream client entry registered ───────────────────
  assert.equal(definition.id, 'kugou')
  assert.equal(definition.displayName, 'KuGou Music')
  const families = Object.keys(definition.capabilities)
  for (const family of ['search@1', 'songs@1', 'playback.audio@1', 'lyrics@1', 'auth@1', 'library@1', 'catalog@1', 'recommendations@1', 'mutations@1']) {
    assert.ok(families.includes(family), 'missing capability family ' + family)
  }
  assert.deepEqual(definition.getAvailability(), { configured: true })

  // ── the main entry's rpc handlers ─────────────────────────────────────────
  assert.deepEqual(host.rpc.names().sort(), ['anonymousSearch', 'legacyPlayInfo', 'request'])
  await assert.rejects(call('anonymousSearch', 'x', 0, 10), /a keyword and two page numbers/)
  await assert.rejects(call('legacyPlayInfo', 'not-a-hash'), /a track hash/)

  // ── the vendored KuGouMusicApi the upstream main entry imports ─────────────
  // The bundle loads it by the specifier `../kugoumusicapi/main.js`, relative to the bundle's own
  // directory; resolving it here from that same directory is what the installed layout does.
  const bundleDir = new URL('../../src/host/vendor/kugou-folia/', import.meta.url)
  // ESM importing that CJS entry hands the flat API table as the namespace's `default` (its exports are
  // assembled at load time, so no named exports): that is exactly what the upstream loader spreads.
  const vendored = await import(new URL('../kugoumusicapi/main.js', bundleDir).href)
  assert.equal(typeof vendored.default.search, 'function')
  assert.equal(typeof vendored.default.song_url_new, 'function')
  // The package's generate_simulate.js calls generateWebGLHash without importing it; the adapter puts
  // the vendored copy on globalThis before the first rpc call.
  assert.equal(typeof globalThis.generateWebGLHash, 'function')

  // ── plugin-side surfaces the desktop host used to provide ─────────────────
  const sealed = host.seal.seal('token=abc;userid=1')
  assert.equal(host.seal.available(), true)
  assert.notEqual(sealed, 'token=abc;userid=1')
  assert.equal(host.seal.open(sealed), 'token=abc;userid=1')

  host.legacyStore.set('KUGOU_API_SESSION_V2', '{"version":2}')
  assert.equal(host.legacyStore.get('KUGOU_API_SESSION_V2'), '{"version":2}')
  assert.equal(host.legacyStore.has('KUGOU_API_SESSION_V2'), true)
  assert.equal(JSON.parse(readFileSync(join(dir, 'kugou-legacy-store.json'), 'utf8')).KUGOU_API_SESSION_V2, '{"version":2}')
  host.legacyStore.delete('KUGOU_API_SESSION_V2')
  assert.equal(host.legacyStore.has('KUGOU_API_SESSION_V2'), false)

  const page = host.pageStore('kugou')
  page.set('userid', '42')
  assert.equal(page.get('userid'), '42')
  assert.deepEqual(page.keys(), ['userid'])
  page.set('userid', null)
  assert.equal(page.get('userid'), null)

  // ── texts: the mod's own locale files, resolved at the boundary ───────────
  assert.equal(host.texts.text('name.short'), '酷狗')
  assert.equal(host.texts.resolveText(definition.shortName), '酷狗')
  assert.equal(host.texts.resolveText({ i18nKey: 'cloud.name' }), '音乐云盘')
  assert.equal(host.texts.resolveText({ i18nKey: 'listeningRank.week' }), '听歌排行 · 最近一周')
  assert.equal(host.texts.resolveText({ i18nKey: 'name.short', params: {} }), '酷狗')

  console.log('KUGOU FOLIA BUNDLE TEST OK')
} finally {
  rmSync(dir, { recursive: true, force: true })
}
