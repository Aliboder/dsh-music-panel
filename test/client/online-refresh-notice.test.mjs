/**
 * 在线平台底层换新的更新弹窗：手动勾选「不再显示」才记下，没勾就关下次还会出现。
 * 文案要求用户彻底重启 DSH 并重新登录，否则会播放出错。
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (path) => readFileSync(join(root, path), 'utf8')
const notice = read('src/client/components/ui/online-refresh-notice.js')
const shell = read('src/client/panel-v3/p3-shell.js')
const prefs = read('src/client/stores/prefs.js')
const strings = read('src/client/i18n/strings.js')

test('the notice has a versioned acknowledgement and a session guard', () => {
  assert.match(notice, /ONLINE_RELAUNCH_NOTICE_ID = '2026-11-online-platforms'/)
  assert.match(notice, /var onlineRelaunchNoticeShown = false/)
  assert.match(notice, /if \(onlineRelaunchNoticeShown\) return false/)
  assert.match(notice, /if \(ack === ONLINE_RELAUNCH_NOTICE_ID\) return false/)
  assert.match(prefs, /onlineRelaunchNoticeAck: ''/, 'the acknowledgement starts empty')
})

test('it is a host modal with a manually checked “don\'t show again”', () => {
  assert.match(notice, /h\(\s*KitModal,/, 'the dialog uses the kit modal adapter')
  assert.match(notice, /title: t\('notice\.onlineRefreshTitle'\)/)
  assert.match(notice, /h\(KitCheckbox, \{/)
  assert.match(notice, /label: t\('notice\.onlineRefreshDontShow'\)/)
  assert.match(notice, /onChange: changeDontShow/)
  assert.match(notice, /props\.onDone\(dontShowRef\.current === true\)/, 'only the checked box acknowledges it')
  // No effect may auto-close/acknowledge it: the user has to act.
  assert.doesNotMatch(notice, /onDone\(true\)/, 'never acknowledges on its own')
})

test('the shell mounts it and persists only a checked acknowledgement', () => {
  assert.match(shell, /onlineRelaunchNoticeOpen\(prefs\)/)
  assert.match(shell, /h\(OnlineRelaunchNotice, \{/)
  assert.match(shell, /if \(dontShow === true\) setPrefs\(\{ onlineRelaunchNoticeAck: ONLINE_RELAUNCH_NOTICE_ID \}\)/)
})

test('the copy tells the user to restart and sign in again', () => {
  for (const key of ['notice.onlineRefreshTitle', 'notice.onlineRefreshBody', 'notice.onlineRefreshDontShow', 'notice.gotIt']) {
    assert.equal(strings.split("'" + key + "':").length, 3, key + ' has a zh and an en string')
  }
  assert.match(strings, /彻底退出并重新启动 DSH/)
  assert.match(strings, /重新登录各在线平台/)
  assert.match(strings, /播放错误/)
})

console.log('online-refresh-notice.test.mjs ok')
