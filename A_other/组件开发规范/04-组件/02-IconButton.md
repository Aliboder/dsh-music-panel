# IconButton

## 宿主能力

宿主没有 `IconButton` 导出。官方组合是 **Tooltip + `<button>` + 图标**，并由调用方保证可访问名称。

## 适配层

```js
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
```

## 标准调用

```js
h(IconButton, { icon: 'chevronLeft', title: label, onClick: onBack })
h(IconButton, { icon: 'play', title: label, active: true, onClick: onPlay })
h(IconButton, { icon: 'more', title: label, onClick: onMore })
```

## fallback CSS

```css
.ui-iconbtn{display:inline-flex;align-items:center;justify-content:center;flex:none;
  width:28px;height:28px;padding:0;border:0;border-radius:var(--dsw-radius-sm,8px);
  background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;
  transition:background .12s,color .12s}
.ui-iconbtn.is-on{background:var(--dsw-alias-interactive-bg-hover);
  color:var(--dsw-alias-label-primary)}
@media (hover: hover){.ui-iconbtn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);
  color:var(--dsw-alias-label-primary)}}
.ui-iconbtn:disabled{opacity:.4;cursor:not-allowed}
.ui-iconbtn:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color);
  outline-offset:2px}
```

## 坑

- `title` 必填：它同时是 Tooltip 文案和 `aria-label`，缺了就是无名按钮。
- 图标尺寸 14 / 16 / 18 三档；按钮本身固定 28×28。
- Tooltip 的 side 默认右侧，插件里通常用 bottom；不要忘记 `delayMs`，否则悬浮会「粘」在鼠标上。
- 纯图标按钮不要用 `Button` 代替：Button 有 28/36 高度与内边距，会撑坏工具栏。
