import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { readJsonWithBackup, writeJsonAtomic } from '../lib/json-store.js'

const dir = await mkdtemp(join(tmpdir(), 'dsh-music-json-'))
const file = join(dir, 'state.json')

assert.equal(await readJsonWithBackup(file), null, 'missing file reads as null')
await writeJsonAtomic(file, { value: 1 })
assert.deepEqual(await readJsonWithBackup(file), { value: 1 })
await writeJsonAtomic(file, { value: 2 })
assert.deepEqual(await readJsonWithBackup(file), { value: 2 })

// A truncated primary file falls back to the backup written before replace.
await writeFile(file, '{"broken"', 'utf8')
assert.deepEqual(await readJsonWithBackup(file), { value: 1 })

// Concurrent writers must leave one complete document, never a partial one.
await Promise.all(
  Array.from({ length: 20 }, (_, index) => writeJsonAtomic(file, { value: index, payload: 'x'.repeat(1000) })),
)
const parsed = await readJsonWithBackup(file)
assert.equal(typeof parsed.value, 'number')
assert.equal(parsed.payload.length, 1000)
assert.ok((await readFile(file, 'utf8')).endsWith('\n'))

console.log('json-store.test.mjs ok')
