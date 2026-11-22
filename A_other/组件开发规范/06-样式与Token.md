# 06 样式与 Token

所有 fallback 样式只用 DSH 设计 token。禁止写死颜色；几何值按本页与 `参考/` 对齐。

## 1. 几何速查

| 用途 | 值 |
|---|---|
| 小圆角 | `--dsw-radius-sm` 8px |
| 中圆角 | `--dsw-radius-md` 12px |
| 大圆角 | `--dsw-radius-lg` 16px |
| 特大圆角 | `--dsw-radius-xl` 20px |
| 发丝线 | `.5px` |
| 按钮 sm / md | 28px / 36px |
| 输入框 | 32px，内衬 `0 8px` |
| 分段控件 tab | 28px |
| 分段页签 tab | 34px（sm 30px） |
| 开关 | 36×20，滑块 16，内衬 2 |
| Pill | 24px，内衬 `0 8px` |
| Tag | 行高 17px，内衬 `1px 8px` |
| 图标按钮 | 28×28，图标 14/16/18 |
| 设置行 | 最小高度 44px |

## 2. 常用 token

### 文字

```css
var(--dsw-alias-label-primary)            /* 主文字 */
var(--dsw-alias-label-secondary)          /* 次要文字 */
var(--dsw-alias-label-tertiary)           /* 弱化文字 */
var(--dsw-alias-label-dimmed)             /* 占位符 */
var(--dsw-alias-label-primary-foreground) /* 主色按钮上的文字 */
```

### 表面与描边

```css
var(--dsw-alias-bg-base)
var(--dsw-alias-bg-layer-1)
var(--dsw-alias-bg-layer-2)
var(--dsw-alias-bg-layer-3)
var(--dsw-alias-bg-module-platform)       /* 页签外框 */
var(--dsw-alias-border-l1)                /* 分隔线 */
var(--dsw-alias-border-l2)
var(--dsw-alias-border-l3)                /* 开关轨道 / 发丝线 */
var(--dsw-alias-border-l4)                /* 输入框描边 */
```

### 交互与品牌

```css
var(--dsw-alias-interactive-bg-hover)
var(--dsw-alias-interactive-bg-active)
var(--dsw-alias-brand-primary)            /* 开关开启轨道 */
var(--dsw-alias-switch-thumb)             /* 开关关态滑块 */
var(--dsw-alias-button-primary-fill)
var(--dsw-alias-button-primary-hover)
var(--dsw-alias-button-ghost-active-fill)
var(--dsw-alias-button-ghost-active-border)
var(--dsw-alias-button-tool-bar-fill)
```

### 状态

```css
var(--dsw-alias-state-success-primary)
var(--dsw-alias-state-warn-primary)
var(--dsw-alias-state-error-primary)
var(--dsw-alias-state-business-primary)
```

### 阴影与焦点

```css
var(--dsw-elevation-soft)
var(--dsw-elevation-prominent)
var(--dsw-focus-ring-width)
var(--dsw-focus-ring-color)
```

## 3. 交互约定

- hover 写在 `@media (hover: hover)` 里，触摸设备不要粘住；
- disabled：`opacity: .4`（开关 `.5`）+ `cursor: not-allowed`；
- 过渡：颜色 `.12s`，位移 `.16s ~ .18s`，缓动用 `ease` 或 `cubic-bezier(.22,1,.36,1)`；
- focus-visible：`outline: var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color)`；
- 发丝线不要用 `1px`，否则与宿主不在同一视觉重量。

## 4. 可访问性

| 控件 | 必备 |
|---|---|
| 图标按钮 | `aria-label`（同时是 Tooltip） |
| 开关 | `role=switch`、`aria-checked`、`aria-label` |
| 分段 | `role=tablist`、每个 tab `aria-selected`，容器 `aria-label` |
| 页签 | tab id、`aria-controls`、面板 `role=tabpanel` + `aria-labelledby` |
| 弹窗 | `role=dialog`、`aria-modal`、初始焦点、Escape |
| 输入 | `aria-label` 或可见 `<label>` |
| 轻提示 | `aria-live=polite`、`role=status` |

键盘：Tab 能到达、Enter/Space 能触发、方向键能切分段/页签、Escape 关最上层浮层。

## 5. CSS 组织

```text
基础         layout / box-sizing / 光标
几何         height / padding / radius / font
颜色         token
状态         hover / active / disabled / focus-visible
过渡         transition
```

同一个选择器尽量只做一类事；状态用 `.is-on` / `[aria-checked=true]` / `[aria-selected=true]`，不要复制整段规则。

## 6. 常见错误

| 错误 | 后果 | 修正 |
|---|---|---|
| 写死 `#fff` | 浅色主题下刺眼、深色岛上消失 | 换 token |
| 1px 边框 | 与宿主视觉重量不一致 | `.5px` 或 inset 阴影 |
| 用 `.is-on` 画分段底色 | 与宿主指示块动画不一致 | 指示块 + 文字变色 |
| 输入框 36px | 与设置行错位 | 32px |
| hover 不包媒体查询 | 手机上点按后状态粘住 | `@media (hover: hover)` |
