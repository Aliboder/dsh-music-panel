# Switch

## 宿主签名（0.2.2-rc.5）

```js
function Switch({ checked, onChange, label, disabled = false, title, className })
// <button role="switch" aria-checked aria-label>
// onChange 收到的是取反后的 boolean
```

## 适配层

```js
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
```

## 标准调用

```js
h(Switch, { value: on, label: label, onChange: setOn })
h(Switch, { value: false, label: label, disabled: true })
```

## fallback CSS（宿主：36×20、内衬 2、滑块 16）

```css
.ui-switch{box-sizing:border-box;position:relative;flex:0 0 auto;width:36px;height:20px;
  padding:2px;border:0;border-radius:999px;corner-shape:round;
  background:var(--dsw-alias-border-l3);cursor:pointer;
  transition:background .12s ease}
.ui-switch[aria-checked=true]{background:var(--dsw-alias-brand-primary)}
.ui-switch:disabled{cursor:default;opacity:.5}
.ui-switch:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color);
  outline-offset:2px}
.ui-switch i{display:block;width:16px;height:16px;border-radius:50%;corner-shape:round;
  background:var(--dsw-alias-switch-thumb);transition:transform .12s ease}
.ui-switch[aria-checked=true] i{transform:translate(16px);
  background:var(--dsw-alias-label-primary-foreground)}
```

## 坑

- **深色岛必看**：宿主开关的开启轨道读 `--dsw-alias-brand-primary`、滑块读 `--dsw-alias-label-primary-foreground`、关态滑块读 `--dsw-alias-switch-thumb`。深色面板里不固定 token，浅色主题会变成白底白滑块。固定值见 `07-深色岛.md`。
- `onChange` 收 boolean；不要传 `event` 或 `value`。
- 开关必须有 label；没有可见文案时用 `label` 作为 `aria-label`。
- 不要用 checkbox 模拟开关：`role=switch` 的键盘与读屏语义不同。
