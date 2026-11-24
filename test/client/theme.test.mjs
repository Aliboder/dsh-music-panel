/**
 * Theme guard: keeps future UI additions on the DSH token/component rules
 * documented in docs/主题与组件开发规范.md.
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
  'eq-panel.js',
  'audio-equalizer.js',
  'now-playing/fullscreen.js',
  'now-playing/lyrics-timing.js',
  'now-playing/cover-accent.js',
  'now-playing/seek-bar.js',
  'now-playing/transport-pill.js',
  'now-playing/settings-panel.js',
  'now-playing/sleep-menu.js',
  'now-playing/secondary-actions.js',
  'now-playing/capsule.js',
  'now-playing/editor.js',
  'now-playing/index.js',
  'settings.js',
  'dialogs.js',
  'composer.js',
  'batch.js',
  'online-lyric.js',
  'trash.js',
]
const p3Dir = join(root, 'src/client/panel-v3')
const p3Css = readFileSync(join(p3Dir, 'p3-styles.js'), 'utf8')
const p3Files = ['p3-overlay.js', 'p3-core.js', 'p3-pages.js', 'p3-dialogs.js', 'p3-shell.js', 'p3-styles.js']
const all = [
  theme,
  ...uiFiles.map((name) => readFileSync(join(uiDir, name), 'utf8')),
  ...p3Files.map((name) => readFileSync(join(p3Dir, name), 'utf8')),
]
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
for (const selector of ['.mp-srow-cover', '.mp-pb-cover']) {
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

// The audio effect window is raised from the player card, so it follows the app theme like the
// lyric-match window: token material, panel radius, elevation (a hairline border on an elevated
// surface counts as a double edge), pointer-only hovers.
assert.match(theme, /\.mp-eqwin\{[^']*border-radius:var\(--dsw-radius-panel/, 'the window keeps the panel radius')
assert.match(theme, /\.mp-eqwin\{[^']*background:var\(--dsw-alias-bg-layer-1/, 'the window surface is a token surface')
assert.match(theme, /\.mp-eqwin\{[^']*box-shadow:var\(--dsw-elevation-prominent/, 'the window is raised by elevation')
assert.doesNotMatch(theme, /\.mp-eqwin\{[^']*border:1px/, 'an elevated surface must not add a hairline border')
assert.match(theme, /\.mp-eqwin-title\{[^']*font-size:16px;line-height:20px/, 'the window title follows the type scale')
assert.match(theme, /@media \(hover: hover\)\{\.mp-eqwin-chip:hover/, 'window hovers are pointer-only')
assert.match(theme, /\.mp-eqwin-chip\.is-on\{[^']*background:var\(--dsw-alias-state-business-primary/, 'the chosen chip uses the business token')

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
assert.match(theme, /\.mp-switch i\{[^']*background:var\(--dsw-alias-switch-thumb/, 'off-state thumb follows the token')
// The segmented fallbacks reproduce the host's sliding indicator and geometry.
assert.match(theme, /\.mp-segment-indicator\{[^']*position:absolute/, 'the segment indicator exists')
assert.match(theme, /\.mp-segment-tabs\{[^']*--segmented-tabs-inset/, 'tabs keep the host inset variable')
assert.match(theme, /\.mp-segment-tabs-indicator\{[^']*border:\.5px solid/, 'the tabs indicator keeps the host hairline')
assert.match(theme, /\.mp-tag\[data-tone="solid"\]/, 'every host tag tone has a fallback')
assert.match(theme, /\.mp-switch\.is-on i\{[^']*background:var\(--dsw-alias-label-primary-foreground/, 'on-state thumb contrasts the brand track, like the host switch')
assert.match(theme, /\.mp-cap-play\{[^']*background:var\(--dsw-alias-label-primary[^']*color:var\(--dsw-alias-label-primary-foreground/, 'capsule play foreground pairs with its light fill')
assert.match(theme, /\.mp-pb-play\{[^']*background:var\(--dsw-alias-label-primary[^']*color:var\(--dsw-alias-label-primary-foreground/, 'player bar play foreground pairs with its light fill')
assert.doesNotMatch(theme, /\.mp-(cap|pb)-play\{[^']*color:var\(--dsw-alias-bg-base/, 'play buttons never use bg-base as ink')

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

// The classic lyric list is gone: its alignment/blur/translation hooks styled markup no
// renderer emits any more, so they must not come back (A_other/docs/踩坑记录.md).
assert.doesNotMatch(theme, /\.mp-align-/, 'classic alignment classes are gone')
assert.doesNotMatch(theme, /\.mp-np\.is-blur/, 'the classic blur class is gone')
assert.doesNotMatch(theme, /--mp-lyric-size|--mp-lyric-trans|--mp-line-gap/, 'the classic lyric CSS variables are gone')
assert.match(theme, /\.mp-np-line-text\{font-size:26px/, 'the plain fallback keeps a readable fixed size')

// The editor becomes a three-column tablet layout on wide screens.
assert.match(theme, /@media \(min-width:1000px\)\{[^']*\.mp-npe-body\{[^']*display:grid/, 'tablet editor grid')
assert.match(theme, /\.mp-npe-section\.is-type\{grid-column:2/, 'settings columns are placed by area')
assert.doesNotMatch(theme, /is-vinyl|mp-npe-cover|mp-guide-vinyl/, 'the removed cover-style templates leave no CSS')

assert.match(theme, /@media \(max-width:980px\)\{[^']*\.mp-np-cover-stage\{margin-left:auto;margin-right:auto\}/, 'narrow cover is centred')

// Player chrome is one idle-hide group: the top back / fullscreen buttons fade with
// the transport capsule and the bottom-right handle, and must not swallow clicks
// while faded. Focus wins over the fade, or Tab could land on an invisible control.
for (const selector of ['.mp-np-head', '.mp-np-fs']) {
  const rule = selector.replace(/\./g, '\\.')
  assert.match(
    theme,
    new RegExp(`\\.mp-np\\.is-chrome-hidden ${rule}\\{[^}]*opacity:0;[^}]*pointer-events:none`),
    `${selector} joins the idle-hide chrome`,
  )
}
assert.match(
  theme,
  /\.mp-np\.is-chrome-hidden \.mp-np-head:has\(:focus-visible\),\.mp-np\.is-chrome-hidden \.mp-np-fs:has\(:focus-visible\)\{[^}]*opacity:1/,
  'keyboard focus overrides the top chrome fade',
)
// A plain :focus-within would pin the chrome: clicking the fullscreen button leaves
// it focused, so the idle fade could never finish (it never hid in fullscreen).
assert.doesNotMatch(
  theme,
  /\.mp-np\.is-chrome-hidden \.mp-np-(?:head|fs):focus-within/,
  'pointer focus must not pin the idle-hide chrome',
)

// The player is a dark surface even in light themes; the title must not
// inherit a dark label colour.
assert.match(theme, /\.mp-np\{[^']*background:#141417;color:#f4f4f5/, 'player surface stays dark')
assert.match(theme, /\.mp-np-title\{[^']*color:#f7f7f8/, 'player title stays light')

// The floating player card follows the host theme like every other sheet: the glass is
// token-based and the controls keep host tokens. It must not pin a dark palette or inherit
// the dark player page's white ink.
assert.match(theme, /\.mp-card\{[^']*color:var\(--dsw-alias-label-primary/, 'player card ink follows the theme')
assert.doesNotMatch(theme, /\.mp-card\{[^']*--dsw-alias-label-primary:/, 'player card does not pin dark ink')
const playerSheet = readFileSync(join(uiDir, 'player-sheet.js'), 'utf8')
assert.match(playerSheet, /background: 'color-mix\(in srgb, var\(--dsw-alias-bg-layer-1/, 'player card glass uses the host surface token')
assert.doesNotMatch(playerSheet, /rgba\(23, 23, 26, 0\.95\)/, 'player card no longer paints fixed dark glass')
assert.doesNotMatch(playerSheet, /colorMode|setColorMode|sheet\.light|sheet\.dark/, 'no dead theme-mode switch; theme follows DSH')

// panel-v3 rows: 76px, 54px cover, 18px title (90% of the 84/60/20 scale).
assert.match(p3Css, /\.mpv3-row \{[^"]*height: 76px/, 'panel-v3 rows are 76px')
assert.match(p3Css, /\.mpv3-row-cover \{[^"]*width: 54px; height: 54px/, 'panel-v3 row covers are 54px')
assert.match(p3Css, /\.mpv3-row-title \{[^"]*font-size: 18px/, 'panel-v3 row titles follow the scaled type')
assert.match(p3Css, /\.mpv3-row-cover img \{[^"]*width: 100%; height: 100%; object-fit: cover/, 'panel-v3 covers clamp their image')
assert.match(p3Css, /\.mpv3-queue-list \{[^"]*overflow-x: hidden; overflow-y: auto/, 'queue list scrolls vertically only')
assert.match(p3Css, /\.mpv3-queue-row \{[^"]*box-sizing: border-box/, 'queue rows include their padding in the width')
assert.match(p3Css, /\.mpv3-queue \{[^"]*color: var\(--dsw-alias-label-primary/, 'queue panel sets its own ink instead of inheriting a page color')
assert.doesNotMatch(p3Css, /\.mp-np \.mpv3-queue/, 'player-page queue follows the host theme instead of pinning a dark island')

assert.match(theme, /\.mp-npe-section\.is-ambient\{grid-column:1\/4;grid-row:3\}/, 'ambient section spans the editor')
assert.match(theme, /\.mp-npe-smoke-grid\{[^']*grid-template-columns:repeat\(4/, 'ambient section has four columns')


// Geometry follows the official primitive stylesheets pinned in
// A_other/design/official/ (主题与组件开发规范 §2.3/§3.2): sm button H28/R8,
// md button H36/R12, switch 36x20, pill 24px capsule.
assert.match(theme, /\.mp-btn\{[^']*height:28px/, 'sm buttons are 28px tall')
assert.match(theme, /\.mp-btn\.is-md\{[^']*height:36px/, 'md buttons are 36px tall')
assert.match(theme, /\.mp-switch\{[^']*width:36px;height:20px/, 'switch is the official 36x20')
assert.match(theme, /\.mp-pill\{[^']*height:24px/, 'pill is the official 24px capsule')
assert.match(theme, /\.mp-iconbtn\{[^']*width:28px;height:28px/, 'compact icon button is 28px')
assert.match(theme, /\.mp-np-handle-btn\{[^']*background:var\(--dsw-alias-bg-layer-1/, 'floating settings handle uses the host surface token')
assert.match(theme, /\.mp-np-handle-btn\{[^']*color:var\(--dsw-alias-label-primary/, 'floating settings handle icon follows the theme')
assert.match(theme, /\.mp-np-handle\.is-on \.mp-np-handle-btn[^']*var\(--dsw-alias-state-business-primary/, 'open handle uses the business token')
assert.doesNotMatch(theme, /\.mp-np-handle-track/, 'no decorative pill behind the floating settings handle')
assert.match(theme, /\.mp-np-handle\{[^']*width:48px/, 'floating handle is just the 48px button')

// Elevated surfaces draw their edge with the elevation shadow, never with an extra
// alias border (主题与组件开发规范 §2.4).
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

// Metadata editor: one dialog, a host-input field grid, and a settings-card
// preview. No bespoke tag-card/border stack, no dead metadata-match CSS.
const tagDialog = readFileSync(join(uiDir, 'dialogs.js'), 'utf8')
assert.match(tagDialog, /h\(KitInput, \{/, 'metadata fields use the host-first KitInput')
assert.match(tagDialog, /className: 'mp-meta-modal'/, 'metadata editor uses the wider dialog canvas')
assert.doesNotMatch(tagDialog, /mp-tag-section|mp-tag-grid|mp-tag-aside/, 'old bespoke tag editor markup is gone')
assert.match(theme, /\.mp-meta-hero\{[^']*settings-card-stroke/, 'summary hero uses the settings-card material')
assert.match(theme, /\.mp-meta-work\{[^']*grid-template-columns:minmax\(0,1fr\) 300px/, 'metadata and lyrics form a measured two-column work area')
assert.match(theme, /\.mp-meta-section\.mp-meta-lyrics\{[^']*settings-card-stroke/, 'lyrics pane is a settings card')
assert.match(theme, /\.mp-meta-textarea\{[^']*--dsw-alias-bg-layer-1/, 'lyrics textarea uses the DSH input surface token')
assert.doesNotMatch(theme, /\.mp-tag-section|\.mp-match{/, 'dead tag/match editor CSS is gone')

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

// The lyric-match window uses the DSH modal, panel and hairline geometry.
assert.match(theme, /\.mp-lym-window\{[^']*border-radius:var\(--dsw-radius-panel/, 'match window uses the panel radius')
assert.match(theme, /\.mp-lym-window\{[^']*background:var\(--dsw-alias-bg-layer-1/, 'match window uses the dialog surface, not the neutral overlay swatch')
assert.doesNotMatch(theme, /\.mp-lym-window\{[^']*background:var\(--dsw-alias-bg-overlay/, 'bg-overlay is a neutral swatch, not the dialog surface')
assert.match(theme, /\.mp-lym-head\{[^']*border-bottom:\.5px solid/, 'match header uses a hairline')
assert.match(theme, /\.mp-lym-result\{[^']*border:\.5px solid/, 'match results use a hairline')
assert.match(theme, /@media \(max-width:860px\)\{[^']*\.mp-lym-body\{flex-direction:column/, 'match window folds on narrow screens')

console.log('theme.test.mjs ok')




