/**
 * Theme guard: keeps future UI additions on the DSH token/component rules
 * documented in docs/theme-guidelines.md.
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const theme = readFileSync(join(root, 'src/90-theme.js'), 'utf8')
const uiDir = join(root, 'src/ui')
const uiFiles = [
  '01-primitives.js',
  '02-track-row.js',
  '03-player-bar.js',
  '04-eq-panel.js',
  '04-now-playing.js',
  '05-queue.js',
  '06-settings.js',
  '07-dialogs.js',
  '08-local.js',
  '09-online.js',
  '10-navigation.js',
  '11-panel.js',
  '12-composer.js',
  '13-batch.js',
  '14-online-lyric.js',
  '15-trash.js',
  '16-header.js',
]
const all = [theme, ...uiFiles.map((name) => readFileSync(join(uiDir, name), 'utf8'))]
const joined = all.join('\n')

// Official radius scale: 8 / 12 / 16 / 20 / 28 (pills/circles use 999/50%).
assert.doesNotMatch(theme, /border-radius:(?:6|7|9|10|11|14|18)px/, 'radius must stay on the 8/12/16/20 scale')

// Official type scale: 13 / 12 / 11 (no half pixels).
assert.doesNotMatch(joined, /font-size:(?:10\.5|11\.5|12\.5)px/, 'font sizes must use the official scale')
assert.doesNotMatch(joined, /fontSize:\s*'(?:10\.5|11\.5|12\.5)px'/, 'inline font sizes must use the official scale')

// `Cover` renders a bare <img> with no intrinsic sizing, so every fixed-size
// container that shows one must clamp it; otherwise the artwork paints at its
// natural size and blows the layout open. The artist/album cards shipped
// exactly that bug, so the containers are listed explicitly.
for (const selector of ['.mp-card-art', '.mp-srow-cover', '.mp-row-cover', '.mp-q-cover', '.mp-pb-cover']) {
  const rule = new RegExp(`\\${selector} img\\{[^}]*width:100%;height:100%;object-fit:cover`)
  assert.match(theme, rule, `${selector} must clamp its Cover image to the container`)
}

// Accent must come from the business token, not the old hard-coded blue.
assert.doesNotMatch(joined, /#5686fe/i, 'use --dsw-alias-state-business-primary instead of #5686fe')
assert.doesNotMatch(joined, /static-deepseek-450/, 'use --dsw-alias-state-business-primary instead of the old token')

// The audio-effects panel must keep one fixed footprint. Without a height the
// 音量 view and the three equalizer tabs each render at their natural size and
// the popover visibly jumps every time the user switches.
const effectsRule = theme.match(/'\.mp-np-extra-pop\.is-effects\{([^}]*)\}'/)
assert.ok(effectsRule, 'the audio-effects panel rule exists')
assert.match(effectsRule[1], /(?<!max-)height:min\(72vh,400px\)/, 'the panel height is fixed')
assert.match(effectsRule[1], /overflow:hidden/, 'the panel clips; each view scrolls its own body')
for (const rule of ['\\.mp-fx-body\\{[^}]*overflow-y:auto', '\\.mp-eq-body\\{[^}]*overflow-y:auto']) {
  assert.match(theme, new RegExp(rule), 'view bodies scroll inside the fixed panel')
}

// Required tokens/recipes must stay present.
for (const token of [
  '--dsw-focus-ring-color',
  '--dsw-menu-surface-fill',
  '--dsw-elevation-panel',
  '--dsw-alias-button-primary-fill',
  '--dsw-alias-toast-bg',
  '--dsw-alias-state-business-primary',
]) {
  assert.ok(theme.includes(token), 'theme must reference ' + token)
}

// Only the adapter may require the host client package.
for (const [index, text] of all.entries()) {
  const hits = text.match(/require\('@deepseek-ai\/dsh-client-ui-primitives'\)/g) || []
  if (index === 0) continue
  assert.equal(hits.length, 0, 'only src/00-host-ui.js may require host primitives')
}
const adapter = readFileSync(join(root, 'src/00-host-ui.js'), 'utf8')
assert.ok(adapter.includes("require('@deepseek-ai/dsh-client-ui-primitives')"), 'adapter must load host primitives')
assert.ok(adapter.includes('HOST_ICON_MAP'), 'adapter must own the host icon map')

// Dialogs must go through KitModal, not raw overlay markup (only fallbacks may).
const rawDialogs = uiFiles
  .map((name) => [name, readFileSync(join(uiDir, name), 'utf8')])
  .filter(([name, text]) => name !== '01-primitives.js' && text.includes("className: 'mp-overlay is-on'"))
  .map(([name]) => name)
assert.deepEqual(rawDialogs, [], 'dialogs must use KitModal (raw mp-overlay found in ' + rawDialogs.join(', ') + ')')

// Player page: the midpoint of the two column centre lines is pinned to the
// interface centre, and the lyrics width is fitted so the right margin never
// goes negative.
assert.match(
  theme,
  /@media \(min-width:981px\)\{[^']*--mp-lyric-fit:min\(/,
  'the lyrics width is clamped to what the interface can hold',
)
assert.match(
  theme,
  /\.mp-np-left\{[^']*margin-left:calc\(\(100% - 1\.5\*var\(--mp-cover/,
  'the left margin follows the column-centre rule',
)
assert.match(theme, /\.mp-np-right\{[^']*width:var\(--mp-lyric-fit\)/, 'the lyrics column uses the fitted width')
assert.match(theme, /\.mp-np-split\{[^']*cursor:col-resize/, 'the splitter is draggable')
assert.match(theme, /\.mp-np-split\{[^']*display:none/, 'the splitter is hidden on the stacked layout')

// Flowing-light background: colours must be registered so track changes can
// interpolate, and the animation must stay on the compositor (transform only).
assert.match(theme, /@property --mp-flow-a\{syntax:'<color>'/, 'flow colours register for smooth track changes')
assert.match(theme, /\.mp-np-blob\{[^']*radial-gradient/, 'flow blobs are gradients, not blur filters')
assert.match(theme, /@keyframes mp-flow-a\{[^']*transform:translate3d/, 'flow animates transform only')
assert.doesNotMatch(theme, /\.mp-np-blob\{[^']*background-position/, 'flow must not animate background-position')
assert.match(theme, /prefers-reduced-motion:reduce\)\{\.mp-np-blob\{animation:none/, 'reduced motion disables the flow')

// The lyric footer buttons follow the chosen lyric alignment.
assert.match(theme, /\.mp-align-center \.mp-np-lyric-foot\{justify-content:center\}/, 'footer follows the lyric alignment')
assert.match(theme, /\.mp-align-right \.mp-np-lyric-foot\{justify-content:flex-end\}/, 'right alignment ends the footer')

// The editor becomes a three-column tablet layout on wide screens.
assert.match(theme, /@media \(min-width:1000px\)\{[^']*\.mp-npe-body\{[^']*display:grid/, 'tablet editor grid')
assert.match(theme, /\.mp-npe-section\.is-type\{grid-column:2/, 'settings columns are placed by area')
assert.match(theme, /\.mp-npe-preview-cover\.is-vinyl\{[^']*repeating-radial-gradient/, 'vinyl preview keeps its disc edge')
assert.match(theme, /\.mp-npe-preview-cover\.is-vinyl img\{[^']*width:78%/, 'vinyl preview artwork sits inside the disc')

console.log('theme.test.mjs ok')
