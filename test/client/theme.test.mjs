/**
 * Theme guard: keeps future UI additions on the DSH token/component rules
 * documented in docs/theme-guidelines.md.
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('../..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const theme = readFileSync(join(root, 'src/client/styles/theme.js'), 'utf8')
const uiDir = join(root, 'src/client/components/ui')
const uiFiles = [
  'primitives.js',
  'component-gallery.js',
  'track-row.js',
  'player-bar.js',
  'eq-panel.js',
  'now-playing.js',
  'queue.js',
  'settings.js',
  'dialogs.js',
  'local.js',
  'online.js',
  'navigation.js',
  'panel.js',
  'composer.js',
  'batch.js',
  'online-lyric.js',
  'trash.js',
  'header.js',
]
const all = [theme, ...uiFiles.map((name) => readFileSync(join(uiDir, name), 'utf8'))]
const joined = all.join('\n')

// Official radius scale: 4 / 8 / 12 / 16 / 20 / 28 (pills/circles use 999/50%).
// R4 is the small-detail step; 10/14/24 are explicitly disallowed local values.
assert.doesNotMatch(theme, /border-radius:(?:6|7|9|10|11|14|18)px/, 'radius must stay on the 8/12/16/20 scale')

// Official type scale: 13 / 12 / 11 (no half pixels).
assert.doesNotMatch(joined, /font-size:(?:10\.5|11\.5|12\.5)px/, 'font sizes must use the official scale')
assert.doesNotMatch(joined, /fontSize:\s*'(?:10\.5|11\.5|12\.5)px'/, 'inline font sizes must use the official scale')

// `Cover` renders a bare <img> with no intrinsic sizing, so every fixed-size
// container that shows one must clamp it; otherwise the artwork paints at its
// natural size and blows the layout open. The artist/album cards shipped
// exactly that bug, so the containers are listed explicitly.
for (const selector of ['.mp-entry-art', '.mp-srow-cover', '.mp-row-cover', '.mp-q-cover', '.mp-pb-cover']) {
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
  '--dsw-alias-switch-thumb',
]) {
  assert.ok(theme.includes(token), 'theme must reference ' + token)
}

// The local Switch fallback must use the host's thumb token, otherwise the
// documented light/dark contract and the actual control drift apart.
assert.match(theme, /\.mp-switch i\{[^']*background:var\(--dsw-alias-switch-thumb/, 'switch thumb follows the token')

// Only the adapter may require the host client package.
for (const [index, text] of all.entries()) {
  const hits = text.match(/require\('@deepseek-ai\/dsh-client-ui-primitives'\)/g) || []
  if (index === 0) continue
  assert.equal(hits.length, 0, 'only src/client/app/host-ui.js may require host primitives')
}
const adapter = readFileSync(join(root, 'src/client/app/host-ui.js'), 'utf8')
assert.ok(adapter.includes("require('@deepseek-ai/dsh-client-ui-primitives')"), 'adapter must load host primitives')
assert.ok(adapter.includes('HOST_ICON_MAP'), 'adapter must own the host icon map')

// Dialogs must go through KitModal, not raw overlay markup (only fallbacks may).
const rawDialogs = uiFiles
  .map((name) => [name, readFileSync(join(uiDir, name), 'utf8')])
  .filter(([name, text]) => name !== 'primitives.js' && text.includes("className: 'mp-overlay is-on'"))
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

// Ambient backdrop: CSS drift on the blurred cover, no smoke canvas.
assert.match(theme, /\.mp-np-bg-drift\{[^']*will-change:transform/, 'backdrop drift layer exists')
assert.match(theme, /@keyframes mp-ambient-drift\{[^']*translate3d/, 'backdrop drift is transform-based')
assert.match(theme, /\.mp-np-bg img\{[^']*transform:scale\(var\(--mp-beat-scale\)/, 'beat pulses the blurred cover')
assert.doesNotMatch(theme, /\.mp-np-smoke|\.mp-np-flow/, 'the smoke layer is gone')
assert.doesNotMatch(theme, /\.mp-np::after\{[^']*rgba\(255,255,255/, 'no white glow overlay')
assert.match(theme, /\.mp-np-bg\.is-ambient \.mp-np-bg-drift\{[^']*animation:mp-ambient-drift/, 'ambient drift animation is wired')
assert.match(theme, /\.mp-np-bg\.is-ambient img\.is-echo\{[^']*animation:mp-ambient-echo/, 'echo animation is gated on is-ambient')
assert.doesNotMatch(theme, /\.mp-np-bg img\.is-echo\{[^}]*animation:/, 'echo does not animate while the backdrop is off')

// The lyric footer buttons follow the chosen lyric alignment.
assert.match(theme, /\.mp-align-center \.mp-np-lyric-foot\{justify-content:center\}/, 'footer follows the lyric alignment')
assert.match(theme, /\.mp-align-right \.mp-np-lyric-foot\{justify-content:flex-end\}/, 'right alignment ends the footer')

// The editor becomes a three-column tablet layout on wide screens.
assert.match(theme, /@media \(min-width:1000px\)\{[^']*\.mp-npe-body\{[^']*display:grid/, 'tablet editor grid')
assert.match(theme, /\.mp-npe-section\.is-type\{grid-column:2/, 'settings columns are placed by area')
assert.match(theme, /\.mp-npe-preview-cover\.is-vinyl\{[^']*repeating-radial-gradient/, 'vinyl preview keeps its disc edge')
assert.match(theme, /\.mp-npe-preview-cover\.is-vinyl::after\{[^']*background:var\(--mp-preview-cover/, 'vinyl preview artwork is clipped by its own circle')

// Narrow single-column vinyl layout keeps the disc inside its stage.
assert.match(theme, /@media \(max-width:980px\)\{[^']*\.mp-np-cover-stage\.is-vinyl \.mp-np-disc-wrap\{top:0\}/, 'narrow vinyl layout has no vertical offset')
assert.match(theme, /\.mp-np\.is-vinyl\{--mp-cover:min\(66vw/, 'narrow vinyl cover is sized to leave room for controls')

assert.match(theme, /@media \(max-width:980px\)\{[^']*\.mp-np-cover-stage\{margin-left:auto;margin-right:auto\}/, 'narrow cover is centred')

// The player is a dark surface even in light themes; the title must not
// inherit a dark label colour.
assert.match(theme, /\.mp-np\{[^']*background:#141417;color:#f4f4f5/, 'player surface stays dark')
assert.match(theme, /\.mp-np-title\{[^']*color:#f7f7f8/, 'player title stays light')

// The floating player card is a dark island on that surface: it paints its own dark
// glass, so the tokens its controls read must be pinned to the dark theme. Without
// this the light theme resolves them to dark ink / near-white layers and the card's
// tiles, pills and inputs turn white-on-white.
assert.match(theme, /\.mp-card\{[^']*--dsw-alias-label-primary:#f4f4f5/, 'player card ink stays light')
assert.match(theme, /\.mp-card\{[^']*--dsw-alias-bg-layer-2:rgba\(255,255,255,\.06\)/, 'player card tiles stay dark')
assert.match(theme, /\.mp-card\{[^']*--dsw-alias-bg-layer-3:rgba\(255,255,255,\.08\)/, 'player card nested surfaces stay dark')
assert.match(theme, /\.mp-card\{[^']*--dsw-alias-border-l1:rgba\(255,255,255,\.07\)/, 'player card hairlines stay light')
assert.match(theme, /\.mp-card\{[^']*color:#f4f4f5/, 'player card sets its own light ink')

// Song rows are larger for readability.
assert.match(theme, /\.mp-row\{[^']*height:84px/, 'song rows are taller')
assert.match(theme, /\.mp-row-cover\{[^']*width:56px;height:56px/, 'song row covers are larger')
assert.match(theme, /\.mp-row-title\{[^']*font-size:16px/, 'song titles are larger')

// Artist and album lists use the same row metrics as the song list.
assert.match(theme, /\.mp-entry-row\{[^']*height:84px/, 'entry rows are song-row height')
assert.match(theme, /\.mp-entry-art\{[^']*width:56px;height:56px/, 'entry rows use song-row cover size')
assert.match(theme, /\.mp-entry-title\{[^']*font-size:16px/, 'entry titles use song-row title size')

assert.match(theme, /\.mp-npe-section\.is-ambient\{grid-column:1\/4;grid-row:3\}/, 'ambient section spans the editor')
assert.match(theme, /\.mp-npe-smoke-grid\{[^']*grid-template-columns:repeat\(4/, 'ambient section has four columns')


// Geometry follows the official primitive stylesheets pinned in
// A_other/design/official/ (theme-guidelines §2.3/§3.2): sm button H28/R8,
// md button H36/R12, switch 36x20, pill 24px capsule.
assert.match(theme, /\.mp-btn\{[^']*height:28px/, 'sm buttons are 28px tall')
assert.match(theme, /\.mp-btn\.is-md\{[^']*height:36px/, 'md buttons are 36px tall')
assert.match(theme, /\.mp-switch\{[^']*width:36px;height:20px/, 'switch is the official 36x20')
assert.match(theme, /\.mp-pill\{[^']*height:24px/, 'pill is the official 24px capsule')
assert.match(theme, /\.mp-iconbtn\{[^']*width:28px;height:28px/, 'compact icon button is 28px')

// Elevated surfaces draw their edge with the elevation shadow, never with an extra
// alias border (theme-guidelines §2.4).
assert.doesNotMatch(theme, /\.mp-dialog\{[^']*border:1px/, 'dialog has no extra border')
assert.doesNotMatch(theme, /\.mp-sheet\{[^']*border:1px/, 'settings sheet has no extra border')

// Neutral dividers are 0.5px hairlines; dashed and status borders stay 1px.
assert.match(theme, /\.mp-set-row\{[^']*border-bottom:\.5px solid/, 'settings rows use a hairline')

// The settings page speaks the same primitive set as the gallery: dropdowns are the
// Menu-based KitSelect, text fields are KitInput, and the rail/cards follow the geometry.
const settings = readFileSync(join(uiDir, 'settings.js'), 'utf8')
assert.doesNotMatch(settings, /h\('select'/, 'settings use KitSelect instead of a native select')
assert.doesNotMatch(settings, /className: 'mp-kit-input'/, 'settings use KitInput instead of a raw input')
assert.match(theme, /\.mp-sheet-tab\.is-on\{[^']*state-business-primary/, 'the active settings tab is tinted with the business token')
assert.match(theme, /\.mp-set-card\{[^']*--dsw-radius-xl/, 'settings cards use the R20 card radius')
assert.match(theme, /\.mp-set-card\{[^']*settings-card-stroke/, 'settings cards use the settings-card material')

// The component test page ships, and every string it renders exists in both
// dictionaries (the i18n checker only covers the Navidrome block).
const manifest = readFileSync(join(root, 'src/client/manifest.json'), 'utf8')
assert.ok(manifest.includes('src/client/components/ui/component-gallery.js'), 'the test page is in the client manifest')
const gallery = readFileSync(join(uiDir, 'component-gallery.js'), 'utf8')
const strings = readFileSync(join(root, 'src/client/i18n/strings.js'), 'utf8')
const galleryKeys = [...new Set([...gallery.matchAll(/t\('((?:gallery|about)\.[A-Za-z.]*)'\)/g)].map((match) => match[1]))]
assert.ok(galleryKeys.length > 40, 'the test page renders a broad set of keys')
for (const key of galleryKeys) {
  const needle = "'" + key + "'"
  const hits = strings.split(needle).length - 1
  assert.ok(hits >= 2, 'gallery key ' + key + ' must exist in zh and en (found ' + hits + ')')
}

console.log('theme.test.mjs ok')




