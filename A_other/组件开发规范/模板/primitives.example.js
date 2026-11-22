/**
 * 适配层示例（通用模板）。
 *
 * 依赖全局：h / cx / icon / t / hostComponent / useState / useRef / useEffect / useLayoutEffect。
 * 命名：宿主组件用原名，包装类用 Kit 前缀；CSS 类用 ui- 前缀。
 * 只复制本插件实际会用到的函数，函数名保持唯一。
 */

var KIT_SEQUENCE = 0

/** 主按钮。variant: primary | outline | ghost | toolbar；size: sm | md。 */
function Button(props) {
  var variant = props.variant === 'primary'
    ? 'primary'
    : props.variant === 'ghost'
      ? 'ghost'
      : props.variant === 'toolbar'
        ? 'toolbar'
        : 'outline'
  var size = props.size === 'md' ? 'md' : 'sm'
  var HostButton = hostComponent('Button')
  if (HostButton !== null) {
    return h(HostButton, {
      variant: variant,
      size: size,
      icon: props.icon ? icon(props.icon, 16) : undefined,
      className: props.className,
      disabled: props.disabled === true,
      onClick: props.onClick,
      title: props.title,
    }, props.children)
  }
  return h('button', {
    type: 'button',
    className: cx('ui-btn', 'is-' + variant, size === 'md' && 'is-md', props.className),
    disabled: props.disabled === true,
    onClick: props.onClick,
    title: props.title,
  }, props.icon ? icon(props.icon, 14) : null, props.children)
}

/** 图标按钮：Tooltip + <button>；title 必填（同时是 aria-label）。 */
function IconButton(props) {
  var HostTooltip = hostComponent('Tooltip')
  var size = Number(props.size) || 16
  var button = h('button', {
    type: 'button',
    className: cx('ui-iconbtn', props.active === true && 'is-on', props.className),
    'aria-label': props.title || '',
    'aria-pressed': props.active === undefined ? undefined : props.active ? 'true' : 'false',
    disabled: props.disabled === true,
    onClick: props.onClick,
  }, icon(props.icon, size))
  if (HostTooltip !== null && props.title) {
    return h(HostTooltip, { label: props.title, side: 'bottom', delayMs: 400 }, button)
  }
  return button
}

/** 开关。value: boolean；onChange(boolean)。 */
function Switch(props) {
  var HostSwitch = hostComponent('Switch')
  if (HostSwitch !== null) {
    return h(HostSwitch, {
      checked: props.value === true,
      onChange: function (next) {
        if (typeof props.onChange === 'function') props.onChange(next === true)
      },
      label: props.label || props.title || '',
      title: props.title,
      disabled: props.disabled === true,
      className: props.className,
    })
  }
  return h('button', {
    type: 'button',
    role: 'switch',
    'aria-checked': props.value === true ? 'true' : 'false',
    'aria-label': props.label || '',
    className: cx('ui-switch', props.value === true && 'is-on', props.className),
    disabled: props.disabled === true,
    onClick: function () {
      if (typeof props.onChange === 'function') props.onChange(!props.value)
    },
  }, h('i', null))
}

/** 单行输入。onChange(value, event)。 */
function KitInput(props) {
  var value = props.value === null || props.value === undefined ? '' : String(props.value)
  var label = props.label || props.placeholder || ''
  function change(event) {
    if (typeof props.onChange === 'function') props.onChange(event.target.value, event)
  }
  var HostInput = hostComponent('Input')
  if (HostInput !== null) {
    return h(HostInput, {
      value: value,
      type: props.type || 'text',
      placeholder: props.placeholder || '',
      icon: props.icon ? icon(props.icon, 16) : undefined,
      disabled: props.disabled === true,
      readOnly: props.readOnly === true,
      'aria-label': label,
      onChange: change,
      onKeyDown: props.onKeyDown,
      onBlur: props.onBlur,
      className: props.className,
    })
  }
  return h('span', { className: cx('ui-input-wrap', props.className) },
    props.icon ? icon(props.icon, 15) : null,
    h('input', {
      className: 'ui-input',
      type: props.type || 'text',
      value: value,
      placeholder: props.placeholder || '',
      disabled: props.disabled === true,
      readOnly: props.readOnly === true,
      'aria-label': label,
      onChange: change,
      onKeyDown: props.onKeyDown,
      onBlur: props.onBlur,
    }))
}

/** 复选框。checked: boolean；onChange(boolean)。 */
function KitCheckbox(props) {
  var HostCheckbox = hostComponent('Checkbox')
  if (HostCheckbox !== null) {
    return h(HostCheckbox, {
      checked: props.checked === true,
      onChange: function (next) {
        if (typeof props.onChange === 'function') props.onChange(next === true)
      },
      label: props.label || '',
      disabled: props.disabled === true,
      title: props.title,
      className: props.className,
    })
  }
  return h('label', { className: cx('ui-check', props.className) },
    h('input', {
      type: 'checkbox',
      checked: props.checked === true,
      disabled: props.disabled === true,
      onChange: function (event) {
        if (typeof props.onChange === 'function') props.onChange(event.target.checked)
      },
    }),
    h('span', null, props.label || ''))
}

/** 互斥分段。options: [{ value, label, title, disabled }]；onChange(value)。 */
function KitSegmented(props) {
  var options = Array.isArray(props.options) ? props.options : []
  var value = String(props.value === undefined ? '' : props.value)
  var label = props.label || ''
  var index = 0
  for (var at = 0; at < options.length; at += 1) {
    if (String(options[at].value) === value) { index = at; break }
  }
  // 每个实例一个 id，避免同页多个分段产生重复 DOM id / aria-controls
  var idRef = useRef(null)
  if (idRef.current === null) {
    KIT_SEQUENCE += 1
    idRef.current = 'ui-seg-' + String(KIT_SEQUENCE)
  }
  var id = props.id || idRef.current
  var HostSegmented = hostComponent('SegmentedControl')
  if (HostSegmented !== null) {
    return h(HostSegmented, {
      id: id,
      value: value,
      options: options.map(function (option) {
        return { value: String(option.value), label: option.label,
          disabled: option.disabled === true, title: option.title }
      }),
      onChange: function (next) {
        if (typeof props.onChange === 'function') props.onChange(next)
      },
      label: label,
      disabled: props.disabled === true,
      className: props.className,
    })
  }
  return h('div', {
    className: cx('ui-segment', props.className),
    role: 'tablist',
    'aria-label': label,
    style: { '--ui-segment-count': String(options.length), '--ui-segment-index': String(index) },
  }, h('span', { className: 'ui-segment-indicator', 'aria-hidden': 'true' }),
    options.map(function (option) {
      var on = String(option.value) === value
      return h('button', {
        key: String(option.value),
        type: 'button',
        role: 'tab',
        'aria-selected': on ? 'true' : 'false',
        className: cx('ui-segment-tab', on && 'is-on'),
        disabled: props.disabled === true || option.disabled === true,
        onClick: function () {
          if (!on && typeof props.onChange === 'function') props.onChange(String(option.value))
        },
      }, option.label)
    }))
}

/** 页面级页签。items: [{ value, label, id, panelId }]；onChange(value)。 */
function KitSegmentedTabs(props) {
  var items = Array.isArray(props.items) ? props.items : []
  var value = String(props.value === undefined ? '' : props.value)
  var size = props.size === 'sm' ? 'sm' : 'md'
  var HostTabs = hostComponent('SegmentedTabs')
  if (HostTabs !== null) {
    return h(HostTabs, {
      items: items,
      value: value,
      onChange: function (next) {
        if (typeof props.onChange === 'function') props.onChange(next)
      },
      label: props.label || '',
      size: size,
      className: props.className,
    })
  }
  var activeAt = 0
  for (var at = 0; at < items.length; at += 1) {
    if (String(items[at].value) === value) activeAt = at
  }
  return h('div', {
    className: cx('ui-segment-tabs', size === 'sm' && 'is-sm', props.className),
    role: 'tablist',
    'aria-label': props.label || '',
  }, h('span', {
    className: 'ui-segment-tabs-indicator',
    'aria-hidden': 'true',
    style: {
      width: 'calc((100% - 2 * var(--segment-tabs-inset)) / ' + String(items.length) + ')',
      transform: 'translateX(' + String(activeAt * 100) + '%)',
    },
  }),
    items.map(function (item) {
      var on = String(item.value) === value
      return h('button', {
        key: String(item.value),
        id: item.id,
        type: 'button',
        role: 'tab',
        'aria-selected': on ? 'true' : 'false',
        'aria-controls': item.panelId,
        tabIndex: on ? 0 : -1,
        className: cx('ui-segment-tab', on && 'is-on'),
        onClick: function () {
          if (typeof props.onChange === 'function') props.onChange(String(item.value))
        },
      }, item.label)
    }))
}

/** 可选中的胶囊。active: boolean。 */
function KitPill(props) {
  var HostPill = hostComponent('Pill')
  var content = [
    props.icon ? icon(props.icon, 13) : null,
    h('span', { key: 'label' }, props.children),
  ]
  if (HostPill !== null) {
    return h(HostPill, {
      active: props.active === true,
      className: props.className,
      title: props.title,
      onClick: props.onClick,
    }, content)
  }
  return h('button', {
    type: 'button',
    className: cx('ui-pill', props.active === true && 'is-on', props.className),
    title: props.title,
    onClick: props.onClick,
  }, content)
}

/** 标签。tone: outline | solid | neutral | quiet | success | info | warning | danger。 */
function KitTag(props) {
  var tone = props.tone || 'outline'
  var HostTag = hostComponent('Tag')
  if (HostTag !== null) return h(HostTag, { tone: tone, className: props.className }, props.children)
  return h('span', { className: cx('ui-tag', props.className), 'data-tone': tone }, props.children)
}

/** 状态点。state: done | warning | error | idle | ongoing。 */
function KitStateDot(props) {
  var state = props.state || 'idle'
  var HostDot = hostComponent('StateDot')
  if (HostDot !== null) return h(HostDot, { state: state })
  return h('span', { className: cx('ui-state-dot', 'is-' + state), 'aria-hidden': 'true' })
}

/** 弹窗。调用方按需挂载，open 恒为 true。 */
var KIT_MODAL_STACK = []

function KitModal(props) {
  var HostModal = hostComponent('Modal')
  var closeRef = useRef(props.onClose)
  closeRef.current = props.onClose
  var tokenRef = useRef(null)
  if (tokenRef.current === null) tokenRef.current = { id: {} }
  useEffect(
    function () {
      if (HostModal !== null) return undefined
      var token = tokenRef.current
      KIT_MODAL_STACK.push(token)
      function onKey(event) {
        if (event.key !== 'Escape') return
        if (KIT_MODAL_STACK[KIT_MODAL_STACK.length - 1] !== token) return
        event.stopPropagation()
        if (typeof closeRef.current === 'function') closeRef.current()
      }
      window.addEventListener('keydown', onKey)
      return function () {
        window.removeEventListener('keydown', onKey)
        var at = KIT_MODAL_STACK.indexOf(token)
        if (at >= 0) KIT_MODAL_STACK.splice(at, 1)
      }
    },
    [],
  )
  if (HostModal !== null) {
    if (props.headless === true) {
      return h(HostModal, {
        open: true,
        onClose: props.onClose,
        headless: true,
        className: cx('ui-modal', 'is-headless', props.className),
        children: props.children,
      })
    }
    return h(HostModal, {
      open: true,
      onClose: props.onClose,
      title: props.title || '',
      closeLabel: t('common.close'),
      children: h('div', { className: 'ui-modal-body' }, props.children),
      footer: props.footer,
      className: cx('ui-modal', props.small === true && 'is-sm', props.className),
      contentClassName: 'ui-modal-content',
    })
  }
  return h('div', { className: 'ui-overlay is-on' },
    h('div', { className: 'ui-scrim', onClick: props.onClose }),
    h('div', {
      className: cx('ui-dialog', props.small === true && 'is-sm', props.className),
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': props.title || '',
    },
      h('div', { className: 'ui-dialog-head' },
        h('div', { className: 'ui-dialog-title' }, props.title || ''),
        props.onClose
          ? h(IconButton, { icon: 'close', size: 15, title: t('common.close'), onClick: props.onClose })
          : null),
      h('div', { className: 'ui-dialog-body' }, props.children),
      props.footer ? h('div', { className: 'ui-dialog-foot' }, props.footer) : null))
}

/** 下拉选择。onChange(value)。 */
function KitSelect(props) {
  var pair = useState(false)
  var open = pair[0]
  var setOpen = pair[1]
  var options = Array.isArray(props.options) ? props.options : []
  var value = String(props.value === undefined ? '' : props.value)
  var current = null
  for (var index = 0; index < options.length; index += 1) {
    if (String(options[index].value) === value) current = options[index]
  }
  var ref = useRef(null)
  var HostMenu = hostComponent('Menu')
  useEffect(
    function () {
      if (!open || HostMenu !== null) return undefined
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
  var trigger = h('button', {
    type: 'button',
    className: cx('ui-select', open && 'is-open'),
    'aria-label': props.label || '',
    'aria-haspopup': 'listbox',
    'aria-expanded': open ? 'true' : 'false',
    disabled: props.disabled === true,
    onClick: function () { setOpen(!open) },
  }, h('span', { className: 'ui-select-label' },
      current ? current.label : props.placeholder || ''), icon('chevronDown', 14))
  if (HostMenu !== null) {
    return h(HostMenu, {
      open: open,
      anchor: trigger,
      items: options.map(function (option) {
        return { id: String(option.value), label: option.label, disabled: option.disabled === true }
      }),
      selectedId: value,
      onSelect: function (id) {
        setOpen(false)
        if (typeof props.onChange === 'function') props.onChange(id)
      },
      onClose: function () { setOpen(false) },
      side: 'bottom',
      align: 'start',
      portal: true,
      compact: true,
    })
  }
  return h('div', { className: 'ui-select-wrap', ref: ref }, trigger, open
    ? h('div', { className: 'ui-select-menu', role: 'listbox', 'aria-label': props.label || '' },
        options.map(function (option) {
          return h('button', {
            key: String(option.value),
            type: 'button',
            role: 'option',
            'aria-selected': String(option.value) === value ? 'true' : 'false',
            disabled: option.disabled === true,
            onClick: function () {
              setOpen(false)
              if (typeof props.onChange === 'function') props.onChange(String(option.value))
            },
          }, option.label)
        }))
    : null)
}

/** 设置行骨架。 */
function SetRow(props) {
  return h('div', { className: 'ui-set-row' },
    h('div', { className: 'ui-set-label' }, props.label,
      props.desc ? h('span', { className: 'ui-set-desc' }, props.desc) : null),
    h('div', { className: 'ui-set-control' }, props.children))
}

function Spinner() {
  return h('span', { className: 'ui-spinner', 'aria-hidden': 'true' })
}

function Empty(props) {
  return h('div', { className: 'ui-empty' },
    icon(props.icon || 'note', 26),
    h('strong', null, props.title),
    props.hint ? h('span', null, props.hint) : null)
}

/** 轻提示服务。同时最多 3 条，默认 2.4s 消失。 */
var KIT_TOASTS = []

function showToast(text) {
  KIT_TOASTS.push({ id: Date.now() + Math.random(), text: text })
  if (KIT_TOASTS.length > 3) KIT_TOASTS.shift()
  var current = KIT_TOASTS[KIT_TOASTS.length - 1]
  setTimeout(function () {
    var at = KIT_TOASTS.indexOf(current)
    if (at >= 0) KIT_TOASTS.splice(at, 1)
  }, 2400)
}
