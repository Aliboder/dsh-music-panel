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
        group.items.map(function (item) {
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
            },
            item.label,
            item.count !== null && item.count !== undefined
              ? h('span', { className: 'mp-sec-count' }, String(item.count))
              : null,
          )
        }),
      )
    }),
  )
}
