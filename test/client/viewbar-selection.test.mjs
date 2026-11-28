/**
 * 选择属于一个列表：换视图要清掉，选歌时也不能把顶栏的 Tab 顶掉。
 * 旧行为：单击歌曲选中 → 回主页，P3ViewBar 的 selecting 分支整行只画编辑栏，
 * Tab 被盖住且选中态留到了新页面。
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (path) => readFileSync(join(root, path), 'utf8')
const shell = read('src/client/panel-v3/p3-shell.js')
const css = read('src/client/panel-v3/p3-styles.js')

test('a selection only counts for songs that are on the current page', () => {
  assert.match(shell, /var selecting = selected\.length > 0/, 'a stale/empty selection no longer hijacks the bar')
})

test('the tab strip and the selection actions share the row', () => {
  assert.match(shell, /var tabRow = !props\.rail && route\.page !== 'search' && tabs\.length > 0/)
  const selectingAt = shell.indexOf('if (selecting) {')
  assert.ok(selectingAt >= 0, 'the selection branch still exists')
  const branch = shell.slice(selectingAt, selectingAt + 2200)
  assert.match(branch, /h\('div', \{ className: 'mpv3-viewbar' \},\s*tabRow,/, 'the selection branch renders the tabs too')
  assert.match(branch, /className: 'mpv3-selection-bar'/, 'and the actions')
  const normalAt = shell.indexOf("return h('div', { className: 'mpv3-viewbar' },\n    tabRow,")
  assert.ok(normalAt > selectingAt, 'the normal branch is the same row with the usual actions')
})

test('the selection actions sit to the right of the tabs, never over them', () => {
  assert.match(css, /\.mpv3-selection-bar \{[^}]*flex: 1 1 auto;[^}]*justify-content: flex-end;/)
  assert.match(css, /\.mpv3-selection-bar \{[^}]*width: auto;/)
  assert.doesNotMatch(css, /\.mpv3-selection-bar \{[^}]*width: 100%;/)
})

test('navigation clears the selection and the range-pick anchor', () => {
  assert.match(shell, /var selectionViewRef = useRef\(null\)/)
  const effectAt = shell.indexOf('var selectionViewRef = useRef(null)')
  const deps = '[route.source, route.page, route.param, route.filter, search.open, search.query, collection.snapshot]'
  const effectEnd = shell.indexOf(deps, effectAt)
  assert.ok(effectAt > 0 && effectEnd > effectAt, 'the view-identity effect is present')
  const effect = shell.slice(effectAt, effectEnd + deps.length)
  assert.match(effect, /clearSelection\(\)/, 'a new list view drops the old selection')
  assert.match(effect, /cancelRangePick\(\)/, 'and the range-pick anchor')
  assert.match(effect, /\[route\.source, route\.page, route\.param, route\.filter, search\.open, search\.query, collection\.snapshot\]/, 'it watches the view identity')
})

console.log('viewbar-selection.test.mjs ok')
