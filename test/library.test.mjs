import assert from 'node:assert/strict'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createLibrary } from '../lib/library.js'
import { wavBuffer } from './helpers.mjs'

const root = await mkdtemp(join(tmpdir(), 'dsh-music-lib-'))
await writeFile(join(root, 'one.wav'), wavBuffer(1))
await writeFile(join(root, 'notes.txt'), 'not audio')
await mkdir(join(root, 'sub'))
await writeFile(join(root, 'sub', 'two.wav'), wavBuffer(1))
await mkdir(join(root, '.hidden'))
await writeFile(join(root, '.hidden', 'nope.wav'), wavBuffer(1))

const library = createLibrary({
  getSettings: async () => ({ roots: [root], depth: 4, extensions: ['wav'] }),
})
const result = await library.scan()

assert.equal(result.tracks.length, 2, 'only visible .wav files are scanned')
assert.deepEqual(
  result.tracks.map((track) => track.name).sort(),
  ['one.wav', 'two.wav'],
)
assert.equal(result.tracks[0].title, 'one', 'missing tags fall back to the file name')
assert.equal(result.tracks[0].ext, 'wav')
assert.equal(result.empty, false)
assert.equal(result.warnings.length, 0)

// Depth 0 stays in the selected folder.
const shallow = createLibrary({
  getSettings: async () => ({ roots: [root], depth: 0, extensions: ['wav'] }),
})
const shallowResult = await shallow.scan()
assert.equal(shallowResult.tracks.length, 1)
assert.equal(shallowResult.tracks[0].title, 'one')

// No roots configured is a valid empty answer, not an error.
const none = createLibrary({ getSettings: async () => ({ roots: [], depth: 4, extensions: ['wav'] }) })
const noneResult = await none.scan()
assert.equal(noneResult.tracks.length, 0)
assert.equal(noneResult.empty, true)

// A missing root is reported as a warning.
const missing = createLibrary({
  getSettings: async () => ({ roots: [join(root, 'gone')], depth: 1, extensions: ['wav'] }),
})
const missingResult = await missing.scan()
assert.equal(missingResult.tracks.length, 0)
assert.equal(missingResult.warnings.length, 1)

console.log('library.test.mjs ok')
