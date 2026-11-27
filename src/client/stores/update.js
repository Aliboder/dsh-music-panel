/**
 * New-version state for the panel's top bar and 设置 → 关于.
 *
 * The Host owns the network call and its disk cache; this module only dedupes requests,
 * keeps a short client cache (the Host's interval), and never shows an error by itself.
 */

var UPDATE_CLIENT_MIN_TTL_MS = 60 * 1000

var updateStore = createStore({
  phase: 'idle', // idle | checking | ready | error | disabled | offline
  current: typeof APP_VERSION === 'string' ? APP_VERSION : '',
  latest: '',
  updateAvailable: false,
  checkedAt: 0,
  failed: false,
  disabled: false,
  source: '',
  intervalHours: 1,
  error: '',
})

var updateFetchedAt = 0
var updateInflight = null

function updateClientTtl() {
  var hours = Number(updateStore.get().intervalHours)
  if (!isFinite(hours) || hours <= 0) hours = 1
  return Math.max(UPDATE_CLIENT_MIN_TTL_MS, hours * 60 * 60 * 1000)
}

function updateOnline() {
  if (typeof navigator === 'undefined') return true
  return navigator.onLine !== false
}

function updateApply(body) {
  var current = typeof body.current === 'string' && body.current !== '' ? body.current : (typeof APP_VERSION === 'string' ? APP_VERSION : '')
  var latest = typeof body.latest === 'string' && body.latest !== '' ? body.latest : ''
  var disabled = body.disabled === true
  updateStore.set({
    phase: disabled ? 'disabled' : 'ready',
    current: current,
    latest: latest,
    updateAvailable: disabled ? false : body.updateAvailable === true,
    checkedAt: Number(body.checkedAt) || 0,
    failed: body.failed === true,
    disabled: disabled,
    source: typeof body.source === 'string' ? body.source : '',
    intervalHours: Number(body.intervalHours) > 0 ? Number(body.intervalHours) : 1,
    error: '',
  })
}

/**
 * Read the Host's update state. `force` bypasses both caches (the manual button).
 * Auto calls reuse the client cache, skip when offline, and stay silent on failure.
 */
async function checkForUpdate(options) {
  var force = options !== null && typeof options === 'object' && options.force === true
  if (!force && updateFetchedAt !== 0 && Date.now() - updateFetchedAt < updateClientTtl()) {
    return updateStore.get()
  }
  if (!updateOnline()) {
    updateStore.set({ phase: 'offline', error: '' })
    return updateStore.get()
  }
  if (updateInflight !== null) return updateInflight
  updateStore.set({ phase: 'checking', error: '' })
  updateInflight = getJson(API + 'update' + (force ? '?force=1' : ''))
    .then(function (body) {
      updateFetchedAt = Date.now()
      updateApply(body || {})
      return updateStore.get()
    })
    .catch(function (error) {
      if (updateStore.get().phase === 'checking') {
        updateStore.set({ phase: 'error', error: errorText(error) })
      }
      return updateStore.get()
    })
    .then(function (state) {
      updateInflight = null
      return state
    })
  return updateInflight
}

/** Relative 「上次检查」 label; '' before the first check. */
function updateCheckedLabel(checkedAt) {
  var at = Number(checkedAt) || 0
  if (at <= 0) return t('update.never')
  var seconds = Math.max(0, Math.floor((Date.now() - at) / 1000))
  if (seconds < 60) return t('update.justNow')
  if (seconds < 3600) return t('update.minutesAgo', { n: Math.floor(seconds / 60) })
  if (seconds < 86400) return t('update.hoursAgo', { n: Math.floor(seconds / 3600) })
  return t('update.daysAgo', { n: Math.floor(seconds / 86400) })
}
