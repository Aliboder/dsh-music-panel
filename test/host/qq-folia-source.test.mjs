/**
 * QQ 移植源：bundle 加载与注册（不连网、不拉起内嵌后端）。
 */

import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createFoliaQq } from '../../src/host/vendor/qq-folia/source.bundle.mjs'
import { createFoliaSource } from '../../src/host/providers/sources/folia-bridge/bridge.js'

const dir = mkdtempSync(join(tmpdir(), 'dsh-qq-folia-'))
try {
  const { definition, host } = createFoliaQq({ dir, language: 'zh-CN' })
  assert.equal(definition.id, 'qq')
  const families = Object.keys(definition.capabilities)
  for (const family of ['search@1', 'songs@1', 'playback.audio@1', 'lyrics@1', 'auth@1', 'library@1', 'catalog@1', 'recommendations@1', 'mutations@1', 'covers@1']) {
    assert.ok(families.includes(family), 'missing capability family ' + family)
  }
  // main 入口登记的四条 rpc：后端状态、musicu 中转、诊断快照、自检。
  assert.deepEqual(host.rpc.names().sort(), ['diagnostics', 'musicu', 'selfCheck', 'status'])
  assert.equal(typeof host.texts.text('name.short'), 'string')
  // paths.legacy 造出受信表认领的目录（QQ 的设备标识文件放在那里）。
  const folder = host.api.paths.legacy('qq-auth-state')
  assert.equal(folder.endsWith('qq-auth-state'), true)

  const source = createFoliaSource({ definition, sourceId: 'qq', texts: host.texts, qualityLevels: ['standard', 'high', 'lossless', 'hires'] })
  assert.equal(source.capabilities.search, true)
  assert.equal(source.capabilities.playback, true)
  assert.equal(source.capabilities.explore, false, 'explore@1 has no place in our UI yet')
  // 断开：不调 status，别把内嵌后端拉起来。
  await host.dispose()
} finally {
  rmSync(dir, { recursive: true, force: true })
}

console.log('qq-folia-source.test ok')
