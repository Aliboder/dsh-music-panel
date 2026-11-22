# SegmentedTabs

## 宿主签名（0.2.2-rc.5）

```js
function SegmentedTabs({ items, value, onChange, label, size = 'md', className })
// items: [{ value, label, id, panelId }]
// 内部用 Pill 渲染 tab；选中态由 aria-selected + CSS 表达
// 面板由调用方渲染：role=tabpanel、id=panelId、aria-labelledby=tab id
```

## 适配层

```js
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
```

## 标准调用

```js
h(KitSegmentedTabs, {
  items: [
    { value: '0', label: tabOne, id: 'ui-tab-0', panelId: 'ui-panel-0' },
    { value: '1', label: tabTwo, id: 'ui-tab-1', panelId: 'ui-panel-1' },
  ],
  value: String(index),
  size: 'sm',
  label: tabsLabel,
  onChange: function (next) { setIndex(Number(next)) },
})
h('div', { id: 'ui-panel-' + String(index), role: 'tabpanel',
  'aria-labelledby': 'ui-tab-' + String(index) }, body)
```

## fallback CSS（宿主值，注意与 SegmentedControl 不同）

```css
.ui-segment-tabs{--segment-tabs-inset:4px;position:relative;display:grid;
  grid-auto-flow:column;grid-auto-columns:1fr;gap:2px;padding:var(--segment-tabs-inset);
  border-radius:var(--dsw-radius-lg);background:var(--dsw-alias-bg-module-platform)}
.ui-segment-tabs.is-sm{--segment-tabs-inset:2px;
  border-radius:calc(var(--dsw-radius-md) + var(--segment-tabs-inset))}
.ui-segment-tabs-indicator{position:absolute;top:var(--segment-tabs-inset);
  bottom:var(--segment-tabs-inset);left:var(--segment-tabs-inset);box-sizing:border-box;
  border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-md);
  background:var(--dsw-alias-bg-layer-3);transition:transform .18s ease;pointer-events:none}
.ui-segment-tabs .ui-segment-tab{height:34px;padding:0 12px;
  border-radius:var(--dsw-radius-md);font-size:14px;line-height:20px}
.ui-segment-tabs.is-sm .ui-segment-tab{height:30px}
.ui-segment-tabs .ui-segment-tab.is-on{font-weight:600}
.ui-segment-tabs.is-sm .ui-segment-tab.is-on{font-weight:500}
```

## 坑

- **不要复用 SegmentedControl 的样式**：页签外框 R16、tab R12、14px 字号、选中加粗；控制是外框 R12、tab 28px、13px。
- `panelId` 必须对应真实面板；否则 `aria-controls` 指向不存在的元素。
- tab 的 `tabIndex`：选中 0，其余 -1，方向键由宿主/fallback 处理。
- `size='sm'` 只有高度与内衬变化，字号不变。
- 深色面板里 `--dsw-alias-bg-module-platform` 也要在岛根固定（见 07）。
