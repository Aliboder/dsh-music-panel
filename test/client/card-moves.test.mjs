/**
 * Where the player card's removed controls went.
 *
 * The device button opens the sound row in 设置 · 播放控制; the platform / account / ID that
 * used to sit on the audio page now describe the playing song in 设置 · 在线与账号.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const page = readFileSync(join(root, 'src/client/components/ui/now-playing/index.js'), 'utf8')
const settings = readFileSync(join(root, 'src/client/components/ui/settings.js'), 'utf8')
const icons = readFileSync(join(root, 'src/client/components/common/icons.js'), 'utf8')
const zh = readFileSync(join(root, 'src/client/i18n/strings.js'), 'utf8')

test('the device button opens 设置 · 播放控制', () => {
  assert.match(page, /key === 'outputDevice'[\s\S]{0,200}pushLayer\('settings', \{ tab: 'playback' \}\)/, 'the card sends the reader to the sound row')
  assert.doesNotMatch(page, /key === 'home'/, 'the old home action is gone with its button')
  assert.match(icons, /speaker: \{/, 'the local icon set has a speaker glyph')
})

test('设置 → 在线与账号 describes the playing song', () => {
  assert.match(settings, /function SettingsNowPlayingCard\(\)/, 'the card exists')
  assert.match(settings, /t\('settings\.nowPlaying'\)/, 'it is labelled 当前歌曲')
  assert.match(settings, /track\.onlineId/, 'it keeps the platform id the audio page used to show')
  assert.match(settings, /h\(SettingsNowPlayingCard, \{ key: 'now-playing' \}\)/, 'the online page renders it')
  assert.match(zh, /'settings\.nowPlaying': '当前歌曲'/, 'the label is in the dictionary')
  assert.match(zh, /'sheet\.outputDevice': '播放设备'/, 'the device button has its own label')
})
console.log('card-moves.test.mjs ok')
