/**
 * queue: side panel inside the workspace, plus the floating variant used from
 * the chat composer. Both share QueueList so there is one row implementation.
 */

function QueueList(props) {
  var snap = props.snap
  var listRef = useRef(null)
  var dragFromRef = useRef(null)
  useEffect(
    function () {
      var box = listRef.current
      if (!box) return
      var row = box.querySelector('.mp-q-row.is-cur')
      if (!row) return
      var top = row.offsetTop - box.clientHeight / 2 + row.offsetHeight / 2
      box.scrollTop = Math.max(0, top)
    },
    [snap && snap.queue, snap && snap.index, snap && snap.order, snap && snap.playing],
  )
  if (!snap || !snap.queue || snap.queue.length === 0) {
    return h(
      'div',
      { className: 'mp-empty', style: { padding: '36px 16px' } },
      icon('list', 24),
      h('strong', null, t('page.queueEmpty')),
    )
  }
  var order = snap.order === 'random' ? player.getPlayOrder() : snap.queue.map(function (_, index) { return index })
  if (!Array.isArray(order) || order.length !== snap.queue.length) {
    order = snap.queue.map(function (_, index) { return index })
  }
  return h(
    'div',
    { className: 'mp-q-list', ref: listRef },
    order.map(function (queueIndex, position) {
      var track = snap.queue[queueIndex]
      if (!track) return null
      var current = queueIndex === snap.index
      return h(
        'div',
        {
          key: track.path + ':' + queueIndex,
          className: cx('mp-q-row', current && 'is-cur'),
          draggable: true,
          onDragStart: function (event) {
            dragFromRef.current = position
            if (event.dataTransfer) {
              event.dataTransfer.effectAllowed = 'move'
              event.dataTransfer.setData('text/plain', String(position))
            }
          },
          onDragOver: function (event) {
            if (dragFromRef.current === null) return
            event.preventDefault()
            if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
          },
          onDrop: function (event) {
            event.preventDefault()
            var from = dragFromRef.current
            dragFromRef.current = null
            if (from === null || from === position) return
            var indices = order.slice()
            var moved = indices.splice(from, 1)[0]
            indices.splice(position, 0, moved)
            player.reorderQueue(indices)
          },
          onDragEnd: function () {
            dragFromRef.current = null
          },
          onClick: function () {
            if (dragFromRef.current === null) player.select(snap.queue, queueIndex)
          },
          title: trackTitleOf(track),
        },
        h(
          'div',
          { className: 'mp-q-idx' },
          current && snap.playing ? icon('play', 12) : String(position + 1),
        ),
        h('div', { className: 'mp-q-cover' }, h(Cover, { src: trackCoverSrc(track), iconSize: 14 })),
        h(
          'div',
          { className: 'mp-q-main' },
          h('div', { className: 'mp-q-name' }, trackTitleOf(track)),
          h('div', { className: 'mp-q-artist' }, trackArtistOf(track)),
        ),
        h('div', { className: 'mp-q-artist' }, fmtTime(track.durationSec)),
      )
    }),
  )
}

function QueuePanel(props) {
  return h(
    'aside',
    { className: 'mp-queue', 'aria-label': t('page.queue') },
    h(
      'div',
      { className: 'mp-q-head' },
      h(
        'div',
        null,
        h('div', { className: 'mp-q-title' }, t('page.queue')),
        h(
          'div',
          { className: 'mp-q-sub' },
          (props.snap.queue.length || 0) + ' · ' + (props.snap.order === 'random' ? t('page.shuffle') : t('page.modeSequence')),
        ),
      ),
      h('div', { className: 'mp-spacer', style: { marginLeft: 'auto' } }),
      h(IconButton, {
        icon: 'target',
        size: 15,
        title: t('page.locateCurrent'),
        onClick: props.onLocate,
      }),
      h(IconButton, {
        icon: 'x',
        size: 15,
        title: t('v2.close'),
        onClick: props.onClose,
      }),
    ),
    h(QueueList, { snap: props.snap }),
  )
}

function QueuePopover(props) {
  useEffect(
    function () {
      if (props.open !== true) return undefined
      function onDown(event) {
        var target = event.target
        if (target && target.closest) {
          if (target.closest('.mp-queue-pop')) return
          if (target.closest('.mp-pb-queue-wrap')) return
          if (target.closest('.mp-composer-cluster')) return
        }
        props.onClose()
      }
      document.addEventListener('pointerdown', onDown, true)
      return function () {
        document.removeEventListener('pointerdown', onDown, true)
      }
    },
    [props.open, props.onClose],
  )
  if (props.open !== true) return null
  return h(
    'div',
    {
      className: cx('mp-queue-pop', props.anchored === true && 'is-anchored'),
      role: 'dialog',
      'aria-label': t('page.queue'),
      style: props.style,
    },
    h(
      'div',
      { className: 'mp-q-head' },
      h('div', { className: 'mp-q-title' }, t('page.queue')),
      h('div', { className: 'mp-spacer', style: { marginLeft: 'auto' } }),
      h(IconButton, { icon: 'x', size: 14, title: t('v2.close'), onClick: props.onClose }),
    ),
    h(QueueList, { snap: props.snap }),
  )
}
