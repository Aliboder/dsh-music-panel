/**
 * 匹配歌词 — the manual lyric-match window, laid out from Folia's
 * `LyricMatchWindow.tsx` and drawn by us rather than by the host frame:
 *
 *   host layer  headless modal (stacking only) — transparent, full screen
 *   scrim       rgba(0,0,0,.6) + blur, click outside closes
 *   window      min(1024px, 100vw-48px), max-h 80vh, rounded-2xl, zinc-900/95
 *   header      px-6 py-4 border-b: title, song line, file line, close
 *   body        left 62% (tabs · search · results) | right 38% (cover · info · preview)
 *   footer      px-6 py-4 border-t, 取消 / 保存
 */

function lyricMatchBadge(label, tone) {
  var palette =
    tone === 'blue'
      ? { bg: 'rgba(59,130,246,.14)', fg: '#7fb0ff' }
      : tone === 'green'
        ? { bg: 'rgba(52,199,123,.14)', fg: '#5fd39a' }
        : { bg: 'rgba(168,120,255,.14)', fg: '#c39bff' }
  return h(
    'span',
    {
      key: 'badge-' + String(label),
      style: {
        padding: '1px 7px',
        borderRadius: '6px',
        fontSize: '11px',
        lineHeight: '16px',
        background: palette.bg,
        color: palette.fg,
      },
    },
    label,
  )
}

/** One of the match window's "take this from the pick" switches. */
function matchSwitchRow(label, value, onChange, key) {
  return h(
    'div',
    {
      key: key,
      style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' },
    },
    h('span', { style: { fontSize: '13px', opacity: '.8' } }, label),
    h(Switch, { value: value === true, label: label, onChange: onChange }),
  )
}

function LyricMatchDialog(props) {
  var layer = props.layer
  var track = (layer.props && layer.props.track) || {}
  var onApply = (layer.props && (layer.props.onApply || layer.props.onApplied)) || null
  var closeSheet = typeof props.onClose === 'function' ? props.onClose : popLayer

  var sourcesPair = useState([])
  var sources = sourcesPair[0]
  var setSources = sourcesPair[1]
  var sourcePair = useState('netease')
  var source = sourcePair[0]
  var setSource = sourcePair[1]
  var queryPair = useState(String(track.title || ''))
  var query = queryPair[0]
  var setQuery = queryPair[1]
  var resultsPair = useState([])
  var results = resultsPair[0]
  var setResults = resultsPair[1]
  var selectedPair = useState(null)
  var selected = selectedPair[0]
  var setSelected = selectedPair[1]
  var previewPair = useState(null)
  var preview = previewPair[0]
  var setPreview = previewPair[1]
  var phasePair = useState('idle')
  var phase = phasePair[0]
  var setPhase = phasePair[1]
  var errorPair = useState('')
  var error = errorPair[0]
  var setError = errorPair[1]
  var savingPair = useState(false)
  var saving = savingPair[0]
  var setSaving = savingPair[1]
  // Folia's three switches under the cover, and the "do not search for this one" mark.
  // They only exist when the window applies the pick to the song's record (the tag
  // editor's own use of this window just returns the text).
  var applyToRecord = layer.props && layer.props.applyToRecord === true
  // Folia's OnlineSongLyricMatch only picks lyrics: an online song has no file to retag.
  var onlineTrack = layer.props && layer.props.online === true
  var coverPair = useState(onlineTrack !== true)
  var useCover = coverPair[0]
  var setUseCover = coverPair[1]
  var metadataPair = useState(false)
  var useMetadata = metadataPair[0]
  var setUseMetadata = metadataPair[1]
  var lyricsPair = useState(true)
  var useLyrics = lyricsPair[0]
  var setUseLyrics = lyricsPair[1]
  var noAutoPair = useState(false)
  var noAutoMatch = noAutoPair[0]
  var setNoAutoMatch = noAutoPair[1]

  var target = {
    title: String(track.title || '').trim(),
    artist: String(track.artist || '').trim(),
    album: String(track.album || '').trim(),
    durationMs: (Number(track.durationSec) || 0) * 1000,
  }

  var FALLBACK_SOURCES = [
    { id: 'netease', label: 'NetEase Cloud Music' },
    { id: 'amll', label: 'AMLLDB' },
    { id: 'qq', label: 'QQ Music' },
    { id: 'kugouLite', label: 'KuGou Music' },
    { id: 'qishui', label: 'Qishui' },
  ]

  useEffect(function () {
    getJson(API + 'lyric-match/sources')
      .then(function (body) {
        var list = Array.isArray(body.sources) ? body.sources : []
        setSources(list.length > 0 ? list : FALLBACK_SOURCES)
      })
      .catch(function (sourcesError) {
        setSources(FALLBACK_SOURCES)
        setError(errorText(sourcesError))
      })
  }, [])

  function targetQuery() {
    return (
      '&title=' + encodeURIComponent(target.title) +
      '&artist=' + encodeURIComponent(target.artist) +
      '&album=' + encodeURIComponent(target.album) +
      '&duration=' + encodeURIComponent(String(Math.round(target.durationMs / 1000)))
    )
  }

  function runSearch(nextQuery) {
    var text = String(nextQuery === undefined ? query : nextQuery).trim()
    if (text === '' || phase === 'loading') return
    setPhase('loading')
    setError('')
    setResults([])
    setSelected(null)
    setPreview(null)
    getJson(
      API +
        'lyric-match/search?source=' +
        encodeURIComponent(source) +
        '&q=' +
        encodeURIComponent(text) +
        targetQuery(),
    )
      .then(function (body) {
        setResults(Array.isArray(body.candidates) ? body.candidates : [])
        if (body.error) setError(String(body.error))
        setPhase('ready')
      })
      .catch(function (searchError) {
        setError(errorText(searchError))
        setPhase('error')
      })
  }

  function choose(candidate) {
    setSelected(candidate)
    setPreview(null)
    getJson(
      API +
        'lyric-match/preview?source=' +
        encodeURIComponent(candidate.source) +
        '&id=' +
        encodeURIComponent(candidate.id),
    )
      .then(function (body) {
        setPreview(body)
      })
      .catch(function (previewError) {
        setPreview({ lrc: '', error: errorText(previewError) })
      })
  }

  function linesOf(body) {
    if (body === null) return []
    if (Array.isArray(body.lines) && body.lines.length > 0) {
      return body.lines.map(function (line) {
        return { text: String(line.text || ''), translation: '' }
      })
    }
    return parseLrcText(body.lrc || '')
  }

  function canSave() {
    if (saving) return false
    if (noAutoMatch) return true
    if (selected === null) return false
    if (useLyrics && (preview === null || String(preview.lrc || '').trim() === '')) return false
    return useLyrics || useMetadata || useCover
  }

  function save() {
    if (!canSave()) return
    setSaving(true)
    setError('')
    if (applyToRecord) {
      // Folia's `applyLocalSongMatchSelection`: lyrics onto the song's record, the chosen
      // fields onto the file's tags. `noAutoMatch` is the "stop matching this song" answer.
      postJson(API + 'lyrics/match-apply', {
        path: track.path,
        provider: selected ? String(selected.source || '') : '',
        id: selected ? String(selected.id || '') : '',
        title: selected ? String(selected.title || '') : '',
        artist: selected ? (Array.isArray(selected.artists) ? selected.artists.join(' / ') : '') : '',
        album: selected ? String(selected.album || '') : '',
        coverUrl: selected ? String(selected.coverUrl || '') : '',
        lrc: preview && typeof preview.lrc === 'string' ? preview.lrc : '',
        wordLevel: preview ? preview.wordLevel === true : false,
        applyLyrics: useLyrics === true && noAutoMatch !== true,
        applyMetadata: useMetadata === true && noAutoMatch !== true,
        applyCover: useCover === true && noAutoMatch !== true,
        noAutoMatch: noAutoMatch === true,
        online: onlineTrack === true,
      })
        .then(function (answer) {
          setSaving(false)
          closeSheet()
          var onSaved = layer.props && layer.props.onSaved
          if (typeof onSaved === 'function') onSaved()
          if (typeof showToast === 'function') {
            showToast(answer && answer.warning ? String(answer.warning) : t('page.lyricsSaved'))
          }
        })
        .catch(function (saveError) {
          setSaving(false)
          setError(errorText(saveError))
        })
      return
    }
    if (preview === null || String(preview.lrc || '').trim() === '') {
      setSaving(false)
      return
    }
    var lines = linesOf(preview)
    if (preview.translation) mergeLyricTranslation(lines, preview.translation)
    var lrc = preview.translation ? buildTranslatedLrc(lines, preview.lrc) : preview.lrc
    if (typeof onApply === 'function') {
      setSaving(false)
      closeSheet()
      onApply(lrc)
      return
    }
    if (!track.path) {
      setSaving(false)
      setError(t('sheet.noLocalFile'))
      return
    }
    postJson(API + 'lyrics/save', { path: track.path, lrc: lrc })
      .then(function () {
        setSaving(false)
        closeSheet()
      })
      .catch(function (saveError) {
        setSaving(false)
        setError(errorText(saveError))
      })
  }

  var fileName = onlineTrack ? '' : track.path ? String(track.path).split(/[\\/]/).pop() : ''
  var songLine = [target.title, target.artist, target.album].filter(Boolean).join(' · ')
  var previewLines = mpPreviewLines(preview)

  var closeButton = h(
    'button',
    {
      type: 'button',
      title: t('page.close'),
      onClick: closeSheet,
      style: {
        width: '32px',
        height: '32px',
        flex: '0 0 auto',
        display: 'grid',
        placeItems: 'center',
        border: '0',
        borderRadius: '8px',
        background: 'transparent',
        color: 'inherit',
        cursor: 'pointer',
      },
    },
    icon('x', 20),
  )

  var header = h(
    'div',
    {
      style: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        padding: '16px 24px',
        borderBottom: '1px solid rgba(255,255,255,.10)',
        flex: '0 0 auto',
      },
    },
    h(
      'div',
      { style: { minWidth: '0', flex: '1 1 auto' } },
      h('h2', { style: { margin: '0', fontSize: '18px', fontWeight: '700' } }, t('sheet.matchLyricsTitle')),
      h(
        'p',
        { style: { margin: '4px 0 0', fontSize: '12px', lineHeight: '18px', opacity: '.6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
        songLine,
      ),
      fileName !== ''
        ? h(
            'div',
            {
              title: fileName,
              style: { display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', fontSize: '11px', opacity: '.55', minWidth: '0' },
            },
            icon('note', 12),
            h('span', { style: { flex: '0 0 auto' } }, t('sheet.file') + ':'),
            h('span', { style: { minWidth: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, fileName),
          )
        : null,
    ),
    closeButton,
  )

  var footer = h(
    'div',
    {
      style: {
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '12px',
        padding: '16px 24px',
        borderTop: '1px solid rgba(255,255,255,.10)',
        flex: '0 0 auto',
      },
    },
    h(
      'button',
      {
        type: 'button',
        onClick: closeSheet,
        style: { padding: '8px 20px', borderRadius: '8px', border: '0', background: 'rgba(255,255,255,.05)', color: 'inherit', font: 'inherit', fontSize: '14px', cursor: 'pointer' },
      },
      t('page.cancel'),
    ),
    h(
      'button',
      {
        type: 'button',
        disabled: !canSave(),
        onClick: save,
        style: {
          padding: '8px 20px',
          borderRadius: '8px',
          border: '0',
          background: !canSave() ? 'rgba(59,130,246,.5)' : '#3b82f6',
          color: '#fff',
          font: 'inherit',
          fontSize: '14px',
          cursor: !canSave() ? 'default' : 'pointer',
        },
      },
      saving ? t('sheet.saving') : t('page.save'),
    ),
  )

  var leftPanel = h(
    'div',
    {
      style: {
        width: '62%',
        flex: '0 1 62%',
        // border-box: the 1px divider counts inside the 62%, otherwise 62%+38%+2px
        // overflows and the right column is clipped at the window edge.
        boxSizing: 'border-box',
        minWidth: '0',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid rgba(255,255,255,.10)',
      },
    },
    h(
      'div',
      { style: { padding: '16px' } },
      h(
        'div',
        {
          style: {
            display: 'flex',
            gap: '16px',
            paddingBottom: '8px',
            marginBottom: '14px',
            borderBottom: '1px solid rgba(255,255,255,.10)',
            overflowX: 'auto',
          },
        },
        sources.map(function (entry) {
          var active = entry.id === source
          return h(
            'button',
            {
              key: entry.id,
              type: 'button',
              onClick: function () {
                setSource(entry.id)
                setResults([])
                setSelected(null)
                setPreview(null)
                runSearch(query)
              },
              style: {
                padding: '0 4px 8px',
                border: '0',
                borderBottom: '2px solid ' + (active ? '#60a5fa' : 'transparent'),
                background: 'transparent',
                color: active ? '#8fb8ff' : 'rgba(255,255,255,.55)',
                font: 'inherit',
                fontSize: '14px',
                fontWeight: active ? '600' : '400',
                whiteSpace: 'nowrap',
                cursor: 'pointer',
              },
            },
            entry.label,
          )
        }),
      ),
      h(
        'div',
        { style: { display: 'flex', gap: '12px' } },
        h(
          'div',
          {
            style: {
              flex: '1 1 auto',
              minWidth: '0',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              borderRadius: '16px',
              border: '1px solid rgba(255,255,255,.10)',
              background: 'rgba(255,255,255,.05)',
              padding: '12px 16px',
            },
          },
          h('span', { style: { opacity: '.4', display: 'flex' } }, icon('search', 18)),
          h('input', {
            type: 'text',
            value: query,
            autoFocus: true,
            placeholder: t('sheet.searchForSong'),
            onChange: function (event) {
              setQuery(event.target.value)
            },
            onKeyDown: function (event) {
              if (event.key === 'Enter') runSearch()
            },
            style: { flex: '1 1 auto', minWidth: '0', background: 'transparent', border: '0', color: 'inherit', font: 'inherit', fontSize: '14px', outline: 'none' },
          }),
        ),
        h(
          'button',
          {
            type: 'button',
            onClick: function () {
              runSearch()
            },
            style: { padding: '0 16px', borderRadius: '16px', border: '0', background: 'rgba(59,130,246,.22)', color: '#9dc0ff', font: 'inherit', fontSize: '14px', fontWeight: '500', cursor: 'pointer', whiteSpace: 'nowrap' },
          },
          phase === 'loading' ? t('sheet.searching') : t('sheet.search'),
        ),
      ),
      error !== '' ? h('div', { style: { marginTop: '8px', fontSize: '12px', color: '#f87171' } }, error) : null,
    ),
    h(
      'div',
      { style: { flex: '1 1 auto', minHeight: '0', overflowY: 'auto', padding: '0 16px 16px' } },
      phase === 'loading'
        ? h('div', { style: { height: '160px', display: 'grid', placeItems: 'center', opacity: '.5', fontSize: '14px' } }, t('sheet.searching'))
        : results.length === 0
          ? h(
              'div',
              { style: { height: '160px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: '.5', fontSize: '14px' } },
              icon('note', 40),
              h('span', null, t('sheet.noResults')),
            )
          : h(
              'div',
              { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
              results.map(function (candidate) {
                var isSelected = selected !== null && selected.id === candidate.id && selected.source === candidate.source
                return h(
                  'div',
                  {
                    key: candidate.source + ':' + candidate.id,
                    onClick: function () {
                      choose(candidate)
                    },
                    style: {
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid ' + (isSelected ? 'rgba(59,130,246,.5)' : 'rgba(255,255,255,.05)'),
                      background: isSelected ? 'rgba(59,130,246,.2)' : 'rgba(255,255,255,.05)',
                      cursor: 'pointer',
                    },
                  },
                  h(
                    'div',
                    { style: { width: '40px', height: '40px', flex: '0 0 auto', borderRadius: '8px', overflow: 'hidden', background: 'rgba(255,255,255,.06)' } },
                    candidate.coverUrl
                      ? h('img', { src: candidate.coverUrl, alt: '', style: { width: '100%', height: '100%', objectFit: 'cover' } })
                      : null,
                  ),
                  h(
                    'div',
                    { style: { flex: '1 1 auto', minWidth: '0' } },
                    h(
                      'div',
                      { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
                      h('span', { style: { fontSize: '14px', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, candidate.title),
                      h(
                        'span',
                        {
                          style: {
                            flex: '0 0 auto',
                            padding: '0 6px',
                            borderRadius: '6px',
                            fontSize: '10px',
                            lineHeight: '16px',
                            fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                            background: 'rgba(59,130,246,.12)',
                            color: '#7fb0ff',
                          },
                        },
                        String(candidate.score) + '%',
                      ),
                    ),
                    h(
                      'div',
                      { style: { fontSize: '12px', opacity: '.6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
                      [candidate.artists.join(' / '), candidate.album].filter(Boolean).join(' · '),
                    ),
                  ),
                  isSelected ? h('span', { style: { color: '#7fb0ff', display: 'flex' } }, icon('check', 16)) : null,
                )
              }),
            ),
    ),
  )

  var rightPanel = h(
    'div',
    {
      style: {
        width: '38%',
        flex: '0 0 38%',
        boxSizing: 'border-box',
        minWidth: '0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '24px',
        borderLeft: '1px solid rgba(255,255,255,.10)',
        minHeight: '0',
        overflow: 'hidden',
      },
    },
    h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', flex: '0 1 auto', minHeight: '0', overflowY: 'auto' } },
      h(
        'div',
        { style: { width: '128px', height: '128px', minHeight: '64px', flex: '0 0 auto', borderRadius: '16px', overflow: 'hidden', background: 'rgba(255,255,255,.06)', boxShadow: '0 6px 18px rgba(0,0,0,.35)' } },
        selected && selected.coverUrl
          ? h('img', { src: selected.coverUrl, alt: '', style: { width: '100%', height: '100%', objectFit: 'cover' } })
          : null,
      ),
      h(
        'div',
        { style: { width: '100%', marginTop: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', textAlign: 'center' } },
        h(
          'h3',
          { style: { margin: '0', padding: '0 8px', fontSize: '16px', fontWeight: '700', lineHeight: '1.35', display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical', overflow: 'hidden' } },
          selected ? selected.title : '',
        ),
        h('div', { style: { fontSize: '14px', fontWeight: '500', opacity: '.75', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, selected ? selected.artists.join(' / ') : ''),
        h('div', { style: { fontSize: '12px', opacity: '.6', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, selected ? selected.album : ''),
      ),
      // Folia's switches: each part of the pick can be left as the file has it. An online
      // song has no file, and Folia's OnlineSongLyricMatch shows no switches at all.
      applyToRecord && onlineTrack !== true
        ? h(
            'div',
            { style: { width: '100%', marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' } },
            h(
              'div',
              {
                style: Object.assign(
                  { display: 'flex', flexDirection: 'column', gap: '10px' },
                  noAutoMatch ? { opacity: '.45', pointerEvents: 'none' } : {},
                ),
              },
              matchSwitchRow(t('sheet.matchApplyLyrics'), useLyrics, setUseLyrics, 'apply-lyrics'),
              onlineTrack ? null : matchSwitchRow(t('sheet.matchApplyMetadata'), useMetadata, setUseMetadata, 'apply-metadata'),
              onlineTrack ? null : matchSwitchRow(t('sheet.matchApplyCover'), useCover, setUseCover, 'apply-cover'),
            ),
            matchSwitchRow(t('sheet.matchNoAutoMatch'), noAutoMatch, setNoAutoMatch, 'no-auto'),
          )
        : null,
    ),
    h(
      'div',
      { style: { width: '100%', height: '112px', flex: '0 0 auto', marginTop: 'auto', display: 'flex', flexDirection: 'column' } },
      h(
        'div',
        { style: { display: 'flex', flexWrap: 'wrap', rowGap: '4px', columnGap: '6px', justifyContent: 'flex-end', marginBottom: '6px', flex: '0 0 auto' } },
        preview && preview.wordLevel ? lyricMatchBadge(t('sheet.badgeWord'), 'blue') : null,
        preview && preview.translation ? lyricMatchBadge(t('sheet.badgeTranslation'), 'green') : null,
        preview && preview.romaji ? lyricMatchBadge(t('sheet.badgeRomaji'), 'purple') : null,
      ),
      h(LyricMatchPreview, {
        lines: previewLines,
        height: 92,
        activeColor: '#60a5fa',
        mutedColor: 'rgba(255,255,255,.3)',
        emptyLabel: selected ? t('sheet.previewEmpty') : '',
      }),
    ),
  )

  // The window itself. Shown in the panel as an overlay, or inline inside the tag
  // editor (which is a host modal of its own, so an overlay there would be behind it).
  var windowEl = h(
    'div',
    {
      className: 'mp-lym-window',
      onClick: function (event) {
        event.stopPropagation()
      },
      style: {
        position: 'relative',
        width: props.embedded === true ? '100%' : 'min(1024px, 100%)',
        height: props.embedded === true ? 'min(640px, 70vh)' : 'min(720px, 100%)',
        maxHeight: '100%',
        minHeight: '320px',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '16px',
        border: '1px solid rgba(255,255,255,.10)',
        boxSizing: 'border-box',
        background: 'rgba(24,24,27,.95)',
        boxShadow: props.embedded === true ? 'none' : '0 25px 50px -12px rgba(0,0,0,.7)',
        backdropFilter: 'blur(12px)',
        overflow: 'hidden',
      },
    },
    header,
    h('div', { style: { flex: '1 1 auto', display: 'flex', minHeight: '0', overflow: 'hidden' } }, leftPanel, rightPanel),
    footer,
  )

  if (props.embedded === true) {
    return h('div', { className: 'mp-lym-embedded', style: { width: '100%' } }, windowEl)
  }

  return h(
    'div',
    {
      className: 'mp-lym-layer',
      // over the player page (70); `overAllLayers` mirrors Folia's escape hatch.
      style: {
        position: 'absolute',
        inset: '0',
        zIndex: String(props.overAllLayers === true ? MP_Z.overAll : MP_Z.overPage),
      },
    },
    h(
      'div',
      {
        className: 'mp-lym-overlay',
        style: {
          position: 'absolute',
          inset: '0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          overflow: 'auto',
          background: 'rgba(0,0,0,.6)',
          backdropFilter: 'blur(20px)',
        },
        onClick: function (event) {
          if (event.target === event.currentTarget) closeSheet()
        },
      },
      windowEl,
    ),
  )
}
