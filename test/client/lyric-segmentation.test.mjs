/**
 * 歌词分词 — the manual split exchange, end to end through the built client.
 *
 * Folia's contract: the rows join back to each lyric line exactly, saving writes the
 * record the lyric setter bakes, and the baked boundaries reach the renderer as
 * `line.wordSegments`.
 */
import assert from 'node:assert/strict'

const stored = new Map()
global.window = {
  __ModuleLoader__: { load: (definition) => { globalThis.__dshMusicDef = definition } },
  localStorage: {
    getItem: (key) => (stored.has(key) ? stored.get(key) : null),
    setItem: (key, value) => { stored.set(key, String(value)) },
    removeItem: (key) => { stored.delete(key) },
  },
  addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
  innerHeight: 900, innerWidth: 1400,
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  setTimeout: (callback) => setTimeout(callback, 0),
  clearTimeout: (id) => clearTimeout(id),
}
function fakeElement() {
  return { dataset: {}, textContent: '', remove() {}, appendChild() {}, addEventListener() {} }
}
global.document = {
  head: { appendChild() {} },
  body: { appendChild() {}, removeChild() {} },
  createElement: () => fakeElement(),
  documentElement: { getAttribute: () => 'zh-CN' },
  visibilityState: 'visible',
  addEventListener() {}, removeEventListener() {},
}

const React = {
  createElement: (type, props, ...children) => ({ type, props, children }),
  useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
  useEffect() {},
  useLayoutEffect() {},
  useRef: (initial) => ({ current: initial }),
  useMemo: (factory) => factory(),
  useCallback: (factory) => factory,
  memo: (component) => component,
  Component: class Component { constructor(props) { this.props = props; this.state = {} } setState() {} },
}

await import('../../client.js')
const api = globalThis.__dshMusicDef.factory(() => React)
const internals = api.__internals
const lyrics = internals.MPFoliaLyrics
assert.ok(lyrics && typeof lyrics.parse === 'function', 'the lyric pipeline bundle is loaded')

const songKey = 'D:/music/song.flac'
const doc = await lyrics.parse({ type: 'local', lrcContent: '[00:01.00]我们一起去听歌吧\n[00:05.00]第二句' })
assert.equal(doc.lines.length, 2)

// ── the dialog renders the exchange format ────────────────────────────────
const saved = []
const dialog = internals.LyricSegmentationDialog({
  layer: {
    kind: 'lyricSeg',
    props: {
      songKey,
      lyrics: doc.lines,
      onSaved: (record) => { saved.push(record) },
    },
  },
})
assert.ok(dialog !== null && typeof dialog === 'object', 'the dialog renders')

function walk(node, visit) {
  if (!node || typeof node !== 'object') return
  visit(node)
  for (const child of node.children || []) walk(child, visit)
  // The host modal takes its footer as a prop, not a child.
  const footer = node.props && node.props.footer
  if (Array.isArray(footer)) footer.forEach((child) => walk(child, visit))
}
let textarea = null
const buttons = []
walk(dialog, (node) => {
  if (node.type === 'textarea') textarea = node
  if (node.type === 'button') buttons.push(node)
})
assert.ok(textarea !== null, 'the rows are editable')
assert.equal(textarea.props.value.split('\n').length, 2, 'one row per lyric line')
assert.equal(
  textarea.props.value.split('\n')[0].replace(/\//g, ''),
  '我们一起去听歌吧',
  'a row is the line with / between words',
)

// The footer is [reset, spacer, cancel, save]: save is the last button and the only one
// that applies the text.
const saveButton = buttons[buttons.length - 1]
assert.ok(saveButton && typeof saveButton.props.onClick === 'function', 'the dialog offers 保存')
assert.equal(saveButton.props.disabled, false, '保存 is enabled while the rows are editable')
saveButton.props.onClick()

// ── saving wrote the record the setter bakes ──────────────────────────────
const record = internals.readLyricSegmentation(songKey)
assert.ok(record !== null && record !== undefined, 'the record is persisted')
assert.equal(record.songKey, songKey)
assert.equal(record.source, 'manual')
assert.equal(saved.length, 1, 'the caller is told, so the lines on screen can be re-baked')
const lineKey = lyrics.getLyricLineSegmentationKey(doc.lines[0])
assert.ok(Array.isArray(record.lines[lineKey]), 'the record is keyed by line time + text')
assert.equal(record.lines[lineKey].join(''), '我们一起去听歌吧')

// ── the display pass bakes it, and counts what landed ─────────────────────
const prepared = internals.mpPrepareLyrics(doc, songKey, [])
assert.equal(prepared.pureMusic, false)
assert.deepEqual(JSON.parse(JSON.stringify(prepared.lyrics[0].wordSegments)), record.lines[lineKey])
assert.equal(prepared.lyrics[0].wordSegments.join(''), '我们一起去听歌吧')
assert.equal(prepared.lyrics[1].wordSegments.join(''), '第二句', 'every saved row lands on its own line')
assert.equal(internals.mpSegmentationLineCount(doc.lines, songKey), 2)

// A record that covers only one line leaves the other on the default split.
internals.saveLyricSegmentation(songKey, { [lineKey]: ['我们', '一起', '去', '听歌', '吧'] })
const partial = internals.mpPrepareLyrics(doc, songKey, [])
assert.deepEqual(JSON.parse(JSON.stringify(partial.lyrics[0].wordSegments)), ['我们', '一起', '去', '听歌', '吧'])
assert.equal(partial.lyrics[1].wordSegments, undefined)
assert.equal(internals.mpSegmentationLineCount(doc.lines, songKey), 1)

// Other songs do not inherit it.
assert.equal(internals.readLyricSegmentation('D:/music/other.flac'), null)

// ── local lyrics take the same raw pipeline ───────────────────────────────
{
  // A timed sidecar's raw text is parsed (here: enhanced LRC, which only the parser can
  // turn into per-word timing); the Host's own lines are the fallback for untimed text.
  const timed = await internals.mpLocalLyricLines(
    { raw: '[00:01.00]<00:01.00>晴<00:01.50>天', formatHint: '' },
    'D:/music/timed.flac',
  )
  assert.equal(timed.folia, true)
  assert.equal(timed.document !== null, true, 'the document is kept for the rule re-run')
  assert.deepEqual(JSON.parse(JSON.stringify(timed.lyrics[0].words.map((word) => word.text))), ['晴', '天'])

  const untimed = await internals.mpLocalLyricLines(
    { lines: [{ time: -1, text: 'plain words', translation: '' }], raw: '' },
    'D:/music/plain.flac',
  )
  assert.equal(untimed.folia, false, 'untimed text keeps the Host lines')
  assert.equal(untimed.lyrics[0].text, 'plain words')
  assert.equal(untimed.document, null)
}

// ── reset forgets it ──────────────────────────────────────────────────────
internals.saveLyricSegmentation(songKey, null)
assert.equal(internals.readLyricSegmentation(songKey), null)
assert.equal(internals.mpPrepareLyrics(doc, songKey, []).lyrics[0].wordSegments, undefined)

console.log('lyric-segmentation.test.mjs ok')

