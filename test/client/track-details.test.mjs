/**
 * 右键 → 详细信息：菜单项、浮层、面板字段与格式化规则。
 *
 * The panel is read-only and client-side: a local row already carries the stat and tag
 * fields the library scan produced, an online row gets its cache state from /online/info.
 * These guards pin that wiring, plus the pure formatters it renders with.
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..')
const read = (path) => readFileSync(join(ROOT, ...path.split('/')), 'utf8')

const manifest = read('src/client/manifest.json')
assert.match(manifest, /"src\/client\/components\/ui\/details\.js"/, 'the fragment is part of the client bundle')

// ── the menu item ─────────────────────────────────────────────────────────
const dialogs = read('src/client/components/ui/dialogs.js')
assert.match(dialogs, /key: 'details'/, 'a single track menu offers 详细信息')
assert.match(dialogs, /icon: 'info'/, 'the item uses the info icon')
assert.match(dialogs, /label: t\('page\.details'\)/, 'the label is the shared 详细信息 key')
assert.match(dialogs, /pushLayer\('details', \{ track: track \}\)/, 'it opens the details layer with the clicked row')

// ── the overlay renders it ────────────────────────────────────────────────
const overlay = read('src/client/panel-v3/p3-overlay.js')
assert.match(
  overlay,
  /if \(layer\.kind === 'details'\) return h\(TrackDetailsDialog, \{ key: 'details', layer: layer \}\)/,
  'the layer renders TrackDetailsDialog',
)

// ── the panel itself ──────────────────────────────────────────────────────
const details = read('src/client/components/ui/details.js')
assert.match(details, /function TrackDetailsDialog\(/, 'the dialog is a named component')
assert.match(details, /h\(\s*KitModal,/, 'dialogs go through KitModal (no raw overlay markup)')
assert.doesNotMatch(details, /mp-overlay|mp-scrim|mp-dialog/, 'no hand-written dialog shell')
assert.doesNotMatch(details, /#[0-9a-fA-F]{3,8}\b/, 'colours come from tokens only')

// A favorites / playlist / recent row is a path-only snapshot; the library record has the
// size and tag fields, so the panel resolves it before rendering.
assert.match(details, /trackByPath\(asked\.path\) \|\| asked/, 'a path-only row is resolved against the library')

const localFields = ['page.infoPath', 'page.infoSize', 'page.infoBitrate', 'page.infoSampleRate', 'page.infoFormat', 'page.infoModified']
for (const key of localFields) assert.match(details, new RegExp(key.replace(/\./g, '\\.')), 'a local file shows ' + key)
assert.match(details, /online\/info\?provider=/, 'an online row reads its cache state from the host')
assert.match(details, /page\.infoNotCached/, 'an uncached online row says so')
assert.match(details, /copyTextSafely\(track\.path\)/, 'the path can be copied from the panel')

// ── formatting rules ──────────────────────────────────────────────────────
const factory = new Function(
  'var t = function (key) { return key };\n' +
    details +
    '\nreturn { detailBitrateText, detailSampleRateText, detailQualityText, detailDateText };',
)
const f = factory()
assert.equal(f.detailBitrateText(320000), '320 kbps')
assert.equal(f.detailBitrateText(128000), '128 kbps')
assert.equal(f.detailBitrateText(0), '', 'an unknown bitrate is left out')
assert.equal(f.detailSampleRateText(44100), '44.1 kHz')
assert.equal(f.detailSampleRateText(48000), '48 kHz', 'whole kHz keeps no decimal')
assert.equal(f.detailSampleRateText(undefined), '')
assert.equal(f.detailQualityText('lossless'), 'sheet.qLossless', 'cache quality reuses the settings wording')
assert.equal(f.detailQualityText('nope'), '')
assert.equal(f.detailDateText(0, true), '')
assert.match(f.detailDateText(Date.UTC(2026, 0, 2, 3, 4, 5), true), /2026/, 'a known stamp renders as a date')

// ── styles and strings ────────────────────────────────────────────────────
const theme = read('src/client/styles/theme.js')
assert.match(theme, /\.mp-detail-row\{[^']*border-bottom:\.5px solid var\(--dsw-alias-border-l1/, 'rows are split by a 0.5px token hairline')
assert.match(theme, /\.mp-detail-value\.is-mono\{/, 'paths and ids render monospace')
assert.doesNotMatch(theme, /\.mp-detail-row\{[^']*border-radius:(?:6|7|9|10|11|14|18)px/, 'no off-spec radius')

const i18n = read('src/client/i18n/i18n.js')
const keys = ['page.details', 'page.infoSong', 'page.infoDuration', 'page.infoFormat', 'page.infoSize', 'page.infoBitrate', 'page.infoSampleRate', 'page.infoPath', 'page.infoModified', 'page.infoAdded', 'page.infoPlays', 'page.infoSource', 'page.infoSongId', 'page.infoCache', 'page.infoNotCached', 'page.infoUnavailable']
for (const key of keys) {
  const count = (i18n.match(new RegExp("'" + key.replace(/\./g, '\\.') + "':", 'g')) ?? []).length
  assert.equal(count, 2, key + ' exists in both locales')
}

console.log('track-details.test.mjs ok')