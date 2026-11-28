/**
 * 试听片段的时钟：Folia 的舞台时长来自媒体元素本身，歌词时钟是 `currentTime + clipStart`。
 * 这里锁住三个事实：媒体时长在试听时优先、片段起点加进各处时钟、试听时不恢复整曲位置。
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (path) => readFileSync(join(root, path), 'utf8')

test('effectivePlayerDuration follows the clip while previewing', () => {
  const source = read('src/client/services/player/duration.js')
  // The fragment is a plain script: evaluate it to test the real function.
  const fn = new Function(source + '; return effectivePlayerDuration')()
  assert.equal(fn(30, 299, true), 30, 'preview wins over the catalogue length')
  assert.equal(fn(30, 299, false), 299, 'a growing MediaSource still cannot shrink the song')
  assert.equal(fn(0, 299, true), 299, 'no media duration yet: fall back to the catalogue')
  assert.equal(fn(30, 0, false), 30)
})

test('the player reads its duration and clip start from the media', () => {
  const player = read('src/client/services/player/player.js')
  assert.match(player, /if \(session\.preview === true\) {\s*var mediaDuration = Number\(audio\.duration\)/)
  assert.match(player, /buffered\.end\(buffered\.length - 1\)/, 'MSE reports only appended data')
  assert.match(player, /session\.clipStartMs = Math\.max\(0, Number\(info\.clipStartMs\) \|\| 0\)/)
  assert.match(player, /preview: session\.preview === true,\s*clipStartMs: Number\(session\.clipStartMs\) \|\| 0,/)
  // A preview has its own short timeline: never resume at a whole-song position.
  assert.match(player, /function isPreviewSession\(\)/)
  assert.match(player, /if \(isPreviewSession\(\)\) {\s*pendingResumeSeconds = null/)
})

test('every lyric surface adds the clip start to its clock', () => {
  const index = read('src/client/components/ui/now-playing/index.js')
  assert.match(index, /var clipStartSec = \(Number\(time\.clipStartMs\) \|\| 0\) \/ 1000/)
  assert.match(index, /lyricClock\(time\.currentTime \+ clipStartSec, offsetMs, lyricGlobalOffsetMs\)/)
  for (const file of ['src/client/render/styles/folia-styles.js', 'src/client/render/styles/folia-pendolo.js']) {
    const source = read(file)
    assert.match(source, /playback\.clipStartMs\) \|\| 0\) \/ 1000/, file + ' shifts the visualizer clock')
    assert.match(source, /- clipStartSec \+ offsetRef\.current/, file + ' maps a lyric seek back onto the clip')
  }
})

test('the host hands out the clip start with the preview flag', () => {
  const online = read('src/host/http/routes/online.js')
  assert.match(online, /clipStartMs: stream !== null && Number\(stream\.clipStartMs\) > 0 \? Math\.round\(stream\.clipStartMs\) : 0/)
  assert.match(online, /x-music-preview-start-ms/)
  const bridge = read('src/host/providers/sources/folia-bridge/bridge.js')
  assert.match(bridge, /answered\.clipStartMs > 0/)
  const kugou = read('src/host/providers/sources/kugou-folia/playback.js')
  assert.match(kugou, /source\.clipStartMs > 0/)
})

console.log('preview-clock.test.mjs ok')
