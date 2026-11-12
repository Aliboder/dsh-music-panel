/**
 * Navidrome / Subsonic connection dialog.
 *
 * Navidrome has no QR sign-in, so the top-bar chip opens this form instead of
 * the shared login layer: server URL, username, password, and a save button.
 *
 * The password is sent once to POST /online/navidrome/login, where the host
 * trades it for a salted token (md5(paste + salt)) and persists only that. It
 * is cleared from component state the moment the request settles.
 */

function NavidromeDialog() {
  var serverPair = useState('')
  var userPair = useState('')
  var passPair = useState('')
  var busyPair = useState(false)
  var errorPair = useState('')
  var noticePair = useState('')
  // Opt-in: keeping the password is the only way to page the whole library,
  // because the native API mints a JWT from it.
  var keepPair = useState(false)
  var keepPassword = keepPair[0]
  var setKeepPassword = keepPair[1]

  var server = serverPair[0]
  var setServer = serverPair[1]
  var username = userPair[0]
  var setUsername = userPair[1]
  var password = passPair[0]
  var setPassword = passPair[1]
  var busy = busyPair[0]
  var setBusy = busyPair[1]
  var error = errorPair[0]
  var setError = errorPair[1]
  var notice = noticePair[0]
  var setNotice = noticePair[1]

  function save() {
    if (busy) return
    var trimmedServer = String(server || '').trim()
    var trimmedUser = String(username || '').trim()
    var secret = String(password || '')
    setError('')
    setNotice('')

    if (!/^https?:\/\//i.test(trimmedServer)) {
      setError(t('online.navidromeBadServer'))
      return
    }
    if (trimmedUser === '') {
      setError(t('online.navidromeNeedUser'))
      return
    }
    if (secret === '') {
      setError(t('online.navidromeNeedPassword'))
      return
    }

    setBusy(true)
    postJson(API + 'online/navidrome/login', {
      server: trimmedServer,
      username: trimmedUser,
      password: secret,
      storePassword: keepPassword === true,
    })
      .then(function (result) {
        setBusy(false)
        // Drop the secret as soon as it is spent.
        setPassword('')
        setNotice(t('online.navidromeOk', { version: (result && result.serverVersion) || 'ok' }))
        void loadProviders()
        showToast(t('online.loginSuccess'))
        // Leave the dialog open briefly so the success line is readable, then
        // close and land on the source the user just configured.
        window.setTimeout(function () {
          popLayer()
        }, 700)
      })
      .catch(function (err) {
        setBusy(false)
        setError(errorText(err))
      })
  }

  function onKeyDown(event) {
    if (event.key === 'Enter') save()
    if (event.key === 'Escape') popLayer()
  }

  return h(
    KitModal,
    {
      title: t('online.navidromeTitle'),
      small: true,
      onClose: popLayer,
      footer: [
        h(Button, { key: 'cancel', variant: 'ghost', onClick: function () { popLayer() } }, t('page.cancel')),
        h(
          Button,
          { key: 'save', variant: 'primary', disabled: busy, onClick: save },
          busy ? t('online.navidromeConnecting') : t('online.navidromeSave'),
        ),
      ],
    },
    h(
      'div',
      { className: 'mp-navidrome-form' },
      h('label', { className: 'mp-navidrome-label' }, t('online.navidromeServer')),
      h('input', {
        className: 'mp-kit-input',
        type: 'url',
        placeholder: t('online.navidromeServerPlaceholder'),
        value: server,
        disabled: busy,
        autofocus: true,
        onKeyDown: onKeyDown,
        onChange: function (event) {
          setServer(event.target.value)
        },
      }),
      h('label', { className: 'mp-navidrome-label' }, t('online.navidromeUser')),
      h('input', {
        className: 'mp-kit-input',
        type: 'text',
        value: username,
        disabled: busy,
        onKeyDown: onKeyDown,
        onChange: function (event) {
          setUsername(event.target.value)
        },
      }),
      h('label', { className: 'mp-navidrome-label' }, t('online.navidromePassword')),
      h('input', {
        className: 'mp-kit-input',
        type: 'password',
        value: password,
        disabled: busy,
        onKeyDown: onKeyDown,
        onChange: function (event) {
          setPassword(event.target.value)
        },
      }),
      h(
        'label',
        { className: 'mp-navidrome-check' },
        h('input', {
          type: 'checkbox',
          checked: keepPassword === true,
          disabled: busy,
          onChange: function (event) {
            setKeepPassword(event.target.checked === true)
          },
        }),
        h('span', null, t('online.navidromeKeep')),
      ),
      h('p', { className: 'mp-navidrome-hint' }, t('online.navidromeHint')),
      keepPassword === true ? h('p', { className: 'mp-navidrome-warn' }, t('online.navidromeKeepWarn')) : null,
      error !== '' ? h('p', { className: 'mp-online-error' }, error) : null,
      notice !== '' ? h('p', { className: 'mp-online-ok' }, notice) : null,
    ),
  )
}
