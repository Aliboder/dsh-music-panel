# Modal

## 宿主签名（0.2.2-rc.5）

```js
function Modal({ open, onClose, title, closeLabel, description, children, footer,
  className, contentClassName, headless = false, backdropBlur = true, tone })
// 宿主处理 portal、焦点陷阱、Escape、遮罩点击
```

## 适配层

```js
function KitModal(props) {
  var HostModal = hostComponent('Modal')
  if (HostModal !== null) {
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
        props.onClose ? h(IconButton, { icon: 'close', size: 15, title: t('common.close'), onClick: props.onClose }) : null),
      h('div', { className: 'ui-dialog-body' }, props.children),
      props.footer ? h('div', { className: 'ui-dialog-foot' }, props.footer) : null))
}
```

headless 场景（只保留遮罩与自己的内容）传 `{ open: true, onClose, headless: true, children }`。

## 标准调用

```js
open
  ? h(KitModal, {
      title: title,
      onClose: close,
      footer: [
        h(Button, { key: 'cancel', onClick: close }, cancelLabel),
        h(Button, { key: 'ok', variant: 'primary', onClick: save }, saveLabel),
      ],
    }, body)
  : null
```

## 坑

- 调用方用「是否挂载」控制显隐，`open` 恒为 true；不要让宿主自己消失后还留在树里。
- 嵌套弹窗：fallback 的 Escape 只会关最上面一层（用栈），不要每层都监听 window。
- 宿主 Modal 已有焦点陷阱；fallback 至少要把初始焦点放到第一个可交互元素。
- footer 里的按钮要按「次要在左、主操作在右」排列；危险操作用错误色但不改 variant。
- 弹窗内容不要自己再画一层卡片阴影，宿主已经给了表面与遮罩。
