/**
 * 存储与备份守卫：Folia 的四组 + 危险操作，每一行都要有真实的 Host 动作。
 *
 * 背景：这一页此前把「在线缓存统计」和「插件数据目录」混在一张平铺列表里，
 * 「分析数据 / 智能平衡数据」根本没有入口。对齐 Folia 后，每个清除按钮都必须
 * 落到 /data/clear 或 /online/cache，缓存目录与目录监视必须真的写进 Host 配置。
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const clientDir = join(root, 'src/client')
const settingsSource = readFileSync(join(root, 'src/client/components/ui/settings.js'), 'utf8')
const prefsSource = readFileSync(join(root, 'src/client/stores/prefs.js'), 'utf8')
const routesSource = readFileSync(join(root, 'src/host/http/routes.js'), 'utf8')
const configSource = readFileSync(join(root, 'src/host/stores/config.js'), 'utf8')
const stringsSource = readFileSync(join(root, 'src/client/i18n/strings.js'), 'utf8')

function cacheTabSource() {
  const start = settingsSource.indexOf('function cacheTab()')
  const end = settingsSource.indexOf('function aboutTab()')
  assert.ok(start >= 0 && end > start, 'settings.js still has a storage tab')
  return settingsSource.slice(start, end)
}

function clientFiles(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) out.push(...clientFiles(path))
    else if (name.endsWith('.js')) out.push(path)
  }
  return out
}

test('存储页按 Folia 分组，缓存详情每行都有清除动作', () => {
  const tab = cacheTabSource()
  for (const key of ['data.groupMedia', 'data.groupDetails', 'data.groupWatch', 'data.groupBackup', 'data.groupDanger']) {
    assert.ok(tab.includes(key), key + ' is one of the storage groups')
  }
  for (const key of [
    'data.cacheDir',
    'data.cacheLimit',
    'data.cacheSongs',
    'data.rowPlaylists',
    'data.rowLyrics',
    'data.rowCover',
    'data.rowAudio',
    'data.rowProfile',
    'data.rowBalance',
    'data.rowLyricsExport',
    'data.clearAll',
  ]) {
    assert.ok(tab.includes(key), key + ' is a storage row')
  }
  // The actions must be real Host requests, not a text-only shell.
  assert.match(tab, /pushLayer\('folderPicker', \{ mode: 'cacheDir' \}\)/, 'the cache folder uses the folder picker')
  assert.match(tab, /revealHostDir\('cache'\)/, 'open folder goes through the Host')
  assert.match(tab, /saveHostConfig\(\{ watchFolders: value \}\)/, 'folder watching is persisted in the Host config')
  assert.match(tab, /API \+ 'data\/clear'/, 'detail rows clear Host data by category')
  assert.match(tab, /API \+ 'online\/cache'/, 'media and cover rows clear the media cache')
  assert.match(tab, /API \+ 'data\/export-lyrics'/, 'lyrics export is a Host action')
  assert.match(tab, /readPrefs\(\)/, 'backup exports the client preferences')
  assert.match(tab, /dsh-music-panel\.backup/, 'the backup has a format marker')
  assert.match(tab, /prefKeys\(\)/, 'import only accepts known preference keys')
})

test('存储页的每个偏好键都有设置页之外的读取方', () => {
  const tab = cacheTabSource()
  const used = [...new Set([...tab.matchAll(/prefs\.([A-Za-z0-9_]+)/g)].map((match) => match[1]))]
  assert.ok(used.includes('onlineCacheEnabled'), 'the cache switch is read by the player')
  assert.ok(used.includes('onlineCacheLimitGb'), 'the cache limit is read by the cache writer')
  const others = clientFiles(clientDir)
    .filter((path) => path !== join(clientDir, 'components/ui/settings.js'))
    .map((path) => readFileSync(path, 'utf8'))
    .join('\n')
  for (const key of used) {
    assert.ok(others.includes(key), key + ' has no reader outside the settings page')
    assert.ok(prefsSource.includes(key + ':'), key + ' has a persisted default')
  }
})

test('Host 提供缓存目录、目录监视、分类清空、歌词导出与版本号', () => {
  for (const key of ['cacheDir', 'watchFolders']) {
    assert.ok(configSource.includes(key + ':'), 'config has ' + key)
  }
  for (const route of ["'/data/export-lyrics'", "'/reveal-dir'", "'/library/revision'", "'/data/clear'"]) {
    assert.ok(routesSource.includes(route), 'route ' + route + ' exists')
  }
  assert.match(routesSource, /CLEARABLE_CATEGORIES/, 'setting/account categories are excluded from single clears')
  assert.match(routesSource, /lyrics:\s*lyricRecords/, 'clearing lyrics maps to the memoized records')
  assert.match(routesSource, /forget\.invalidate\(\)/, 'a category clear forgets its memoized store')
  assert.ok(existsSync(join(root, 'src/host/services/media/watch.js')), 'the folder watcher exists')
  const watch = readFileSync(join(root, 'src/host/services/media/watch.js'), 'utf8')
  assert.match(watch, /debounceMs/, 'watcher changes are debounced')
  assert.match(watch, /minGapMs/, 'and rate limited')
  const library = readFileSync(join(root, 'src/client/components/library/library.js'), 'utf8')
  assert.match(library, /cacheDir: typeof body\.effectiveCacheDir/, 'the client keeps the effective cache directory')
  assert.match(library, /async function saveHostConfig/, 'settings that do not change the library do not trigger a rescan')
  const picker = readFileSync(join(root, 'src/client/components/ui/folder-picker.js'), 'utf8')
  assert.match(picker, /mode === 'cacheDir'/, 'the folder picker can choose the cache directory')
  const shell = readFileSync(join(root, 'src/client/panel-v3/p3-shell.js'), 'utf8')
  assert.match(shell, /library\/revision/, 'the panel polls the watcher revision')
})

test('客户端清除会同时清内存，不只在下次启动生效', () => {
  const settings = cacheTabSource()
  assert.match(settings, /clearLyricClientCaches\(\)/, 'lyrics clear also resets the live caches')
  assert.match(settings, /clearProfileStore\(\)/, 'analysis clear resets the live store')
  assert.match(settings, /clearBalanceStore\(\)/, 'balance clear resets the live store')
  const lyrics = readFileSync(join(root, 'src/client/services/lyrics/lyrics.js'), 'utf8')
  assert.match(lyrics, /function clearLyricClientCaches/, 'the live lyric clear is defined')
  assert.match(lyrics, /clearLyricOffsets/, 'including the offset memory')
  const profile = readFileSync(join(root, 'src/client/services/player/effects/profile.js'), 'utf8')
  assert.match(profile, /function clearProfileStore/, 'the analysis store is clearable')
  const balance = readFileSync(join(root, 'src/client/services/player/effects/balance-meter.js'), 'utf8')
  assert.match(balance, /function clearBalanceStore/, 'the balance store is clearable')
})

test('存储页文案在两种语言里都定义', () => {
  for (const key of ['data.groupMedia', 'data.groupDetails', 'data.groupWatch', 'data.groupBackup', 'data.cacheDirPick', 'data.backupRow']) {
    const count = (stringsSource.match(new RegExp("'" + key.replace(/\./g, '\\.') + "':", 'g')) || []).length
    assert.equal(count, 2, key + ' is defined in zh and en')
  }
})

console.log('storage-settings.test.mjs ok')
