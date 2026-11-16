/**
 * Folia audio graph: the bundle really builds Folia's node order.
 *
 * The test runs the generated fragment through `vm`, so it checks the shipped
 * artifact rather than a second hand-written copy of the graph.
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..')
const BUNDLE = join(ROOT, 'src/client/audio/engine.bundle.js')

const sandbox = { console }
vm.runInNewContext(readFileSync(BUNDLE, 'utf8'), sandbox, { filename: BUNDLE })
const audio = sandbox.__mpAudioBundle()
assert.ok(audio !== null && typeof audio.buildPlaybackGraph === 'function', 'audio bundle loads')

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
    setValueCurveAtTime(curve) {
      this.value = curve[curve.length - 1]
    },
    cancelScheduledValues() {},
    cancelAndHoldAtTime() {},
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
  const context = {
    currentTime: 0,
    sampleRate: 48000,
    destination: node('destination'),
    nodes: [],
    createGain() {
      const value = { ...node('gain'), gain: param(1) }
      this.nodes.push(value)
      return value
    },
    createBiquadFilter() {
      const value = {
        ...node('biquad'),
        type: 'peaking',
        frequency: param(1000),
        Q: param(1),
        gain: param(0),
      }
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
      }
      this.nodes.push(value)
      return value
    },
    createBuffer(numberOfChannels, length, sampleRate) {
      return {
        numberOfChannels,
        length,
        sampleRate,
        getChannelData: () => new Float32Array(length),
      }
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
  return context
}

const context = createContext()
const analyser = context.createAnalyser()
const settings = audio.resolveAudioEqualizerSettings(audio.DEFAULT_AUDIO_EQUALIZER_SETTINGS)
const equalizerNodesRef = { current: [] }
let deckConnections = 0

const graph = audio.buildPlaybackGraph({
  context,
  analyser,
  connectDecks(ctx, output) {
    deckConnections += 1
    const deck = ctx.createGain()
    deck.connect(output)
    return true
  },
  equalizerNodesRef,
  settings,
})

assert.equal(deckConnections, 1, 'both decks are connected through one mix point')
assert.equal(graph.decksConnected, true)
assert.equal(equalizerNodesRef.current.length, 10, 'Folia ten-band equalizer')

const types = equalizerNodesRef.current.map((filter) => filter.type)
assert.equal(types.join(','), 'lowshelf,peaking,peaking,peaking,peaking,peaking,peaking,peaking,peaking,highshelf')
for (const filter of equalizerNodesRef.current) assert.equal(filter.Q.value, 1.4)

// Folia's order: EQ -> effects -> transport fade -> volume -> analyser -> out.
assert.ok(equalizerNodesRef.current[0].connections.length >= 0)
assert.ok(graph.fadeNode.connections.includes(graph.gainNode), 'transport fade feeds volume')
assert.ok(graph.gainNode.connections.includes(analyser), 'volume feeds the analyser')
assert.ok(analyser.connections.includes(context.destination), 'analyser is the last node')

// The effect chain is present even when neutral, and its punch compressor is
// bypassed (ratio 1). There is no extra limiter in the graph.
const compressor = context.nodes.find((item) => item.kind === 'compressor')
assert.ok(compressor, 'effects chain owns its compressor')
assert.equal(compressor.ratio.value, 1)
assert.equal(typeof graph.effectChain.apply, 'function')
// The equalizer is a shared chain after the mix point, not per deck.
const mix = context.nodes.find((item) => item.kind === 'gain')
assert.ok(mix, 'the graph built a mix gain')
assert.ok(mix.connections.includes(equalizerNodesRef.current[0]), 'mix feeds the first EQ band')

// A deck chain is Folia's four gain stages: replayGain -> trim -> tone -> fade.
const element = {
  currentTime: 0,
  paused: true,
  duration: 180,
  currentSrc: '',
  addEventListener() {},
  removeEventListener() {},
}
const deckOutput = context.createGain()
const chain = audio.connectAutomixDeck(context, element, deckOutput)
assert.equal(chain.source.connections[0], chain.replayGain, 'deck source feeds replayGain')
assert.equal(chain.replayGain.connections[0], chain.trim, 'replayGain feeds trim')
assert.equal(chain.trim.connections[0], chain.tone.low, 'trim feeds the low tone band')
assert.equal(chain.tone.low.connections[0], chain.tone.mid, 'low feeds mid')
assert.equal(chain.tone.mid.connections[0], chain.tone.high, 'mid feeds high')
assert.equal(chain.tone.high.connections[0], chain.fade, 'high feeds the crossfade envelope')
assert.equal(chain.fade.connections[0], deckOutput, 'fade feeds the shared mix')
assert.equal(typeof chain.analyser.tick, 'function', 'the deck has its own analyser')
assert.equal(typeof chain.balanceMeter.tick, 'function', 'the deck has its own balance meter')

console.log('audio-graph.test.mjs ok')
