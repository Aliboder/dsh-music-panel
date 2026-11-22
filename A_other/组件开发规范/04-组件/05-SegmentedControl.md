# SegmentedControl

## 宿主签名（0.2.2-rc.5）

```js
function SegmentedControl({ id, value, options, onChange, label, disabled = false, className })
// options: [{ value, label, title, disabled }]
// 选中值用 === 比较；id 派生 ${id}-${value} 与 ${id}-${value}-panel
// 内部有滑动指示块（.indicator），选中 tab 只改文字颜色
```

## 适配层

```js
var KIT_SEQUENCE = 0

function KitSegmented(props) {
  var options = Array.isArray(props.options) ? props.options : []
  var value = String(props.value === undefined ? '' : props.value)
  var label = props.label || ''
  var index = 0
  for (var at = 0; at < options.length; at += 1) {
    if (String(options[at].value) === value) { index = at; break }
  }
  // 每个实例一个 id：固定默认 id 会让同页多个分段产生重复 DOM id / aria-controls
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
```

## 标准调用

```js
h(KitSegmented, { id: 'quality', value, label, options: [
  { value: 'standard', label: standardLabel },
  { value: 'lossless', label: losslessLabel },
], onChange: setValue })
```

## fallback CSS（宿主值）

```css
.ui-segment{position:relative;display:inline-grid;grid-auto-flow:column;grid-auto-columns:1fr;
  gap:2px;padding:4px;border-radius:var(--dsw-radius-md);
  background:var(--dsw-alias-interactive-bg-hover)}
.ui-segment-indicator{position:absolute;top:4px;left:4px;
  width:calc((100% - 8px - 2px * (var(--ui-segment-count, 1) - 1)) / var(--ui-segment-count, 1));
  height:calc(100% - 8px);border:0;border-radius:var(--dsw-radius-sm);
  background:var(--dsw-alias-bg-layer-1);box-shadow:var(--dsw-elevation-soft);
  transform:translate(calc(var(--ui-segment-index, 0) * (100% + 2px)));
  transition:transform .16s ease;pointer-events:none}
.ui-segment-tab{box-sizing:border-box;position:relative;z-index:1;height:28px;padding:0 16px;
  border:0;border-radius:var(--dsw-radius-sm);background:transparent;
  color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;line-height:20px;
  font-weight:500;white-space:nowrap;cursor:pointer;transition:color .12s ease}
.ui-segment-tab.is-on{color:var(--dsw-alias-label-primary)}
.ui-segment-tab:disabled{cursor:default;opacity:.4}
.ui-segment-tab:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color);
  outline-offset:-2px}
```

## 坑

- **id 必须唯一**：宿主用 `${id}-${value}` 生成 tab id 与 `aria-controls`；固定默认 id 会在同页产生重复 id。
- value 必须统一成字符串；宿主用 `===` 比较，数字与字符串混用会「选不中」。
- 指示块依赖 `--ui-segment-count` 与 `--ui-segment-index` 两个变量；fallback 要传，否则宽度为 0。
- 不要用 `.is-on` 画底色：宿主用指示块，选中 tab 只改文字色。
- 多个分段同页时，`label` 要区分（读屏用）。
