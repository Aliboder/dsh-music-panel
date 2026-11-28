/**
 * 网易云移植源：bundle 加载、注册、宿主面（替身目录，不连网；工作线程起在后台，用完立刻收）。
 */

import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createFoliaNetease } from '../../src/host/vendor/netease-folia/source.bundle.mjs'
import { createFoliaSource } from '../../src/host/providers/sources/folia-bridge/bridge.js'

const dir = mkdtempSync(join(tmpdir(), 'dsh-netease-folia-'))
const module = createFoliaNetease({ dir, language: 'zh-CN' })
try {
  assert.equal(module.definition.id, 'netease')
  const families = Object.keys(module.definition.capabilities)
  for (const family of ['search@1', 'songs@1', 'playback.audio@1', 'lyrics@1', 'auth@1', 'library@1', 'catalog@1', 'recommendations@1', 'mutations@1', 'covers@1', 'reports@1']) {
    assert.ok(families.includes(family), 'missing capability family ' + family)
  }
  // main 入口登记的四条 rpc：状态、重启、诊断快照、自检。
  assert.deepEqual(module.host.rpc.names().sort(), ['diagnostics', 'restart', 'selfCheck', 'status'])
  assert.equal(module.host.texts.text('name.short'), '网易云')
  // 工作线程是磁盘文件：bundle 旁边的 worker.cjs 与它 require 的兄弟文件都在。
  for (const file of ['worker.cjs', 'neteaseApiStartup.cjs', 'backendLifecycle.cjs', 'networkRecorder.cjs']) {
    assert.equal(existsSync(join(process.cwd(), 'src/host/vendor/netease-folia', file)), true, 'missing ' + file)
  }

  const source = createFoliaSource({ definition: module.definition, sourceId: 'netease', texts: module.host.texts, qualityLevels: ['standard', 'high', 'lossless', 'hires'] })
  assert.equal(source.capabilities.search, true)
  assert.equal(source.capabilities.playback, true)
  assert.equal(source.capabilities.playbackReports, true, 'netease implements reports@1')
  assert.equal(source.capabilities.explore, false, 'explore@1 has no place in our UI yet')
} finally {
  await module.dispose()
  rmSync(dir, { recursive: true, force: true })
}

console.log('netease-folia-source.test ok')
