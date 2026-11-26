/**
 * 收藏到歌单 — the online half of the player card's "add to playlist".
 *
 * Local tracks use the existing local picker; a streaming track needs the account's
 * own playlists, so this dialog lists them from `/online/my-playlists` and adds the
 * song with `/online/playlist-add` (Folia's add-to-playlist store does the same two
 * steps for an online song).
 */

/**
 * What the picker is about: the song it was asked for, and the platform that owns it.
 *
 * The song answers for its own source — Folia's picker does the same
 * (`getPlaybackSourceRef(song)` in useAddToPlaylistStore / AddToPlaylistHost) — so a caller
 * cannot strand the dialog on「当前曲目没有在线平台」by leaving the provider prop out. An
 * explicit `provider` still wins; `track` is the older prop name the context menu used.
 */
function onlineAddTarget(layerProps) {
  var props = layerProps !== null && typeof layerProps === 'object' ? layerProps : {}
  var song = props.song || props.track || null
  return {
    song: song,
    provider: String(props.provider || (song && song.onlineProvider) || ''),
  }
}

function OnlineAddToPlaylistDialog(props) {
  var layer = props.layer || {}
  var target = onlineAddTarget(layer.props)
  var song = target.song
  var provider = target.provider

  var listPair = useState(null)
  var playlists = listPair[0]
  var setPlaylists = listPair[1]
  var phasePair = useState('loading')
  var phase = phasePair[0]
  var setPhase = phasePair[1]
  var errorPair = useState('')
  var error = errorPair[0]
  var setError = errorPair[1]
  var busyPair = useState('')
  var busy = busyPair[0]
  var setBusy = busyPair[1]

  useEffect(
    function () {
      if (provider === '') {
        setPhase('error')
        setError(t('sheet.noProvider'))
        return undefined
      }
      var cancelled = false
      getJson(API + 'online/my-playlists?provider=' + encodeURIComponent(provider))
        .then(function (body) {
          if (cancelled) return
          setPlaylists(Array.isArray(body.playlists) ? body.playlists : [])
          setPhase('ready')
        })
        .catch(function (loadError) {
          if (cancelled) return
          setPhase('error')
          setError(errorText(loadError))
        })
      return function () {
        cancelled = true
      }
    },
    [provider],
  )

  function add(playlist) {
    if (song === null || busy !== '') return
    setBusy(String(playlist.id))
    setError('')
    postJson(API + 'online/playlist-add', {
      provider: provider,
      playlistId: String(playlist.id),
      song: song,
    })
      .then(function () {
        setBusy('')
        popLayer()
        if (typeof showToast === 'function') showToast(t('sheet.addedToPlaylist'))
      })
      .catch(function (addError) {
        setBusy('')
        setError(errorText(addError))
      })
  }

  var body = h(
    'div',
    { className: 'mp-set-card' },
    h(
      'div',
      // Same scrolling list as the local picker: the account can hold more playlists than
      // the dialog is tall (Folia's picker scrolls its list instead of clipping it).
      { className: 'mp-set-card-body mp-pick-list' },
      phase === 'loading'
        ? h('div', { className: 'mp-folder-state' }, h(Spinner), h('span', null, t('sheet.loadingPlaylists')))
        : null,
      phase === 'error' ? h('div', { className: 'mp-online-error' }, error) : null,
      phase === 'ready' && playlists.length === 0
        ? h('div', { className: 'mp-folder-state' }, t('sheet.noPlaylists'))
        : null,
      phase === 'ready'
        ? (playlists || []).map(function (playlist) {
            var playlistId = String(playlist.id)
            var count = Number(playlist.trackCount) || 0
            return h(
              SetRow,
              {
                key: playlistId,
                label: String(playlist.name || ''),
                desc: count + ' ' + t('v2.songs'),
              },
              h(
                Button,
                {
                  variant: 'outline',
                  size: 'sm',
                  disabled: busy !== '',
                  onClick: function () {
                    add(playlist)
                  },
                },
                busy === playlistId ? t('sheet.saving') : t('online.addToCloudPlaylist'),
              ),
            )
          })
        : null,
    ),
  )

  return h(
    KitModal,
    {
      title: t('online.addToCloudPlaylist'),
      onClose: popLayer,
      small: true,
      footer: [
        h(Button, { key: 'cancel', variant: 'ghost', onClick: popLayer }, t('page.cancel')),
      ],
    },
    body,
  )
}
