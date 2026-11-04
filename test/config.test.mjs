import assert from 'node:assert/strict'
import { DEFAULTS, extensionOf, isAllowedName, mimeOf, normalizeConfig } from '../lib/config.js'

// Empty/garbage input falls back to the defaults.
assert.deepEqual(normalizeConfig(undefined), DEFAULTS)
assert.deepEqual(normalizeConfig(null), DEFAULTS)
assert.deepEqual(normalizeConfig('nope'), DEFAULTS)

// Roots: trimmed, empty entries dropped, non-strings dropped.
assert.deepEqual(normalizeConfig({ roots: ['  D:/Music  ', '', 42, 'D:/More'] }).roots, ['D:/Music', 'D:/More'])

// Depth clamps into 0..8.
assert.equal(normalizeConfig({ depth: -3 }).depth, 0)
assert.equal(normalizeConfig({ depth: 99 }).depth, 8)
assert.equal(normalizeConfig({ depth: '2' }).depth, 2)
assert.equal(normalizeConfig({ depth: 'x' }).depth, DEFAULTS.depth)

// Extensions: lowercased, dotted entries normalized, unknown ones dropped.
assert.deepEqual(normalizeConfig({ extensions: ['MP3', '.flac', 'txt'] }).extensions, ['mp3', 'flac'])
assert.deepEqual(normalizeConfig({ extensions: [] }).extensions, DEFAULTS.extensions)
assert.deepEqual(normalizeConfig({ extensions: ['bogus'] }).extensions, DEFAULTS.extensions)

// Small helpers.
assert.equal(extensionOf('a/b/Song.FLAC'), 'flac')
assert.equal(extensionOf('noext'), '')
assert.equal(mimeOf('x.mp3'), 'audio/mpeg')
assert.equal(mimeOf('x.wav'), 'audio/wav')
assert.equal(mimeOf('x.xyz'), 'application/octet-stream')
assert.equal(isAllowedName('x.mp3', ['mp3']), true)
assert.equal(isAllowedName('x.wav', ['mp3']), false)

console.log('config.test.mjs ok')
