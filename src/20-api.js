/**
 * api: every call into the Host half lives here.
 *
 * The playback engine expects `API`, `getJson`, `postJson`, `streamUrl` and
 * `coverUrl` under these exact names.
 */

var API = 'music/'

function streamUrl(path) {
  return API + 'stream?path=' + encodeURIComponent(path)
}

function coverUrl(path) {
  return API + 'cover?path=' + encodeURIComponent(path)
}

function onlineStreamUrl(provider, id) {
  return API + 'online/stream?provider=' + encodeURIComponent(provider) + '&id=' + encodeURIComponent(id)
}

async function getJson(url) {
  var response = await fetch(url, {
    credentials: 'same-origin',
    headers: { accept: 'application/json' },
  })
  var body = null
  try {
    body = await response.json()
  } catch (error) {
    body = null
  }
  if (!response.ok || body === null || body.ok !== true) {
    var message =
      body !== null && body.error && body.error.message ? body.error.message : 'HTTP ' + response.status
    throw new Error(message)
  }
  return body
}

function postJson(url, payload) {
  return fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(payload === undefined ? {} : payload),
  }).then(function (response) {
    return response
      .json()
      .catch(function () {
        return null
      })
      .then(function (body) {
        if (!response.ok || body === null || body.ok !== true) {
          var error = new Error(
            body !== null && body.error && body.error.message
              ? body.error.message
              : 'HTTP ' + response.status,
          )
          error.body = body
          throw error
        }
        return body
      })
  })
}

/** PATCH / DELETE with the same envelope as postJson. */
function sendJson(method, url, payload) {
  return fetch(url, {
    method: method,
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  }).then(function (response) {
    return response
      .json()
      .catch(function () {
        return null
      })
      .then(function (body) {
        if (!response.ok || body === null || body.ok !== true) {
          var error = new Error(
            body !== null && body.error && body.error.message
              ? body.error.message
              : 'HTTP ' + response.status,
          )
          error.body = body
          throw error
        }
        return body
      })
  })
}

/** Cover URL for a library or online track ('' when it has no art). */
function trackCoverSrc(track) {
  if (!track) return ''
  if (track.onlineProvider) {
    return typeof track.coverUrl === 'string' && track.coverUrl !== ''
      ? API + 'online/cover?url=' + encodeURIComponent(track.coverUrl)
      : ''
  }
  if (track.hasCover === true && track.path) return coverUrl(track.path)
  return ''
}

/** Map one online search / playlist result into the queue's track shape. */
function onlineTrackOf(result) {
  var provider = result.provider
  return {
    path: 'online:' + provider + ':' + result.id,
    title: result.title,
    artist: result.artist,
    album: result.album,
    durationSec: result.durationSec,
    hasCover: false,
    coverUrl: result.coverUrl || '',
    onlineUrl: onlineStreamUrl(provider, result.id),
    onlineProvider: provider,
    onlineId: result.id,
    qualityHint: result.qualityHint || '',
    sampleRate: 0,
    size: 0,
    mtime: 0,
  }
}

function onlineCoverSrc(result) {
  if (!result || typeof result.coverUrl !== 'string' || result.coverUrl === '') return ''
  return API + 'online/cover?url=' + encodeURIComponent(result.coverUrl)
}
