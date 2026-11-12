import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
assert.equal(pkg.exports['./package.json'], './package.json', 'package.json must be exported')

// This is the lookup DSH uses to decide whether a package is a web client.
const requireFromProfile = createRequire(join(root, 'profile-noop.cjs'))
const resolved = requireFromProfile.resolve('dsh-music-panel/package.json')
assert.equal(resolved, join(root, 'package.json'))

console.log('package-exports.test.mjs ok')
