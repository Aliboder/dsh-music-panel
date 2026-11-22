# Pill / Tag / StateDot

## 宿主签名（0.2.2-rc.5）

```js
function Pill({ active = false, className, children, onClick, ...rest })
// 有 onClick 渲染 <button>，没有则 <span>；active 时加 active 类

function Tag({ tone = 'outline', className, children })
// tone: outline | solid | neutral | quiet | success | info | warning | danger

function StateDot({ state, size, className, appearance = 'dot' })
// state: done | warning | error | idle | ongoing
```

## Pill 适配层

```js
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
```

标准调用：`h(KitPill, { active: value === id, onClick }, label)`

## Tag / StateDot 适配层

```js
function KitTag(props) {
  var tone = props.tone || 'outline'
  var HostTag = hostComponent('Tag')
  if (HostTag !== null) return h(HostTag, { tone: tone, className: props.className }, props.children)
  return h('span', { className: cx('ui-tag', props.className), 'data-tone': tone }, props.children)
}

function KitStateDot(props) {
  var state = props.state || 'idle'
  var HostDot = hostComponent('StateDot')
  if (HostDot !== null) return h(HostDot, { state: state })
  return h('span', { className: cx('ui-state-dot', 'is-' + state), 'aria-hidden': 'true' })
}
```

标准调用：

```js
h(KitTag, { tone: 'success' }, label)
h(KitStateDot, { state: 'done' })
h(KitPill, { active, onClick }, label)
```

## fallback CSS

```css
.ui-pill{display:inline-flex;align-items:center;gap:4px;height:24px;padding:0 8px;
  border:0;border-radius:999px;corner-shape:round;background:var(--dsw-alias-bg-layer-2);
  color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;line-height:18px;cursor:pointer}
.ui-pill.is-on{color:var(--dsw-alias-label-primary);
  background:var(--dsw-alias-button-ghost-active-fill);
  box-shadow:inset 0 0 0 1px var(--dsw-alias-button-ghost-active-border)}
.ui-tag{display:inline-flex;align-items:center;padding:1px 8px;border-radius:999px;
  corner-shape:round;font-size:11px;line-height:17px;font-weight:500;white-space:nowrap}
.ui-tag[data-tone=outline]{border:.5px solid var(--dsw-alias-border-l4);color:var(--dsw-alias-label-tertiary)}
.ui-tag[data-tone=solid]{background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3)}
.ui-tag[data-tone=neutral]{background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-secondary)}
.ui-tag[data-tone=quiet]{color:var(--dsw-alias-label-tertiary)}
.ui-tag[data-tone=success]{background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 10%,transparent);
  color:var(--dsw-alias-state-success-primary)}
.ui-tag[data-tone=info]{background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 10%,transparent);
  color:var(--dsw-alias-state-business-primary)}
.ui-tag[data-tone=warning]{background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 12%,transparent);
  color:var(--dsw-alias-state-warn-primary)}
.ui-tag[data-tone=danger]{background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 10%,transparent);
  color:var(--dsw-alias-state-error-primary)}
```

## 坑

- Pill 的 `active` 只在宿主存在时生效于宿主类名；fallback 用 `.is-on`，两条路径的视觉必须一致。
- Tag 八种 tone 必须都有 fallback 规则；新增 tone 先对照宿主 CSS。
- StateDot 只是状态点，不要用 Tag 模拟；它没有文案。
