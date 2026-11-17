# 主题与组件开发规范

> 适用：`plugins/dsh-music`（dsh-music-panel）的 Web 端。
> **新增或修改任何界面组件前，先读 §0–§2；选型按 §3，验收按 §6。**
>
> 上游依据：DSH 官方文档与主题源码的本地存档，见 [A_other/design/references/README.md](../design/references/README.md)
> （pin 在 `dsh-v0.2.2-rc.3`，与本机运行的 DSH 同版本）。**官方文档优先于本文**：冲突时以官方为准，并回头修本文。
>
> 规则等级：**MUST** = review 直接打回；**SHOULD** = 默认这样做；**NEVER** = 禁止。

---

## 0. 开工判断：有没有参考界面

新界面的做法只有两条路，先判断，再动手。

### 0.1 没有参考界面

按实际需求设计，但结构必须由本仓已有的**页面骨架**拼成（§1.3），控件按 §3 选型，外观按 §2 执行。

### 0.2 有参考界面

参考界面可以是截图、别的应用、Folia 上游面板、原型图。对齐分三层，**按顺序判断，互不越界**：

| 层 | 跟谁 | 管什么 |
|---|---|---|
| ① 布局与排版 | **参考界面** | 区块划分、元素顺序、分组关系、对齐方式、左右/上下栏的相对位置与占比、信息密度、滚动结构、窄屏如何折叠 |
| ② 组件类型 | **参考界面** | 下拉就是下拉、胶囊就是胶囊、分段就是分段、滑块就是滑块、图片网格就是图片网格；不能用“功能一样”作为换类型的理由 |
| ③ 组件外观 | **DeepSeek Harness** | 颜色、描边、阴影、圆角、字号、字重、间距刻度、图标、焦点环、动效、菜单/对话框材质——全部 DSH 官方，**不照搬参考界面的视觉** |

边界：

- **① 只到结构层**：对齐“谁在哪、先后顺序、成组关系、占多少比例”，不对齐参考的具体像素。参考行高 40、DSH 行高 44 → 取 44；参考面板宽 420、DSH 面板按内容与断点定 → 按断点。
- **② 优先于 ③**，但 ③ 中的硬规范（token、圆角档位、无障碍、深色岛）不可被 ① ② 覆盖。参考把主按钮做成蓝色实心，DSH 的 primary 是单色 → 仍用单色。
- **参考的组件类型 DSH 没有时**：用最接近的官方控件或本仓原语承担，**不伪装**成参考里的控件；交付说明里登记“参考是 X，DSH 无对应，用 Y”。
- 交付时逐层自查一遍：布局逐项对照参考 → 组件类型逐项对照 → 外观只查 DSH 合规。

---

## 1. 三层结构：骨架 → 区块 → 控件

### 1.1 三层顺序（MUST）

| 顺序 | 用什么 | 位置 |
|---|---|---|
| 1 | 宿主组件（DSH 官方 primitives） | `src/client/app/host-ui.js` 的 `hostComponent(name)` |
| 2 | 本仓原语（含宿主适配与 fallback） | `src/client/components/ui/primitives.js` |
| 3 | 一次性布局（纯容器/网格/装饰） | 直接写元素；颜色/圆角/字号仍走 token |

**NEVER**：跳过前两层自己写一个控件；只改文案或只画个壳冒充功能。

### 1.2 宿主组件是唯一跨包通道

- 只有 `host-ui.js` 可以 `require('@deepseek-ai/dsh-client-ui-primitives')`；其他文件一律经 `hostComponent(name)` 取。
- 每个适配组件必须有**同 props、同 DOM 语义**的 fallback（测试与 harness 没有宿主包）。
- 启动时控制台打印 `[dsh-music-panel] host UI kit: native|fallback`；设置 → 外观有状态行。
- **NEVER** 认为“测试过了 = 线上 native 了”；两条路径都要看。

### 1.3 页面骨架（新界面从这里拼）

新界面不要临场发明骨架，按下面四类之一组织，全屏面板的样式复用现有类：

| 骨架 | 用在哪 | 现有类 / 组件 |
|---|---|---|
| 设置页 | 插件设置、偏好分组 | `KitModal(headless) > .mp-sheet` + `.mp-sheet-nav/.mp-sheet-tab/.mp-sheet-body`；行用 `SetRow(.mp-set-row)` |
| 两栏工作台 | 预览 + 设置面板（如样式工作室类界面） | `.mp-sheet` 内两栏：左预览/主区 + 右设置列；右列表头用 `.mp-set-label`，分组用 `.mp-studio-sep` 式 1px 分隔 |
| 列表页 | 曲库、队列、在线结果 | `.mp-row/.mp-entry-row/.mp-srow/.mp-q-row`，工具栏用 `.mp-sectionbar` |
| 浮层 | 菜单、确认框、轻提示 | `KitModal` / `HeadMenu` / `showToast` |

骨架内的**分区标题**统一用 `.mp-set-label`（13/20 加粗）与 `.mp-set-desc`（12/18 tertiary），不要每页自己发明标题层级。

---

## 2. 外观：DSH 决定

### 2.1 颜色只来自 token

DSH 用 `body[data-ds-dark-theme]` 切主题，同一套 `--dsw-*` 在两种状态下解析成不同值。插件**不监听、不切换**主题。

```css
/* 正确 */
.mp-row:hover { background: var(--dsw-alias-interactive-bg-hover); }
.mp-row-title { color: var(--dsw-alias-label-primary); }

/* 错误 */
@media (prefers-color-scheme: dark) { … }
.mp-row-title { color: #18181b; }
```

- 功能样式只用 `--dsw-alias-*` 语义别名；**NEVER** 复制静态色板值，或在功能样式里写十六进制、颜色函数、`white`/`black` 字面量（官方 color-token spec 会拒收）。
- 派生表面（半透明底、描边、选中底）用 `color-mix` 从 token 派生，不写只在深色成立的 `rgba(255,255,255,.06)`。
- `var(--dsw-…, #151517)` 的 fallback 只服务测试/harness，**必须是中性深色**。
- `prefers-color-scheme` **NEVER** 用于主题；只允许 `prefers-reduced-motion`。

### 2.2 Token 速查

完整取值以 [official/tokens/](../design/official/tokens/) 为准（`base.css`、`design-platform.css`、`focus.css`、`corner-shape.css`、`scrollbar.css`）。常用语义别名：

| 用途 | Token |
|---|---|
| 应用底 / 抬升表面 / 浮层 | `--dsw-alias-bg-base` / `--dsw-alias-bg-layer-1·2·3` / `--dsw-alias-bg-overlay` |
| 文字层级 | `--dsw-alias-label-primary` / `-secondary` / `-tertiary`；主色底上的字 `-primary-foreground` |
| 描边 | `--dsw-alias-border-l1`…`-l4`（l1 最弱；设置卡片用 `-settings-card-stroke`） |
| 悬停 / 按下 / 选中底 | `--dsw-alias-interactive-bg-hover` / `-active` |
| 主按钮 | `--dsw-alias-button-primary-fill` / `-hover` |
| 强调 / 焦点蓝 | `--dsw-alias-state-business-primary` |
| 状态 | `--dsw-alias-state-error-primary` / `-success-primary` / `-warn-primary` / `-idle-primary` |
| 焦点环 | `--dsw-focus-ring-color` + `--dsw-focus-ring-width`（2px） |
| 菜单材质 | `--dsw-menu-surface-fill` + `--dsw-menu-backdrop-filter` |
| 阴影 / 层级 | `--dsw-elevation-panel` / `-prominent` / `-soft` |
| Toast / 开关滑块 | `--dsw-alias-toast-bg` / `-toast-label` / `--dsw-alias-switch-thumb` |
| 固定中性色 | `--dsw-static-neutral-bluish-50` / `-950`（只用于深色岛、插画、遮罩） |

### 2.3 几何：圆角按“用途 × 高度”

官方 [ui-radius](../design/official/dsh-ui-radius.zh.md) 规定的是档位与用法的对应，不是“随便挑一个档”：

| 用途 | 高度 | 圆角 | token |
|---|---|---|---|
| 小细节（键帽、行内代码） | < H20 | R4 | `--dsw-radius-xs` |
| 紧凑控件（小按钮、紧凑图标按钮、紧凑菜单项） | H20–28 | R8 | `--dsw-radius-sm` |
| 标准控件 / 单行 cell（按钮、输入框、选择器、导航行） | H32–40 | R12 | `--dsw-radius-md` |
| 大控件 / 分组内容 | 多行 cell、嵌套表单组 | R16 | `--dsw-radius-lg` |
| 独立内容卡片（设置卡片、气泡、引导卡） | — | R20 | `--dsw-radius-xl` |
| 主容器（对话框、面板、输入框容器） | — | R28 | `--dsw-radius-panel` |

- 胶囊与正圆用 `999px` / `50%`，并在同一规则里配对 `corner-shape: round`（主题默认 `superellipse(1.5)`，圆与胶囊必须保持圆弧）。
- **NEVER** 新增 6/7/9/10/11/14/18px 圆角，也不要自造 10/14/24 这类局部值（官方明令不允许）。
- 嵌套几何：内层 R = max(0, 外层 R − 内缩)；菜单外框 R16 + 4px 内衬 + 菜单项 R12（紧凑版 R12 / 3px / R8）。
- 首尾相接的贴边表面用 R0；只给外露的外围拐角圆角。

### 2.4 表面材质：层级阴影优先于描边

- 抬升表面（菜单、浮层、对话框、面板、悬浮按钮、输入框）：`border: 0` + `box-shadow: var(--dsw-elevation-panel|prominent|soft)`；阴影自带 0.5px 发丝描边，**NEVER** 再叠一层 `--dsw-alias-border-*`。
- 平面中性描边与分隔线：**0.5px**，颜色用 `--dsw-alias-border-*`；dashed 记号与状态色描边保持 1px。
- 设置卡片：`border-radius: var(--dsw-radius-xl)`；`border: .5px solid var(--dsw-alias-settings-card-stroke)`；`background: var(--dsw-alias-settings-card-fill)`。
- 菜单：材质只由 `--dsw-menu-surface-fill` + `--dsw-menu-backdrop-filter` 组成，功能样式**不得覆盖**；菜单一律用 `Menu`/`MenuSurface`。
- 对话框：用 `KitModal`（宿主 `Modal`）；遮罩与模糊交给宿主，不自己加 `backdrop-filter`。
- 链接：`--dsw-alias-link`，`font-weight:500`，默认无下划线，hover/focus 时 3px offset 点状下划线。

### 2.5 字号、间距、动效、焦点

- 字号必须与行高配对；正文 13/20，次要 12，小号 11；标题 16/20/22/24。**NEVER** 10.5/11.5/12.5px。
- 间距 4/6/8/10/12/16/22/24；不要 5/7/9/13 这类无规律值。
- `:hover` 规则放进 `@media (hover: hover)`；无 hover 时操作保持可见或可点击。触摸目标按 `(pointer: coarse)` 加大。
- 焦点环：键盘可见 2px `--dsw-focus-ring-color`；不要裁掉外露焦点环。
- 动效：快 0.12s、移动 0.22s、展开 0.3s；缓动 `cubic-bezier(.22,1,.36,1)` 或 `cubic-bezier(.4,0,.2,1)`；`prefers-reduced-motion` 下关闭非必要动画。
- 滚动条：卡片/面板内部滚动隐藏滚动条（`.mp-card-scroll`），列表保留系统滚动条；不要为了一帧动画出现滚动条造成布局跳动。

### 2.6 深色岛（唯一例外）

`.mp-np`（播放页）、`.mp-card`（播放器卡片）、`.mp-npe`（编辑器）及播放页浮层**始终深色**，不跟随浅色主题：

- 岛内新控件先按深色取值（白字 / 白色 alpha / 固定深色底），不直接读会随浅色变亮的 `--dsw-alias-bg-layer-*`。
- 必须让宿主组件进岛时，在**岛根作用域**把相关 token 钉成深色值，不逐个子组件打补丁。
- 新增长在播放页上的浮层，照 `.mp-card` 的做法在 `test/client/theme.test.mjs` 加守卫。
- **NEVER** 在深色岛里用宿主 Switch 却不钉 token。

---

## 3. 组件选型：官方目录优先

### 3.1 常见需求 → 用什么

| 需要 | 用 | 不要 |
|---|---|---|
| 普通按钮 | `Button`（宿主 `Button`；变体 primary / ghost / outline / toolbar，`sm` H28/R8、`md` H36/R12） | 裸 `<button>`、蓝色实心、不同高度的仿按钮 |
| 图标按钮 | `IconButton`（H28/R8；`title` 自动套宿主 Tooltip） | 无 label 的纯图标 |
| 开关 | `Switch`（宿主 36×20；`label` 必填） | 原生 checkbox 重画 |
| 互斥分段 / Tab | `SegmentedControl`（外框 R12 + 4px 内衬 + R8 分段）；页面级 Tab 用 `SegmentedTabs`（md 42px / sm 34px） | 用一排 Pill 当互斥 Tab |
| 多选 chip / 视图切换 | `Pill`（可多选，各自 active） | 用 Pill 表示互斥状态 |
| 只读徽章 | `Tag`（11px，`tone` 八种） | 自画彩色胶囊 |
| 下拉选择 | **`Menu`**（DSH 没有 Select；下拉一律是锚定菜单） | 原生 `<select>` 自绘、div 弹层 |
| 文本输入 | `Input`（宿主单行输入，可带 icon） | 无边框、无焦点环 |
| 滑杆 | `.mp-range` + `accent-color` token | 写死蓝色、自绘轨道 |
| 复选框 | `Checkbox`（带可见 label） | 只画对勾 |
| 设置行 | `SetRow` / `mpPanelRow` | 标签和值各写各的间距 |
| 列表行 | `.mp-row` / `.mp-srow` / `.mp-q-row` | 每处重设行高/封面尺寸 |
| 空/加载 | `Empty` / `Spinner` | 空白页或假骨架 |
| 状态点 | `StateDot`（done/warning/error/idle/ongoing） | 自画彩色圆点 |
| 轻提示 | `showToast` / `Toast` | 自建 toast 容器 |
| 对话框 | `KitModal` | 新写 `.mp-overlay + .mp-dialog` |
| 顶栏 / 右键菜单 | `HeadMenu` | 自绘 `position:absolute` 弹层 |

### 3.2 当前宿主映射（会随 DSH 升级变化）

| 语义 | 适配层 | 宿主组件 | fallback |
|---|---|---|---|
| 按钮 | `Button` | `Button`（`variant` / `size` / `icon`） | `.mp-btn`（`is-primary` / `is-ghost` / `is-toolbar`，`is-md`） |
| 图标按钮 | `IconButton` | `Tooltip`（`label` / `side` / `delayMs`） | `title` + `.mp-iconbtn` |
| 开关 | `Switch` | `Switch`（`checked` / `onChange` / `label`） | `.mp-switch[role=switch]` |
| 胶囊 | `KitPill` | `Pill`（`active` / `onClick`） | `.mp-pill` |
| 输入 | `KitInput` | `Input`（原生 input 属性 + `icon`） | `.mp-kit-input` |
| 复选 | `KitCheckbox` | `Checkbox`（`checked` / `onChange` / `label`） | `.mp-check` |
| 分段 | `KitSegmented` | `SegmentedControl`（`id` / `value` / `options` / `onChange` / `label`） | `.mp-segment` |
| Tab | `KitSegmentedTabs` | `SegmentedTabs`（`items` / `value` / `onChange` / `label` / `size`） | 同 `.mp-segment` |
| 标签 | `KitTag` | `Tag`（`tone`） | `.mp-tag` |
| 状态点 | `KitStateDot` | `StateDot`（`state`） | `.mp-state-dot` |
| 对话框 | `KitModal` | `Modal` | `.mp-overlay + .mp-dialog` |
| 菜单 | `HeadMenu` | `Menu` | `.mp-headmenu-pop` |
| 轻提示 | `Toast` | `Toast` | `.mp-toast` |

> 表中 props 是适配层**实际传给宿主**的字段；宿主升级时先核对。
> 没有把握的名字不要凭空调用——`hostComponent(name)` 探测到才用。

### 3.3 新增一个宿主组件的流程

1. 在官方 `ui-primitives` README（[存档](../design/official/dsh-ui-primitives.README.zh.md)）或源码里确认导出名与 props，**不要凭记忆猜**。
2. 在适配层写包装：宿主可用走宿主，否则返回同 DOM/同 class 的 fallback。
3. fallback 按 §2 的几何与材质实现（高度 ↔ 圆角、0.5px 发丝线、token 取色）。
4. 在 §3.2 表里登记，并补 `test/client/theme.test.mjs` 的守卫。
5. 在「设置 → 关于 → 测试页面」里加一个用例，native 与 fallback 各看一眼。

---

## 4. 页面级审查（新增整页 / 整个弹窗）

零件合规不代表组合合规。交付前按官方 [UI 审查基准](../design/official/dsh-ui-design-review-cases.zh.md) 的顺序看一遍：

1. **整体**：材质（层级阴影 vs 平面描边）、字体与行高、圆角档位、密度、响应式折叠是否同一套语言。
2. **组间关系**：分区之间的间距与分隔、对齐基线、同角色元素是否同一尺寸与同一状态样式。
3. **组内元素**：行高、图标尺寸、标签与值的对齐、hover/选中/禁用/焦点四态齐全。
4. **把发现放回整体**：某个控件单独看合规、组合后出现双描边、分组断裂、焦点被裁切，都算问题。
5. **对齐**：以角色判断对齐边（标题操作 vs 行操作）；不等长文字用基线而不是盒边判断；复合控件整组居中。
6. **空间分组**：用间距表达关系，不要每个块都加卡片；同组用 12–16，组间用 22–24。
7. **整屏密度**：一屏能看多少信息由行高与间距决定，不靠缩字号。
8. **信息层级**：同一信息单元只有一处强调；标题、副标题、数值三层的字号/颜色不混用。
9. **控件状态**：持续选中与临时悬停可共存；禁用是 `disabled` 而不是只降透明度。

---

## 5. 浅色 / 深色与输入方式

### 5.1 必查 8 项

1. 容器底色：`bg-base` / `bg-layer-1/2/3`，还是深色岛？
2. 文字：`label-primary/secondary/tertiary`，有没有继承到错的颜色？
3. 描边/分隔线：0.5px hairline，浅色下是否还看得见？
4. 悬停/按下：`interactive-bg-hover/active`，没有写死白 alpha。
5. 选中/强调：`state-business-primary` 或其 `color-mix`。
6. 主按钮：`button-primary-fill` + `label-primary-foreground`。
7. 焦点环：键盘 Tab 到每个可交互元素都可见 2px。
8. 深色岛：浅色主题下仍深底白字，且没有混入宿主浅色 token。

### 5.2 输入方式

- `:hover` 只在 `@media (hover: hover)` 内生效；触摸设备靠显式控件。
- `(pointer: coarse)` 下加大触摸目标（≥ 40px 热区）。
- 下拉/菜单的键盘：`↑`/`↓`/Home/End 走位，Escape 关闭，焦点回到锚点。

### 5.3 常见错误

- 深色岛读宿主层 token → 浅色下白块白字。
- 深字深底 / 白 alpha 描边用到浅色主题。
- 用 `prefers-color-scheme` 判断主题（DSH 用 `data-ds-dark-theme`）。
- 层级表面同时给 border 和 elevation 阴影（双描边，官方 spec 拒收）。
- 用一排 Pill 冒充互斥 Tab（应为 `SegmentedControl`）。
- 自绘 `<select>` 或 div 弹层冒充下拉（应为 `Menu`）。

---

## 6. 验收

新增/修改组件后至少跑：

```bash
node scripts/build-client.mjs
node scripts/build-client.mjs --check
node --run test
node --run check
```

真实 DSH 里刷新后确认：

- 控制台 `[dsh-music-panel] host UI kit: native` 或 `fallback`，两条路径都可用；
- 设置 → 关于 → **测试页面**：逐项对照官方控件（按钮 / 输入 / 开关 / 胶囊 / 分段 / 下拉 / 滑杆 / 复选 / 菜单 / 对话框 / Toast）；
- 浅色、深色各看一遍；焦点环、Esc、方向键、外部点击；
- 宽屏 / ≤900px / ≤720px 三档不溢出。

守卫会拦：非法圆角档位、半像素字号、旧蓝色、适配层外 require 宿主包、非 KitModal 的对话框、播放页/卡片深色面被浅色 token 破坏。规则新增时同步补守卫（见 `test/client/theme.test.mjs`）。

---

## 7. 反例（review 直接打回）

- 写死颜色：`#141417`、`#5686fe`、`#f4f4f5`、`rgba(255,255,255,.07)` 作为最终颜色（阴影 / 遮罩 / 封面叠层 / §2.6 深色岛除外）。
- 圆角 `6/7/9/10/11/14/18px`；把手写 10/14/24 当新档位。
- 字号 `10.5/11.5/12.5px`；只给字号不配行高。
- 层级表面：`border: 1px` + `box-shadow: elevation`；或 1px 中性描边（应为 0.5px）。
- 新对话框直接写 `mp-overlay + mp-scrim + mp-dialog`。
- 新图标直接手写 `<svg>`，没有进 `HOST_ICON_MAP`。
- 一排 Pill 冒充互斥 Tab；`<select>` 冒充 DSH 下拉。
- 在适配层之外 `require` 宿主 client 包。
- 用原生 checkbox 重新画开关；用 div 画按钮。
- 只改标签不接真实状态（假按钮 / 假数据）。

---

## 8. 文件地图

| 文件 | 职责 |
|---|---|
| `src/client/styles/theme.js` | 全部 CSS 与 `--dsw-*` 使用 |
| `src/client/app/host-ui.js` | 宿主模块加载、`hostComponent`、`HOST_ICON_MAP` |
| `src/client/components/common/icons.js` | `icon()` 本地 SVG + 宿主图标分流 |
| `src/client/components/ui/primitives.js` | `IconButton`、`Button`、`Switch`、`KitPill`、`KitInput`、`KitCheckbox`、`KitSegmented`、`KitSegmentedTabs`、`KitTag`、`KitStateDot`、`KitModal`、`SetRow`、`Cover`、`Spinner`、`Empty`、`SeekBar` |
| `src/client/components/ui/component-gallery.js` | 组件测试页（设置 → 关于 → 测试页面） |
| `src/client/components/ui/dialogs.js` | `Toast`、确认框、右键菜单等浮层 |
| `src/client/components/ui/header.js` | `HeadMenu`、`ContentHeader`、选择/排序菜单 |
| `src/client/components/ui/settings.js` | 设置面板（headless Modal）与关于页 |
| `src/client/components/ui/player-sheet.js` / `now-playing.js` | 播放器卡片 / 播放页（深色岛） |
| `test/client/theme.test.mjs` | 主题/组件守卫 |
| `A_other/design/official/` | 官方文档与 token 源文件存档 |
| `A_other/docs/theme-guidelines.md` | 本文档 |

---

## 9. 变更记录

| 日期 | 变更 |
|---|---|
| 2026-11-11 | 初版：从 0.15–0.18 的官方主题对齐与宿主组件接入整理而成 |
| 2026-11-16 | 补深色岛例外；扩成完整组件开发规范 |
| 2026-11-17 | 目录重构后更新路径；增加 Agent 速读、选型决策表、验收命令 |
| 2026-11-17 | 依官方文档（`dsh-v0.2.2-rc.3`）重写：有/无参考界面的三层对齐、圆角按用途×高度、elevation 优先于描边、0.5px 发丝线、菜单材质、输入方式、页面级审查、组件测试页 |
