/**
 * primitives: the few shared UI atoms plus the player hooks.
 */

function usePlayerSnapshot() {
  var pair = useState(player.getSnapshot())
  useEffect(function () {
    return player.subscribe(function () {
      pair[1](player.getSnapshot())
    })
  }, [])
  return pair[0]
}

function usePlayerTime() {
  var pair = useState(player.getTime())
  useEffect(function () {
    return player.subscribeTime(function () {
      pair[1](player.getTime())
    })
  }, [])
  return pair[0]
}

function usePrefs() {
  return useStore(prefsStore)
}

/** Milliseconds left until `deadline`, ticking once a second while it is set. */
function useCountdown(deadline) {
  var pair = useState(Date.now())
  var now = pair[0]
  var setNow = pair[1]
  useEffect(
    function () {
      if (!deadline || deadline <= Date.now()) return undefined
      var timer = setInterval(function () {
        setNow(Date.now())
      }, 1000)
      return function () {
        clearInterval(timer)
      }
    },
    [deadline],
  )
  return Math.max(0, (Number(deadline) || 0) - now)
}

function IconButton(props) {
  var button = h(
    'button',
    {
      type: 'button',
      className: cx('mp-iconbtn', props.active === true && 'is-on', props.className),
      title: props.title,
      'aria-label': props.title || props.label || '',
      disabled: props.disabled === true,
      onClick: props.onClick,
      onContextMenu: props.onContextMenu,
    },
    icon(props.icon, props.size || 16),
  )
  var HostTooltip = hostComponent('Tooltip')
  if (props.tooltip !== false && HostTooltip !== null && typeof props.title === 'string' && props.title !== '') {
    return h(HostTooltip, { label: props.title, side: 'bottom', delayMs: 400 }, button)
  }
  return button
}

function Button(props) {
  return h(
    'button',
    {
      type: 'button',
      className: cx(
        'mp-btn',
        props.variant === 'primary' && 'is-primary',
        props.variant === 'ghost' && 'is-ghost',
        props.className,
      ),
      disabled: props.disabled === true,
      onClick: props.onClick,
      title: props.title,
    },
    props.icon ? icon(props.icon, 14) : null,
    props.children,
  )
}

function Cover(props) {
  var failedPair = useState(false)
  var failed = failedPair[0]
  var setFailed = failedPair[1]
  useEffect(
    function () {
      setFailed(false)
    },
    [props.src],
  )
  var source = failed ? '' : props.src || ''
  return h(
    'div',
    { className: props.className, style: props.style },
    source === ''
      ? icon(props.icon || 'note', props.iconSize || 15)
      : h('img', {
          src: source,
          alt: '',
          loading: 'lazy',
          draggable: false,
          onError: function () {
            setFailed(true)
          },
        }),
  )
}

function Spinner() {
  return h('span', { className: 'mp-spinner', 'aria-hidden': 'true' })
}

function Empty(props) {
  return h(
    'div',
    { className: 'mp-empty' },
    icon(props.icon || 'note', 26),
    h('strong', null, props.title),
    props.hint ? h('span', null, props.hint) : null,
  )
}

function SeekBar(props) {
  var time = usePlayerTime()
  var pair = useState(null)
  var seeking = pair[0]
  var setSeeking = pair[1]
  var duration = time.duration > 0 ? time.duration : props.fallbackDuration || 0
  var position = seeking !== null ? seeking : Math.min(time.currentTime, duration || 0)
  var percent = duration > 0 ? clamp(position / duration, 0, 1) * 100 : 0
  var buffered = Math.min(duration, Math.max(0, Number(time.buffered) || 0))
  var bufferedPercent = duration > 0 ? clamp(buffered / duration, 0, 1) * 100 : 0

  function commit() {
    if (seeking === null) return
    if (duration > 0) player.seek(seeking)
    setSeeking(null)
  }

  function preview(event) {
    if (duration <= 0 || typeof props.onPreview !== 'function') return
    var rect = event.currentTarget.getBoundingClientRect()
    var ratio = clamp((event.clientX - rect.left) / rect.width, 0, 1)
    props.onPreview(ratio * duration)
  }

  return h(
    'div',
    {
      className: 'mp-seek',
      style: { '--mp-p': percent + '%', '--mp-b': bufferedPercent + '%' },
      onPointerMove: preview,
      onPointerLeave: function () {
        if (typeof props.onPreview === 'function') props.onPreview(null)
      },
    },
    h('span', { className: 'mp-seek-buffer', style: { width: bufferedPercent + '%' } }),
    h('input', {
      type: 'range',
      min: 0,
      max: duration > 0 ? duration : 1,
      step: 0.5,
      value: position,
      disabled: duration <= 0,
      style: { '--mp-p': percent + '%', '--mp-b': bufferedPercent + '%' },
      'aria-label': t('page.duration'),
      onChange: function (event) {
        setSeeking(Number(event.target.value))
      },
      onPointerUp: commit,
      onKeyUp: commit,
      onBlur: commit,
    }),
  )
}

function Switch(props) {
  var HostSwitch = hostComponent('Switch')
  if (HostSwitch !== null) {
    return h(HostSwitch, {
      checked: props.value === true,
      onChange: function (next) {
        if (typeof props.onChange === 'function') props.onChange(next === true)
      },
      label: props.label || '',
      title: props.title,
      disabled: props.disabled === true,
    })
  }
  return h(
    'button',
    {
      type: 'button',
      className: cx('mp-switch', props.value === true && 'is-on'),
      role: 'switch',
      'aria-checked': props.value === true,
      'aria-label': props.label || '',
      onClick: function () {
        if (props.onChange) props.onChange(!props.value)
      },
    },
    h('i'),
  )
}

function KitPill(props) {
  var HostPill = hostComponent('Pill')
  var content = [
    props.icon ? icon(props.icon, 13) : null,
    h('span', { key: 'label' }, props.children),
  ]
  if (HostPill !== null) {
    return h(
      HostPill,
      {
        active: props.active === true,
        className: props.className,
        title: props.title,
        onClick: props.onClick,
      },
      content,
    )
  }
  return h(
    'button',
    {
      type: 'button',
      className: cx('mp-pill', props.active === true && 'is-on', props.className),
      title: props.title,
      onClick: props.onClick,
    },
    content,
  )
}

/**
 * Dialog shell: the host Modal when available (focus trap, Escape, portal,
 * native chrome), otherwise the same overlay markup the plugin used before.
 */
function KitModal(props) {
  var HostModal = hostComponent('Modal')
  if (HostModal !== null) {
    if (props.headless === true) {
      return h(HostModal, {
        open: true,
        onClose: props.onClose,
        headless: true,
        className: cx('mp-kit-modal', 'mp-kit-modal-headless', props.className),
        children: props.children,
      })
    }
    return h(
      HostModal,
      {
        open: true,
        onClose: props.onClose,
        title: props.title || '',
        closeLabel: t('v2.close'),
        children: h('div', { className: 'mp-kit-body' }, props.children),
        footer: props.footer,
        className: cx('mp-kit-modal', props.small === true && 'is-sm', props.className),
        contentClassName: 'mp-kit-content',
      },
    )
  }
  if (props.headless === true) {
    return h(
      'div',
      { className: 'mp-overlay is-on' },
      h('div', { className: 'mp-scrim', onClick: props.onClose }),
      props.children,
    )
  }
  return h(
    'div',
    { className: 'mp-overlay is-on' },
    h('div', { className: 'mp-scrim', onClick: props.onClose }),
    h(
      'div',
      {
        className: cx('mp-dialog', props.small === true && 'is-sm', props.className),
        role: 'dialog',
        'aria-label': props.title || '',
      },
      h(
        'div',
        { className: 'mp-d-head' },
        h('div', { className: 'mp-d-title' }, props.title || ''),
        props.onClose
          ? h(IconButton, { icon: 'x', size: 15, title: t('v2.close'), onClick: props.onClose })
          : null,
      ),
      h('div', { className: 'mp-d-body' }, props.children),
      props.footer ? h('div', { className: 'mp-d-foot' }, props.footer) : null,
    ),
  )
}

function SetRow(props) {
  return h(
    'div',
    { className: 'mp-set-row' },
    h(
      'div',
      { className: 'mp-set-text' },
      h('div', { className: 'mp-set-label' }, props.label),
      props.desc ? h('div', { className: 'mp-set-desc' }, props.desc) : null,
    ),
    h('div', { className: 'mp-set-control' }, props.children),
  )
}
