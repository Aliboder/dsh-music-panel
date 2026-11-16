/**
 * The DSH boundary around Folia's graph: two media elements, one shared mix,
 * volume on the master gain, and EQ/effects handles.
 *
 * Runs `folia-graph.js` next to the generated audio bundle in one `vm` context,
 * so the adapter is exercised without mounting the whole client.
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..')
const BUNDLE = join(ROOT, 'src/client/audio/engine.bundle.js')
const GRAPH = join(ROOT, 'src/client/services/player/folia-graph.js')

const sandbox = { console }
vm.runInNewContext(readFileSync(BUNDLE, 'utf8'), sandbox, { filename: BUNDLE })
vm.runInNewContext(readFileSync(GRAPH, 'utf8'), sandbox, { filename: GRAPH })
assert.equal(typeof sandbox.createFoliaGraph, 'function', 'the graph adapter is present')

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
    close() {
      this.state = 'closed'
    },
    sinkId: '',
    setSinkId(next) {
      this.sinkId = next
      return Promise.resolve()
    },
    resume() {
      this.state = 'running'
      return Promise.resolve()
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

function createElement() {
  const parent = {
    insertBefore(child) {
      child.parentNode = this
      return child
    },
    removeChild(child) {
      child.parentNode = null
      return child
    },
  }
  return {
    parentNode: parent,
    nextSibling: null,
    className: '',
    preload: '',
    src: '',
    currentSrc: '',
    paused: true,
    ended: false,
    duration: 180,
    currentTime: 0,
    volume: 1,
    muted: false,
    setAttribute() {},
    removeAttribute() {},
    addEventListener() {},
    removeEventListener() {},
    pause() {
      this.paused = true
    },
    load() {},
  }
}

const context = createContext()
const primary = createElement()
const secondary = createElement()
const engine = sandbox.createFoliaGraph({
  createContext: () => context,
  createAudioElement: () => secondary,
})

assert.equal(engine.attach(primary), secondary, 'attaching the resident element creates the spare deck')
assert.equal(primary.volume, 1)
const graph = engine.ensure()
assert.ok(graph, 'the graph builds')
assert.equal(primary.volume, 1, 'the element volume is bypassed once the graph exists')
assert.equal(secondary.volume, 1, 'the spare deck is bypassed too')
assert.equal(engine.getMasterGain(), graph.gainNode, 'the master gain is Folia volume')
assert.equal(engine.getFadeGraph().gain, graph.fadeNode, 'the transport fade node is exposed')
assert.equal(engine.getEqualizerNodes().length, 10, 'Folia ten-band equalizer is wired')
assert.equal(engine.getDeckChain('A').fade.connections[0], engine.getMixNode(), 'deck A feeds the shared mix')
assert.equal(engine.getDeckChain('B').fade.connections[0], engine.getMixNode(), 'deck B feeds the shared mix')
assert.equal(engine.getContext(), context)
assert.equal(engine.getAnalyser().fftSize, 2048)
assert.equal(engine.getAnalyser().smoothingTimeConstant, 0.6)

engine.setVolume(0.25)
assert.equal(graph.gainNode.gain.value, 0.25, 'volume is written to the master gain')
engine.setMuted(true)
assert.equal(graph.gainNode.gain.value, 0, 'mute is a master-gain zero')
engine.setMuted(false)
assert.equal(graph.gainNode.gain.value, 0.25, 'unmute restores the chosen volume')

const eq = sandbox.__mpAudioBundle().resolveAudioEqualizerSettings({
  ...sandbox.__mpAudioBundle().DEFAULT_AUDIO_EQUALIZER_SETTINGS,
  enabled: true,
  gains: [3, 0, 0, 0, 0, 0, 0, 0, 0, -2],
})
engine.setEq(eq)
assert.equal(engine.getEq().enabled, true)
assert.equal(engine.getEqualizerNodes()[0].gain.value, 3)
assert.equal(engine.getEqualizerNodes()[9].gain.value, -2)

assert.equal(engine.getWave().length, 1024, 'the analyser buffer is exposed at Folia size')
assert.equal(engine.setOutputDevice('dev-1'), true, 'setSinkId is applied')
assert.equal(context.sinkId, 'dev-1')

engine.dispose()
assert.equal(primary.volume, 1)
assert.equal(secondary.parentNode, null)
console.log('folia-graph.test.mjs ok')
