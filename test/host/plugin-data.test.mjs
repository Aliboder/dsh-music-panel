import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { clearData, inspectData } from '../../src/host/services/media/plugin-data.js'
import { createRoutes } from '../../src/host/http/routes.js'
import { fakeReq, fakeRes } from '../helpers.mjs'

const settingsJson = '{"roots":[]}'
const lyricStatesJson = '{"version":1,"tracks":{}}'

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-music-data-'))
  await mkdir(join(dir, 'cache'), { recursive: true })
  await mkdir(join(dir, 'trash'), { recursive: true })
  await mkdir(join(dir, 'lyrics'), { recursive: true })
  await writeFile(join(dir, 'settings.json'), settingsJson)
  await writeFile(join(dir, 'favorites.json'), '{}')
  await writeFile(join(dir, 'sessions.json'), '{}')
  await writeFile(join(dir, 'lyric-states.json'), lyricStatesJson)
  await writeFile(join(dir, 'lyrics', 'deadbeef.json'), '{}')
  await writeFile(join(dir, 'cache', 'a.mp3'), Buffer.alloc(10))
  await writeFile(join(dir, 'trash', 'b.mp3'), Buffer.alloc(5))
  return dir
}

test('inspectData groups plugin files without touching music roots', async () => {
  const dir = await fixture()
  try {
    const data = await inspectData(dir)
    assert.equal(data.files, 7)
    assert.equal(
      data.bytes,
      10 + 5 + 2 + 2 + settingsJson.length + lyricStatesJson.length + 2,
    )
    assert.deepEqual(
      data.categories.map((row) => row.id).sort(),
      ['accounts', 'cache', 'favorites', 'lyrics', 'settings', 'trash'],
    )
    const byId = Object.fromEntries(data.categories.map((row) => [row.id, row]))
    assert.equal(byId.cache.bytes, 10)
    assert.equal(byId.trash.bytes, 5)
    assert.equal(byId.lyrics.files, 2, 'the index and the lyric text are one category')
    assert.equal(byId.lyrics.bytes, lyricStatesJson.length + 2)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('clearData removes data but protects a configured music root', async () => {
  const dir = await fixture()
  try {
    const protectedRoot = join(dir, 'cache')
    const result = await clearData(dir, [protectedRoot])
    assert.ok(result.removed.includes('settings.json'))
    assert.ok(result.removed.includes('trash'))
    assert.ok(result.protected.includes('cache'))
    assert.equal(await inspectData(dir).then((data) => data.categories.some((row) => row.id === 'cache')), true)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('data routes inspect and require the explicit clear token', async () => {
  const dir = await fixture()
  let reset = 0
  try {
    const handle = createRoutes({
      settings: {
        read: async () => ({ roots: [] }),
        write: async (patch) => ({ roots: [], ...patch }),
        dir,
        home: dir,
        file: join(dir, 'settings.json'),
      },
      resetData: async () => {
        reset += 1
      },
    })
    let res = fakeRes()
    await handle(fakeReq('/music/data'), res)
    assert.equal(res.status, 200)
    assert.equal(res.json().ok, true)
    assert.ok(res.json().categories.some((row) => row.id === 'cache'))

    res = fakeRes()
    await handle(fakeReq('/music/data/clear', 'POST', { 'content-type': 'application/json' }, '{}'), res)
    assert.equal(res.status, 400)
    assert.equal(res.json().error.code, 'CONFIRM_REQUIRED')
    assert.equal(reset, 0)

    res = fakeRes()
    await handle(
      fakeReq('/music/data/clear', 'POST', { 'content-type': 'application/json' }, '{"confirm":"clear-all"}'),
      res,
    )
    assert.equal(res.status, 200)
    assert.equal(res.json().ok, true)
    assert.equal(reset, 1)
    assert.equal(await inspectData(dir).then((data) => data.files), 0)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
