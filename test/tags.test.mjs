import assert from 'node:assert/strict'
import {
  MAX_FIELD_LENGTH,
  MAX_LYRICS_LENGTH,
  TAG_FIELDS,
  VORBIS_KEYS,
  formatOf,
  normalizeTags,
  validateTags,
} from '../lib/tags.js'

assert.equal(TAG_FIELDS.length, 12, 'twelve editable tag fields')
assert.deepEqual(Object.keys(VORBIS_KEYS), TAG_FIELDS, 'every editable field has a Vorbis key, in order')

assert.equal(formatOf('song.flac'), 'flac')
assert.equal(formatOf('song.FLAC'), 'flac')
assert.equal(formatOf('song.mp3'), 'id3')
assert.equal(formatOf('song.MP3'), 'id3')
assert.equal(formatOf('song.m4a'), null, 'unsupported containers are refused')

const normalized = normalizeTags({ title: 'x', lyrics: 'lrc', extra: 'nope', artist: 5 })
assert.equal(Object.keys(normalized).length, 12, 'only the editable fields survive')
assert.equal(normalized.title, 'x')
assert.equal(normalized.artist, '', 'non-string values collapse to empty')
assert.equal(normalized.extra, undefined)
assert.equal(validateTags(normalized), null)

assert.match(validateTags(normalizeTags({ title: 'x'.repeat(MAX_FIELD_LENGTH + 1) })), /超长/)
assert.equal(validateTags(normalizeTags({ title: 'x'.repeat(MAX_FIELD_LENGTH) })), null)
assert.match(validateTags(normalizeTags({ lyrics: 'x'.repeat(MAX_LYRICS_LENGTH + 1) })), /超长/)
assert.equal(validateTags(normalizeTags({ lyrics: 'x'.repeat(MAX_LYRICS_LENGTH) })), null)

console.log('tags.test.mjs ok')
