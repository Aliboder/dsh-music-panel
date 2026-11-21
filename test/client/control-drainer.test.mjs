/**
 * `music_control` 的消费端：面板折叠/未打开时指令也必须被执行。
 *
 * The drainer runs from the plugin lifecycle, so these checks keep three things true: the
 * timer is started there (not from the panel), only the audible window drains, and an old
 * instruction is dropped instead of being replayed on a wake-up.
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..')
const read = (path) => readFileSync(join(ROOT, ...path.split('/')), 'utf8')
const source = read('src/client/services/player/control-drainer.js')

function makeHarness(options = {}) {
  const applied = []
  const infos = []
  const warns = []
  const timers = { timeouts: [], intervals: [] }
  const listeners = []

  const doc = {
    visibilityState: 'visible',
    addEventListener(name, fn) { listeners.push({ name, fn }) },
    removeEventListener(name, fn) {
      const at = listeners.findIndex((item) => item.name === name && item.fn === fn)
      if (at >= 0) listeners.splice(at, 1)
    },
  }
  const player = { isLeader: () => options.leader !== false }
  const getJson = options.getJson || (async () => ({ actions: options.actions || [] }))
  const applyControlAction = async (action) => {
    applied.push(action && action.action)
    if (action && action.action === 'boom') throw new Error('boom')
  }
  const factory = new Function(
    'player', 'getJson', 'API', 'applyControlAction',
    'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'document', 'console',
    source + '\nreturn { drainControlsOnce, startControlDrainer, CONTROL_INTERVAL_MS, CONTROL_FIRST_DELAY_MS, CONTROL_MAX_AGE_MS };',
  )
  const api = factory(
    player,
    getJson,
    'music/',
    applyControlAction,
    (fn, ms) => { timers.timeouts.push({ fn, ms }); return timers.timeouts.length },
    () => {},
    (fn, ms) => { timers.intervals.push({ fn, ms }); return timers.intervals.length },
    () => {},
    doc,
    {
      warn: (...parts) => warns.push(parts.join(' ')),
      info: (...parts) => infos.push(parts.join(' ')),
    },
  )
  return { api, applied, infos, warns, timers, listeners, doc }
}

// ── the schedule ──────────────────────────────────────────────────────────
{
  const h = makeHarness()
  assert.equal(h.api.CONTROL_INTERVAL_MS, 2000, 'a tick every two seconds')
  assert.equal(h.api.CONTROL_FIRST_DELAY_MS, 1000, 'the first tick waits for the audio host')
  assert.equal(h.api.CONTROL_MAX_AGE_MS, 300000, 'five minutes is the staleness bound')
}

// ── only the audible window drains ────────────────────────────────────────
await (async () => {
  let asked = 0
  const h = makeHarness({
    leader: false,
    getJson: async () => {
      asked += 1
      return { actions: [] }
    },
  })
  await h.api.drainControlsOnce()
  assert.equal(asked, 0, 'a follower window never takes actions it could not play')
})()

// ── a batch keeps its order, one failure does not stop the rest ───────────
await (async () => {
  const now = Date.now()
  const h = makeHarness({
    actions: [
      { action: 'pause', at: now },
      { action: 'boom', at: now },
      { action: 'next', at: now },
    ],
  })
  await h.api.drainControlsOnce()
  assert.deepEqual(h.applied, ['pause', 'boom', 'next'], 'actions apply in order and a failure is contained')
  assert.ok(h.warns.length >= 1, 'the failing action is logged')
})()

// ── an instruction that waited too long is dropped ────────────────────────
await (async () => {
  const now = Date.now()
  const h = makeHarness({
    actions: [
      { action: 'play', query: '晴天', at: now - 6 * 60 * 1000 },
      { action: 'pause', at: now },
    ],
  })
  await h.api.drainControlsOnce()
  assert.deepEqual(h.applied, ['pause'], 'the stale play is not replayed')
  assert.ok(h.infos.some((line) => line.includes('stale')), 'the drop is logged')
})()

// ── one batch at a time ───────────────────────────────────────────────────
await (async () => {
  let resolveFetch = null
  let asked = 0
  const h = makeHarness({
    getJson: () => {
      asked += 1
      return new Promise((resolve) => { resolveFetch = resolve })
    },
  })
  const first = h.api.drainControlsOnce()
  const second = h.api.drainControlsOnce()
  await second
  assert.equal(asked, 1, 'a tick that lands mid-batch is skipped')
  resolveFetch({ actions: [] })
  await first
  assert.equal(asked, 1)
})()

// ── start / stop and the wake-up catch-up ─────────────────────────────────
await (async () => {
  const h = makeHarness({ actions: [{ action: 'next', at: Date.now() }] })
  const stop = h.api.startControlDrainer()
  assert.deepEqual(h.timers.timeouts.map((item) => item.ms), [1000], 'the first tick is delayed')
  assert.deepEqual(h.timers.intervals.map((item) => item.ms), [2000], 'then a two-second interval')
  assert.equal(h.listeners.filter((item) => item.name === 'visibilitychange').length, 1, 'a wake-up listener is registered')

  h.doc.visibilityState = 'hidden'
  await h.listeners[0].fn()
  assert.deepEqual(h.applied, [], 'a hidden tab does not drain on the event')

  h.doc.visibilityState = 'visible'
  await h.listeners[0].fn()
  assert.deepEqual(h.applied, ['next'], 'becoming visible drains at once')

  stop()
  assert.equal(h.listeners.filter((item) => item.name === 'visibilitychange').length, 0, 'the disposer removes the listener')
})()

// ── the wiring: started by the plugin, not by the panel ───────────────────
const plugin = read('src/client/app/plugin.js')
assert.match(plugin, /return startControlDrainer\(\)/, 'the plugin lifecycle starts the drainer')
const shell = read('src/client/panel-v3/p3-shell.js')
assert.doesNotMatch(shell, /control\/pending/, 'the panel no longer polls: one consumer only')
const manifest = read('src/client/manifest.json')
assert.match(manifest, /"src\/client\/services\/player\/control-drainer\.js"/, 'the drainer is part of the bundle')

// ── the applier loads what it needs with the panel closed ─────────────────
const overlay = read('src/client/panel-v3/p3-overlay.js')
assert.match(overlay, /async function applyControlAction\(action\)/, 'the drainer can await one action')
assert.match(overlay, /await ensureLibraryLoaded\(\)/, 'a local play loads the library itself')
const library = read('src/client/components/library/library.js')
assert.match(library, /function ensureLibraryLoaded\(\)/, 'the shared library load exists')
assert.match(library, /libraryLoadPromise !== null/, 'concurrent callers share one load')

console.log('control-drainer.test.mjs ok')