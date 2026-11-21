/**
 * Issue #26 guard: a refused stream must reach the listener as the Host's reason, not as
 * Chromium's demuxer text.
 *
 * The Host answers `{ ok:false, error:{ code, message, upstreamStatus } }`. The player used to
 * throw that answer away, hand the same URL to the media element, and let the kernel report
 * `DEMUXER_ERROR_COULD_NOT_OPEN` — the error answer was treated as audio.
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..')
const read = (path) => readFileSync(join(ROOT, ...path.split('/')), 'utf8')

// ── the classifier the player runs over browser text ────────────────────────
const baseSource = read('src/client/styles/base.js')
const base = new Function(baseSource + '\nreturn { isBrowserMediaFailureText };')()

assert.equal(
  base.isBrowserMediaFailureText(
    'PipelineStatus::DEMUXER_ERROR_COULD_NOT_OPEN: MediaSource endOfStream before demuxer initialization completes (before HAVE_METADATA) is treated as an error. This may also occur as consequence of other MediaSource errors before HAVE_METADATA.',
  ),
  true,
  'the exact text from the issue is browser pipeline text',
)
assert.equal(base.isBrowserMediaFailureText('MEDIA_ERR_SRC_NOT_SUPPORTED'), true)
assert.equal(base.isBrowserMediaFailureText('MEDIA_ERR_DECODE'), true)
assert.equal(base.isBrowserMediaFailureText('音乐平台 CDN 节点拒绝了取流请求（HTTP 403）'), false, 'a Host reason is not browser text')
assert.equal(base.isBrowserMediaFailureText('该曲目暂不可播（可能需要登录或 VIP）'), false)
assert.equal(base.isBrowserMediaFailureText(''), false)
assert.equal(base.isBrowserMediaFailureText(undefined), false)

// ── the player reads the Host's answer before deciding anything ────────────
const player = read('src/client/services/player/player.js')

assert.match(player, /function onlineStreamFailure\(response\)/, 'the refusal answer is read into an error')
assert.match(player, /body\.error\.message/, 'the Host writes the reason in error.message')
assert.match(player, /failure\.onlineStreamRefused = true/, 'the error says it is a refused stream, not a media failure')
assert.match(
  player,
  /if \(!response\.ok\) return onlineStreamFailure\(response\)\.then\(function \(failure\) \{ throw failure \}\)/,
  'a non-2xx answer is parsed before it can reach the media element',
)

// The refused branch reports and returns; only a media-level failure may fall back to the
// element. Falling back here is what turned a 502 body into DEMUXER_ERROR_COULD_NOT_OPEN.
const catchStart = player.indexOf('.catch(function (error) {')
const catchEnd = player.indexOf('startOnlineDirect(item, token, loudness)', catchStart)
assert.ok(catchStart >= 0 && catchEnd > catchStart, 'the MSE catch handles a refusal before the direct fallback')
const refusalBranch = player.slice(catchStart, catchEnd)
assert.match(refusalBranch, /error\.onlineStreamRefused === true/, 'the catch distinguishes a refused stream')
assert.match(refusalBranch, /onError\(error\.message\)/, 'the reason the Host gave is what the toast says')
assert.match(refusalBranch, /loudness\.resolve\(\)/, 'the loudness gate is released on the refusal path')

// ── kernel text never reaches the toast ────────────────────────────────────
assert.match(player, /if \(isBrowserMediaFailureText\(reason\)\)/, 'onError filters browser pipeline text')
assert.match(player, /console\.warn\('\[Player\] Media pipeline failure:', reason\)/, 'the kernel text still reaches the log')
assert.match(player, /page\.playbackFailedMedia/, 'an online track with no reason says it could not decode')

const i18n = read('src/client/i18n/i18n.js')
const mediaKey = (i18n.match(/'page\.playbackFailedMedia':/g) ?? []).length
assert.equal(mediaKey, 2, 'the fallback sentence exists in both locales')

// The Host half: a CDN refusal is retried with a fresh address and then reported with its status.
const route = read('src/host/http/routes/online.js')
assert.match(route, /function retriableCdnStatus\(status\)/)
assert.match(route, /function cdnFailureMessage\(status\)/, 'the status is turned into a sentence')
assert.match(route, /upstreamStatus: Number\(upstream\.status\) \|\| 0/, 'the CDN status travels to the client')
assert.match(route, /retryUrl\.searchParams\.set\('refresh'/, 'a refusal is retried with a fresh signature')

console.log('online-stream-errors.test.mjs ok')