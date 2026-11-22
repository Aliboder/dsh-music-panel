/**
 * Online playlist paging (client): a page that never lands must surface as an error with a
 * retry, not leave the view on skeletons for good.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const online = readFileSync(join(root, 'src/client/components/online/online.js'), 'utf8')
const pages = readFileSync(join(root, 'src/client/panel-v3/p3-pages.js'), 'utf8')

assert.match(online, /var PLAYLIST_REQUEST_TIMEOUT_MS = \d+/, 'a playlist page has a bounded wait')
assert.match(online, /new AbortController\(\)[\s\S]{0,400}controller\.abort\(\)/, 'the wait aborts the request')
assert.match(online, /signal: controller\.signal/, 'the request carries the abort signal')
assert.match(online, /error\.name === 'AbortError'[\s\S]{0,120}p3\.requestTimeout/, 'an aborted page becomes a visible timeout')
assert.match(online, /clearTimeout\(timer\)/, 'the timer is cleared when the page settles')
// The page opener keeps its retry path: an error phase offers the button again.
assert.match(pages, /playlistPhase === 'error'[\s\S]{0,400}openOnlinePlaylist\(collection\)/, 'a failed page can be retried')
console.log('online-playlist.test.mjs ok')
