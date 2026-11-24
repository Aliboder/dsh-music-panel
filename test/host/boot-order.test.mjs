/**
 * Host boot order: sources must be registered before the HTTP route is exposed.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const index = readFileSync(join(root, 'index.js'), 'utf8')

test('sources are registered synchronously before createRoutes', () => {
  const registerAt = index.indexOf('registerOnlineSources()')
  const routesAt = index.indexOf('const handle = createRoutes(')
  assert.ok(registerAt > 0, 'registerOnlineSources is called')
  assert.ok(routesAt > registerAt, 'registration happens before the route is built')
})

test('source cleanup is deferred and does not register', () => {
  const labelAt = index.indexOf("'music: sources'")
  assert.ok(labelAt > 0, 'source lifecycle effect exists')
  const effectAt = index.lastIndexOf('ctx.effect(', labelAt)
  const cleanup = index.slice(effectAt, labelAt + 30)
  assert.match(cleanup, /resetSources\(\)/)
  assert.doesNotMatch(cleanup, /registerOnlineSources\(\)/)
})
console.log('boot-order.test.mjs ok')
