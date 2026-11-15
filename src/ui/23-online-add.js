/**
 * 收藏到歌单 — the online half of the player card's "add to playlist".
 *
 * Local tracks use the existing local picker; a streaming track needs the account's
 * own playlists, so this dialog lists them from `/online/my-playlists` and adds the
 * song with `/online/playlist-add` (Folia's add-to-playlist store does the same two
 * steps for an online song).
 */

function OnlineAddToPlaylistDialog(props) {
  var layer = props.layer || {}
  var provider = String((layer.props && layer.props.provider) || '')
  var song = (layer.props && layer.props.song) || null

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
    { className: 'mp-online-add', style: { display: 'flex', flexDirection: 'column', gap: '8px', minHeight: '120px' } },
    phase === 'loading'
      ? h('div', { className: 'mp-empty', style: { padding: '20px' } }, t('sheet.loadingPlaylists'))
      : null,
    phase === 'error' ? h('div', { className: 'mp-set-desc', style: { color: '#f87171' } }, error) : null,
    phase === 'ready' && playlists.length === 0
      ? h('div', { className: 'mp-empty', style: { padding: '20px' } }, t('sheet.noPlaylists'))
      : null,
    phase === 'ready'
      ? (playlists || []).map(function (playlist) {
          return h(
            'button',
            {
              key: String(playlist.id),
              type: 'button',
              className: 'mp-online-add-row',
              disabled: busy !== '',
              onClick: function () {
                add(playlist)
              },
              style: {
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                width: '100%',
                padding: '10px 12px',
                borderRadius: '10px',
                border: '1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.08))',
                background: 'var(--dsw-alias-bg-layer-2,rgba(255,255,255,.04))',
                color: 'inherit',
                font: 'inherit',
                fontSize: '13px',
                textAlign: 'left',
                cursor: busy !== '' ? 'default' : 'pointer',
              },
            },
            icon('note', 16),
            h(
              'span',
              { style: { flex: '1 1 auto', minWidth: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
              String(playlist.name || ''),
            ),
            playlist.trackCount !== undefined
              ? h('span', { style: { fontSize: '11px', opacity: '.55' } }, String(playlist.trackCount) + ' 首')
              : null,
            busy === String(playlist.id)
              ? h('span', { style: { fontSize: '11px', opacity: '.7' } }, t('sheet.saving'))
              : null,
          )
        })
      : null,
  )

  return h(
    KitModal,
    {
      title: t('page.addToPlaylist'),
      onClose: popLayer,
      small: true,
      footer: [
        h(
          'button',
          {
            key: 'cancel',
            type: 'button',
            className: 'mp-btn',
            onClick: popLayer,
            style: {
              padding: '8px 18px',
              borderRadius: '8px',
              border: '1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.12))',
              background: 'transparent',
              color: 'inherit',
              font: 'inherit',
              fontSize: '13px',
              cursor: 'pointer',
            },
          },
          t('page.cancel'),
        ),
      ],
    },
    body,
  )
}
