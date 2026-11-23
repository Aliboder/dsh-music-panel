/**
 * VolumeControl: the one volume row used by the sidebar, the queue and the player page.
 *
 * It is controlled (value / muted / onChange / onMutedChange) so the gallery can use it
 * without touching the player. The wheel is a native listener: React's onWheel is passive,
 * and preventDefault there cannot stop the page from scrolling.
 */

var MP_VOLUME_WHEEL_STEP = 0.05

/** One wheel notch = 5%; muted starts from 0 so scrolling up also unmutes. */
function mpVolumeWheelNext(value, muted, deltaY) {
  var base = muted === true ? 0 : clamp(Number(value) || 0, 0, 1)
  var direction = deltaY > 0 ? -1 : 1
  return Math.round(clamp(base + direction * MP_VOLUME_WHEEL_STEP, 0, 1) * 100) / 100
}
function mpVolumePercent(value, muted) {
  var heard = muted === true ? 0 : clamp(Number(value) || 0, 0, 1)
  return Math.round(heard * 100)
}

function VolumeControl(props) {
  var rawValue = Number(props.value)
  var value = clamp(isFinite(rawValue) ? rawValue : 1, 0, 1)
  var muted = props.muted === true
  var heard = muted ? 0 : value
  var disabled = props.disabled === true
  var rootRef = useRef(null)
  var live = useRef({ value: value, muted: muted, disabled: disabled, onChange: props.onChange, onMutedChange: props.onMutedChange })
  live.current = {
    value: value,
    muted: muted,
    disabled: disabled,
    onChange: props.onChange,
    onMutedChange: props.onMutedChange,
  }

  function commit(next) {
    var current = live.current
    var rounded = Math.round(clamp(next, 0, 1) * 100) / 100
    if (rounded > 0 && current.muted && typeof current.onMutedChange === 'function') current.onMutedChange(false)
    if (typeof current.onChange === 'function') current.onChange(rounded)
  }

  useEffect(function () {
    var node = rootRef.current
    if (node === null) return undefined
    function onWheel(event) {
      var current = live.current
      if (current.disabled || event.deltaY === 0) return
      // The slider owns the wheel while the pointer is over it; never scroll the page.
      event.preventDefault()
      var base = current.muted ? 0 : current.value
      var next = mpVolumeWheelNext(current.value, current.muted, event.deltaY)
      if (next === base && !(current.muted && next > 0)) return
      commit(next)
    }
    node.addEventListener('wheel', onWheel, { passive: false })
    return function () { node.removeEventListener('wheel', onWheel) }
  }, [])

  var percent = mpVolumePercent(value, muted)
  var iconName = muted || percent === 0 ? 'mute' : percent < 50 ? 'volumeLow' : 'volume'
  return h(
    'span',
    {
      ref: rootRef,
      className: cx('mp-volume', props.className, muted && 'is-muted'),
      onClick: function (event) {
        event.stopPropagation()
        // The sidebar mount lives inside the host's <button> row; cancel its activation there only.
        if (props.nested === true) event.preventDefault()
      },
      onPointerDown: function (event) { event.stopPropagation() },
    },
    h(IconButton, {
      icon: iconName,
      size: props.iconSize || 16,
      active: muted,
      disabled: disabled,
      title: muted ? t('sheet.unmute') : t('sheet.mute'),
      'aria-label': muted ? t('sheet.unmute') : t('sheet.mute'),
      onClick: function () {
        if (typeof props.onMutedChange === 'function') props.onMutedChange(!muted)
      },
    }),
    h('input', {
      type: 'range',
      className: cx('mp-range', 'mp-volume-range'),
      min: '0',
      max: '1',
      step: '0.01',
      value: String(heard),
      disabled: disabled,
      title: t('page.volume') + ' · ' + percent + '%',
      'aria-label': t('page.volume'),
      'aria-valuetext': percent + '%',
      onChange: function (event) { commit(Number(event.target.value)) },
    }),
    props.showValue === true ? h('span', { className: 'mp-volume-value' }, percent + '%') : null,
  )
}

function mpVolumePopoverStyle(rect) {
  if (!rect) return { position: 'fixed', left: '8px', top: '8px' }
  var width = 196
  var gap = 8
  var viewport = typeof window !== 'undefined' ? window.innerWidth : 1280
  var left = Math.max(8, Math.min(rect.left, viewport - width - 8))
  var up = rect.top > 96
  return {
    position: 'fixed',
    left: left + 'px',
    top: (up ? rect.top - gap : rect.bottom + gap) + 'px',
    width: width + 'px',
    transform: up ? 'translateY(-100%)' : 'none',
  }
}

/** The sidebar's compact trigger opens this popover; the queue/player use VolumeControl inline. */
function VolumePopover(props) {
  var ref = useRef(null)
  useEffect(function () {
    var node = ref.current
    if (node === null || typeof node.showPopover !== 'function') return
    if (typeof node.matches === 'function' && node.matches(':popover-open')) return
    try { node.showPopover() } catch (error) {}
  }, [])
  useEffect(function () {
    function onDown(event) {
      var target = event.target
      if (target && typeof target.closest === 'function' && target.closest('[data-volume-trigger]')) return
      if (ref.current !== null && target && ref.current.contains(target)) return
      props.onClose()
    }
    function onKey(event) {
      if (event.key === 'Escape') props.onClose()
    }
    document.addEventListener('pointerdown', onDown, true)
    document.addEventListener('keydown', onKey, true)
    return function () {
      document.removeEventListener('pointerdown', onDown, true)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [props.onClose])
  return h(
    'div',
    { ref: ref, popover: 'manual', className: 'mp-volume-pop', style: mpVolumePopoverStyle(props.rect), role: 'dialog', 'aria-label': t('page.volume'), onClick: function (event) { event.stopPropagation(); event.preventDefault() }, onPointerDown: function (event) { event.stopPropagation() } },
    h('div', { className: 'mp-volume-pop-head' }, t('page.volume')),
    h(VolumeControl, Object.assign({ nested: true }, props.control, { showValue: true })),
  )
}
