/**
 * Folia 移植模块的行为测试：ReplayGain 算术、按轮洗牌、睡眠定时。
 *
 * 这三块从 Folia 逐段搬来（replay-gain.ts / shuffleRound.ts / useSleepTimer.ts），
 * 纯函数与生命周期逻辑直接用 vm 加载源码验证，不依赖面板渲染。
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const playerDir = join(root, 'src/client/services/player')

function sandboxWith(extra = {}) {
  const stored = new Map()
  const sandbox = {
    console,
    Math,
    Set,
    Map,
    JSON,
    Date,
    isFinite,
    encodeURIComponent,
    setInterval,
    clearInterval,
    setTimeout,
    clearTimeout,
    window: {
      localStorage: {
        getItem: (key) => (stored.has(key) ? stored.get(key) : null),
        setItem: (key, value) => stored.set(key, String(value)),
        removeItem: (key) => stored.delete(key),
      },
    },
    __stored: stored,
    ...extra,
  }
  sandbox.globalThis = sandbox
  sandbox.window = Object.assign(sandbox.window, {})
  vm.createContext(sandbox)
  return sandbox
}

function loadPlayerModule(name, extra) {
  const sandbox = sandboxWith(extra)
  vm.runInContext(readFileSync(join(playerDir, name), 'utf8'), sandbox, { filename: name })
  return sandbox
}

test('ReplayGain: 选模式、专辑回退、正增益防削波', () => {
  const s = loadPlayerModule('replay-gain.js')
  assert.deepEqual(
    { gain: s.calculateReplayGain({ trackGain: 3 }, 'off').effectiveGainDb, linear: s.calculateReplayGain({ trackGain: 3 }, 'off').linearGain },
    { gain: 0, linear: 1 },
    'off applies nothing',
  )
  const track = s.calculateReplayGain({ trackGain: -5, albumGain: -7 }, 'track')
  assert.equal(track.effectiveGainDb, -5)
  const album = s.calculateReplayGain({ trackGain: -5 }, 'album')
  assert.equal(album.effectiveGainDb, -5, 'album falls back to the track gain')
  const clipped = s.calculateReplayGain({ trackGain: 6, trackPeak: 2 }, 'track')
  assert.equal(clipped.gainDb, 6)
  assert.ok(Math.abs(clipped.effectiveGainDb + 6.0206) < 0.001, 'a positive gain is capped by the peak')
  assert.ok(clipped.linearGain < 0.51)
  const missing = s.calculateReplayGain(null, 'track')
  assert.equal(missing.linearGain, 1, 'a song without tags plays at its original level')
})

test('一轮不重复: 钉住当前、先没听过的、整轮重洗', () => {
  const s = loadPlayerModule('shuffle-round.js')
  const songs = ['a', 'b', 'c', 'd'].map((key) => ({ path: key }))
  const keyOf = (song) => song.path
  // First shuffle: current (c) pinned first, nothing played yet.
  const first = s.shuffleForRound({ songs, keyOf, pinnedIndex: 2, state: null, random: () => 0.5 })
  assert.equal(first.queue[0].path, 'c', 'the current song stays pinned first')
  assert.equal(first.newRound, false)
  assert.deepEqual(first.state.played, ['c'], 'the current song counts as played')
  assert.equal(first.state.orderHash, s.shuffleRoundOrderHash(first.queue.map(keyOf)))
  // The whole queue has been heard: a new round starts.
  const towardEnd = Object.assign({}, first.state, { played: ['a', 'b', 'c', 'd'] })
  const last = s.shuffleForRound({ songs, keyOf, pinnedIndex: 2, state: towardEnd, random: () => 0.2 })
  assert.equal(last.newRound, true)
  assert.deepEqual(last.state.played, ['c'], 'the new round only remembers the pinned song')
  assert.equal(last.queue[0].path, 'c')
  // decideShuffleRoundStep: complete + list loop + more than one countable song = reshuffle.
  const state = Object.assign({}, first.state, { played: ['a', 'b'] })
  const queueKeys = first.queue.map(keyOf)
  const step = s.decideShuffleRoundStep({
    state,
    keys: queueKeys,
    currentKey: 'c',
    countedKeys: ['a', 'b', 'c', 'd'],
    loopMode: 'all',
  })
  assert.equal(step.kind, 'write', 'playing c marks it heard but does not finish the round')
  const finish = s.decideShuffleRoundStep({
    state: Object.assign({}, first.state, { played: ['a', 'b', 'c'] }),
    keys: queueKeys,
    currentKey: 'd',
    countedKeys: ['a', 'b', 'c', 'd'],
    loopMode: 'all',
  })
  assert.equal(finish.kind, 'reshuffle')
  const single = s.decideShuffleRoundStep({
    state,
    keys: ['c'],
    currentKey: 'c',
    countedKeys: ['c'],
    loopMode: 'all',
  })
  assert.equal(single.kind, 'none', 'one countable song never loops the reshuffle')
  // Persisted state round-trips and belongs to this exact order.
  s.writeShuffleRoundState(first.state)
  assert.deepEqual(s.readShuffleRoundState(), first.state)
  assert.equal(s.isShuffleRoundQueue(first.state, first.queue.map(keyOf)), true)
  assert.equal(s.isShuffleRoundQueue(first.state, songs.map(keyOf)), false)
})

test('睡眠定时: 到点暂停并清空，面板是否卸载无关', () => {
  const calls = { paused: 0, toasts: 0, prefs: [] }
  const prefs = { sleepTimerMinutes: 1, sleepDeadline: Date.now() - 10 }
  const sandbox = loadPlayerModule('sleep-timer.js', {
    prefsStore: { get: () => prefs, subscribe: () => () => {} },
    player: { pause: () => { calls.paused += 1 } },
    setPrefs: (patch) => { calls.prefs.push(patch) },
    showToast: () => { calls.toasts += 1 },
    t: (key) => key,
  })
  const stop = sandbox.startSleepTimer()
  assert.equal(calls.paused, 1, 'an already-due deadline pauses immediately')
  assert.equal(calls.toasts, 1)
  assert.equal(JSON.stringify(calls.prefs[0]), JSON.stringify({ sleepTimerMinutes: 0, sleepDeadline: 0 }))
  stop()
})

console.log('playback-internals.test.mjs ok')
