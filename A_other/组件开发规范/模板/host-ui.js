/**
 * DSH 宿主组件加载器（通用模板）。
 *
 * 整个插件只有这个文件 require 宿主原语包；业务代码通过 hostComponent(name) 取组件。
 * 宿主包不可用时返回 null，适配层自然回退到本地实现。
 *
 * 用法：复制到 src/client/app/host-ui.js，按 manifest 顺序加载。
 */

var hostUi = null
try {
  hostUi = require('@deepseek-ai/dsh-client-ui-primitives')
} catch (error) {
  hostUi = null
}

function hostComponent(name) {
  if (!hostUi) return null
  var value = hostUi[name]
  if (typeof value === 'function') return value
  if (value && typeof value === 'object' && value.$$typeof) return value
  return null
}

/** 只列实际会渲染的组件；关于页按它描述能力。 */
var HOST_KIT_COMPONENTS = [
  'Button',
  'Switch',
  'Modal',
  'Input',
  'Checkbox',
  'SegmentedControl',
  'SegmentedTabs',
  'Tag',
  'StateDot',
  'Tooltip',
  'Pill',
  'Menu',
]

/** native = 全部可用；partial = 包在但缺件；fallback = 包不可用。 */
function hostKitState() {
  if (!hostUi) return { state: 'fallback', missing: HOST_KIT_COMPONENTS.slice() }
  var missing = HOST_KIT_COMPONENTS.filter(function (name) {
    return hostComponent(name) === null
  })
  return { state: missing.length === 0 ? 'native' : 'partial', missing: missing }
}

/** 本地图标名 → 宿主图标组件；未命中的继续用本地 SVG。 */
var HOST_ICON_MAP = {
  search: 'IconSearchOutlineRegular',
  settings: 'IconSettingsOutlineRegular',
  plus: 'IconPlusOutlineRegular',
  play: 'IconPlayOutlineRegular',
  pause: 'IconPauseOutlineRegular',
  close: 'IconCloseOutlineRegular',
  check: 'IconCheckOutlineRegular',
  more: 'IconEllipsisOutlineRegular',
  chevronLeft: 'IconChevronLeftOutlineRegular',
  chevronRight: 'IconChevronRightOutlineRegular',
  chevronDown: 'IconChevronDownOutlineRegular',
  sort: 'IconChevronsUpDownOutlineRegular',
}

/** 优先宿主图标，否则本地 SVG。size 用 12 / 14 / 16 / 18。 */
function icon(name, size) {
  var HostIcon = hostComponent(HOST_ICON_MAP[name] || '')
  if (HostIcon !== null) return h(HostIcon, { size: size })
  return localIcon(name, size)
}
