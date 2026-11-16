/**
 * 喜欢 / 收藏 — one model for both kinds of track, like Folia's `SongLike`.
 *
 * Folia keeps a single `{ isLiked, onLike, disabled, disabledReason }` and lets the
 * owner decide the write: the local library for a downloaded file, the provider
 * account for a streaming track. This plugin grew three copies of that logic (the
 * bar, the online lists, the player card), each with a different state source, so
 * the heart could disagree with itself. This is the single producer they all use.
 */

function isProviderLoggedIn(provider) {
  var store = onlineStore.get()
  var entry = (store.providers || {})[provider]
  return Boolean(entry && entry.loggedIn === true)
}

/** `SongLike` for a track. Local reads the favorites map; online reads the liked map. */
function likeStateOf(track, favoriteSet) {
  if (track === null || track === undefined) {
    return { isLiked: false, disabled: true, reason: '', onLike: function () {} }
  }
  if (track.onlineProvider) {
    var liked = onlineStore.get().liked || {}
    var loggedIn = isProviderLoggedIn(track.onlineProvider)
    return {
      isLiked: liked[track.path] === true,
      disabled: !loggedIn,
      reason: loggedIn ? '' : t('sheet.loginToLike'),
      onLike: function () {
        toggleLikeTrack(track)
      },
    }
  }
  return {
    isLiked: Boolean(favoriteSet && favoriteSet[track.path] === true),
    disabled: false,
    reason: '',
    onLike: function () {
      toggleLikeTrack(track)
    },
  }
}

/**
 * Toggle like. Online is optimistic — the heart flips now and reverts if the
 * provider rejects the write — because that is what Folia's onLike does and a
 * round trip is visible at these latencies.
 */
function toggleLikeTrack(track) {
  if (track === null || track === undefined) return
  if (!track.onlineProvider) {
    if (typeof track.path === 'string' && track.path !== '') void toggleFavorite(track.path)
    return
  }
  if (!isProviderLoggedIn(track.onlineProvider)) {
    showToast(t('sheet.loginToLike'))
    return
  }
  var path = track.path
  var liked = onlineStore.get().liked || {}
  var next = liked[path] !== true
  var optimistic = Object.assign({}, liked)
  if (next) optimistic[path] = true
  else delete optimistic[path]
  onlineStore.set({ liked: optimistic })
  if (typeof refreshLikedPlaylist === 'function') refreshLikedPlaylist(next ? 1 : -1)
  postJson(API + 'online/like', { provider: track.onlineProvider, song: track, on: next }).catch(function (error) {
    var revert = Object.assign({}, onlineStore.get().liked || {})
    if (next) delete revert[path]
    else revert[path] = true
    onlineStore.set({ liked: revert })
    if (typeof refreshLikedPlaylist === 'function') refreshLikedPlaylist(next ? -1 : 1)
    showToast(errorText(error))
  })
}

/** Fill the liked map for a provider (the lists and the card share it). */
function loadLikedIds(provider) {
  return getJson(API + 'online/liked-ids?provider=' + encodeURIComponent(provider)).then(function (body) {
    var map = {}
    ;(Array.isArray(body.ids) ? body.ids : []).forEach(function (path) {
      map[path] = true
    })
    onlineStore.set({ liked: map })
    return map
  })
}
