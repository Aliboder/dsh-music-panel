---
name: dsh-component-development
description: "当在 DSH Client 插件中开发或修改界面时使用：宿主组件优先、fallback 与官方等价、组件测试页为唯一标准、token 与深色岛、验收与升级复核。"
---

# DSH 组件开发

让 DSH Client 插件的界面与 DeepSeek Harness 官方风格保持一致。本 skill 是决策与流程入口；完整代码、逐组件说明与可执行自检在配套的「组件开发规范」文件夹里。

## 何时使用

- 新增或修改任何界面：按钮、开关、输入框、复选框、分段、页签、弹窗、菜单、提示、设置行、工具栏、面板。
- 需要决定用宿主组件、包装一层，还是本地实现。
- 需要写 fallback、处理主题/深色面板，或评审界面是否符合 DSH 风格。

## 何时不用

- 纯 Host/服务端逻辑，没有界面改动。
- 目标不是 DSH Client 插件（其他产品/框架）。
- 只是修文案、调数据，不涉及控件与样式。

## 第一步：定位规范

在仓库里先找规范文件夹，不要假设固定路径：

```text
搜索：**/组件开发规范/README.md
常见位置：仓库根、docs/、A_other/、tools/
```

找到后按 `README.md` 的「给 AI 的阅读顺序」执行：

```text
README → 01 核心原则 → 02 宿主组件加载 → 03 适配层规范 → 04 对应组件页
```

找不到时：按本 skill 的规则执行，并建议把公开仓库的 `组件开发规范/` 引入项目：
`https://github.com/Aliboder/dsh-component-development`

## 六条硬规则

1. **宿主优先**：`hostComponent('X') !== null` 时必须渲染宿主组件；只有不可用时才用 fallback。
2. **fallback 等价**：props、DOM/aria、几何、交互、颜色五个维度一致，不是「看起来像」。
3. **测试页唯一标准**：每个控件先在组件测试页立用例（适配层名 + 实际控件 + 可复制调用），业务只出现验证过的写法。
4. **token 优先**：颜色、圆角、阴影、焦点环只用 `--dsw-*`；禁止写死十六进制。
5. **深色岛固定 token**：浅色主题下的深色面板，在岛根固定宿主会读的 token（`--dsw-static-*`），否则开关会白底白滑块。
6. **唯一加载入口**：全插件只有一处 `require('@deepseek-ai/dsh-client-ui-primitives')`，业务只通过 `hostComponent(name)` 取组件。

## 选型决策

| 情况 | 做法 |
|---|---|
| 宿主有该组件 | 直接用适配层包宿主；不重写视觉 |
| 宿主有基础组件，但缺组合 | 用宿主基础组件组合（如 Tooltip + button = IconButton） |
| 宿主没有，且是简单展示 | 本地实现，但几何/token 必须对齐官方 |
| 宿主没有，且交互复杂 | 先停下来说明缺口，设计并评审后再实现 |
| 只是容器/布局 | 不需要适配层，直接布局 |

## 工作流（按顺序）

```text
1. 读规范与对应组件页
2. 查测试页是否已有用例；没有就先加用例
3. 写适配层：宿主分支 + fallback 分支，同一组业务 props
4. 写 fallback CSS：结构 → 几何 → token → 交互
5. 深色面板：在岛根固定 token
6. 自检：native/fallback、浅色/深色、键盘、重复 id、硬编码颜色
7. 同步文档与 CHANGELOG，再提交
```

每一步的交付物：

| 步骤 | 交付 |
|---|---|
| 2 | 测试页用例（adapter / code / 实际控件） |
| 3 | 适配层函数（含宿主与 fallback 两条路径） |
| 4 | fallback CSS（只用 token） |
| 5 | 岛根 token 清单（如需） |
| 6 | 验收结果（两条路径、两套主题、键盘） |
| 7 | 文档与 CHANGELOG 更新 |

## 适配层契约

| 适配层 | 宿主 | 业务侧 onChange |
|---|---|---|
| Button | Button | `onClick(event)` |
| IconButton | 无（Tooltip + button） | `onClick(event)` |
| Switch | Switch | `onChange(boolean)` |
| KitInput | Input | `onChange(value, event)` |
| KitCheckbox | Checkbox | `onChange(boolean)` |
| KitSegmented | SegmentedControl | `onChange(value)`，value 字符串 |
| KitSegmentedTabs | SegmentedTabs | `onChange(value)`，items 带 id/panelId |
| KitPill | Pill | `onClick(event)` |
| KitTag | Tag | 无 |
| KitStateDot | StateDot | 无 |
| KitModal | Modal | `onClose()` |
| KitSelect | Menu | `onChange(id)` |
| SetRow | 无 | 无 |

## 最小代码

宿主加载器：

```js
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
```

适配层骨架：

```js
function AdapterName(props) {
  var value = String(props.value === undefined ? '' : props.value)
  var Host = hostComponent('HostName')
  if (Host !== null) {
    return h(Host, {
      value: value,
      label: props.label || '',
      className: props.className,
      onChange: function (next) {
        if (typeof props.onChange === 'function') props.onChange(next)
      },
    }, props.children)
  }
  return h('div', { className: cx('ui-adapter', props.className) }, props.children)
}
```

测试页用例：

```js
h(GalleryCase, {
  title: t('gallery.caseSwitch'),
  adapter: 'Switch',
  code: "h(Switch, { value, label, onChange })",
}, h(Switch, { value: on, label: label, onChange: setOn }),
   h(Switch, { value: false, label: label, disabled: true }))
```

`code` 里用 `label` / `value` / `onChange` 占位符，不要写文案键。

## 几何与 token 速查

| 项目 | 值 |
|---|---|
| 发丝线 | `.5px` |
| 圆角 | sm 8 / md 12 / lg 16 / xl 20 |
| 按钮 | sm 28 / md 36 |
| 输入框 | 32，内衬 `0 8px` |
| 分段控件 tab | 28 |
| 分段页签 tab | 34（sm 30） |
| 开关 | 36×20，滑块 16，内衬 2 |
| Pill | 24 |
| 图标按钮 | 28×28 |

颜色只用：`--dsw-alias-label-*`、`--dsw-alias-bg-*`、`--dsw-alias-border-*`、`--dsw-alias-interactive-*`、`--dsw-alias-brand-primary`、`--dsw-alias-switch-thumb`、`--dsw-alias-state-*`、`--dsw-elevation-*`、`--dsw-focus-ring-*`。

## 深色岛（最容易踩）

```css
.ui-island{
  --dsw-alias-label-primary: var(--dsw-static-neutral-bluish-50);
  --dsw-alias-label-secondary: var(--dsw-static-neutral-bluish-300);
  --dsw-alias-label-tertiary: var(--dsw-static-neutral-bluish-400);
  --dsw-alias-label-primary-foreground: var(--dsw-static-neutral-bluish-1000);
  --dsw-alias-bg-module-platform: var(--dsw-static-neutral-bluish-800);
  --dsw-alias-brand-primary: var(--dsw-static-neutral-bluish-50);
  --dsw-alias-switch-thumb: var(--dsw-static-neutral-bluish-400);
  --dsw-alias-border-l3: rgba(255, 255, 255, .16);
}
```

只在岛根固定；不要在单个控件上重复。固定后切浅色主题验证开关、分段、输入框、页签。

## 验收门禁

```text
[ ] 测试页有用例（adapter + code + 实际控件）
[ ] native 与 fallback 两条路径都跑过
[ ] 浅色 / 深色 / 深色岛都看过
[ ] 键盘：Tab / Enter / Space / 方向键 / Escape
[ ] 同页无重复 DOM id 与 aria-controls
[ ] 颜色无硬编码，发丝线 .5px
[ ] 文档与 CHANGELOG 已同步
[ ] 构建/测试命令通过（项目自定义）
```

## 常见错误

| 现象 | 原因 | 修正 |
|---|---|---|
| 开关白底白滑块 | 深色岛没固定 `label-primary-foreground` / `brand-primary` / `switch-thumb` | 按岛根清单固定 |
| 分段选中项没有滑块动画 | fallback 用 `.is-on` 画底色 | 加滑动指示块，选中只改文字色 |
| 同页多个分段冲突 | 固定默认 id | 每实例自增 id |
| 输入框 onChange 拿到 event | 宿主 Input 的 onChange 是原生事件 | 适配层取 `event.target.value` |
| 页签样式像分段控件 | 两者 CSS 不同 | 页签 R16/R12、tab 34/30、14px、选中加粗 |
| 图标按钮没有读屏名 | 缺 `aria-label` | `title` 必填，同时作 Tooltip 与 aria-label |
| 菜单定位错乱 | `anchor` 传了 ref 而不是元素 | 传 React 元素；`onSelect` 收 id |
| Button 外观不对 | 宿主默认 variant 是 ghost | 适配层显式传 variant |

## 不要做

- 不要在业务代码里直接 `require` 宿主包。
- 不要复制宿主 CSS 的 hashed 类名；抄值，不抄类名。
- 不要在 fallback 里写死颜色或近似色。
- 不要先写业务、后补测试页。
- 不要为了「更好看」绕过宿主组件。

## 何时停下确认

- 需要一种规范里没有的新视觉语言或新 token。
- 宿主没有对应组件，且 fallback 需要复杂交互（焦点陷阱、拖拽、虚拟列表）。
- 规范与现有代码冲突，或需要改动公共适配层。
- 无法完成验证（无法构建、无法重启、没有测试页入口）。

## 需要更多细节

打开规范文件夹：

```text
README.md                    阅读顺序与接入步骤
04-组件/                     每个控件：签名 → 适配层 → 调用 → CSS → 坑
模板/                        host-ui.js / primitives / gallery / theme.css
契约/                        components.json / geometry.json
脚本/check-kit.mjs           自检
参考/                        宿主签名与关键 CSS 实测
```

## 基线

对齐 DSH 0.2.2-rc.5；skill 版本 1.1.0。DSH 升级后按规范里的 `09-升级复核.md` 从安装包重新读宿主签名与 CSS，再改测试页与 fallback。
