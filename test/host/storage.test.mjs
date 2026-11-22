/**
 * 存储与备份的 Host 侧：缓存目录与目录监视配置、按类别清空、批量导出歌词、
 * watcher 版本号。界面在 client，但这些动作都必须真的落到磁盘。
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { clearDataCategory, inspectData } from '../../src/host/services/media/plugin-data.js'
import { createLyricState } from '../../src/host/stores/lyric-state.js'
import { createRoutes } from '../../src/host/http/routes.js'
import { fakeReq, fakeRes } from '../helpers.mjs'

async function dataDir() {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-music-storage-'))
  await mkdir(join(dir, 'lyrics'), { recursive: true })
  await mkdir(join(dir, 'cache'), { recursive: true })
  await writeFile(join(dir, 'settings.json'), '{}')
  await writeFile(join(dir, 'favorites.json'), '{"favorites":[]}')
  await writeFile(join(dir, 'playlists.json'), '{"playlists":[]}')
  await writeFile(join(dir, 'lyric-states.json'), '{"version":1,"tracks":{}}')
  return dir
}

function routesFor(dir, extra = {}) {
  let config = { roots: [], hiddenRoots: [], depth: 4, extensions: ['mp3'], cacheDir: '', watchFolders: false }
  const calls = { setDir: [], sync: 0 }
  const handle = createRoutes({
    settings: {
      read: async () => config,
      write: async (patch) => {
        config = { ...config, ...patch }
        return config
      },
      dir,
      home: dir,
      file: join(dir, 'settings.json'),
    },
    library: { scan: async () => ({ tracks: [] }) },
    mediaCache: {
      setDir(next) {
        calls.setDir.push(next)
      },
      ensure: async () => {},
    },
    watcher: {
      sync() {
        calls.sync += 1
      },
    },
    getLibraryRevision: () => 7,
    ...extra,
  })
  return { handle, calls, config: () => config }
}

test('clearDataCategory清空一个类别，其它类别保留', async () => {
  const dir = await dataDir()
  try {
    const before = await inspectData(dir)
    assert.ok(before.categories.some((row) => row.id === 'favorites'))
    const cleared = await clearDataCategory(dir, 'favorites')
    assert.ok(cleared.removed.includes('favorites.json'))
    const after = await inspectData(dir)
    assert.equal(after.categories.some((row) => row.id === 'favorites'), false)
    assert.ok(after.categories.some((row) => row.id === 'playlists'), 'the neighbouring category stays')
    // settings/accounts are not addressable here.
    const guarded = await clearDataCategory(dir, 'settings')
    assert.deepEqual(guarded.removed, [])
    assert.equal(await readFile(join(dir, 'settings.json'), 'utf8'), '{}')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('config 返回并保存缓存目录与目录监视开关', async () => {
  const dir = await dataDir()
  try {
    const { handle, calls, config } = routesFor(dir)
    let res = fakeRes()
    await handle(fakeReq('/music/config'), res)
    assert.equal(res.status, 200)
    assert.equal(res.json().defaultCacheDir, join(dir, 'cache'))
    assert.equal(res.json().effectiveCacheDir, join(dir, 'cache'))

    res = fakeRes()
    await handle(
      fakeReq('/music/config', 'POST', { 'content-type': 'application/json' }, JSON.stringify({ cacheDir: join(dir, 'custom-cache'), watchFolders: true })),
      res,
    )
    assert.equal(res.status, 200)
    assert.equal(res.json().config.cacheDir, join(dir, 'custom-cache'))
    assert.equal(res.json().config.watchFolders, true)
    assert.equal(res.json().effectiveCacheDir, join(dir, 'custom-cache'))
    assert.deepEqual(calls.setDir, [join(dir, 'custom-cache')], 'the cache store follows the setting')
    assert.equal(calls.sync, 1, 'the watcher resyncs')
    assert.equal(config().watchFolders, true)

    res = fakeRes()
    await handle(
      fakeReq('/music/config', 'POST', { 'content-type': 'application/json' }, JSON.stringify({ cacheDir: 'relative/cache' })),
      res,
    )
    assert.equal(res.status, 400)
    assert.equal(res.json().error.code, 'BAD_CACHE_DIR')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('按类别清空的 HTTP 入口拒绝 settings，清空 favorites', async () => {
  const dir = await dataDir()
  try {
    const { handle } = routesFor(dir)
    let res = fakeRes()
    await handle(fakeReq('/music/data/clear', 'POST', { 'content-type': 'application/json' }, '{"category":"settings"}'), res)
    assert.equal(res.status, 400)
    assert.equal(res.json().error.code, 'BAD_CATEGORY')
    res = fakeRes()
    await handle(fakeReq('/music/data/clear', 'POST', { 'content-type': 'application/json' }, '{"category":"favorites"}'), res)
    assert.equal(res.status, 200)
    assert.equal(res.json().category, 'favorites')
    assert.equal(await inspectData(dir).then((data) => data.categories.some((row) => row.id === 'favorites')), false)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('批量导出歌词把每条缓存的歌词写成文件', async () => {
  const dir = await dataDir()
  try {
    const lyricState = createLyricState({ dir })
    await lyricState.writePayload('D:/Music/晴天.mp3', { text: '[00:01.000]晴天', formatHint: 'lrc' })
    await lyricState.patch('D:/Music/晴天.mp3', { source: 'local' })
    await lyricState.writePayload('online:qq:42', { text: '[00:01.000]在线', formatHint: 'lrc' })
    await lyricState.patch('online:qq:42', { source: 'online' })
    const { handle } = routesFor(dir, { lyricState })
    let res = fakeRes()
    await handle(fakeReq('/music/data/export-lyrics', 'POST', { 'content-type': 'application/json' }, '{}'), res)
    assert.equal(res.status, 200)
    assert.equal(res.json().count, 2)
    const names = (await readdir(res.json().dir)).sort()
    assert.deepEqual(names, ['qq-42.lrc', '晴天.lrc'])
    assert.equal(await readFile(join(res.json().dir, '晴天.lrc'), 'utf8'), '[00:01.000]晴天')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('library revision 与 reveal-dir 的边界', async () => {
  const dir = await dataDir()
  try {
    const { handle } = routesFor(dir)
    let res = fakeRes()
    await handle(fakeReq('/music/library/revision'), res)
    assert.equal(res.status, 200)
    assert.equal(res.json().revision, 7)

    res = fakeRes()
    await handle(fakeReq('/music/reveal-dir', 'POST', { 'content-type': 'application/json' }, '{"kind":"../../etc"}'), res)
    assert.equal(res.status, 400)
    assert.equal(res.json().error.code, 'BAD_REQUEST')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
