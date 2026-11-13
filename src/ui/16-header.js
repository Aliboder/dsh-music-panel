/**
 * shared content header: title + count, select / sort / search actions, and the
 * play-mode pills row used by both the local and online libraries.
 */

function HeadMenu(props) {
  var openPair = useState(false)
  var open = openPair[0]
  var setOpen = openPair[1]
  var ref = useRef(null)

  useEffect(
    function () {
      if (!open) return undefined
      if (props.hostMenu !== false && hostComponent('Menu') !== null) return undefined
      function onDown(event) {
        if (ref.current && ref.current.contains(event.target)) return
        setOpen(false)
      }
      function onKey(event) {
        if (event.key === 'Escape') setOpen(false)
      }
      document.addEventListener('pointerdown', onDown, true)
      window.addEventListener('keydown', onKey)
      return function () {
        document.removeEventListener('pointerdown', onDown, true)
        window.removeEventListener('keydown', onKey)
      }
    },
    [open],
  )

  var trigger = h(IconButton, {
    icon: props.icon,
    size: 17,
    title: props.title,
    active: open,
    onClick: function () {
      setOpen(!open)
    },
  })
  var HostMenu = props.hostMenu === false ? null : hostComponent('Menu')
  if (HostMenu !== null) {
    var hostItems = props.items.map(function (item) {
      if (item.separator) return { type: 'separator', id: item.key }
      return {
        id: item.key,
        label: item.label,
        icon: item.icon ? icon(item.icon, 13) : undefined,
        disabled: item.disabled === true,
        danger: item.danger === true,
      }
    })
    var selectedId
    props.items.forEach(function (item) {
      if (item.active === true && selectedId === undefined) selectedId = item.key
    })
    return h(HostMenu, {
      open: open,
      anchor: trigger,
      items: hostItems,
      selectedId: selectedId,
      onSelect: function (id) {
        setOpen(false)
        var chosen = null
        props.items.forEach(function (item) {
          if (chosen === null && item.key === id) chosen = item
        })
        if (chosen !== null && typeof chosen.run === 'function') chosen.run()
      },
      onClose: function () {
        setOpen(false)
      },
      side: 'bottom',
      align: 'end',
      portal: true,
      compact: true,
      className: 'mp-headmenu-host',
    })
  }

  return h(
    'div',
    { className: 'mp-headmenu', ref: ref },
    trigger,
    open
      ? h(
          'div',
          { className: 'mp-headmenu-pop', role: 'menu' },
          props.items.map(function (item) {
            if (item.separator) return h('hr', { key: item.key, className: 'mp-headmenu-sep' })
            return h(
              'button',
              {
                key: item.key,
                type: 'button',
                role: 'menuitem',
                className: cx('mp-headmenu-item', item.active === true && 'is-on'),
                onClick: function () {
                  setOpen(false)
                  if (typeof item.run === 'function') item.run()
                },
              },
              item.icon ? icon(item.icon, 13) : null,
              h('span', { className: 'mp-headmenu-label' }, item.label),
              item.hint ? h('span', { className: 'mp-headmenu-hint' }, item.hint) : null,
            )
          }),
        )
      : null,
  )
}

function SelectMenu(props) {
  return h(HeadMenu, {
    icon: 'checkCircle',
    title: t('page.select'),
    items: [
      { key: 'all', icon: 'check', label: t('v2.selAll'), run: props.onAll },
      { key: 'none', icon: 'x', label: t('v2.selNone'), run: props.onNone },
      { key: 'range', icon: 'target', label: t('v2.selRange'), run: props.onRange },
      { key: 'invert', icon: 'refresh', label: t('v2.selInvert'), run: props.onInvert },
    ],
  })
}

function SortMenu() {
  var prefs = usePrefs()
  var fields = [
    ['title', t('v2.sortTitle')],
    ['artist', t('v2.sortArtist')],
    ['duration', t('v2.sortDuration')],
    ['added', t('v2.sortAdded')],
    ['recent', t('v2.sortRecent')],
  ]
  var items = fields.map(function (entry) {
    return {
      key: entry[0],
      label: entry[1],
      active: prefs.sortBy === entry[0],
      run: function () {
        setPrefs({ sortBy: entry[0] })
      },
    }
  })
  items.push({ key: 'sep', separator: true })
  items.push({
    key: 'asc',
    label: t('page.sortAsc'),
    hint: '↑',
    active: prefs.sortDir === 'asc',
    run: function () {
      setPrefs({ sortDir: 'asc' })
    },
  })
  items.push({
    key: 'desc',
    label: t('page.sortDesc'),
    hint: '↓',
    active: prefs.sortDir === 'desc',
    run: function () {
      setPrefs({ sortDir: 'desc' })
    },
  })
  return h(HeadMenu, { icon: 'sort', title: t('page.sort'), items: items, hostMenu: false })
}

function ContentHeader(props) {
  var filter = useContentFilter()
  var openPair = useState(false)
  var open = openPair[0]
  var setOpen = openPair[1]
  var inputRef = useRef(null)

  // A different list is a different search scope; never carry the query over.
  useEffect(
    function () {
      clearContentFilter()
      setOpen(false)
    },
    [props.title],
  )

  useEffect(
    function () {
      if (!open) return
      var input = inputRef.current
      if (input === null) return
      input.focus()
      if (typeof input.select === 'function') input.select()
    },
    [open],
  )

  function closeSearch() {
    setOpen(false)
    clearContentFilter()
  }

  function onSearchKey(event) {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeSearch()
    }
  }

  return h(
    'header',
    { className: 'mp-content-head' },
    h('h1', { className: 'mp-title', title: props.title }, props.title),
    h('span', { className: 'mp-count' }, props.count > 0 ? t('page.trackCountUnit', { n: props.count }) : ''),
    props.selecting === true && (props.selectedCount || 0) > 0
      ? h('span', { className: 'mp-sel-count' }, t('page.selectedCount', { n: props.selectedCount }))
      : null,
    h(
      'div',
      { className: 'mp-head-actions' },
      open
        ? h(
            'div',
            { className: 'mp-head-search' },
            icon('search', 14),
            h('input', {
              ref: inputRef,
              type: 'search',
              className: 'mp-head-search-input',
              value: filter.query,
              placeholder: t('page.searchInView'),
              'aria-label': t('page.searchInView'),
              onChange: function (event) {
                setContentFilter(event.target.value)
              },
              onKeyDown: onSearchKey,
            }),
            filter.query !== ''
              ? h(
                  'button',
                  {
                    type: 'button',
                    className: 'mp-head-search-clear',
                    title: t('page.searchClear'),
                    'aria-label': t('page.searchClear'),
                    onClick: function () {
                      setContentFilter('')
                      if (inputRef.current !== null) inputRef.current.focus()
                    },
                  },
                  icon('x', 12),
                )
              : null,
            h(
              'button',
              {
                type: 'button',
                className: 'mp-head-search-done',
                title: t('page.searchClose'),
                'aria-label': t('page.searchClose'),
                onClick: closeSearch,
              },
              t('page.searchClose'),
            ),
          )
        : h(SelectMenu, {
            onAll: props.onAll,
            onNone: props.onNone,
            onRange: props.onRange,
            onInvert: props.onInvert,
          }),
      open ? null : h(SortMenu),
      open
        ? null
        : h(IconButton, {
            icon: 'search',
            size: 17,
            title: t('page.searchInView'),
            onClick: function () {
              setOpen(true)
            },
          }),
    ),
  )
}

