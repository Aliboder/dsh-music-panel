# Button

## 宿主签名（0.2.2-rc.5）

```js
function Button({ variant = 'ghost', size = 'md', icon, className, children, ...rest })
// <button> 上展开 rest（disabled / onClick / title 等）；icon 是 React 节点
// variant: primary | ghost | outline | toolbar
```

## 适配层

```js
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
```

## 标准调用

```js
h(Button, { variant: 'primary' }, label)
h(Button, { variant: 'outline' }, label)
h(Button, { variant: 'ghost', icon: 'plus' }, label)
h(Button, { size: 'md' }, label)
h(Button, { disabled: true }, label)
h(Button, { className: 'ui-danger-btn', icon: 'trash' }, label)
```

## fallback CSS

```css
.ui-btn{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;
  gap:4px;height:28px;padding:0 10px;border:0;border-radius:var(--dsw-radius-sm,8px);
  background:transparent;color:var(--dsw-alias-label-primary);
  font-size:12px;line-height:18px;cursor:pointer;white-space:nowrap;
  box-shadow:inset 0 0 0 .5px var(--dsw-alias-border-l3)}
.ui-btn.is-md{height:36px;padding:0 14px;border-radius:var(--dsw-radius-md,12px);
  font-size:14px;line-height:22px}
.ui-btn.is-ghost{box-shadow:none;color:var(--dsw-alias-label-secondary)}
.ui-btn.is-primary{background:var(--dsw-alias-button-primary-fill);
  color:var(--dsw-alias-label-primary-foreground);box-shadow:none}
@media (hover: hover){.ui-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}}
.ui-btn:disabled{opacity:.4;cursor:not-allowed}
.ui-btn:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color);outline-offset:2px}
```

## 坑

- 宿主默认 `variant='ghost'`。适配层若默认 `outline`，必须**显式**传 `variant: 'outline'`，否则两条路径外观不同。
- `icon` 传 React 节点，不是字符串；本地图标名要先经 `icon()` 转换。
- 危险按钮不要新造 variant，用 `className` 叠加错误色（见规范 06）。
- 文案不要写死在组件里，调用方传入。
