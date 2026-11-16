# 主题与组件开发规范

> 适用于 `plugins/dsh-music`（dsh-music-panel）的 Web 端。
> 新增或修改任何界面之前先读这一页。目标不是「插件里再画一套 UI」，而是让控件在浅色 / 深色下
> 都像 DSH 原生界面的一部分。
>
> 最后核对：2026-11-16，DSH `0.2.2-rc.3`，宿主 UI 适配层（native / fallback）与主题 token。

---

## 0. 先选组件，再写样式

每个新控件按这个顺序决定怎么做，**不要跳过前两层直接写 `<div>`**：

1. **宿主组件**：`src/00-host-ui.js` 的 `hostComponent(name)` 能拿到，就走宿主（Tooltip /
   Switch / Pill / Modal / Menu / Toast）。
2. **本仓原语**：宿主没有、或宿主版本不可用，就用 `src/ui/01-primitives.js` 的本地组件
   （`IconButton` / `Button` / `Switch` / `KitPill` / `KitModal` / `SetRow` / `Empty` / `Spinner` …）。
   本地原语的 fallback 必须和宿主同貌，而不是另一套设计。
3. **一次性布局**：只有纯布局、容器、装饰才直接写元素；颜色、圆角、字号、焦点环仍从 token 来。

判断标准：把插件截图和 DSH 设置页截图并排，**换主题后两边的层级、描边、悬停、焦点行为一致**，
才算完成。只做到「深色能看」不算。

---

## 1. 总则

1. **只用 `--dsw-*` token 取主题值。** 颜色、圆角、字号、焦点环、菜单材质、toast、阴影都从
   token 来；CSS 里不允许出现「看起来像主题色」的写死值（阴影 / 遮罩 / 封面叠层 / §1.1 的
   深色岛除外）。
2. **浅色 / 深色都必须成立。** token 在 `body` 与 `body[data-ds-dark-theme]` 下分别解析；
   新组件要在两种主题下各看一遍。不要用 `prefers-color-scheme` 判断主题。
3. **宿主组件优先。** 如果 `@deepseek-ai/dsh-client-ui-primitives` 提供对应组件，就走适配层用它；
   只有模块缺失（测试 / harness / 旧 DSH）时才回退到本地实现。
4. **样式只作用于自己的 `.mp-*` 命名空间。** 不改宿主类的全局行为，不覆盖宿主的全局
   `--dsw-*` 定义（作用域内的深色岛例外见 §1.1）。
5. **风险边界。** 宿主 client 包是 DSH 内部 API，官方明确不建议第三方插件依赖；所有访问都
   收敛在 `src/00-host-ui.js`，模块不存在时自动回退，升级出问题只修适配层。
6. **不要假控件。** 按钮必须真的执行操作，开关必须真的改状态，空状态/加载态必须对应真实状态；
   只改文案或只画一个胶囊不算功能。
7. **先映射，后发明。** 常见交互（开关、菜单、对话框、提示、胶囊）都已经有对应物；不要为同一
   语义再发明第三种外观。

### 1.1 深色岛例外

播放页 `.mp-np` 和它上面的播放器卡片 `.mp-card` 是**始终深色**的表面，不跟随宿主浅色主题变亮：

| 表面 | 位置 | 做法 |
|---|---|---|
| `.mp-np` | 播放页（Folia stage） | 直接写深色（`#141417` / 白字 / 白色 alpha），`test/theme.test.mjs` 有守卫 |
| `.mp-card` | 播放器卡片（封面 / 本地 / 控制 / 播放列表 / 音质） | 深色玻璃；在 `.mp-card` 作用域把用到的 `--dsw-*` 钉成深色值，覆盖只作用于该子树 |
| `.mp-npe` | 播放页编辑器 | 固定深色；标签/描边用白 alpha，不再读宿主层 token |
| `.mp-np-extra-pop` / 睡眠/效果浮层 | 播放页上的浮层 | 固定深色；文字用白 alpha |

规则：

- 深色岛里的**新控件**先按深色取值（白字 / 白色 alpha / 固定深色底），不要直接拿
  `--dsw-alias-bg-layer-2` 这类会随浅色主题变亮的 token。
- 如果必须让宿主组件（Switch / Tooltip 等）进岛，要在岛的根作用域里把相关 token 钉成深色值，
  不要逐个子组件打补丁。
- 新增长在播放页上的浮层，照 `.mp-card` 的做法在 `test/theme.test.mjs` 加守卫，
  防止以后又变成「深色底 + 浅色 token」的白底白字。

---

## 2. 主题与 token

### 2.1 主题怎么切

DSH 在 `body` 上切换 `data-ds-dark-theme`，同一套 `--dsw-*` 变量在两种状态下解析成不同值。
插件**不监听、不切换**主题，只引用变量：

```css
/* 正确：跟着宿主走 */
.mp-row:hover { background: var(--dsw-alias-interactive-bg-hover); }
.mp-row-title { color: var(--dsw-alias-label-primary); }

/* 错误：自己判断主题 / 写死浅色 */
@media (prefers-color-scheme: dark) { … }
.mp-row-title { color: #18181b; }
```

`prefers-color-scheme` 只允许用于「减少动态效果」这类与主题无关的偏好：
`@media (prefers-reduced-motion: reduce)`。

### 2.2 Token 速查

| 用途 | Token | 说明 |
|---|---|---|
| 应用底色 | `--dsw-alias-bg-base` | 页面最底层 |
| 抬升表面 | `--dsw-alias-bg-layer-1` / `-2` / `-3` | 卡片 / 嵌套表面 / 输入与胶囊底 |
| 浮层 | `--dsw-alias-bg-overlay` | 弹出层、浮层底 |
| 正文 / 次要 / 三级 | `--dsw-alias-label-primary` / `-secondary` / `-tertiary` | 文字层级 |
| 主色背景上的文字 | `--dsw-alias-label-primary-foreground` | 单色 primary 按钮上的字 |
| 分隔线 / 描边 | `--dsw-alias-border-l1` / `-l2` / `-l3` | l1 最弱，l2 用于控件描边 |
| 悬停 / 按下 | `--dsw-alias-interactive-bg-hover` / `-active` | 行、图标按钮、胶囊 |
| 主按钮 | `--dsw-alias-button-primary-fill` / `-hover` | 单色 primary（浅色近黑 / 深色近白） |
| 强调 / 选中 / 焦点蓝 | `--dsw-alias-state-business-primary` | 浅色 `#4176E6`，深色 `#7AAAFF` |
| 错误 / 成功 / 警告 / 空闲 | `--dsw-alias-state-error-primary` / `-success-primary` / `-warn-primary` / `-idle-primary` | 语义状态 |
| 焦点环 | `--dsw-focus-ring-color` + `--dsw-focus-ring-width`（2px） | 键盘焦点 |
| 菜单材质 | `--dsw-menu-surface-fill` + `--dsw-menu-backdrop-filter` | 顶栏/右键菜单 |
| 阴影 | `--dsw-elevation-panel` / `-prominent` / `-soft` | 弹层 / 重点浮层 / 轻阴影 |
| Toast | `--dsw-alias-toast-bg` / `--dsw-alias-toast-label` | 轻提示 |
| 开关滑块 | `--dsw-alias-switch-thumb` | 宿主 Switch 的滑块 |
| 固定中性色 | `--dsw-static-neutral-bluish-50` / `-950` | 深色岛 / 装饰插画等**有意不随主题**的表面 |
| 圆角 | `--dsw-radius-sm` 8 / `-md` 12 / `-lg` 16 / `-xl` 20 / `-panel` 28 | 只允许这几档 |
| 字体 | `--dsw-font-family` | 字号阶 24 / 22 / 20 / 18 / 16 / 14 / 13 / 12 / 11 |

### 2.3 Fallback 规则

`var(--dsw-..., #151517)` 里的兜底值只服务于测试 / harness，**必须是中性深色**，不能是另一套
主题色。真实 DSH 里 token 始终存在；fallback 只保证测试环境不出现透明/继承色。

```css
/* 正确：中性深色兜底 */
color: var(--dsw-alias-label-secondary, #a1a1aa);

/* 错误：兜底成浅色主题值 */
color: var(--dsw-alias-label-secondary, #5f5f66);
```

### 2.4 派生颜色

需要半透明表面、描边、选中底时，用 `color-mix` 从 token 派生，不要写 `rgba(255,255,255,.06)`
这类只在深色下成立的固定值（深色岛除外）：

```css
background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 14%, transparent);
border-color: color-mix(in srgb, var(--dsw-alias-state-business-primary) 46%, transparent);
```

### 2.5 固定中性色什么时候用

`--dsw-static-neutral-bluish-*` 是**有意不跟随主题**的固定中性色，只用于：

- 深色岛（播放页 / 播放器卡片 / 编辑器）；
- 插画、开屏引导这类以图片为主的视觉；
- 封面叠层、阴影、遮罩。

控件本身（按钮、输入、开关、菜单）不要用它，否则浅色主题下会变暗块。

### 2.6 圆角与字号

- 圆角只用 8 / 12 / 16 / 20 / 28（胶囊/圆形用 999 / 50%）。
- 正文 13px / 20px；次要 12px；小号 11px；标题 16 / 20 / 22 / 24。
- 不要出现 6 / 7 / 9 / 10 / 11 / 14 / 18px 圆角，也不要 10.5 / 11.5 / 12.5px 字号。
  `test/theme.test.mjs` 会拦。

---

## 3. 宿主组件适配层

### 3.1 加载与判定

`src/00-host-ui.js` 是**唯一**允许 `require('@deepseek-ai/dsh-client-ui-primitives')` 的地方：

```js
var hostUi = null
try {
  hostUi = require('@deepseek-ai/dsh-client-ui-primitives')
} catch (error) {
  hostUi = null
}
```

`hostComponent(name)` 同时接受函数组件与 `forwardRef` 对象（`value.$$typeof`），拿不到返回
`null`；每个适配组件都必须有等价的本地 fallback，DOM / 类名与之前保持一致。

### 3.2 当前是 native 还是 fallback

- 启动时控制台打印：`[dsh-music-panel] host UI kit: native|fallback`。
- 设置 → 外观底部有「宿主组件 / Host UI kit」状态行。
- 测试环境固定 fallback（没有宿主包），所以**fallback 路径必须始终可用**。
- 不能说「测试过了就等于线上 native 过了」：两边都要看。

### 3.3 图标

`src/15-icons.js` 的 `icon(name, size)`：

1. 先查 `HOST_ICON_MAP`（`src/00-host-ui.js`）里对应的宿主图标组件（如 `search` →
   `IconSearchOutlineRegular`）；
2. 宿主没有映射，就用本地 SVG（Feather/Lucide 路径，MIT）。

规则：

- DSH 有对应图标的，先加进 `HOST_ICON_MAP`，不要手写第二份。
- 音乐专用图标（上一首/下一首/随机/循环/音量/音符）保留本地 SVG。
- 图标默认 `aria-hidden`；可点击图标外面必须是 `button` 且有 `aria-label`/`title`。

### 3.4 新增一个宿主组件

1. 在 `hostComponent` 能取到的名字里确认宿主导出（不要凭记忆猜）。
2. 在适配层写一个包装组件：宿主可用走宿主，否则返回**同 DOM/同 class** 的 fallback。
3. fallback 的 props 与宿主保持同一组（如 `checked` / `onChange` / `label`）。
4. 更新本文 §4 的映射表与 `test/theme.test.mjs` 的必要守卫。
5. 在 native 与 fallback 两种状态下各点一遍。

### 3.5 当前映射

| 语义 | 适配层 | 宿主组件 | fallback |
|---|---|---|---|
| 图标按钮提示 | `IconButton` | `Tooltip`（`label` / `side` / `delayMs`） | `title` + `.mp-iconbtn` |
| 开关 | `Switch` | `Switch`（`checked` / `onChange(next)` / `label` / `title` / `disabled`） | `.mp-switch[role=switch]` |
| 模式胶囊 | `KitPill` | `Pill`（`active` / `className` / `title` / `onClick`） | `.mp-pill` / `.mp-pill.is-on` |
| 对话框 | `KitModal` | `Modal`（`open` / `onClose` / `title` / `footer` / `headless` / `className` / `contentClassName`） | `.mp-overlay` + `.mp-dialog` |
| 顶栏菜单 | `HeadMenu` | `Menu`（`open` / `anchor` / `items` / `selectedId` / `onSelect` / `onClose` / `side` / `align` / `portal` / `compact`） | `.mp-headmenu-pop` |
| 轻提示 | `Toast` | `Toast`（`text` / `holdMs` / `onDone`） | `.mp-toast` |

> 表中的 props 是**适配层实际传给宿主的字段**，不是对 DSH 内部包的公开承诺；宿主升级时先核对。
> 当前只接入了这 6 个宿主组件；Button、输入框、下拉、滑杆、Tab 等仍是本地原语。不要因为
> 「DSH 可能有」就凭空调用未验证的宿主导出——先用 `hostComponent(name)` 探测，拿不到就走
> fallback；新增接入按 §3.4。

---

## 4. 组件规范

### 4.1 组件映射表

| 需要 | 用 | 不要 |
|---|---|---|
| 图标按钮 | `IconButton`（`mp-iconbtn`） | 裸 `<button>` 包 SVG、没有 label |
| 文字按钮 | `Button`（`mp-btn`，default / primary / ghost） | 蓝色实心按钮、不同高度的仿按钮 |
| 开关 | `Switch` | 原生 `<input type=checkbox>` 重新画 |
| 过滤/模式胶囊 | `KitPill` / `.mp-chip` | 用 button 假装胶囊、选中只换字色 |
| 来源 Tab | `.mp-src-tabs` / `.mp-src-tab` | 另造一套圆角 Tab |
| 顶栏/排序菜单 | `HeadMenu` | 自绘 `position:absolute` 弹层 |
| 对话框 | `KitModal` | 新写 `.mp-overlay` + `.mp-dialog` |
| 轻提示 | `showToast` / `Toast` | 自建 toast 容器 |
| 文本输入 | `.mp-kit-input` / `.mp-search-input` / `.mp-field input` | 无边框、无焦点环的 input |
| 原生下拉 | `.mp-set-control select` 或 `.mp-field` 内的原生 `<select>` + token | 自绘下拉（除非确实需要搜索/多选） |
| 滑杆 | `.mp-range` / `accent-color: var(--dsw-alias-state-business-primary)` | 写死蓝色 |
| 设置行 | `SetRow` / `mpPanelRow` | 标签和值各写各的间距 |
| 列表行 | `.mp-row` / `.mp-srow` / `.mp-q-row` | 每处重新定义行高和封面尺寸 |
| 空/加载 | `Empty` / `Spinner` | 空白页或假骨架 |

### 4.2 IconButton

- 结构：`button.mp-iconbtn` → `icon(name, size)`；有 `title` 时自动套宿主 `Tooltip`。
- 尺寸：30×30，圆角 8，图标 16–17；播放页特殊尺寸在 `.mp-np` 作用域单独覆盖。
- 颜色：默认 `label-secondary`；悬停 `interactive-bg-hover` + `label-primary`；激活
  `is-on` 用 `state-business-primary`。
- 无障碍：必须有 `title` 或 `aria-label`；禁用时 `disabled`，不要只降透明度。
- 不要：图标按钮没有提示；用 `div` 绑定点击；在浅色主题写死白色图标。

### 4.3 Button

- 变体：默认（layer-3 底 + border-l2）、`primary`（单色 `button-primary-fill` +
  `label-primary-foreground`）、`ghost`（透明 + secondary 字）。
- 尺寸：高 30，圆角 8，图标 14，水平 padding 12；同组按钮间距 6–8。
- 禁用：`disabled` + 透明度 0.5；不要用「看似可用」的按钮弹 toast。
- 不要：蓝色实心 primary（官方 primary 是单色）；自造第二个按钮类。

### 4.4 Switch

```js
h(Switch, {
  value: prefs.showTranslation === true,
  label: t('page.translation'),
  onChange: function (next) { setPrefs({ showTranslation: next }) },
})
```

- 宿主可用时用宿主 `Switch`；fallback 是 `button[role=switch]` + `.mp-switch`。
- 轨道：关 `interactive-bg-active`，开 `state-business-primary`；滑块白色 / `switch-thumb`。
- 必须传 `label`（屏幕阅读器）与 `value`（真实状态）；`onChange` 里写回真实偏好。
- 不要：受控值来自本地临时 state 却不同步回 store；用文字「开/关」代替开关。

### 4.5 Pill / Chip / Tab

- **模式胶囊**（顺序/随机/单曲循环等）用 `KitPill`；**筛选 chip**用 `.mp-chip`；
  **来源切换**用 `.mp-src-tabs` / `.mp-src-tab`。
- 选中态必须同时有底色与文字变化，不能只换颜色；`is-on` 用 `interactive-bg-active` /
  business 混合，边框用 `border-l2` 或 business。
- 高度：Pill 32，Chip 26，Src Tab 26；圆角：Pill 999，Chip/Tab 8。
- 无障碍：`aria-pressed` 或 `role=tab` + `aria-selected`；键盘可聚焦。
- 不要：用胶囊当主按钮；同一行混用三种胶囊外观。

### 4.6 Menu

`HeadMenu` 的 item 形状：

```js
{
  key: 'title',          // 唯一 id
  label: '标题',
  icon: 'note',          // 可选，走 icon()
  hint: '↑',             // 可选，右侧提示
  active: true,          // 可选，当前项
  disabled: false,       // 可选
  danger: true,          // 可选，危险操作
  separator: true,       // 分隔线（只需 key）
  run: function () {},   // 选中后执行
}
```

- 宿主 `Menu` 可用时自动 portal / 定位 / 键盘；fallback 自己处理外部点击与 Escape。
- 打开态由组件内部管理；调用方只给 items 与 `hostMenu`（需要禁用宿主菜单时传 `false`）。
- 外观：`--dsw-menu-surface-fill` + `--dsw-menu-backdrop-filter` + `elevation-panel`。
- 不要：在业务组件里直接写弹层定位；菜单项没有 `key` / `run`；危险项没有 `danger`。

### 4.7 Modal

统一用 `KitModal`：

```js
h(KitModal, {
  title: t('v2.newPlaylist'),
  onClose: popLayer,
  footer: [cancelButton, createButton],
}, body)
```

- 宿主 `Modal` 负责焦点陷阱、Escape、portal；fallback 是 `.mp-overlay` + `.mp-dialog`。
- 两栏设置用 `headless: true`（保留自己的两栏布局，宿主只提供模态壳）。
- 外观：`bg-layer-1` 底 + `border-l2` + `elevation-panel`；圆角宿主 Modal 用 panel（28），
  fallback `.mp-dialog` 用 16；标题 13–16。
- 底部按钮顺序：取消在左、主操作在右；主操作只用一个 `primary`。
- 不要：新对话框直接写 `mp-overlay + mp-scrim + mp-dialog`（`theme.test` 会拦）；
  对话框里再套一个全屏遮罩。

### 4.8 Toast

- 用 `showToast(text)`；宿主 `Toast` 可用时走宿主，否则 `.mp-toast`。
- 只用于「操作已发生」的轻反馈（已保存 / 已复制 / 已加入）；需要用户决策的错误用对话框。
- 时长由宿主/组件控制（fallback 约 1.8s）；不要堆叠多条，后一条覆盖前一条。
- 无障碍：`role=status`；不要把焦点移到 toast。

### 4.9 Input / Select / Range

- 文本输入：`.mp-kit-input`、`.mp-search-input`、`.mp-head-search-input`、`.mp-field input`；
  底 `bg-layer-2`，描边 `border-l1`，字 `label-primary`，placeholder `label-tertiary`。
- 焦点：`border-color: state-business-primary` + `box-shadow: 0 0 0 3px color-mix(...)`。
- 原生 `<select>` 可以保留，但必须套 token（背景、描边、字色、圆角 8）；设置行用
  `.mp-set-control select`，编辑器里用 `.mp-npe-body select`。
- 滑杆：`.mp-range` + `accent-color: var(--dsw-alias-state-business-primary)`；不要自绘轨道。
- 不要：输入框没有 `aria-label`/关联 label；高度/圆角各自发明。

### 4.10 列表行 / 封面 / 空状态 / 加载

- 歌曲/歌手/专辑/队列行分别用 `.mp-row` / `.mp-entry-row` / `.mp-srow` / `.mp-q-row`，
  不要在每个视图里重设行高。
- 封面容器必须 `overflow:hidden` 且 `img { width:100%; height:100%; object-fit:cover }`；
  无封面时用 `icon('note')` 或 `Cover` 的占位，不要留白块。
- 当前播放行：`is-cur` + business 混合底 + 左侧 3px 竖条（`.mp-row.is-cur::before`）。
- 空状态：`Empty`（图标 + 标题 + 提示）；加载：`Spinner`；不要用「暂无」占位冒充数据。
- 浅色/深色：行的 hover/选中/副标题全部走 token；封面颜色可以保留图片自身颜色。

### 4.11 设置行

- 设置页用 `SetRow`（`.mp-set-row`）：左侧 label + desc，右侧 control。
- 播放器卡片里的设置用 `mpPanelRow`（label 14/20，control 右对齐，窄屏换行）。
- 窄屏（≤620px）`SetRow` 自动改为上下排列；控件不要溢出。
- 不要：label 与值写在不同容器却不对齐；desc 用正文色（应 `label-tertiary`）。

### 4.12 播放页专用（深色岛）

- `.mp-np`、`.mp-card`、`.mp-npe` 及其浮层按 §1.1 处理。
- 文字/图标用白色 alpha（`rgba(255,255,255,.xx)`）或 `.mp-card` 作用域里的深色 token；
  不要直接读宿主的 `bg-layer-2` / `label-primary`（浅色主题下会变白底/深字）。
- 播放页的控件尺寸可以更大（46–48 圆形按钮），但圆角仍走 8/12/16/20/999。
- 新样式/浮层先在浅色主题下看：如果出现白底白字或深字深底，说明又漏了深色岛处理。

---

## 5. 浅色 / 深色适配

### 5.1 必须检查的 8 项

1. 容器底色：`bg-base` / `bg-layer-1/2/3`，还是深色岛？
2. 文字：`label-primary` / `secondary` / `tertiary`，有没有继承到错的颜色？
3. 描边/分隔线：`border-l1/l2`，浅色下是否还看得见？
4. 悬停/按下：`interactive-bg-hover/active`，不要写死 `rgba(255,255,255,.07)`。
5. 选中/强调：`state-business-primary` 或其 `color-mix`。
6. 主按钮：`button-primary-fill` + `label-primary-foreground`。
7. 焦点环：键盘 Tab 到每个可交互元素都可见 2px `focus-ring-color`。
8. 深色岛：浅色主题下是否仍然深底白字，且没有混入宿主浅色 token。

### 5.2 组件对照

| 组件 | 浅色主题 | 深色主题 | 备注 |
|---|---|---|---|
| IconButton | secondary 图标，hover 浅灰底 | secondary 图标，hover 白 alpha 底 | 不要写死颜色 |
| Button | 默认浅底深字；primary 近黑底白字 | 默认深底浅字；primary 近白底深字 | primary 单色，不是蓝色 |
| Switch | 关浅灰轨道，开 business 蓝 | 关白 alpha 轨道，开 business 蓝 | 滑块白/`switch-thumb` |
| Pill/Chip | 浅底深字，选中 business 混合 | 深底浅字，选中 business 混合 | 状态不只靠颜色 |
| Menu | 浅色菜单面 + 阴影 | 深色菜单面 + 阴影 | `menu-surface-fill` |
| Modal | 浅色 layer-1 + scrim | 深色 layer-1 + scrim | 用 KitModal |
| Toast | 浅色 toast 底 + 深字 | 深色 toast 底 + 浅字 | `toast-bg/label` |
| Input | 浅底 + l1 描边 | 深底 + 白 alpha 描边 | 焦点环 business |
| 播放页/卡片 | 仍然深色（§1.1） | 深色 | 不要跟主题变亮 |

### 5.3 常见错误

- **深色岛读宿主层 token**：浅色下 `--dsw-alias-bg-layer-2` 变近白，深色卡片上出现白块白字。
  处理：在岛根作用域钉深色 token，或用白 alpha。
- **深字深底**：深色岛用了 `label-primary`，浅色主题解析成近黑。处理：深色岛统一白字。
- **描边消失**：浅色主题用白 alpha 描边。处理：岛内白 alpha，岛外 `border-l1`。
- **只测深色**：浅色主题下 `#fff` 图标直接消失。处理：图标颜色跟 `currentColor`。
- **用 `prefers-color-scheme` 判断主题**：DSH 用 `data-ds-dark-theme`，媒体查询不会跟着切。
- **在深色岛里用宿主 Switch 却不钉 token**：开关轨道按浅色主题变亮。处理：作用域内钉 token。

### 5.4 怎么验证两种主题

1. 在 DSH 里切到浅色，刷新插件面板；再切到深色重复一遍。
2. 看控制台 `host UI kit` 是 native 还是 fallback；两种都要成立。
3. 重点看：菜单、对话框、开关、输入框、空状态、播放页卡片、播放页浮层。
4. 键盘 Tab 一遍；确认焦点环在两种主题下都可见。
5. 改主题 token 或新增深色岛时，在 `test/theme.test.mjs` 加一条守卫。

---

## 6. 尺寸、间距、动效

### 6.1 原生观感基准

| 元素 | 常用值 |
|---|---|
| 图标按钮 | 30×30，圆角 8，图标 16–17 |
| 文字按钮 | 高 30，圆角 8，字号 13，图标 14，水平 padding 12 |
| 胶囊 / Chip | Pill 高 32 / 圆角 999；Chip 高 26 / 圆角 8 |
| 菜单项 | 高 32 左右，圆角 8，padding 7–9，字号 13，图标 13 |
| 对话框 | 宽 640（小号 380–420），fallback 圆角 16 / 宿主 Modal 走 panel 圆角 28，标题 13–16，底部按钮 30 |
| 设置行 | 最小高 44，上下 padding 11，分隔线 `border-l1` |
| Toast | 圆角 12，padding 8×14，字号 13 |
| 输入框 | 高 30–32，圆角 8，字号 12–13 |
| 歌曲行 | 高 84，封面 56，标题 16，副标题 14 |

### 6.2 间距与动效

- 圆角：8 / 12 / 16 / 20 / 28；胶囊/圆形 999 / 50%。
- 字号：24 / 22 / 20 / 18 / 16 / 14 / 13 / 12 / 11；正文 13/20。
- 间距：4 / 6 / 8 / 10 / 12 / 16 / 22 / 24；不要 5/7/9/13 这类无规律值。
- 动效：快 0.12s、移动 0.22s、展开 0.3s，缓动 `cubic-bezier(.22,1,.36,1)` 或
  `cubic-bezier(.4,0,.2,1)`；不要弹跳/旋转过度。
- `@media (prefers-reduced-motion: reduce)` 下关闭非必要动画。
- 滚动条：卡片/面板内部滚动隐藏滚动条（`.mp-card-scroll`），列表保留系统滚动条；
  不要为了一帧动画出现滚动条造成布局跳动。

---

## 7. 无障碍与键盘

- 所有可交互元素必须能 Tab 到，`:focus-visible` 2px `--dsw-focus-ring-color`。
- 图标按钮：`title` + `aria-label`；只读图标 `aria-hidden="true"`。
- 开关：`role="switch"` + `aria-checked`（宿主组件自带）。
- Tab/胶囊组：`role="tab"` + `aria-selected`，或 `aria-pressed`。
- 菜单：`role="menu"` / `menuitem`；Escape 关闭；方向键（宿主 Menu 负责，fallback 至少支持 Esc）。
- 对话框：焦点陷阱、Esc 关闭、关闭后焦点回到触发点；宿主 Modal 负责，fallback 需要调用方补。
- Toast：`role="status"`，不抢焦点。
- 表单：每个 input 有 label / `aria-label`；错误提示用文字，不只靠红色。
- 不要：`div` + `onClick` 当按钮；禁用态只改透明度不设 `disabled`。

---

## 8. 验收清单

新增/修改组件后至少跑：

1. `node scripts/build-client.mjs`（改 `src/**` 后必须）
2. `node scripts/build-client.mjs --check`
3. `npm test`（含 `test/theme.test.mjs` 主题守卫）
4. `npm run check`
5. 真实 DSH 里刷新后确认：
   - 控制台 `[dsh-music-panel] host UI kit: native` 或 `fallback`，两条路径都可用
   - 设置 → 外观 →「宿主组件」状态正确
   - 浅色 / 深色各看一遍
   - 菜单、对话框、开关、输入框、播放页卡片
   - Tab 焦点环、Esc、方向键、外部点击
   - 宽屏 / ≤900px / ≤720px 三档不溢出
6. 改 Folia 样式/背景时，先重建对应 bundle 再 build-client（见 [踩坑记录](pitfalls.md)）。

守卫会拦：非 8/12/16/20 圆角、10.5/11.5/12.5 字号、旧蓝色、适配层之外 require 宿主包、
非 KitModal 的对话框、播放页/卡片的深色面被浅色 token 破坏。

---

## 9. 反例（review 直接打回）

- 写死颜色：`#141417`、`#5686fe`、`#f4f4f5`、`rgba(255,255,255,.07)` 作为最终颜色
  （阴影 / 遮罩 / 封面叠层 / §1.1 深色岛除外）。
- 圆角 `6/7/9/10/11/14/18px`。
- 字号 `12.5px` / `11.5px` / `10.5px`。
- 新对话框直接写 `mp-overlay + mp-scrim + mp-dialog`。
- 新图标直接手写 `<svg>`，没有进 `HOST_ICON_MAP`。
- 蓝色实心主按钮（官方 primary 是单色）。
- 在适配层之外 `require` 宿主 client 包。
- 用原生 checkbox 重新画开关；用 div 画按钮。
- 只改标签不接真实状态（假按钮 / 假数据）。

---

## 10. 文件地图

| 文件 | 职责 |
|---|---|
| `src/90-theme.js` | 全部 CSS 与 `--dsw-*` 使用 |
| `src/00-host-ui.js` | 宿主模块加载、`hostComponent`、`HOST_ICON_MAP` |
| `src/15-icons.js` | `icon()` 本地 SVG + 宿主图标分流 |
| `src/ui/01-primitives.js` | `IconButton`、`Button`、`Switch`、`KitPill`、`KitModal`、`SetRow`、`Cover`、`Spinner`、`Empty`、`SeekBar` |
| `src/ui/07-dialogs.js` | `Toast`、确认框、右键菜单等浮层 |
| `src/ui/16-header.js` | `HeadMenu`、`ContentHeader`、选择/排序菜单 |
| `src/ui/06-settings.js` | 设置面板（headless Modal）与宿主组件状态行 |
| `src/ui/20-player-sheet.js` | 播放器卡片（深色岛） |
| `src/ui/04-now-playing.js` | 播放页（深色岛）与播放页设置 |
| `src/ui/25-look-picker.js` | 外观选择器（歌词样式 / 背景） |
| `test/theme.test.mjs` | 主题/组件守卫 |
| `docs/theme-guidelines.md` | 本文档 |
| `docs/screenshots/v2-light.png` / `v2-dark.png` | 浅色 / 深色基准图 |

---

## 11. 变更记录

| 日期 | 变更 |
|---|---|
| 2026-11-11 | 初版：从 0.15–0.18 的官方主题对齐与宿主组件接入整理而成 |
| 2026-11-16 | 补 §1.1「深色岛例外」：播放页与播放器卡片始终按深色取值，修复浅色模式白底白字 |
| 2026-11-16 | 扩成完整组件开发规范：主题机制、token 表、适配层、8 类组件、浅/深色对照、验收清单 |
