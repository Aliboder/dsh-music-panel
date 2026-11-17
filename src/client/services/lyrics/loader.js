/**
 * One lyric load per song, shared by the player and every surface that shows lyrics.
 *
 * Folia loads a song's lyric where playback starts, not where a panel happens to be
 * open: the visualizer and the player's start gate both need it. This module is that
 * place — `load()` answers the resolved lyric (local file, matched online lyric, or the
 * platform's own), `whenReady()` is what the player waits on before starting audio.
 *
 * It does not run the optional word-by-word upgrade: that is a display decision with a
 * toast and diagnostics, and it stays where the lyrics are shown.
 *
 * @module dsh-music-panel/lyric-loader
 */

var MPLyricLoader = (function () {
  /** Songs whose resolved lyric is kept (both decks and the panel rarely exceed this). */
  var CACHE_LIMIT = 12
  /** The gate never holds playback hostage to a slow network. */
  var GATE_TIMEOUT_MS = 8000

  var cache = new Map()
  var inflight = new Map()

  /** The identity of a song, the same key the Host's lyric record uses. */
  function keyOf(track) {
    if (track === null || typeof track !== 'object') return ''
    if (track.onlineProvider) {
      return 'online:' + String(track.onlineProvider) + ':' + String(track.onlineId || '')
    }
    return String(track.path || '')
  }

  function emptyResult(key) {
    return {
      key: key,
      lyrics: [],
      document: null,
      source: null,
      pureMusic: false,
      isWordByWord: false,
      offsetMs: 0,
      chorusRanges: [],
      matchedUpdated: false,
    }
  }

  function remember(key, result) {
    cache.set(key, result)
    while (cache.size > CACHE_LIMIT) {
      var oldest = cache.keys().next().value
      if (oldest === undefined) break
      cache.delete(oldest)
    }
  }

  async function loadOnline(track) {
    var key = keyOf(track)
    var provider = String(track.onlineProvider || '')
    var id = String(track.onlineId || '')
    var query =
      API +
      'online/lyric?provider=' +
      encodeURIComponent(provider) +
      '&id=' +
      encodeURIComponent(id) +
      '&title=' +
      encodeURIComponent(track.title || '') +
      '&artist=' +
      encodeURIComponent(track.artist || '') +
      '&album=' +
      encodeURIComponent(track.album || '') +
      '&duration=' +
      encodeURIComponent(String(track.durationSec || 0)) +
      '&preferred=' +
      encodeURIComponent(String(prefs.lyricPreferredSource || ''))
    // The hook lines are part of the display pass (Folia marks them with the provider's
    // own ranges), so the chorus window is asked alongside the lyric.
    var chorusPromise = getJson(API + 'online/chorus?provider=' + encodeURIComponent(provider) + '&id=' + encodeURIComponent(id)).catch(
      function () {
        return null
      },
    )
    var body = await getJson(query)
    var chorusRanges = mpChorusRanges(await chorusPromise)
    var result = emptyResult(key)
    result.chorusRanges = chorusRanges
    result.source = body.source === 'imported' ? 'imported' : 'online'
    result.offsetMs = readSavedLyricOffset(key)
    if (body.pureMusic === true) {
      result.pureMusic = true
      return result
    }
    var document = null
    if (body.raw && typeof MPFoliaLyrics !== 'undefined' && MPFoliaLyrics !== null) {
      try {
        var parsed = await MPFoliaLyrics.parse(body.raw, { songId: Number(track.onlineId) || 0 })
        if (parsed && Array.isArray(parsed.lines) && parsed.lines.length > 0) document = parsed
      } catch (error) {
        document = null
      }
    }
    if (document !== null) {
      var shown = mpPrepareLyrics(document, key, chorusRanges)
      result.lyrics = shown.lyrics
      result.document = document
      result.pureMusic = shown.pureMusic === true
      result.isWordByWord = shown.isWordByWord === true
      return result
    }
    // No document the pipeline can parse (an older cache): the Host's LRC and its word
    // timeline, converted the way the legacy producers are.
    var lines = parseLrcText(body.lrc || '')
    if (body.translation) mergeLyricTranslation(lines, body.translation)
    attachWordTimeline(lines, body.lines)
    result.lyrics = legacyLinesToFolia(lines)
    result.isWordByWord = body.wordLevel === true
    return result
  }

  async function loadLocal(track) {
    var key = keyOf(track)
    var priority = prefs.lyricLocalPriority === 'online' ? 'online' : 'local'
    var formatOrder = Array.isArray(prefs.lyricFormatOrder) ? prefs.lyricFormatOrder.join(',') : ''
    var url =
      API +
      'lyrics?path=' +
      encodeURIComponent(track.path) +
      '&priority=' +
      encodeURIComponent(priority) +
      '&formatOrder=' +
      encodeURIComponent(formatOrder)
    var body = await getJson(url)
    var matchedUpdated = false
    // Folia's `matchLyrics`: none of the file's own lyrics is usable (or the listener chose
    // online) — ask once, then read the resolved lyric again.
    if (body.needsAutoMatch === true) {
      var auto = await getJson(
        API +
          'lyrics/auto?path=' +
          encodeURIComponent(track.path) +
          '&preferred=' +
          encodeURIComponent(String(prefs.lyricPreferredSource || '')),
      ).catch(function () {
        return null
      })
      if (auto !== null && auto.matched) {
        body = await getJson(url)
        matchedUpdated = true
      }
    }
    var shown = await mpLocalLyricLines(body, key)
    return {
      key: key,
      lyrics: shown.lyrics,
      document: shown.document,
      source: body.pureMusic === true ? 'pure' : String(body.source || ''),
      pureMusic: body.pureMusic === true || shown.pureMusic === true,
      isWordByWord: shown.isWordByWord === true,
      offsetMs: Number(body.offsetMs) || readSavedLyricOffset(key),
      chorusRanges: [],
      matchedUpdated: matchedUpdated,
    }
  }

  /** The resolved lyric for one song; concurrent callers share the same request. */
  function load(track) {
    var key = keyOf(track)
    if (key === '') return Promise.resolve(emptyResult(''))
    var hit = cache.get(key)
    if (hit !== undefined) return Promise.resolve(hit)
    var running = inflight.get(key)
    if (running !== undefined) return running
    var promise = (track.onlineProvider ? loadOnline(track) : loadLocal(track))
      .catch(function () {
        return emptyResult(key)
      })
      .then(function (result) {
        inflight.delete(key)
        remember(key, result)
        return result
      })
    inflight.set(key, promise)
    return promise
  }

  /**
   * What the player's start gate waits on. Always resolves: a timeout, a failed request
   * and "no loader" all mean "start the song anyway", never "never start".
   *
   * @param {object} track
   * @param {number} [timeoutMs]
   */
  function whenReady(track, timeoutMs) {
    var ms = typeof timeoutMs === 'number' && timeoutMs >= 0 ? timeoutMs : GATE_TIMEOUT_MS
    return new Promise(function (resolve) {
      var settled = false
      var timer = setTimeout(function () {
        if (settled) return
        settled = true
        if (typeof console !== 'undefined' && typeof console.info === 'function') {
          console.info('[dsh-music] lyric gate timed out for ' + keyOf(track))
        }
        resolve(null)
      }, ms)
      load(track).then(
        function (result) {
          if (settled) return
          settled = true
          clearTimeout(timer)
          resolve(result)
        },
        function () {
          if (settled) return
          settled = true
          clearTimeout(timer)
          resolve(null)
        },
      )
    })
  }

  /** Forget one song's resolved lyric (after the listener changes its source), or all. */
  function invalidate(key) {
    if (key === undefined) {
      cache.clear()
      return
    }
    cache.delete(String(key))
  }

  return { load: load, whenReady: whenReady, invalidate: invalidate, keyOf: keyOf }
})()
