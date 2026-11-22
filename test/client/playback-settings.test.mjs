/**
 * 播放控制页守卫：Folia 的分组、以及每条新设置都必须有真实落点。
 *
 * 背景（A_other/docs/踩坑记录.md）：设置项只写不读已经踩过两次；这条测试锁住
 * 队列默认位置、无法播放跳过、一轮重新洗牌、播放时阻止休眠四条链路。
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const settings = readFileSync(join(root, 'src/client/components/ui/settings.js'), 'utf8')
const prefs = readFileSync(join(root, 'src/client/stores/prefs.js'), 'utf8')
const player = readFileSync(join(root, 'src/client/services/player/player.js'), 'utf8')
const dialogs = readFileSync(join(root, 'src/client/components/ui/dialogs.js'), 'utf8')
const sheet = readFileSync(join(root, 'src/client/components/ui/player-sheet.js'), 'utf8')
const zh = readFileSync(join(root, 'src/client/i18n/strings.js'), 'utf8')
const page = readFileSync(join(root, 'src/client/i18n/i18n.js'), 'utf8')

function playbackTabSource() {
  const start = settings.indexOf('function playbackTab()')
  const end = settings.indexOf('function accountAvatar(info)')
  assert.ok(start >= 0 && end > start, 'settings.js still has a playback tab')
  return settings.slice(start, end)
}

test('播放控制页按 Folia 分组，插件项收进「插件」组', () => {
  const tab = playbackTabSource()
  for (const key of ['settings.groupTransition', 'settings.groupSound', 'settings.groupBehavior', 'settings.groupPlugin']) {
    assert.ok(tab.includes(key), key + ' is one of the page groups')
  }
  assert.match(tab, /settingsGroup\('transition'/, 'the transition group renders')
  assert.match(tab, /settingsGroup\('sound'/, 'the sound group renders')
  assert.match(tab, /settingsGroup\('behavior'/, 'the behaviour group renders')
  assert.match(tab, /settingsGroup\('plugin'/, 'the plugin group renders last')
  for (const key of [
    'settings.outputDevice',
    'settings.replayGain',
    'settings.playbackFade',
    'settings.queueAddBehavior',
    'settings.autoSkipUnplayable',
    'settings.shuffleRoundNoRepeat',
    'settings.preventSleep',
    'settings.voiceInputPause',
  ]) {
    assert.ok(tab.includes(key), key + ' has a row on the page')
  }
})

test('播放页的「智能过渡」是一枚开关，不是设置入口', () => {
  // Folia's SoundTiles: <QuickTile kind="toggle" lit={automixEnabled} onClick={() => toggleAutomix(!automixEnabled)} />.
  const at = sheet.indexOf("t('sheet.smartFade')")
  assert.ok(at > 0, 'the sheet still shows the 智能过渡 row')
  const block = sheet.slice(at, at + 300)
  assert.match(block, /crossfadeFadeSeconds\(prefs\) > 0/, 'the switch lights from the live value')
  assert.match(block, /setPrefs\(\{ crossfadeEnabled: value \}\)/, 'flipping writes the switch')
  assert.doesNotMatch(block, /onAction\('settings'\)/, 'the tile no longer opens the settings page')
})

test('播放页的「音频效果器」打开 Folia 的效果窗口，并按处理开关点亮', () => {
  // Folia's SoundTiles: <QuickTile kind="open" lit={isEqualizerOn} onClick={openAudioEqualizer} />.
  const at = sheet.indexOf("t('sheet.effects')")
  assert.ok(at > 0, 'the sheet still shows the 音频效果器 tile')
  const block = sheet.slice(at, at + 360)
  assert.match(block, /pushLayer\('equalizer'/, 'the tile opens the audio effect window')
  assert.match(block, /normalizeEqPrefs\(prefs\)\.enabled/, 'the tile lights while processing is on')
  assert.doesNotMatch(block, /setEffectsOpen/, 'the tile no longer unfolds an inline panel')
})

test('标签改为「播放控制」，中英两份字典都改', () => {
  assert.match(zh, /'settings\.tabPlayback': '播放控制'/, 'the tab label is 播放控制')
  assert.match(zh, /'v2\.playback': '播放控制'/, 'the page title is 播放控制')
  assert.match(page, /'settings\.tabPlayback': '播放控制'/, 'the base dictionary keeps the same label')
  assert.match(zh, /'settings\.tabPlayback': 'Playback'/, 'English keeps Playback')
})

test('加入队列的默认位置两端都实现', () => {
  assert.match(prefs, /queueAddBehavior: 'append'/, 'the default is append')
  assert.match(prefs, /merged\.queueAddBehavior !== 'next'/, 'a stored value is normalized')
  assert.match(dialogs, /readPrefs\(\)\.queueAddBehavior === 'next'/, 'the menu reads the preference')
  assert.match(dialogs, /player\.enqueueNext\(track\)/, 'next inserts after the current song')
  assert.match(dialogs, /player\.enqueue\(track\)/, 'append puts it at the end')
})

test('无法播放跳过、轮换重洗、播放时阻止休眠接到播放器', () => {
  assert.match(prefs, /autoSkipUnplayable: false/, 'skip is off by default')
  assert.match(player, /readPrefs\(\)\.autoSkipUnplayable === true/, 'the error path reads the switch')
  // Folia's shuffleRound: a finished round is reshuffled from the tracking pass, not from
  // the advance step, so a crossfade at the boundary cannot bypass it.
  assert.match(player, /shuffleQueueInRounds\(/, 'shuffle uses the round helper')
  assert.match(player, /function trackShuffleRoundProgress\(\)/, 'a tracking pass exists')
  assert.match(player, /decideShuffleRoundStep\(/, 'the tracking pass uses Folia\'s step decision')
  assert.match(player, /readShuffleRoundState\(/, 'the round is remembered across songs')
  assert.doesNotMatch(player, /function advanceIndex\(/, 'the old wrap-only reshuffle is gone')
  assert.match(prefs, /preventSleepDuringPlayback: false/, 'screen lock is off by default')
  assert.match(player, /preventSleepDuringPlayback === true/, 'the player reads the switch')
  assert.match(player, /navigator\.wakeLock\.request\('screen'\)/, 'it asks the browser for the lock')
  assert.match(player, /refreshWakeLock: function/, 'the settings switch can re-sync it immediately')
})

test('睡眠定时、ReplayGain、在线音质由插件生命周期接管', () => {
  const plugin = readFileSync(join(root, 'src/client/app/plugin.js'), 'utf8')
  const shell = readFileSync(join(root, 'src/client/panel-v3/p3-shell.js'), 'utf8')
  assert.match(plugin, /startSleepTimer\(\)/, 'the sleep timer starts from apply()')
  assert.doesNotMatch(shell, /window\.setTimeout\(function \(\) \{\n\s+player\.pause\(\)/, 'the panel no longer owns the countdown')
  assert.match(player, /calculateReplayGain\(/, 'the player applies Folia\'s ReplayGain arithmetic')
  assert.match(player, /loadReplayGainFor\(item\)/, 'gain is resolved on every load')
  assert.match(player, /function onlineUrlFor\(item\)/, 'stream URLs are resolved at play time')
  assert.match(player, /onlineStreamUrl\(item\.onlineProvider, item\.onlineId\)/, 'and read the current quality preference')
})

console.log('playback-settings.test.mjs ok')
