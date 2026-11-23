/**
 * Contact-the-author button: the QQ feedback group QR lives beside the search box.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (file) => readFileSync(join(root, file), 'utf8')
const contact = read('src/client/app/contact.js')
const shell = read('src/client/panel-v3/p3-shell.js')
const strings = read('src/client/i18n/strings.js')
const styles = read('src/client/panel-v3/p3-styles.js')

test('the feedback group keeps its name, number and inlined QR', () => {
  assert.match(contact, /name: 'dsh-music-panel反馈群'/)
  assert.match(contact, /number: '495049439'/)
  assert.match(contact, /data:image\/webp;base64,[A-Za-z0-9+/=]+/)
  assert.match(contact, /function P3ContactDialog\(props\)/)
})

test('the contact button sits immediately left of the search field', () => {
  const buttonAt = shell.indexOf("t('contact.title')")
  const searchAt = shell.indexOf("className: 'mpv3-search'")
  assert.ok(buttonAt > 0, 'contact button is rendered')
  assert.ok(searchAt > buttonAt, 'contact button is before the search field')
  assert.match(shell, /className: 'mpv3-contact-btn'/) 
  assert.match(shell, /t\('contact\.join'\)/) 
  assert.match(strings, /'contact\.join': '加入交流群'/) 
  assert.match(strings, /'contact\.title': '加入交流群'/) 
  assert.match(shell, /h\(P3ContactDialog, \{ onClose:/)
})

test('the dialog shows the QR, group name and number', () => {
  assert.match(contact, /className: 'mpv3-contact-qr'/)
  assert.match(contact, /CONTACT_QQ_GROUP\.name/)
  assert.match(contact, /contact\.groupNumber/)
  assert.match(contact, /copyTextSafely\(CONTACT_QQ_GROUP\.number\)/)
  assert.match(strings, /'contact\.title': '加入交流群'/)
  assert.match(strings, /'contact\.title': 'Join the group'/)
  assert.match(styles, /\.mpv3-contact-qr \{/)
})
console.log('contact-dialog.test.mjs ok')
