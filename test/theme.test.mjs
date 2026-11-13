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

console.log('theme.test.mjs ok')
