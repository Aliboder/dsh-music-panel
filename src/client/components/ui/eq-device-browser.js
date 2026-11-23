/**
 * AutoEQ headphone presets: one searchable device library shared by the
 * equalizer panel and the audio-effects window.
 */

var EQ_DEVICE_PAGE = 40

/** AutoEQ stores the measurement rig family; show it in the user's language. */
function eqFormLabel(form) {
  var value = String(form || '')
  if (value.indexOf('in-ear') !== -1) return t('eq.formInEar')
  if (value.indexOf('over-ear') !== -1) return t('eq.formOverEar')
  if (value.indexOf('earbud') !== -1) return t('eq.formEarbud')
  return value
}

function EqDeviceBrowser(props) {
  var searchPair = useState('')
  var search = searchPair[0]
  var setSearch = searchPair[1]
  var foundPair = useState([])
  var found = foundPair[0]
  var setFound = foundPair[1]
  var loadingPair = useState(false)
  var loading = loadingPair[0]
  var setLoading = loadingPair[1]
  var errorPair = useState('')
  var searchError = errorPair[0]
  var setSearchError = errorPair[1]
  var totalPair = useState(0)
  var total = totalPair[0]
  var setTotal = totalPair[1]
  var morePair = useState(false)
  var loadingMore = morePair[0]
  var setLoadingMore = morePair[1]
  var searchSeq = useRef(0)
  var activeId = props.value === undefined || props.value === null ? '' : String(props.value)

  function fetchDevices(text, offset, append) {
    var seq = searchSeq.current + 1
    searchSeq.current = seq
    if (append) setLoadingMore(true)
    else setLoading(true)
    getJson(
      API +
        'eq/presets?q=' +
        encodeURIComponent(text) +
        '&limit=' +
        EQ_DEVICE_PAGE +
        '&offset=' +
        offset,
    )
      .then(function (body) {
        if (searchSeq.current !== seq) return
        var rows = Array.isArray(body.results) ? body.results : []
        setFound(function (previous) {
          return append ? previous.concat(rows) : rows
        })
        setTotal(Number(body.total) || 0)
        setSearchError('')
      })
      .catch(function (error) {
        if (searchSeq.current !== seq) return
        if (!append) setFound([])
        setSearchError(error && error.message ? error.message : t('eq.searchFailed'))
      })
      .then(function () {
        if (searchSeq.current !== seq) return
        setLoading(false)
        setLoadingMore(false)
      })
  }

  useEffect(
    function () {
      var text = String(search || '').trim()
      var timer = setTimeout(
        function () {
          fetchDevices(text, 0, false)
        },
        text === '' ? 0 : 220,
      )
      return function () {
        clearTimeout(timer)
      }
    },
    [search],
  )

  function apply(entry) {
    if (!entry || !Array.isArray(entry.bands)) return
    if (typeof props.onChange === 'function') props.onChange(entry)
  }

  function loadMore() {
    if (loading || loadingMore) return
    fetchDevices(String(search || '').trim(), found.length, true)
  }

  var selectedName = ''
  if (activeId !== '') {
    var parts = activeId.split('::')
    selectedName = parts.length > 2 ? parts.slice(2).join('::') : activeId
  }
  var tiles = found.map(function (entry) {
    var caption = String(entry.source || '')
    if (entry.form) caption += (caption === '' ? '' : ' · ') + eqFormLabel(entry.form)
    return h(EqPresetTile, {
      key: entry.id,
      name: entry.name,
      caption: caption,
      bands: entry.bands,
      active: activeId === entry.id,
      onClick: function () {
        apply(entry)
      },
    })
  })
  return h(
    'div',
    { className: cx('mp-eq-device', props.className) },
    h('input', {
      type: 'text',
      className: 'mp-eq-search',
      value: search,
      placeholder: t('eq.searchDevice'),
      'aria-label': t('eq.searchDevice'),
      onChange: function (event) {
        setSearch(event.target.value)
      },
    }),
    selectedName !== ''
      ? h('div', { className: 'mp-eq-device-current' }, t('eq.deviceCurrent', { name: selectedName }))
      : null,
    h(
      'div',
      { className: 'mp-eq-device-scroll' },
      tiles.length > 0
        ? h('div', { className: 'mp-eq-grid' }, tiles)
        : h(
            'div',
            { className: 'mp-eq-empty' },
            h(
              'span',
              { className: 'mp-eq-empty-title' },
              loading ? t('eq.searching') : searchError !== '' ? searchError : t('eq.searchEmpty'),
            ),
          ),
    ),
    found.length > 0 && found.length < total
      ? h('button', { type: 'button', className: 'mp-eq-more', onClick: loadMore }, loadingMore ? t('eq.searching') : t('eq.loadMore'))
      : null,
    total > 0
      ? h('div', { className: 'mp-eq-device-count' }, t('eq.deviceCount', { shown: found.length, total: total }))
      : null,
  )
}
