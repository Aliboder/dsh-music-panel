/**
 * 音频增益三个模式的行为：与 Folia 的 applyReplayGain 同一条路。
 *
 * Folia 每个模式只写一次「本曲增益」到该曲所在 deck 的 replayGain 节点：
 * 关闭 = 0 dB，单曲 / 专辑 = calculateReplayGain（含 peak 防削波），
 * 智能平衡 = chooseBalance / planBalanceMove。三者互斥，绝不会相乘。
 *
 * 这个测试用假 AudioContext 起真正的播放器（与 player-folia-runtime 同一套桩），
 * 让同一首歌同时有「智能平衡记录」和「ReplayGain 标签」，再逐个模式核对
 * 播放器写进 deck 的 dB 只来自当前模式。
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
        getFloatTimeDomainData(data) {
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
const PATH = 'C:/music/balance-and-tags.flac'
const stored = new Map([
  // 智能平衡已经知道这首歌：整曲 -8 LUFS，于是它要 -6 dB。
  [
    'music.balance.v1',
    JSON.stringify({
      songs: { [PATH]: { file: { loudness: -8, peak: 0.9 }, at: Date.now() } },
      typical: [{ key: PATH, gainDb: -6 }],
    }),
  ],
  // 标签说单曲 -4 dB、专辑 -7 dB；智能平衡若是也被应用，结果会变成 -10 / -13。
  ['music.prefs.v2', JSON.stringify({ volume: 1, replayGainMode: 'track' })],
])
const saved = []
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
  localStorage: {
    getItem: (key) => (stored.has(key) ? stored.get(key) : null),
    setItem: (key, value) => {
      stored.set(key, String(value))
      saved.push({ key, value: String(value) })
    },
    removeItem: (key) => stored.delete(key),
  },
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
if (typeof URL.createObjectURL !== 'function') {
  URL.createObjectURL = () => 'blob:test'
  URL.revokeObjectURL = () => {}
}

const tags = { ok: true, trackGain: -4, trackPeak: 0.5, albumGain: -7, albumPeak: 0.5 }
globalThis.fetch = async (url) => {
  const target = String(url)
  if (target.includes('replaygain')) {
    return { ok: true, status: 200, json: async () => tags }
  }
  if (target.includes('stream')) {
    return {
      ok: true,
      status: 200,
      headers: new Map(),
      json: async () => ({ ok: true }),
      blob: async () => ({ size: 1, arrayBuffer: async () => new ArrayBuffer(8) }),
    }
  }
  return { ok: true, status: 200, json: async () => ({ ok: true }), blob: async () => ({ size: 0 }) }
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
assert.ok(player && typeof player.setGainMode === 'function', 'the player owns the gain mode')

const primary = createAudioElement()
primary.parentNode = { insertBefore(child) { child.parentNode = this }, removeChild(child) { child.parentNode = null } }
primary.nextSibling = null
player.attachAudio(primary)
assert.ok(player.ensureAnalyser() !== null, 'the graph holds the deck nodes')

const settle = async () => {
  for (let i = 0; i < 4; i += 1) await new Promise((resolve) => setTimeout(resolve, 0))
}

player.select([{ path: PATH, name: 'Balance And Tags', durationSec: 180 }], 0)
await settle()

const applied = () => player.getGainState().appliedDb
const deck = () => player.getGainState().deckDb
const near = (actual, expected, label) => {
  assert.ok(Math.abs(actual - expected) < 0.05, `${label}: expected ${expected} dB, got ${actual} dB`)
}

// 单曲：只有标签的 -4 dB。智能平衡的记录（-6 dB）不能乘进来。
near(applied(), -4, 'track mode applies the tag gain alone')
near(deck(), -4, 'track mode writes that gain to the deck')

// 专辑：标签的 -7 dB。
player.setGainMode('album')
await settle()
assert.equal(player.getGainState().mode, 'album')
near(applied(), -7, 'album mode applies the album gain')
near(deck(), -7, 'album mode writes the album gain')

// 关闭：unity，即使这首歌既平衡记录又有标签。
player.setGainMode('off')
await settle()
near(applied(), 0, 'off applies nothing')
near(deck(), 0, 'off leaves the deck at unity')

// 智能平衡：-14 - (-8) = -6 dB，且不再叠加标签。
player.setGainMode('auto')
await settle()
assert.equal(player.getGainState().mode, 'auto')
near(applied(), -6, 'auto applies the balance reading')
near(deck(), -6, 'auto writes the balance gain')

// 回到单曲：标签重新接管，平衡记录不残留。
player.setGainMode('track')
await settle()
near(applied(), -4, 'switching back re-decides at once')

// 模式写进 prefs，旧的 normalizeVolume 只作为镜像。
const lastPrefs = JSON.parse(
  [...saved].reverse().find((entry) => entry.key === 'music.prefs.v2').value,
)
assert.equal(lastPrefs.replayGainMode, 'track')
assert.equal(lastPrefs.normalizeVolume, false)

player.attachAudio(null)
console.log('replay-gain-modes.test.mjs ok')
