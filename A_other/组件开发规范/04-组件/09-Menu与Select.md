# Menu 与 Select

## 宿主签名（0.2.2-rc.5）

```js
function Menu({ open, anchor, items, selectedId, selectedIds, onSelect, onClose,
  side = 'bottom', align = 'start', portal = false, compact = false,
  selection = 'check', footer, className, ... })
// anchor 是 React 元素；宿主把 anchor 渲染进自己的根 span，用 CSS anchor 定位
// items: [{ id, label, icon, disabled, danger, shortcut, submenu, type: 'separator' }]
// onSelect(id)
```

## Select 适配层（触发器 + 宿主菜单）

```js
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
  var HostMenu = hostComponent('Menu')
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
  // fallback：自绘浮层，注意外部点击与 Escape
  return h('div', { className: 'ui-select-wrap' }, trigger, open
    ? h('div', { className: 'ui-select-menu', role: 'listbox', 'aria-label': props.label || '' },
        options.map(function (option) {
          return h('button', { key: String(option.value), type: 'button', role: 'option',
            'aria-selected': String(option.value) === value ? 'true' : 'false',
            disabled: option.disabled === true,
            onClick: function () { setOpen(false);
              if (typeof props.onChange === 'function') props.onChange(String(option.value)) },
          }, option.label)
        }))
    : null)
}
```

标准调用：`h(KitSelect, { value, label, placeholder, options, onChange })`

## 顶栏/右键菜单

```js
h(HeadMenu, {
  icon: 'more',
  title: menuLabel,
  items: [
    { key: 'rename', label: renameLabel, run: onRename },
    { key: 'delete', label: deleteLabel, danger: true, run: onDelete },
    { separator: true, key: 'sep' },
  ],
})
```

`HeadMenu` 的宿主分支把 `items` 映射成 `{ id, label, icon, disabled, danger }` 与 `{ type: 'separator' }`，`selectedId` 取当前激活项，`onSelect(id)` 里执行对应动作。

## fallback 菜单样式

```css
.ui-select{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 8px;
  border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-md);
  background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);cursor:pointer}
.ui-select-menu{position:absolute;top:calc(100% + 4px);left:0;z-index:10;min-width:100%;
  padding:4px;border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-1);
  box-shadow:var(--dsw-elevation-prominent);display:flex;flex-direction:column}
.ui-select-menu [role=option]{display:flex;align-items:center;gap:8px;height:32px;padding:0 10px;
  border:0;border-radius:var(--dsw-radius-sm);background:transparent;text-align:left;
  color:var(--dsw-alias-label-primary);cursor:pointer}
.ui-select-menu [role=option]:hover{background:var(--dsw-alias-interactive-bg-hover)}
```

## 坑

- `anchor` 是 **React 元素**，不是 ref；宿主会把它渲染进自己的根节点。
- `onSelect` 的参数是 item 的 **id**（字符串），不是整个 item。
- fallback 必须处理点击外部关闭与 Escape；宿主已经处理。
- 菜单项文案、图标、快捷链要成套；danger 项不能只靠颜色区分，文案要写清。
- 不要用 `Menu` 做导航列表；导航用链接或 `SegmentedTabs`。
