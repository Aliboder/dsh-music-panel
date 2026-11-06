import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeConfig } from '../lib/config.js'

test('online sources: keeps http(s) urls, derives ids and names', () => {
  const config = normalizeConfig({
    onlineSources: [
      { name: 'Radio', url: 'https://example.com/radio.mp3' },
      { url: 'http://example.com/song.flac' },
      { url: 'ftp://example.com/x.mp3' },
      { url: 'not a url' },
      null,
      { name: 'x'.repeat(200), url: 'https://a.example/x' },
    ],
  })
  assert.equal(config.onlineSources.length, 3)
  const first = config.onlineSources[0]
  assert.equal(first.name, 'Radio')
  assert.equal(first.url, 'https://example.com/radio.mp3')
  assert.match(first.id, /^on-[0-9a-f]{16}$/)
  assert.equal(config.onlineSources[1].name, 'example.com')
  assert.ok(config.onlineSources[2].name.length <= 120)
})

test('online sources: bounded to 50 entries', () => {
  const list = Array.from({ length: 60 }, (_, i) => ({ url: `https://example.com/${i}.mp3` }))
  assert.equal(normalizeConfig({ onlineSources: list }).onlineSources.length, 50)
})

test('config without online sources keeps an empty list', () => {
  assert.deepEqual(normalizeConfig({}).onlineSources, [])
  assert.deepEqual(normalizeConfig(null).onlineSources, [])
})
