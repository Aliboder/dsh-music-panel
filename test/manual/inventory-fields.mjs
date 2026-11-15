/**
 * Inventory probe: dump every field each upstream returns for the entities we
 * consume, so "what we drop" is measured rather than guessed.
 *
 * Run: node test/manual/inventory-fields.mjs
 */

import { createRequire } from 'node:module'
import { createServer } from 'node:net'
import { callUpstream as nc } from '../../lib/services/netease-api.js'
import { stopNeteaseService } from '../../lib/services/netease-api.js'

const require = createRequire(import.meta.url)
const out = {}
const keysOf = (value) => (value !== null && typeof value === 'object' ? Object.keys(value).sort() : [])

// ── netease ────────────────────────────────────────────────────────────────

{
  const search = await nc('/cloudsearch', { keywords: '晴天', type: 1, limit: 1 })
  const song = search.result?.songs?.[0] ?? {}
  out['netease.search.song'] = keysOf(song)
  out['netease.search.song.ar[]'] = keysOf(song.ar?.[0])
  out['netease.search.song.al'] = keysOf(song.al)
  out['netease.search.song.privilege'] = keysOf(song.privilege)
  out['netease.search.result'] = keysOf(search.result)

  const lyric = await nc('/lyric', { id: String(song.id ?? '') })
  out['netease.lyric'] = keysOf(lyric)
  out['netease.lyric.lrc'] = keysOf(lyric.lrc)
  out['netease.lyric.yrc'] = keysOf(lyric.yrc)
  out['netease.lyric.tlyric'] = keysOf(lyric.tlyric)

  const album = await nc('/album', { id: String(song.al?.id ?? '') })
  out['netease.album'] = keysOf(album.album)
  out['netease.album.song'] = keysOf(album.album?.songs?.[0])

  const playlist = await nc('/playlist/detail', { id: '3778678' })
  out['netease.playlist'] = keysOf(playlist.playlist)

  const url = await nc('/song/url/v1', { id: String(song.id ?? ''), level: 'exhigh' })
  out['netease.songUrl.data[0]'] = keysOf(url.data?.[0])
  await stopNeteaseService()
}

// ── QQ ─────────────────────────────────────────────────────────────────────

{
  const port = await new Promise((resolve, reject) => {
    const probe = createServer()
    probe.once('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address()
      probe.close(() => resolve(port))
    })
  })
  process.env.PORT = String(port)
  const mod = require('@yakult-green-tea/qq-music-api')
  const server = mod.server
  await new Promise((resolve, reject) => {
    if (server.listening) return resolve()
    server.once('listening', resolve)
    server.once('error', reject)
  })
  const base = `http://127.0.0.1:${port}`
  const search = await (await fetch(`${base}/search?keyword=%E6%99%B4%E5%A4%A9&page=1&limit=1`)).json()
  const item = search.items?.[0] ?? {}
  out['qq.search.item'] = keysOf(item)
  out['qq.search.item.singer'] = keysOf(item.singer?.[0])
  out['qq.search.item.album'] = keysOf(item.album)
  out['qq.search.item.file'] = keysOf(item.file)
  const mid = item.mid ?? ''
  const lyric = await (await fetch(`${base}/getLyric?songmid=${mid}`)).json()
  out['qq.lyric.response'] = keysOf(lyric.response ?? lyric)
  const play = await (await fetch(`${base}/getMusicPlay/${mid}`)).json()
  out['qq.play.data'] = keysOf(play.data)
  out['qq.play.data.playUrl[mid]'] = keysOf(play.data?.playUrl?.[mid])
  await new Promise((resolve) => server.close(resolve))
}

// ── kugou (legacy transport, raw upstream shape) ───────────────────────────

{
  const port = await new Promise((resolve, reject) => {
    const probe = createServer()
    probe.once('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address()
      probe.close(() => resolve(port))
    })
  })
  process.env.PORT = String(port)
  process.env.HOST = '127.0.0.1'
  process.env.platform = 'lite'
  const mod = require('kugoumusicapi')
  const app = await mod.startService()
  await new Promise((resolve, reject) => {
    if (app.service.listening) return resolve()
    app.service.once('listening', resolve)
    app.service.once('error', reject)
  })
  const base = `http://127.0.0.1:${port}`
  const search = await (await fetch(`${base}/search?keywords=%E6%99%B4%E5%A4%A9&page=1&pagesize=1`)).json()
  const song = search.data?.lists?.[0] ?? {}
  out['kugou.search.song'] = keysOf(song)
  await new Promise((resolve) => app.service.close(resolve))
}

// ── bodian ─────────────────────────────────────────────────────────────────

{
  const { createBodianApi } = require('bodian-music-api')
  const api = createBodianApi({ deviceId: 'c'.repeat(32) })
  const search = await api.request('search', { query: '晴天', limit: 1 })
  const song = search.data?.resultList?.[0] ?? {}
  out['bodian.search.song'] = keysOf(song)
  out['bodian.search.song.artists'] = keysOf(song.artists?.[0])
  out['bodian.search.song.audios'] = keysOf(song.audios?.[0])
  const lyric = await api.request('lyrics', { id: song.id })
  out['bodian.lyrics'] = keysOf(lyric.data)
}

for (const [label, keys] of Object.entries(out)) {
  console.log(`\n## ${label} (${keys.length})\n${keys.join(', ')}`)
}
process.exit(0)
