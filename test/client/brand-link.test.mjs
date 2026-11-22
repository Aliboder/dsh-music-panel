/**
 * The panel top bar carries the plugin mark; clicking it must open the repository.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const shell = readFileSync(join(root, 'src/client/panel-v3/p3-shell.js'), 'utf8')
const brand = readFileSync(join(root, 'src/client/app/brand.js'), 'utf8')
const manifest = readFileSync(join(root, 'src/client/manifest.json'), 'utf8')
const styles = readFileSync(join(root, 'src/client/panel-v3/p3-styles.js'), 'utf8')

test('the top-left mark links to the repository in a new tab', () => {
  assert.match(shell, /className: 'mpv3-brand'/)
  assert.match(shell, /href: 'https:\/\/github\.com\/Aliboder\/dsh-music-panel'/)
  assert.match(shell, /target: '_blank'/)
  assert.match(shell, /rel: 'noreferrer noopener'/)
  assert.match(shell, /src: P3_BRAND_ICON/)
})

test('the mark is inlined and loads before the panel shell', () => {
  assert.match(brand, /data:image\/webp;base64,[A-Za-z0-9+/=]{1500,}/)
  const markAt = manifest.indexOf('src/client/app/brand.js')
  const shellAt = manifest.indexOf('src/client/panel-v3/p3-shell.js')
  assert.ok(markAt >= 0, 'brand fragment is in the manifest')
  assert.ok(markAt < shellAt, 'brand fragment comes before the shell that uses it')
})

test('the mark follows the theme: token colors and a visible focus ring', () => {
  assert.match(styles, /\.mpv3-brand \{/)
  assert.match(styles, /width: 28px; height: 28px/)
  assert.match(styles, /\.mpv3-brand:hover \{[^}]*var\(--dsw-alias-/)
  assert.match(styles, /\.mpv3-brand:focus-visible \{[^}]*var\(--dsw-focus-ring-color/)
})
console.log('brand-link.test.mjs ok')
