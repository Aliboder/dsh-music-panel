# Input 与 Checkbox

## Input 宿主签名（0.2.2-rc.5）

```js
const Input = forwardRef(function ({ icon, className, ...inputProps }, ref) {
  // <span class=wrap>[icon]<input {...inputProps}/></span>
})
// onChange 是原生事件；value/type/placeholder/disabled/readOnly 都展开到 <input>
```

## Input 适配层

```js
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
```

标准调用：`h(KitInput, { value, placeholder, icon: 'search', label, onChange })`

### Input fallback CSS

```css
.ui-input-wrap{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 8px;
  border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-md);
  background:var(--dsw-alias-bg-layer-1)}
.ui-input-wrap:focus-within{border-color:var(--dsw-alias-state-business-primary)}
.ui-input{flex:1;min-width:0;height:30px;padding:0;border:0;outline:none;
  background:transparent;color:var(--dsw-alias-label-primary);font-size:14px;line-height:22px}
.ui-input::placeholder{color:var(--dsw-alias-label-dimmed)}
```

## Checkbox 宿主签名

```js
function Checkbox({ checked, onChange, label, disabled = false, title, className, modalAutofocus = false })
// <label><input type=checkbox>…<span>label</span></label>
// onChange 收 event.target.checked
```

## Checkbox 适配层

```js
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
```

标准调用：`h(KitCheckbox, { checked, label, onChange })`

### Checkbox fallback CSS

```css
.ui-check{display:inline-flex;align-items:center;gap:6px;font-size:14px;line-height:20px;
  color:var(--dsw-alias-label-primary);cursor:pointer}
.ui-check input{flex:0 0 auto;width:16px;height:16px;margin:0;
  accent-color:var(--dsw-alias-brand-primary);cursor:inherit}
.ui-check input:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color);
  outline-offset:2px}
```

## 坑

- Input 的 `onChange` 在宿主里是**原生事件**；适配层负责取 `event.target.value`，业务只拿 value。
- `aria-label` 必须给：宿主 Input 只渲染 `<input>`，没有内建标签。
- 输入框高度固定 32px；多行输入不要用这个适配层，改用 `textarea` 并单独立用例。
- Checkbox 的 label 是可见文案，不是 aria-label；两者不要混用。
