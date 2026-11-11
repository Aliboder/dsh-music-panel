/**
 * navigation: one model, two shapes (top section bar or left rail).
 *
 * Both shapes render `navGroupsFor`, so switching the layout never changes
 * what is reachable — only where it sits. Playlists are first-class items,
 * not a "playlists" list page.
 */

function navItemContextMenu(item, active) {
  if (!item.localPlaylistId) return undefined
  return function (event) {
    event.preventDefault()
    var id = item.localPlaylistId
    var name = item.label
    pushLayer('confirm', {
      title: t('page.delete'),
      text: t('page.deleteConfirm', { name: name }),
      onConfirm: function () {
        if (active === item.key) setNav('songs')
        void removePlaylist(id)
      },
    })
  }
}

function NavRail(props) {
  var groups = navGroupsFor(props.source, props.favoritesCount)
  var active = activeNavKey(props.nav)
  return h(
    'nav',
    { className: 'mp-nav', 'aria-label': t('page.tabLocal') },
    groups.map(function (group) {
      return h(
        'div',
        { className: 'mp-nav-group', key: group.label },
        h(
          'div',
          { className: 'mp-nav-head' },
          h('div', { className: 'mp-nav-label' }, group.label),
          group.action
            ? h(
                'button',
                {
                  type: 'button',
                  className: 'mp-nav-act',
                  title: group.action.title,
                  'aria-label': group.action.title,
                  onClick: group.action.run,
                },
                icon(group.action.icon, 12),
              )
            : null,
        ),
        group.items.map(function (item) {
          return h(
            'button',
            {
              key: item.key,
              type: 'button',
              className: cx('mp-nav-item', active === item.key && 'is-on'),
              'aria-current': active === item.key ? 'page' : undefined,
              title: item.label,
              onClick: function () {
                activateNavItem(item)
              },
              onContextMenu: navItemContextMenu(item, active),
              onMouseEnter: item.onlinePlaylist
                ? function () {
                    prefetchOnlinePlaylist(item.onlinePlaylist)
                  }
                : undefined,
              onFocus: item.onlinePlaylist
                ? function () {
                    prefetchOnlinePlaylist(item.onlinePlaylist)
                  }
                : undefined,
            },
            icon(item.icon, 15),
            h('span', null, item.label),
            item.count !== null && item.count !== undefined
              ? h('em', { className: 'mp-nav-count' }, String(item.count))
              : null,
          )
        }),
      )
    }),
  )
}

var MAX_PLAYLIST_TABS = 3

function SectionPlaylistOverflow(props) {
  var openPair = useState(false)
  var open = openPair[0]
  var setOpen = openPair[1]
  var buttonRef = useRef(null)
  var posPair = useState(null)
  var pos = posPair[0]
  var setPos = posPair[1]
  var active = activeNavKey(uiStore.get().nav)

  useEffect(
    function () {
      if (!open) return undefined
      function place() {
        var button = buttonRef.current
        if (!button) return
        var rect = button.getBoundingClientRect()
        var width = Math.min(720, window.innerWidth - 24)
        var left = Math.max(12, Math.min(window.innerWidth - width - 12, rect.right - width))
        setPos({ left: left + 'px', top: rect.bottom + 8 + 'px', width: width + 'px' })
      }
      function close(event) {
        if (buttonRef.current && buttonRef.current.contains(event.target)) return
        var pop = document.querySelector('.mp-playlist-pop')
        if (pop && pop.contains(event.target)) return
        setOpen(false)
      }
      function onKey(event) {
        if (event.key === 'Escape') setOpen(false)
      }
      place()
      window.addEventListener('resize', place)
      window.addEventListener('scroll', place, true)
      document.addEventListener('pointerdown', close, true)
      window.addEventListener('keydown', onKey)
      return function () {
        window.removeEventListener('resize', place)
        window.removeEventListener('scroll', place, true)
        document.removeEventListener('pointerdown', close, true)
        window.removeEventListener('keydown', onKey)
      }
    },
    [open],
  )

  function pick(item) {
    setOpen(false)
    activateNavItem(item)
  }

  return h(
    'span',
    { className: 'mp-sec-overflow' },
    h(
      'button',
      {
        type: 'button',
        ref: buttonRef,
        className: cx('mp-sec-expand', open && 'is-on'),
        title: t('v2.expandPlaylists'),
        'aria-expanded': open === true,
        onClick: function () {
          setOpen(!open)
        },
      },
      t('v2.expandPlaylists'),
      icon('chevronDown', 12),
    ),
    open
      ? h(
          'div',
          {
            className: 'mp-playlist-pop',
            role: 'dialog',
            'aria-label': t('v2.playlists'),
            style: pos || { visibility: 'hidden' },
          },
          h(
            'div',
            { className: 'mp-playlist-pop-head' },
            h('strong', null, t('v2.playlists')),
            h('span', { className: 'mp-playlist-pop-count' }, String(props.items.length)),
          ),
          h(
            'div',
            { className: 'mp-playlist-grid' },
            props.items.map(function (item) {
              return h(
                'button',
                {
                  key: item.key,
                  type: 'button',
                  className: cx('mp-playlist-card', active === item.key && 'is-on'),
                  onClick: function () {
                    pick(item)
                  },
                  onContextMenu: navItemContextMenu(item, active),
                },
                h(
                  'span',
                  { className: 'mp-playlist-card-icon' },
                  item.coverSrc ? h(Cover, { src: item.coverSrc, iconSize: 16 }) : icon(item.icon || 'list', 16),
                ),
                h(
                  'span',
                  { className: 'mp-playlist-card-main' },
                  h('strong', null, item.label),
                  h(
                    'span',
                    null,
                    item.count !== null && item.count !== undefined
                      ? t('page.trackCountUnit', { n: item.count })
                      : '',
                  ),
                ),
              )
            }),
          ),
        )
      : null,
  )
}

function SectionBar(props) {
  var groups = navGroupsFor(props.source, props.favoritesCount)
  var active = activeNavKey(props.nav)
  return h(
    'div',
    { className: 'mp-sectionbar', role: 'tablist', 'aria-label': t('page.tabLocal') },
    groups.map(function (group, groupIndex) {
      return h(
        'span',
        { key: group.label, style: { display: 'contents' } },
        groupIndex > 0 ? h('span', { className: 'mp-sec-sep' }) : null,
        group.showLabel ? h('span', { className: 'mp-sec-label' }, group.label) : null,
        group.action
          ? h(
              'button',
              {
                type: 'button',
                className: 'mp-sec-act',
                title: group.action.title,
                'aria-label': group.action.title,
                onClick: group.action.run,
              },
              icon(group.action.icon, 12),
            )
          : null,
        (group.label === t('v2.playlists') && group.items.length > MAX_PLAYLIST_TABS
          ? group.items.slice(0, MAX_PLAYLIST_TABS)
          : group.items
        ).map(function (item) {
          return h(
            'button',
            {
              key: item.key,
              type: 'button',
              role: 'tab',
              title: item.label,
              'aria-selected': active === item.key,
              className: cx('mp-sec-item', active === item.key && 'is-on'),
              onClick: function () {
                activateNavItem(item)
              },
              onContextMenu: navItemContextMenu(item, active),
              onMouseEnter: item.onlinePlaylist
                ? function () {
                    prefetchOnlinePlaylist(item.onlinePlaylist)
                  }
                : undefined,
              onFocus: item.onlinePlaylist
                ? function () {
                    prefetchOnlinePlaylist(item.onlinePlaylist)
                  }
                : undefined,
            },
            item.label,
            item.count !== null && item.count !== undefined
              ? h('span', { className: 'mp-sec-count' }, String(item.count))
              : null,
          )
        }),
        group.label === t('v2.playlists') && group.items.length > MAX_PLAYLIST_TABS
          ? h(SectionPlaylistOverflow, { items: group.items })
          : null,
      )
    }),
  )
}
