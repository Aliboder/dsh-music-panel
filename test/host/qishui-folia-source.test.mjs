/**
 * 汽水移植源：bundle 加载、注册、宿主面，以及 ticket guard 的续期重试（不连网）。
 */

import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createFoliaQishui } from '../../src/host/vendor/qishui-folia/source.bundle.mjs'
import { createFoliaSource } from '../../src/host/providers/sources/folia-bridge/bridge.js'
import { withAuthRetry } from '../../src/host/providers/sources/folia-bridge/retry.js'

const dir = mkdtempSync(join(tmpdir(), 'dsh-qishui-folia-'))
try {
  const { definition, host } = createFoliaQishui({ dir, language: 'zh-CN' })
  assert.equal(definition.id, 'qishui')
  const families = Object.keys(definition.capabilities)
  for (const family of ['search@1', 'songs@1', 'playback.audio@1', 'lyrics@1', 'auth@1', 'catalog@1', 'library@1', 'recommendations@1', 'mutations@1']) {
    assert.ok(families.includes(family), 'missing capability family ' + family)
  }
  assert.equal(typeof host.texts.text('name.short'), 'string')

  // 映射层：汽水的能力族里没有 explore 的入口，我们也不声明它。
  const source = createFoliaSource({ definition, sourceId: 'qishui', texts: host.texts, qualityLevels: ['standard', 'high', 'lossless'] })
  assert.equal(source.id, 'qishui')
  assert.equal(source.capabilities.search, true)
  assert.equal(source.capabilities.playback, true)
  assert.equal(source.capabilities.explore, false, 'explore@1 has no place in our UI yet')
} finally {
  rmSync(dir, { recursive: true, force: true })
}

// ── withAuthRetry：报出凭据过期时续期一次并重试 ────────────────────────────
{
  let attempts = 0
  let refreshed = 0
  const definition = {
    id: 'qishui',
    capabilities: {
      'library@1': {
        async getUserPlaylists() {
          attempts += 1
          if (attempts === 1) throw Object.assign(new Error('Qishui says 28001008'), { code: 'auth-required' })
          return { items: [], hasMore: false }
        },
      },
      'auth@1': {
        async getLoginStatus() {
          refreshed += 1
          return { id: 'u1', nickname: 'n' }
        },
      },
    },
  }
  const wrapped = withAuthRetry(definition, {
    shouldRefresh: (error) => error.code === 'auth-required' || /28001008/.test(error.message),
    refresh: () => definition.capabilities['auth@1'].getLoginStatus(),
  })
  const answered = await wrapped.capabilities['library@1'].getUserPlaylists()
  assert.deepEqual(answered, { items: [], hasMore: false })
  assert.equal(attempts, 2, 'retried once')
  assert.equal(refreshed, 1, 'renewed once, by reading the account')

  // 别的错误不续期、不重试。
  let otherAttempts = 0
  const plain = withAuthRetry({ capabilities: { 'search@1': { async searchSongs() { otherAttempts += 1; throw new Error('boom') } } } }, {
    shouldRefresh: () => false,
    refresh: async () => {},
  })
  await assert.rejects(plain.capabilities['search@1'].searchSongs('x'), /boom/)
  assert.equal(otherAttempts, 1)

  // 续期后仍失败：照常抛第二次的错，不会无限重试。
  let always = 0
  const broken = withAuthRetry({ capabilities: { 'a@1': { async run() { always += 1; throw Object.assign(new Error('gone'), { code: 'auth-required' }) } } } }, {
    shouldRefresh: () => true,
    refresh: async () => {},
  })
  await assert.rejects(broken.capabilities['a@1'].run(), /gone/)
  assert.equal(always, 2)
}

console.log('qishui-folia-source.test ok')
