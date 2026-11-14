import assert from 'node:assert/strict'
import { chooseTranslatedKrc } from '../lib/providers/krc.js'

const line = (t) => ({ t, end: t + 1, text: 'x' })
const krc = (count, translations) => ({
  lines: Array.from({ length: count }, (_, i) => line(i)),
  translations: translations === undefined ? [] : translations,
})

// Already translated: keep the preferred parse.
const primary = krc(3, ['a', 'b', 'c'])
assert.equal(chooseTranslatedKrc(primary, [krc(3, ['x', 'y', 'z'])]), primary)

// Primary has no translation: a sibling with the same line count wins.
const plain = krc(3)
const sameCount = krc(3, ['一', '二', '三'])
assert.equal(chooseTranslatedKrc(plain, [krc(5, ['a']), sameCount]), sameCount)

// No same-count option: fall back to the first translated candidate.
const otherCount = krc(4, ['a', 'b', 'c', 'd'])
assert.equal(chooseTranslatedKrc(plain, [krc(5, []), otherCount]), otherCount)

// Nothing translated: null, so the caller keeps the plain parse.
assert.equal(chooseTranslatedKrc(plain, [krc(3), krc(3, [])]), null)

// Degenerate input never throws.
assert.equal(chooseTranslatedKrc(null, []), null)
assert.equal(chooseTranslatedKrc(plain, null), null)

console.log('krc-fallback.test.mjs ok')
