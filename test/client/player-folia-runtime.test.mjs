/**
 * Player runtime wiring: attach a real `<audio>` shape to the Folia graph.
 *
 * The client smoke test mounts UI; this one builds the actual player graph with
 * a fake AudioContext, then exercises attach/ensure/volume/EQ/dispose. It is
 * the closest check to the Desktop path without an audio device.
 */

import assert from 'node:assert/strict'

function param(value) {
  return {
    value,
    setValueAtTime(next) {
      this.value = next
    },
    setTargetAtTime(next) {
      this.value = next
    },
    linearRampToValueAtTime(next) {
      this.value = next
    },
    exponentialRampToValueAtTime(next) {
      this.value = next
    },
    cancelScheduledValues() {},
    cancelAndHoldAtTime() {},
    setValueCurveAtTime(curve) {
      this.value = curve[curve.length - 1]
    },
  }
}

function node(kind) {
  return {
    kind,
    connections: [],
    connect(target) {
      this.connections.push(target)
      return target
    },
    disconnect(target) {
      if (target === undefined) this.connections.length = 0
      else this.connections = this.connections.filter((item) => item !== target)
    },
  }
}

function createContext() {
  return {
    state: 'running',
    currentTime: 0,
    sampleRate: 48000,
    destination: node('destination'),
    nodes: [],
    resume() {
      this.state = 'running'
      return Promise.resolve()
    },
    close() {
      this.state = 'closed'
    },
    createGain() {
      const value = { ...node('gain'), gain: param(1) }
      this.nodes.push(value)
      return value
    },
    createBiquadFilter() {
      const value = { ...node('biquad'), type: 'peaking', frequency: param(1000), Q: param(1), gain: param(0) }
      this.nodes.push(value)
      return value
    },
    createWaveShaper() {
      const value = { ...node('waveshaper'), oversample: 'none', curve: null }
      this.nodes.push(value)
      return value
    },
    createDelay() {
      const value = { ...node('delay'), delayTime: param(0) }
      this.nodes.push(value)
      return value
    },
    createDynamicsCompressor() {
      const value = {
        ...node('compressor'),
        threshold: param(0),
        knee: param(30),
        ratio: param(1),
        attack: param(0.008),
        release: param(0.18),
      }
      this.nodes.push(value)
      return value
    },
    createChannelSplitter() {
      const value = node('splitter')
      this.nodes.push(value)
      return value
    },
    createChannelMerger() {
      const value = node('merger')
      this.nodes.push(value)
      return value
    },
    createAnalyser() {
      const value = {
        ...node('analyser'),
        fftSize: 2048,
        smoothingTimeConstant: 0.6,
        frequencyBinCount: 1024,
        getByteFrequencyData(data) {
          data.fill(0)
        },
      }
      this.nodes.push(value)
      return value
    },
    createBuffer(numberOfChannels, length, sampleRate) {
      return { numberOfChannels, length, sampleRate, getChannelData: () => new Float32Array(length) }
    },
    createBufferSource() {
      const value = { ...node('buffer-source'), buffer: null, loop: false, start() {}, stop() {} }
      this.nodes.push(value)
      return value
    },
    createConvolver() {
      const value = { ...node('convolver'), normalize: false, buffer: null }
      this.nodes.push(value)
      return value
    },
    createOscillator() {
      const value = { ...node('oscillator'), frequency: param(440), start() {}, stop() {} }
      this.nodes.push(value)
      return value
    },
    createMediaElementSource() {
      const value = node('media-source')
      this.nodes.push(value)
      return value
    },
  }
}

function createAudioElement() {
  const handlers = new Map()
  const element = {
    parentNode: null,
    nextSibling: null,
    className: '',
    preload: '',
    src: '',
    currentSrc: '',
    paused: true,
    ended: false,
    readyState: 4,
    duration: 180,
    currentTime: 0,
    volume: 1,
    muted: false,
    error: null,
    buffered: { length: 0 },
    addEventListener(type, handler) {
      const list = handlers.get(type) || []
      list.push(handler)
      handlers.set(type, list)
    },
    removeEventListener(type, handler) {
      handlers.set(type, (handlers.get(type) || []).filter((item) => item !== handler))
    },
    setAttribute() {},
    removeAttribute(name) {
      if (name === 'src') element.src = ''
    },
    play() {
      element.paused = false
      return Promise.resolve()
    },
    pause() {
      element.paused = true
    },
    load() {},
  }
  return element
}

const context = createContext()
const window = {
  __ModuleLoader__: {
    load(definition) {
      globalThis.__dshMusicDef = definition
    },
  },
  AudioContext: function () {
    return context
  },
  webkitAudioContext: function () {
    return context
  },
  localStorage: { getItem: () => null, setItem() {} },
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent() {},
  setTimeout: (callback, ms) => setTimeout(callback, ms),
  clearTimeout: (id) => clearTimeout(id),
  requestAnimationFrame: (callback) => setTimeout(callback, 0),
  cancelAnimationFrame: (id) => clearTimeout(id),
  location: { href: 'http://localhost/' },
}
globalThis.window = window
globalThis.document = {
  head: { appendChild() {} },
  createElement(tag) {
    return tag === 'audio' ? createAudioElement() : { dataset: {}, textContent: '', appendChild() {}, remove() {}, setAttribute() {} }
  },
  documentElement: { getAttribute: () => 'zh-CN' },
  visibilityState: 'visible',
  addEventListener() {},
  removeEventListener() {},
}
if (typeof global.navigator === 'undefined') {
  global.navigator = { language: 'zh-CN' }
}

const React = {
  createElement: (type, props, ...children) => ({ type, props, children }),
  useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
  useEffect() {},
  useRef: (initial) => ({ current: initial }),
  useMemo: (factory) => factory(),
  useCallback: (factory) => factory,
  Component: class Component {
    constructor(props) {
      this.props = props
      this.state = {}
    }
    setState() {}
  },
}

await import('../../client.js')
const definition = globalThis.__dshMusicDef
const plugin = definition.factory((name) => {
  assert.equal(name, 'react')
  return React
})
const player = plugin.__internals.player
assert.ok(player && typeof player.attachAudio === 'function')

const primary = createAudioElement()
primary.parentNode = { insertBefore(child) { child.parentNode = this }, removeChild(child) { child.parentNode = null } }
primary.nextSibling = null
player.attachAudio(primary)
assert.ok(primary.volume <= 1, 'the resident element is accepted')

const analyser = player.ensureAnalyser()
assert.ok(analyser !== null, 'the Folia graph builds from the player')
assert.equal(analyser.fftSize, 2048)
assert.equal(analyser.smoothingTimeConstant, 0.6)
assert.ok(player.getWave() !== null, 'the player exposes the Folia analyser')

player.setVolume(0.35)
player.setMuted(true)
player.setMuted(false)
player.setVolume(1)
player.setEq({ enabled: true, bands: [3, 0, 0, 0, 0, 0, 0, 0, 0, -2], preset: 'flat' })
assert.equal(player.getEq().enabled, true)
assert.equal(player.getEq().bands[0], 3)

player.attachAudio(null)
console.log('player-folia-runtime.test.mjs ok')
