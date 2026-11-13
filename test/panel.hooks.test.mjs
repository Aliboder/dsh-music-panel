/**
 * Guard: tab render helpers must not call React hooks.
 *
 * The panel ships as a plain script under React's Rules of Hooks. `onlineTab()`
 * and friends are invoked from a ternary chain (`tab === 'online' ? onlineTab() : …`),
 * so a useState() inside one runs only on the renders where that tab is active.
 * React then sees a different hook count and throws, and because nothing in the
 * panel catches it the whole UI goes blank with no message in the host log.
 *
 * A Navidrome credential form shipped exactly that way. This test reads the
 * sources and fails if any hook reappears inside a conditional render helper.
 */

import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const HOOKS = [
  'useState',
  'useEffect',
  'useLayoutEffect',
  'useRef',
  'useMemo',
  'useCallback',
  'useReducer',
  'useContext',
]

const SETTINGS = join('src', 'ui', '06-settings.js')
const source = readFileSync(SETTINGS, 'utf8')
const lines = source.split('\n')

/** Return the body of `function <name>(` up to the next function at the same indent. */
function functionBody(name) {
  const startLine = lines.findIndex((line) => new RegExp(`^\\s*function\\s+${name}\\s*\\(`).test(line))
  assert.ok(startLine !== -1, `function ${name} not found in ${SETTINGS}`)
  const indent = lines[startLine].match(/^\s*/)[0].length
  const body = []
  for (let i = startLine + 1; i < lines.length; i++) {
    const line = lines[i]
    // A sibling `function` at the same indent closes this one.
    if (new RegExp(`^\\s{${indent}}function\\s`).test(line)) break
    body.push(line)
  }
  return body.join('\n')
}

// ── 1. no hook inside the tab helpers ─────────────────────────────────────
const HELPERS = ['onlineTab', 'libraryTab', 'cacheTab', 'lyricsTab', 'playbackTab', 'appearanceTab']
for (const helper of HELPERS) {
  let body
  try {
    body = functionBody(helper)
  } catch {
    continue // helper not present in this revision
  }
  for (const hook of HOOKS) {
    const hit = body.match(new RegExp(`\\b${hook}\\s*\\(`))
    assert.equal(
      hit,
      null,
      `${helper}() calls ${hook}() at some line — it renders conditionally, so the hook count would vary per render and React would blank the panel`,
    )
  }
}

// ── 2. the Navidrome form hook lives on the component ─────────────────────
const componentHook = /^\s{2}var navForm = useNavidromeForm\(\)$/m
assert.match(
  source,
  componentHook,
  'useNavidromeForm() must be called once, at the top level of SettingsSheet',
)

const calls = (source.match(/useNavidromeForm\(\)/g) || []).length
assert.equal(
  calls,
  1,
  `useNavidromeForm() is called ${calls} times in ${SETTINGS}; it must be called exactly once (the definition is in src/70-online.js)`,
)

// ── 3. the navidrome card takes the form as a parameter ───────────────────
assert.match(
  source,
  /function navidromeCard\(info, form\)/,
  'navidromeCard must receive the form from its caller instead of creating its own state',
)

// ── 4. no hook called from a .map() callback anywhere in src/ ─────────────
function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full))
    else if (entry.name.endsWith('.js')) out.push(full)
  }
  return out
}

const mapViolations = []
for (const file of walk('src')) {
  const text = readFileSync(file, 'utf8')
  const fileLines = text.split('\n')
  for (let i = 0; i < fileLines.length; i++) {
    // Look at `.map(function (…) {` blocks and their bodies.
    if (!/\.map\(\s*function\s*\(/.test(fileLines[i])) continue
    let depth = 0
    let opened = false
    for (let j = i; j < fileLines.length; j++) {
      for (const ch of fileLines[j]) {
        if (ch === '{') {
          depth += 1
          opened = true
        } else if (ch === '}') {
          depth -= 1
        }
      }
      for (const hook of HOOKS) {
        if (new RegExp(`\\b${hook}\\s*\\(`).test(fileLines[j])) {
          mapViolations.push(`${file}:${j + 1} ${hook}() inside a .map() callback`)
        }
      }
      if (opened && depth <= 0) break
    }
  }
}
assert.deepEqual(mapViolations, [], mapViolations.join('\n'))

console.log('  ok  no hooks inside tab render helpers')
console.log('  ok  no hooks inside .map() callbacks')
console.log('  ok  useNavidromeForm() is called once, on SettingsSheet')
console.log('\npanel.hooks.test.mjs ok')
