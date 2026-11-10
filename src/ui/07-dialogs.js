/**
 * dialogs: context menu, login, tag editor, add-to-playlist, confirm and toast.
 */

function ContextMenu(props) {
  var layer = props.layer
  var track = layer.props.track
  var online = typeof track.onlineProvider === 'string' && track.onlineProvider !== ''
  var favorite = libraryStore.get().favorites.indexOf(track.path) >= 0
  var items = []
  var likedPair = useState(false)
  var liked = likedPair[0]
  var setLiked = likedPair[1]

  useEffect(
    function () {
      if (!online) return undefined
      var cancelled = false
      getJson(
        API +
          'online/liked?provider=' +
          encodeURIComponent(track.onlineProvider) +
          '&id=' +
          encodeURIComponent(track.onlineId || ''),
      )
        .then(function (body) {
          if (!cancelled) setLiked(body.liked === true)
        })
        .catch(function () {
          // Not signed in / unavailable: keep the neutral state.
        })
      return function () {
        cancelled = true
      }
    },
    [online, track.onlineProvider, track.onlineId],
  )

  useEffect(function () {
    if (hostComponent('Menu') !== null) return undefined
    function onDown(event) {
      var node = event.target
      if (node && typeof node.closest === 'function' && node.closest('.mp-ctx')) return
      removeLayer('menu')
    }
    function onScroll() {
      removeLayer('menu')
    }
    document.addEventListener('pointerdown', onDown, true)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return function () {
      document.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  var selection = selectionStore.get()
  var multi =
    selection.active === true &&
    selection.paths.length > 0 &&
    selection.paths.indexOf(track.path) >= 0
  if (multi) {
    var selectedPaths = selection.paths.slice()
    if (online) {
      if (typeof layer.props.playSelected === 'function') {
        items.push({
          key: 'play',
          icon: 'play',
          label: t('page.playSelected'),
          run: function () {
            layer.props.playSelected()
          },
        })
      }
      items.push({
        key: 'select-none',
        icon: 'x',
        label: t('page.selectNone'),
        run: clearSelection,
      })
      items.push({
        key: 'done',
        icon: 'check',
        label: t('page.done'),
        run: function () {
          setSelectionMode(false)
        },
      })
      } else {
    var library = libraryStore.get()
    var favoriteSet = {}
    ;(library.favorites || []).forEach(function (path) {
      favoriteSet[path] = true
    })
    var allFavorite = selectedPaths.every(function (path) {
      return favoriteSet[path] === true
    })
    var selectedTracks = (library.tracks || []).filter(function (item) {
      return selectedPaths.indexOf(item.path) >= 0
    })
    if (Array.isArray(layer.props.visiblePaths) && layer.props.visiblePaths.length > 0) {
      var visiblePaths = layer.props.visiblePaths
      items.push({
        key: 'select-all',
        icon: 'checkCircle',
        label: t('page.selectAll'),
        run: function () {
          selectAllPaths(visiblePaths)
        },
      })
    }
    items.push({
      key: 'select-none',
      icon: 'x',
      label: t('page.selectNone'),
      run: clearSelection,
    })
    items.push({
      key: 'done',
      icon: 'check',
      label: t('page.done'),
      run: function () {
        setSelectionMode(false)
      },
    })
    items.push({ key: 'sep-select', separator: true })
    items.push({
      key: 'play',
      icon: 'play',
      label: t('page.playSelected'),
      run: function () {
        if (selectedTracks.length > 0) player.playList(selectedTracks, 0)
      },
    })
    items.push({
      key: 'fav',
      icon: 'heart',
      label: allFavorite ? t('page.unfavorite') : t('page.favoriteSelected'),
      run: function () {
        var targets = allFavorite
          ? selectedPaths.slice()
          : selectedPaths.filter(function (path) {
              return favoriteSet[path] !== true
            })
        void (async function () {
          try {
            for (var index = 0; index < targets.length; index += 1) await toggleFavorite(targets[index])
            showToast(allFavorite ? t('page.unfavorite') : t('page.favoriteSelected'))
          } catch (error) {
            showToast(errorText(error))
          }
        })()
      },
    })
    items.push({
      key: 'add',
      icon: 'plus',
      label: t('page.addToPlaylist'),
      run: function () {
        pushLayer('addTo', { paths: selectedPaths.slice() })
      },
    })
    items.push({
      key: 'batch',
      icon: 'edit',
      label: t('page.batchEdit'),
      run: function () {
        pushLayer('batchEdit', { paths: selectedPaths.slice() })
      },
    })
    items.push({ key: 'sep-multi', separator: true })
    items.push({
      key: 'delete',
      icon: 'trash',
      label: t('page.delete'),
      danger: true,
      run: function () {
        var paths = selectedPaths.slice()
        pushLayer('confirm', {
          title: t('page.delete'),
          text: t('v2.removeSelectedConfirm', { n: paths.length }),
          onConfirm: function () {
            removeTracks(paths)
              .then(function (body) {
                showToast(t('v2.removed', { n: (body.moved || []).length }))
              })
              .catch(function (error) {
                showToast(errorText(error))
              })
          },
        })
      },
    })
    }
  } else {
  items.push({
    key: 'play',
    icon: 'play',
    label: t('page.play'),
    run: function () {
      if (layer.props.onPlay) layer.props.onPlay(track)
      else player.playList([track], 0)
    },
  })
  items.push({
    key: 'next',
    icon: 'list',
    label: t('page.next'),
    run: function () {
      player.enqueue(track)
      showToast(t('page.addedToPlaylist'))
    },
  })
  if (online) {
    items.push({
      key: 'fav',
      icon: liked ? 'heartFill' : 'heart',
      label: liked ? t('page.unfavorite') : t('page.favorite'),
      run: function () {
        var next = !liked
        postJson(API + 'online/like', { provider: track.onlineProvider, song: track, on: next })
          .then(function () {
            setLiked(next)
            showToast(next ? t('page.favorite') : t('page.unfavorite'))
          })
          .catch(function (error) {
            showToast(errorText(error))
          })
      },
    })
    items.push({
      key: 'add-cloud',
      icon: 'plus',
      label: t('online.addToCloudPlaylist'),
      run: function () {
        pushLayer('onlineAddTo', { track: track })
      },
    })
  } else {
    items.push({
      key: 'fav',
      icon: favorite ? 'heartFill' : 'heart',
      label: favorite ? t('page.unfavorite') : t('page.favorite'),
      run: function () {
        void toggleFavorite(track.path)
      },
    })
    items.push({
      key: 'add',
      icon: 'plus',
      label: t('page.addToPlaylist'),
      run: function () {
        pushLayer('addTo', { track: track })
      },
    })
  }
  if (layer.props.onRemove) {
    items.push({
      key: 'remove',
      icon: 'trash',
      label: online ? t('online.removeFromHistory') : t('page.removeTrack'),
      run: layer.props.onRemove,
    })
  }
  items.push({ key: 'sep1', separator: true })
  if (!online) {
    items.push({
      key: 'tags',
      icon: 'edit',
      label: t('page.editMeta'),
      run: function () {
        pushLayer('tag', { path: track.path })
      },
    })
    items.push({
      key: 'reveal',
      icon: 'folder',
      label: t('page.reveal'),
      run: function () {
        postJson(API + 'reveal', { path: track.path })
          .then(function () {
            showToast(t('page.revealed'))
          })
          .catch(function (error) {
            showToast(errorText(error))
          })
      },
    })
  }
  if (!online) {
    items.push({
      key: 'copy',
      icon: 'copy',
      label: t('page.copyPath'),
      run: function () {
        var path = track.path
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            void navigator.clipboard.writeText(path)
          }
        } catch (error) {
          // Clipboard can be blocked; the toast still confirms the intent.
        }
        showToast(t('page.copied'))
      },
    })
  }

    }
var width = 190
  var height = items.length * 32 + 8
  var left = Math.min(layer.props.x || 0, Math.max(8, window.innerWidth - width - 12))
  var top = Math.min(layer.props.y || 0, Math.max(8, window.innerHeight - height - 12))

  var HostMenu = hostComponent('Menu')
  if (HostMenu !== null) {
    var hostItems = items.map(function (item) {
      if (item.separator) return { type: 'separator', id: item.key }
      return { id: item.key, label: item.label, icon: icon(item.icon, 14) }
    })
    return h(HostMenu, {
      open: true,
      anchor: null,
      items: hostItems,
      contextual: true,
      portal: true,
      side: 'bottom',
      align: 'start',
      getAnchorRect: function () {
        return { left: left, top: top, right: left, bottom: top, width: 0, height: 0, x: left, y: top }
      },
      onSelect: function (id) {
        popLayer()
        var chosen = null
        items.forEach(function (item) {
          if (chosen === null && item.key === id) chosen = item
        })
        if (chosen !== null && typeof chosen.run === 'function') chosen.run()
      },
      onClose: function () {
        popLayer()
      },
    })
  }

  return h(
    'div',
    { className: 'mp-ctx', style: { left: left + 'px', top: top + 'px' }, role: 'menu' },
    items.map(function (item) {
      if (item.separator) return h('hr', { key: item.key })
      return h(
        'button',
        {
          key: item.key,
          type: 'button',
          role: 'menuitem',
          onClick: function () {
            popLayer()
            item.run()
          },
        },
        icon(item.icon, 14),
        item.label,
      )
    }),
  )
}

function AddToPlaylistDialog(props) {
  var library = useStore(libraryStore)
  var layerProps = props.layer.props || {}
  var paths = Array.isArray(layerProps.paths)
    ? layerProps.paths.slice()
    : layerProps.track
      ? [layerProps.track.path]
      : []
  var playlists = library.playlists
  var pair = useState('')
  var name = pair[0]
  var setName = pair[1]
  var busyPair = useState(false)
  var busy = busyPair[0]
  var setBusy = busyPair[1]

  function addTo(id) {
    if (busy || paths.length === 0) return
    setBusy(true)
    addToPlaylist(id, paths).then(function (ok) {
      setBusy(false)
      if (ok) {
        popLayer()
        showToast(t('page.addedToPlaylist'))
      }
    })
  }

  function createAndAdd() {
    var value = name.trim()
    if (value === '' || busy) return
    setBusy(true)
    createPlaylist(value).then(function (created) {
      if (created && created.id) return addToPlaylist(created.id, paths)
      return false
    }).then(function (ok) {
      setBusy(false)
      if (ok !== false) {
        popLayer()
        showToast(t('page.addedToPlaylist'))
      }
    })
  }

  return h(
    KitModal,
    {
      title: t('page.addToPlaylist'),
      small: true,
      onClose: popLayer,
    },
    playlists.length === 0
      ? h('p', { className: 'mp-set-desc' }, t('v2.noPlaylists'))
      : playlists.map(function (playlist) {
          return h(
            'button',
            {
              key: playlist.id,
              type: 'button',
              className: 'mp-srow',
              onClick: function () {
                addTo(playlist.id)
              },
            },
            h('div', { className: 'mp-srow-cover' }, icon('list', 16)),
            h(
              'div',
              { className: 'mp-srow-main' },
              h('div', { className: 'mp-srow-title' }, playlist.name),
              h('div', { className: 'mp-srow-sub' }, (playlist.trackPaths || []).length + ''),
            ),
            icon('chevronRight', 14),
          )
        }),
    h(
      'div',
      { style: { display: 'flex', gap: '8px', paddingTop: '6px' } },
      h('input', {
        type: 'text',
        value: name,
        placeholder: t('v2.newPlaylist'),
        className: 'mp-kit-input',
        onChange: function (event) {
          setName(event.target.value)
        },
      }),
      h(Button, { variant: 'primary', icon: 'plus', disabled: busy, onClick: createAndAdd }, t('page.create')),
    ),
  )
}

function LoginDialog(props) {
  var provider = props.layer.props.provider || 'netease'
  var mode = props.layer.props.mode || 'qq'
  var qrPair = useState(null)
  var qr = qrPair[0]
  var setQr = qrPair[1]
  var statusPair = useState('waiting')
  var status = statusPair[0]
  var setStatus = statusPair[1]
  var errorPair = useState('')
  var error = errorPair[0]
  var setError = errorPair[1]

  useEffect(
    function () {
      var cancelled = false
      var timer = null
      startProviderLogin(provider, mode)
        .then(function (body) {
          if (cancelled) return
          setQr(body)
          timer = setInterval(function () {
            checkProviderLogin(provider, body.key, body.mode || mode)
              .then(function (next) {
                if (cancelled) return
                setStatus(next)
                if (next === 'success') {
                  clearInterval(timer)
                  timer = null
                  void loadProviders()
                  showToast(t('online.loginSuccess'))
                  popLayer()
                }
                if (next === 'expired' || next === 'failed') {
                  clearInterval(timer)
                  timer = null
                }
              })
              .catch(function (pollError) {
                if (cancelled) return
                setError(errorText(pollError))
              })
          }, 2000)
        })
        .catch(function (startError) {
          if (cancelled) return
          setError(errorText(startError))
        })
      return function () {
        cancelled = true
        if (timer !== null) clearInterval(timer)
      }
    },
    [provider, mode],
  )

  var providerLabel =
    provider === 'netease'
      ? t('online.providerNetease')
      : provider === 'qq'
        ? t('online.providerQq')
        : t('online.providerKugou')

  return h(
    KitModal,
    {
      title: t('online.loginTitle', { provider: providerLabel }),
      small: true,
      onClose: popLayer,
    },
    h(
      'div',
      { className: 'mp-kit-center' },
      h(
        'div',
        { className: 'mp-qr' },
        qr && qr.imageDataUrl
          ? h('img', { src: qr.imageDataUrl, alt: '' })
          : h('span', { style: { fontSize: '12px', color: 'var(--dsw-alias-label-tertiary,#8a8a93)' } }, '…'),
      ),
      h('div', { className: 'mp-qr-hint' }, t('online.loginHint')),
      h(
        'div',
        { className: 'mp-qr-hint' },
        error !== ''
          ? error
          : status === 'scanned'
            ? t('online.statusscanned')
            : status === 'success'
              ? t('online.statussuccess')
              : status === 'expired'
                ? t('online.statusexpired')
                : t('online.statuswaiting'),
      ),
    ),
  )
}

var TAG_FIELDS = [
  ['title', 'page.metaTitle'],
  ['artist', 'page.artist'],
  ['album', 'page.album'],
  ['albumArtist', 'page.albumArtist'],
  ['year', 'page.year'],
  ['genre', 'page.genre'],
  ['track', 'page.trackNo'],
  ['disc', 'page.discNo'],
  ['composer', 'page.composer'],
  ['lyricist', 'page.lyricist'],
  ['comment', 'page.comment'],
]

var TAG_MATCH_FIELDS = [
  ['title', 'page.metaTitle'],
  ['artist', 'page.artist'],
  ['album', 'page.album'],
  ['year', 'page.year'],
  ['genre', 'page.genre'],
  ['track', 'page.trackNo'],
  ['disc', 'page.discNo'],
]

function tagSourceLabel(source) {
  if (source === 'netease') return t('page.sourceNetease')
  if (source === 'qq') return t('page.sourceQq')
  if (source === 'itunes') return t('page.sourceItunes')
  if (source === 'musicbrainz') return t('page.sourceMusicbrainz')
  return String(source || '')
}

function TagDialog(props) {
  var path = props.layer.props.path
  var tagsPair = useState(null)
  var tags = tagsPair[0]
  var setTags = tagsPair[1]
  var errorPair = useState('')
  var error = errorPair[0]
  var setError = errorPair[1]
  var busyPair = useState(false)
  var busy = busyPair[0]
  var setBusy = busyPair[1]
  var formPair = useState({})
  var form = formPair[0]
  var setForm = formPair[1]
  var coverPair = useState(null)
  var coverPreview = coverPair[0]
  var setCoverPreview = coverPair[1]
  var matchPair = useState(false)
  var matchOpen = matchPair[0]
  var setMatchOpen = matchPair[1]
  var matchPhasePair = useState('idle')
  var matchPhase = matchPhasePair[0]
  var setMatchPhase = matchPhasePair[1]
  var matchListPair = useState([])
  var matchResults = matchListPair[0]
  var setMatchResults = matchListPair[1]

  useEffect(
    function () {
      var cancelled = false
      getJson(API + 'tags?path=' + encodeURIComponent(path))
        .then(function (body) {
          if (cancelled) return
          var loaded = body.tags || {}
          setTags(loaded)
          var next = {}
          TAG_FIELDS.forEach(function (entry) {
            var value = loaded[entry[0]]
            next[entry[0]] = value === undefined || value === null ? '' : String(value)
          })
          next.lyrics = typeof loaded.lyrics === 'string' ? loaded.lyrics : ''
          setForm(next)
        })
        .catch(function (loadError) {
          if (!cancelled) setError(errorText(loadError))
        })
      return function () {
        cancelled = true
      }
    },
    [path],
  )

  function setField(key, value) {
    setForm(function (previous) {
      var next = Object.assign({}, previous)
      next[key] = value
      return next
    })
  }

  function field(key) {
    return h(
      'div',
      { className: 'mp-field' },
      h('label', null, t(TAG_FIELDS.find(function (entry) { return entry[0] === key })[1])),
      h('input', {
        type: 'text',
        value: form[key] || '',
        onChange: function (event) {
          setField(key, event.target.value)
        },
      }),
    )
  }

  function runMatch() {
    if (matchPhase === 'loading') return
    setMatchOpen(true)
    setMatchPhase('loading')
    setMatchResults([])
    setError('')
    postJson(API + 'online-search', {
      title: form.title || '',
      artist: form.artist || '',
      album: form.album || '',
    })
      .then(function (body) {
        setMatchResults(Array.isArray(body.results) ? body.results : [])
        setMatchPhase('ready')
      })
      .catch(function (matchError) {
        setError(errorText(matchError))
        setMatchPhase('error')
      })
  }

  function pickMatch(item) {
    var next = Object.assign({}, form)
    ;['title', 'artist', 'album', 'year', 'track', 'disc', 'genre'].forEach(function (key) {
      if (item[key] !== undefined && item[key] !== null && String(item[key]) !== '') {
        next[key] = String(item[key])
      }
    })
    setForm(next)
    if (item.coverUrl) setCoverPreview(item.coverUrl)
    setMatchOpen(false)
    setMatchPhase('idle')
  }

  function applyMatchField(item, key) {
    if (key === 'cover') {
      if (item.coverUrl) setCoverPreview(item.coverUrl)
      return
    }
    if (item[key] === undefined || item[key] === null || String(item[key]) === '') return
    setField(key, String(item[key]))
  }

  function openOnlineLyric() {
    pushLayer('onlineLyric', {
      track: { path: path, title: form.title || '', artist: form.artist || '' },
      onApply: function (lrc) {
        setField('lyrics', lrc)
      },
    })
  }

  function save() {
    if (busy) return
    setBusy(true)
    setError('')
    var current = player.getSnapshot()
    var playingThis =
      current.index >= 0 && current.queue[current.index] && current.queue[current.index].path === path
    if (playingThis) player.suspend()
    function restorePlayback() {
      if (playingThis && !player.getSnapshot().playing) player.toggle()
    }
    sendJson('PUT', API + 'tags', {
      path: path,
      tags: form,
      coverUrl: coverPreview || '',
    })
      .then(function () {
        setBusy(false)
        restorePlayback()
        popLayer()
        showToast(t('page.metaSaved'))
        void loadLibrary(true)
      })
      .catch(function (saveError) {
        setBusy(false)
        restorePlayback()
        setError(errorText(saveError))
      })
  }

  var coverSrc =
    coverPreview !== null && coverPreview !== undefined
      ? API + 'online/cover?url=' + encodeURIComponent(coverPreview)
      : API + 'cover?path=' + encodeURIComponent(path)

  return h(
    KitModal,
    {
      title: t('page.editMeta'),
      onClose: popLayer,
      footer: [
        h(Button, { key: 'cancel', variant: 'ghost', onClick: function () { popLayer() } }, t('page.cancel')),
        h(
          Button,
          {
            key: 'save',
            variant: 'primary',
            disabled: busy,
            onClick: save,
          },
          busy ? t('page.saving') : t('page.save'),
        ),
      ],
    },
h(
        'div',
        { className: 'mp-kit-body' },
        error !== '' ? h('div', { className: 'mp-qr-hint' }, error) : null,
        h(
          'div',
          { className: 'mp-tag-cover-row' },
          h(Cover, { src: coverSrc, className: 'mp-tag-cover', iconSize: 44 }),
          h(
            'div',
            { className: 'mp-tag-cover-actions' },
            h(Button, { icon: 'search', onClick: runMatch, disabled: matchPhase === 'loading' }, t('v2.match')),
            coverPreview !== null
              ? h(Button, { variant: 'ghost', icon: 'refresh', onClick: function () { setCoverPreview(null) } }, t('page.resetCover'))
              : null,
            h('div', { className: 'mp-set-desc' }, t('page.metaHint')),
          ),
        ),
        matchOpen
          ? h(
              'div',
              { className: 'mp-match' },
              h(
                'div',
                { className: 'mp-match-head' },
                h('span', null, t('page.onlineResults')),
                h('div', { className: 'mp-spacer', style: { marginLeft: 'auto' } }),
                h(IconButton, {
                  icon: 'x',
                  size: 14,
                  title: t('v2.close'),
                  onClick: function () {
                    setMatchOpen(false)
                  },
                }),
              ),
              matchPhase === 'loading'
                ? h('div', { className: 'mp-empty', style: { padding: '18px' } }, h(Spinner), t('page.onlineLoading'))
                : matchResults.length === 0
                  ? h('div', { className: 'mp-empty', style: { padding: '18px' } }, t('page.onlineEmpty'))
                  : matchResults.map(function (item, index) {
                      var chipFields = TAG_MATCH_FIELDS.filter(function (entry) {
                        return item[entry[0]] !== undefined && item[entry[0]] !== null && String(item[entry[0]]) !== ''
                      })
                      if (item.coverUrl) chipFields.push(['cover', 'v2.cover'])
                      return h(
                        'div',
                        { key: String(index), className: 'mp-match-row' },
                        h(
                          'button',
                          {
                            type: 'button',
                            className: 'mp-match-item',
                            onClick: function () {
                              pickMatch(item)
                            },
                          },
                          item.coverUrl
                            ? h(Cover, {
                                src: API + 'online/cover?url=' + encodeURIComponent(item.coverUrl),
                                className: 'mp-match-cover',
                                iconSize: 16,
                              })
                            : h('div', { className: 'mp-match-cover' }, icon('note', 16)),
                          h(
                            'div',
                            { className: 'mp-match-main' },
                            h('div', { className: 'mp-srow-title' }, item.title || ''),
                            h(
                              'div',
                              { className: 'mp-srow-sub' },
                              [item.artist, item.album, item.year, tagSourceLabel(item.source)]
                                .filter(function (part) {
                                  return part !== '' && part !== undefined && part !== null
                                })
                                .join(' · '),
                            ),
                          ),
                        ),
                        chipFields.length > 0
                          ? h(
                              'div',
                              { className: 'mp-match-fields' },
                              chipFields.map(function (entry) {
                                return h(
                                  'button',
                                  {
                                    key: entry[0],
                                    type: 'button',
                                    className: 'mp-match-chip',
                                    onClick: function () {
                                      applyMatchField(item, entry[0])
                                    },
                                  },
                                  t(entry[1]),
                                )
                              }),
                            )
                          : null,
                      )
                    }),
              h('div', { className: 'mp-np-setting-hint' }, t('v2.matchHint')),
              h('div', { className: 'mp-np-setting-hint' }, t('page.onlineHint')),

            )
          : null,
        h(
          'div',
          { className: 'mp-d-grid' },
          field('title'),
          field('artist'),
          field('album'),
          field('albumArtist'),
        ),
        h(
          'div',
          { className: 'mp-d-grid' },
          field('year'),
          field('genre'),
          field('track'),
          field('disc'),
        ),
        h(
          'div',
          { className: 'mp-d-grid' },
          field('composer'),
          field('lyricist'),
        ),
        h(
          'div',
          { className: 'mp-field' },
          h('label', null, t('page.comment')),
          h('input', {
            type: 'text',
            value: form.comment || '',
            onChange: function (event) {
              setField('comment', event.target.value)
            },
          }),
        ),
        h(
          'div',
          { className: 'mp-field' },
          h(
            'div',
            { className: 'mp-tag-lyrics-head' },
            h('label', null, t('page.lyrics')),
            h(Button, { variant: 'ghost', icon: 'search', onClick: openOnlineLyric }, t('page.onlineLyrics')),
          ),
          h('textarea', {
            rows: 6,
            value: form.lyrics || '',
            onChange: function (event) {
              setField('lyrics', event.target.value)
            },
          }),
        ),
        h('div', { className: 'mp-set-desc' }, (tags && tags.format) || ''),
      ),
      
  )
}

function ConfirmDialog(props) {
  var layer = props.layer
  return h(
    KitModal,
    {
      title: layer.props.title || '',
      small: true,
      onClose: popLayer,
      footer: [
        h(Button, { key: 'cancel', variant: 'ghost', onClick: function () { popLayer() } }, t('page.cancel')),
        h(
          Button,
          {
            key: 'ok',
            variant: 'primary',
            onClick: function () {
              var action = layer.props.onConfirm
              popLayer()
              if (typeof action === 'function') action()
            },
          },
          t('page.done'),
        ),
      ],
    },
    h('p', { className: 'mp-kit-text' }, layer.props.text || ''),
  )
}

function Toast(props) {
  var toast = useStore(toastStore)
  var HostToast = hostComponent('Toast')
  if (HostToast !== null && toast.text !== '') {
    return h(HostToast, {
      key: toast.seq,
      text: toast.text,
      holdMs: 1800,
      onDone: function () {
        if (toastStore.get().seq === toast.seq) toastStore.set({ text: '', seq: toast.seq })
      },
    })
  }
  return h(
    'div',
    { className: cx('mp-toast', toast.text !== '' && 'is-on'), role: 'status' },
    toast.text,
  )
}
