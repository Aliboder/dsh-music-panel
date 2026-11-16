/**
 * windowed list (fixed row height).
 *
 * Renders the visible slice inside an absolutely positioned spacer. The list is
 * the single scroll container for a track view; `resetKey` decides when the
 * scroll position should go back to the top (view / filter / query change), so
 * a scan that adds or removes a track no longer jumps the list.
 */

function VirtualList(props) {
  var rowHeight = props.rowHeight || 56
  var overscan = props.overscan === undefined ? 6 : props.overscan
  var topPair = useState(props.initialScroll || 0)
  var scrollTop = topPair[0]
  var setScrollTop = topPair[1]
  var viewPair = useState(600)
  var viewport = viewPair[0]
  var setViewport = viewPair[1]
  var ref = useRef(null)

  useEffect(function () {
    var element = ref.current
    if (element === null) return undefined
    function measure() {
      setViewport(element.clientHeight || 600)
    }
    measure()
    window.addEventListener('resize', measure)
    var observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    if (observer !== null) observer.observe(element)
    return function () {
      window.removeEventListener('resize', measure)
      if (observer !== null) observer.disconnect()
    }
  }, [])

  useEffect(
    function () {
      var element = ref.current
      var start = props.initialScroll || 0
      if (element !== null) element.scrollTop = start
      setScrollTop(start)
    },
    [props.resetKey],
  )

  var items = props.items || []

  useEffect(
    function () {
      if (!props.focusPath) return
      var index = -1
      for (var i = 0; i < items.length; i += 1) {
        if (items[i].path === props.focusPath) {
          index = i
          break
        }
      }
      if (index < 0) return
      var top = Math.max(0, index * rowHeight - Math.max(0, viewport / 2 - rowHeight / 2))
      if (ref.current !== null) ref.current.scrollTop = top
      setScrollTop(top)
    },
    [props.focusPath],
  )

  function onScroll(event) {
    var top = event.currentTarget.scrollTop
    setScrollTop(top)
    if (typeof props.onScrollTop === 'function') props.onScrollTop(top)
  }

  if (items.length === 0) {
    return h(
      'div',
      { className: props.className, ref: ref, onScroll: onScroll },
      props.empty || null,
    )
  }

  var total = items.length * rowHeight
  var start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan)
  var end = Math.min(items.length, Math.ceil((scrollTop + viewport) / rowHeight) + overscan)
  var slice = items.slice(start, end)

  return h(
    'div',
    { className: props.className, ref: ref, onScroll: onScroll },
    h(
      'div',
      { className: 'mp-vlist-inner', style: { height: total + 'px' } },
      slice.map(function (item, offset) {
        var index = start + offset
        return h(
          'div',
          {
            key: props.itemKey ? props.itemKey(item, index) : index,
            className: 'mp-vlist-row',
            style: { height: rowHeight + 'px', top: index * rowHeight + 'px' },
          },
          props.renderRow(item, index),
        )
      }),
    ),
  )
}
