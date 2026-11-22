/**
 * The component test page is the standard reference implementation.
 *
 * Every case must name its adapter and carry a copy-paste call, and the spec must point at
 * the page: that is what makes "look at the test page, copy the call" a real instruction
 * instead of folklore.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const gallery = readFileSync(join(root, 'src/client/components/ui/component-gallery.js'), 'utf8')
const spec = readFileSync(join(root, 'A_other/docs/主题与组件开发规范.md'), 'utf8')

test('every gallery case names its adapter and carries a callable snippet', () => {
  const cases = (gallery.match(/h\(GalleryCase, \{/g) || []).length
  assert.ok(cases >= 20, 'the test page covers the shared controls (' + cases + ' cases)')
  assert.equal((gallery.match(/adapter: '/g) || []).length, cases, 'every case names its adapter')
  assert.equal((gallery.match(/code: "/g) || []).length, cases, 'every case carries a snippet')
  assert.match(gallery, /'data-adapter': props\.adapter/, 'the adapter is machine-readable in the DOM')
  assert.match(gallery, /mp-gallery-code/, 'the snippet is rendered under the case')
})

test('the spec links the portable kit and its audit', () => {
  assert.match(spec, /组件开发规范\/README\.md/, '§3.4 links the portable kit')
  assert.match(spec, /宿主原语签名与CSS-0\.2\.2-rc\.5\.md/, '§3.4 links the audit inside the kit')
})

test('the spec points authors at the test page', () => {
  assert.match(spec, /### 3\.4 组件测试页 = 标准实现/, '§3.4 documents the rule')
  assert.match(spec, /component-gallery\.js/, '§3.4 names the file')
  assert.match(spec, /照抄/, '§3.4 says to copy the call rather than approximate it')
})
console.log('gallery.test.mjs ok')
