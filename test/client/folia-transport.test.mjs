/**
 * The DSH transport around Folia's decks: load, play, pause, seek, crossfade.
 *
 * A fake graph keeps the test on the transport contract; the real graph and
 * fade controller are covered by `folia-graph.test.mjs` and
 * `audio-folia.test.mjs`.
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..')
const BUNDLE = join(ROOT, 'src/client/audio/engine.bundle.js')
const TRANSPORT = join(ROOT, 'src/client/services/player/folia-transport.js')

const sandbox = { console }
vm.runInNewContext(readFileSync(BUNDLE, 'utf8'), sandbox, { filename: BUNDLE })
vm.runInNewContext(readFileSync(TRANSPORT, 'utf8'), sandbox, { filename: TRANSPORT })
assert.equal(typeof sandbox.createFoliaTransport, 'function', 'the transport adapter is present')

function createElement() {
  const handlers = new Map()
  const element = {
    src: '',
    currentSrc: '',
    paused: true,
    ended: false,
    readyState: 4,
    duration: 180,
    currentTime: 0,
    error: null,
    buffered: { length: 0 },
    volume: 1,
    muted: false,
    addEventListener(type, handler) {
      const list = handlers.get(type) || []
      list.push(handler)
      handlers.set(type, list)
    },
    removeEventListener(type, handler) {
      handlers.set(type, (handlers.get(type) || []).filter((item) => item !== handler))
    },
    emit(type) {
      for (const handler of handlers.get(type) || []) handler({ target: element })
    },
    play() {
      element.paused = false
      element.emit('play')
      return Promise.resolve()
    },
    pause() {
      element.paused = true
      element.emit('pause')
    },
    load() {
      element.currentSrc = element.src
      element.emit('loadedmetadata')
    },
    removeAttribute(name) {
      if (name === 'src') element.src = ''
    },
  }
  return element
}

const elements = { A: createElement(), B: createElement() }
let active = 'A'
let scheduled = null
function gainNode() {
  return {
    gain: {
      value: 1,
      setValueAtTime(next) {
        this.value = next
      },
      linearRampToValueAtTime(next) {
        this.value = next
      },
      cancelScheduledValues() {},
      cancelAndHoldAtTime() {},
    },
  }
}
const chains = {
  A: { replayGain: gainNode(), trim: gainNode(), balanceMeter: { tick() {} }, analyser: {} },
  B: { replayGain: gainNode(), trim: gainNode(), balanceMeter: { tick() {} }, analyser: {} },
}
const graph = {
  ensure: () => ({}),
  getDeckElement: (deck) => elements[deck],
  getActiveDeck: () => active,
  setActiveDeck: (deck) => { active = deck },
  getContext: () => ({ state: 'running', currentTime: 0 }),
  getDeckChain: (deck) => chains[deck],
  getFadeGraph: () => ({
    context: { state: 'running', currentTime: 0 },
    gain: {
      gain: {
        value: 1,
        setValueAtTime() {},
        linearRampToValueAtTime() {},
        cancelScheduledValues() {},
        cancelAndHoldAtTime() {},
      },
    },
  }),
  scheduleCrossfade: (...args) => {
    scheduled = args
    return true
  },
}

const states = []
const times = []
const errors = []
const ended = []
const transport = sandbox.createFoliaTransport({
  graph,
  playbackFade: false,
  onState: (state) => states.push(state),
  onTime: (time) => times.push(time),
  onError: (error) => errors.push(error),
  onEnded: (event) => ended.push(event),
})

assert.equal(transport.getActiveDeck(), 'A')
assert.equal(transport.getDeckState('A').playing, false)

assert.equal(transport.setDeckReplayGain('A', 3, 0), true)
assert.equal(transport.setDeckTrim('A', -2, 0), true)
assert.ok(chains.A.replayGain.gain.value > 1.4, 'replay gain is written to the deck')
assert.ok(chains.A.trim.gain.value < 0.8, 'trim is written to the deck')
assert.equal(transport.getBalanceMeter('A'), chains.A.balanceMeter)
assert.equal(transport.getDeckAnalyser('A'), chains.A.analyser)

const loaded = await transport.load('A', 'a.mp3', { autoplay: true })
assert.equal(loaded, true)
assert.equal(elements.A.src, 'a.mp3')
assert.equal(elements.A.paused, false, 'autoplay presses play')
assert.equal(transport.getState().playing, true)
assert.equal(states.at(-1).deck, 'A')
assert.equal(states.at(-1).playing, true)

transport.seek('A', 42)
assert.equal(elements.A.currentTime, 42, 'seek writes the element clock')
assert.equal(times.at(-1).currentTime, 42)

assert.equal(await transport.pause('A'), true)
assert.equal(elements.A.paused, true, 'pause stops the deck')
assert.equal(transport.getState().playing, false)

await transport.load('B', 'b.mp3', { autoplay: false })
assert.equal(elements.B.src, 'b.mp3')
assert.equal(elements.B.paused, true, 'the incoming deck stays silent until the blend')

const blended = await transport.crossfadeTo('B', 'b.mp3', {
  seconds: 4,
  crossover: 0.5,
  hold: 0,
  together: 0,
})
assert.equal(blended, true)
assert.equal(elements.B.paused, false, 'the incoming deck starts for the blend')
assert.ok(scheduled, 'Folia scheduleCrossfade was called')
assert.equal(scheduled[0], 4)
assert.equal(scheduled[1], 0.5)
assert.equal(transport.getActiveDeck(), 'B')
assert.equal(active, 'B')

elements.B.ended = true
elements.B.emit('ended')
assert.equal(ended.at(-1).deck, 'B')

transport.stop('B')
assert.equal(elements.B.src, '')
assert.equal(transport.getState().playing, false)
assert.deepEqual(errors, [])

transport.dispose()
console.log('folia-transport.test.mjs ok')
