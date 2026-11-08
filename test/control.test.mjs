import { test } from 'node:test'
import assert from 'node:assert/strict'
import { enqueueControl, takeControls } from '../lib/control.js'

test('control queue drains in order', () => {
  takeControls()
  assert.equal(enqueueControl({ action: 'play', query: '晴天' }), true)
  assert.equal(enqueueControl({ action: 'pause' }), true)
  const actions = takeControls()
  assert.deepEqual(
    actions.map((item) => [item.action, item.query]),
    [
      ['play', '晴天'],
      ['pause', ''],
    ],
  )
  assert.deepEqual(takeControls(), [])
})

test('control queue ignores empty actions and keeps the newest ten', () => {
  takeControls()
  assert.equal(enqueueControl({ action: '' }), false)
  for (let index = 0; index < 12; index += 1) {
    enqueueControl({ action: 'play', query: String(index) })
  }
  const actions = takeControls()
  assert.equal(actions.length, 10)
  assert.equal(actions[0].query, '2')
  assert.equal(actions[9].query, '11')
})
