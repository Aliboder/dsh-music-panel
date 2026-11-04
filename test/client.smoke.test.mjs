/**
 * Module-level smoke test for client.js.
 *
 * The Web Client half is a plain script that talks to the host through
 * `window.__ModuleLoader__` and a minimal React surface. Loading it under those
 * two mocks proves the module id, the factory shape, and that `apply` registers
 * exactly the three seats this plugin owns — before a real browser is involved.
 */

import assert from 'node:assert/strict'

const registrations = []
const texts = []

function fakeElement() {
  return {
    dataset: {},
    textContent: '',
    remove() {
      this.removed = true
    },
  }
}

global.window = {
  __ModuleLoader__: {
    load(definition) {
      globalThis.__dshMusicDef = definition
    },
  },
  localStorage: {
    getItem() {
      return null
    },
    setItem() {},
  },
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent() {},
  setTimeout(callback) {
    return setTimeout(callback, 0)
  },
  clearTimeout(id) {
    clearTimeout(id)
  },
}

global.document = {
  head: {
    appendChild(node) {
      texts.push(node)
    },
  },
  createElement() {
    return fakeElement()
  },
  documentElement: {
    getAttribute() {
      return 'zh-CN'
    },
  },
}

const React = {
  createElement: (type, props, ...children) => ({ type, props, children }),
  useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
  useEffect() {},
  useRef: (initial) => ({ current: initial }),
  useMemo: (factory) => factory(),
  useCallback: (factory) => factory,
  // Minimal Component base so the error-boundary class can be declared.
  Component: class Component {
    constructor(props) {
      this.props = props
      this.state = {}
    }

    setState() {}
  },
}

await import('../client.js')

const definition = globalThis.__dshMusicDef
assert.ok(definition, 'client.js must register through window.__ModuleLoader__')
assert.equal(definition.id, 'dsh-music-panel', 'module id must equal the package name')
assert.equal(typeof definition.factory, 'function')

const api = definition.factory((name) => {
  assert.equal(name, 'react', `unexpected host module: ${name}`)
  return React
})

assert.equal(api.name, 'dsh-music-panel')
assert.deepEqual(api.inject, ['slots', 'locale'])
assert.equal(typeof api.apply, 'function')

const mounts = []

const ctx = {
  effect(factory) {
    const dispose = factory()
    registrations.push(dispose)
    return dispose
  },
  slots: {
    inject(name, callback) {
      mounts.push(name)
      callback()
      return () => {}
    },
    register(registration) {
      assert.ok(registration.name, 'a registration needs a seat name')
      return () => {}
    },
  },
}

api.apply(ctx)

assert.deepEqual(mounts, [
  'shell.overlay',
  'sidebar.panellist',
  'main',
  'conversation.input.left',
  'conversation.input.dock',
  'shell.overlay',
])
assert.equal(texts.length, 1, 'exactly one style element is injected')
assert.ok(String(texts[0].textContent).includes('.mu-root'), 'the player styles are in place')
assert.ok(String(texts[0].textContent).includes('.mu-audio-host'), 'the resident audio host style is in place')
assert.equal(registrations.length, 8, 'style + engine teardown + six seats are effects')

console.log('client.smoke.test.mjs ok')
