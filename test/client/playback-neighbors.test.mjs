/**
 * Folia playbackNeighbors contract, tested without the player runtime.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const source = readFileSync(join(root, 'src/client/services/player/playback-neighbors.js'), 'utf8')
const context = vm.createContext({})
vm.runInContext(source, context)
const next = (length, index, loop) => vm.runInContext(`nextQueueIndex(${length}, ${index}, "${loop}")`, context)
const prev = (length, index, loop) => vm.runInContext(`prevQueueIndex(${length}, ${index}, "${loop}")`, context)
const after = (length, index, loop) => vm.runInContext(`hasTrackAfter(${length}, ${index}, "${loop}")`, context)

assert.equal(next(3, 0, 'none'), 1)
assert.equal(next(3, 1, 'none'), 2)
assert.equal(next(3, 2, 'none'), -1, 'no wrap without list loop')
assert.equal(next(3, 2, 'all'), 0, 'list loop wraps')
assert.equal(next(0, 0, 'all'), -1)
assert.equal(prev(3, 0, 'none'), -1, 'no wrap without list loop')
assert.equal(prev(3, 0, 'all'), 2, 'list loop wraps')
assert.equal(prev(0, 0, 'all'), -1)
assert.equal(after(3, 1, 'none'), true)
assert.equal(after(3, 2, 'none'), false)
assert.equal(after(3, 2, 'all'), true)
assert.equal(after(1, 0, 'all'), false, 'a one-track loop is not a transition')
console.log('playback-neighbors.test.mjs ok')
