/** One-off KuGou link/lyric probe (manual). */
import { createRequire } from 'node:module'
import { createServer } from 'node:net'

const require = createRequire(import.meta.url)

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
const search = await (await fetch(`${base}/search?keywords=${encodeURIComponent('晴天')}&page=1&pagesize=1`)).json()
const song = search?.data?.lists?.[0] ?? {}
console.log('song keys:', Object.keys(song).slice(0, 14).join(','))
console.log('hash:', song.FileHash, 'album:', song.AlbumID, 'mixid:', song.MixSongID)

const qs = new URLSearchParams({ hash: song.FileHash, album_id: String(song.AlbumID ?? ''), mid: '', album_audio_id: '' })
for (const path of ['/song/url', `/song/url?${qs.toString()}`, `/lyric?${new URLSearchParams({ hash: song.FileHash, keyword: `${song.SingerName || ''} - ${song.SongName || song.FileName || ''}` }).toString()}`]) {
  const response = await fetch(base + path)
  const text = await response.text()
  console.log(`\n### ${path} -> ${response.status}\n${text.slice(0, 320)}`)
}

await new Promise((resolve) => app.service.close(resolve))
process.exit(0)
