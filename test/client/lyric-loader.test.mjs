/**
 * The shared lyric loader: one load per song, the source rules Folia uses, and the
 * player's start gate (which must always let playback through).
 *
 * The client fragments are concatenated into `client.js`; this test loads the same
 * files into one sandbox realm so their globals see each other exactly as in the app.
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..', 'src', 'client')

const stored = new Map()
const requests = []
let responder = null

const sandbox = {
  console,
  Intl,
  URL,
  TextDecoder,
  TextEncoder,
  setTimeout,
  clearTimeout,
  atob,
  API: '/music/',
  localStorage: {
    getItem: (key) => (stored.has(key) ? stored.get(key) : null),
    setItem: (key, value) => {
      stored.set(key, String(value))
    },
    removeItem: (key) => stored.delete(key),
  },
  // The app's preferences live in a store; a component's `prefs` is a local value, so the
  // loader must read the store (specifically: no bare `prefs` in this sandbox).
  prefsStore: {
    get: () => ({
      lyricPreferredSource: 'qq',
      lyricLocalPriority: 'online',
      lyricFormatOrder: ['yrc', 'lrc'],
      autoUseBestLyric: true,
    }),
  },
  getJson: async (url) => {
    requests.push(url)
    if (responder === null) return {}
    return await responder(url)
  },
}
sandbox.globalThis = sandbox
sandbox.window = sandbox
vm.createContext(sandbox)

const bundle = readFileSync(join(root, 'render', 'lyrics', 'lyrics.bundle.js'), 'utf8')
vm.runInContext(bundle, sandbox, { filename: 'lyrics.bundle.js' })
vm.runInContext(readFileSync(join(root, 'services', 'lyrics', 'lyrics.js'), 'utf8'), sandbox, { filename: 'lyrics.js' })
vm.runInContext(readFileSync(join(root, 'services', 'lyrics', 'loader.js'), 'utf8'), sandbox, { filename: 'loader.js' })

const loader = sandbox.MPLyricLoader
assert.ok(loader && typeof loader.load === 'function', 'the loader is on the client global scope')

// ── the song identity the Host record uses ─────────────────────────────────

assert.equal(loader.keyOf({ path: 'D:/music/a.mp3' }), 'D:/music/a.mp3')
assert.equal(loader.keyOf({ onlineProvider: 'qq', onlineId: '42' }), 'online:qq:42')
assert.equal(loader.keyOf(null), '')

// ── one request per song, however many surfaces ask ────────────────────────

{
  requests.length = 0
  responder = async () => ({
    source: 'online',
    raw: { type: 'local', lrcContent: '[00:01.000]第一行\n[00:05.000]第二行' },
    lrc: '[00:01.000]第一行\n[00:05.000]第二行',
  })
  const track = { onlineProvider: 'netease', onlineId: 'n1', title: 't', artist: 'a', album: 'b', durationSec: 200 }
  const [first, second] = await Promise.all([loader.load(track), loader.load(track)])
  assert.equal(first, second, 'the second caller shares the first request')
  assert.equal(first.lyrics.length, 2)
  assert.equal(first.source, 'online')
  assert.ok(first.document !== null, 'the parsed document travels with the result')
  const lyricCalls = requests.filter((url) => url.includes('online/lyric?'))
  assert.equal(lyricCalls.length, 1, 'one online/lyric request for two loads')
  assert.ok(lyricCalls[0].includes('preferred=qq'), 'the preferred source travels to the Host')

  // The resolved lyric is remembered: a third load answers from memory.
  await loader.load(track)
  assert.equal(requests.filter((url) => url.includes('online/lyric?')).length, 1)
}

// ── a pure-music verdict is an answer, not a lyric ─────────────────────────

{
  responder = async () => ({ pureMusic: true, lrc: '', lines: null, source: 'online' })
  const track = { onlineProvider: 'qq', onlineId: 'p1' }
  const result = await loader.load(track)
  assert.equal(result.pureMusic, true)
  assert.equal(result.lyrics.length, 0)
}

// ── local: the Host's pick, including the automatic match ──────────────────

{
  requests.length = 0
  responder = async (url) => {
    if (url.includes('lyrics/auto')) return { ok: true, matched: { source: 'qq', id: 'q1' } }
    if (url.includes('lyrics/sources')) return { ok: true }
    // First read: no usable local lyric. Second read (after the match): the matched one.
    const secondRead = requests.filter((entry) => entry.includes('lyrics?path=')).length > 1
    return secondRead
      ? {
          ok: true,
          source: 'online',
          needsAutoMatch: false,
          raw: '[00:02.000]匹配到的歌词',
          offsetMs: 500,
          matched: { source: 'qq', id: 'q1' },
        }
      : { ok: true, source: null, needsAutoMatch: true, raw: '' }
  }
  const track = { path: 'D:/music/local.mp3' }
  const result = await loader.load(track)
  assert.equal(result.source, 'online')
  assert.equal(result.offsetMs, 500)
  assert.equal(result.matchedUpdated, true)
  assert.equal(result.lyrics.length, 1)
  assert.ok(requests.some((url) => url.includes('lyrics/auto')), 'the match was asked once')
  assert.ok(requests[0].includes('formatOrder=yrc%2Clrc'), 'the listener format order is sent')
  assert.ok(requests[0].includes('priority=online'), 'the local/online priority is sent')
}

// ── the upgrade lands after the first lyric, and the surfaces are told ─────

/** Let the fire-and-forget upgrade finish. */
async function settle(notifications) {
  for (let i = 0; i < 100 && notifications.length === 0; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
}

{
  requests.length = 0
  loader.invalidate()
  responder = async (url) => {
    if (url.includes('online/best-lyric')) {
      return {
        ok: true,
        match: {
          source: 'qq',
          id: 'q1',
          wordLevel: true,
          raw: { type: 'local', lrcContent: '[1000,2000](1000,900,0)升级', formatHint: 'yrc' },
        },
      }
    }
    return { source: 'online', raw: { type: 'local', lrcContent: '[00:01.000]第一版' } }
  }
  const track = { onlineProvider: 'netease', onlineId: 'up1', title: 't', artist: 'a' }
  const notifications = []
  const base = await loader.load(track)
  assert.equal(base.lyrics[0].fullText, '第一版')
  const off = loader.subscribe('online:netease:up1', (result) => notifications.push(result))
  await settle(notifications)
  off()
  assert.equal(notifications.length, 1, 'the upgrade is announced once')
  assert.equal(notifications[0].upgraded.source, 'qq')
  assert.equal(notifications[0].upgraded.wordLevel, true)
  assert.equal(notifications[0].lyrics[0].fullText, '升级')
  assert.ok(requests.some((url) => url.includes('online/best-lyric')), 'the other sources were asked')
  // The upgraded lyric is what the next load answers with.
  const cached = await loader.load(track)
  assert.equal(cached.lyrics[0].fullText, '升级')
}

// An imported lyric is the listener's own choice: no other source replaces it.
{
  requests.length = 0
  loader.invalidate()
  responder = async (url) => {
    if (url.includes('online/best-lyric')) return { ok: true, match: { source: 'qq', id: 'q2', raw: null, lrc: '[00:01.000]x' } }
    return { source: 'imported', raw: { type: 'local', lrcContent: '[00:01.000]导入' } }
  }
  await loader.load({ onlineProvider: 'qq', onlineId: 'imp1' })
  await new Promise((resolve) => setTimeout(resolve, 50))
  assert.equal(requests.some((url) => url.includes('online/best-lyric')), false, 'an imported lyric is not upgraded')
}

// ── the gate always resolves: a hung request times out ─────────────────────

{
  responder = () => new Promise(() => {})
  const started = Date.now()
  const settled = await loader.whenReady({ path: 'D:/music/hang.mp3' }, 30)
  assert.equal(settled, null)
  assert.ok(Date.now() - started < 2000, 'the gate does not wait on a hung request')
}

// ── invalidating one song makes the next load ask again ────────────────────

{
  requests.length = 0
  responder = async () => ({ source: 'online', raw: { type: 'local', lrcContent: '[00:01.000]x' } })
  const track = { onlineProvider: 'qq', onlineId: 'i1' }
  await loader.load(track)
  await loader.load(track)
  assert.equal(requests.filter((url) => url.includes('online/lyric?')).length, 1)
  loader.invalidate('online:qq:i1')
  await loader.load(track)
  assert.equal(requests.filter((url) => url.includes('online/lyric?')).length, 2, 'a changed source is read again')
}

console.log('lyric-loader.test.mjs ok')
