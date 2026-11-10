# 主题与组件规范

> 适用于 `plugins/dsh-music`（dsh-music-panel）的 Web 端。
> 新增或修改界面之前先读这一页；它与 DSH 官方的 token / 组件行为对齐，目的是让后续功能看起来、用起来都是同一个产品。
>
> 最后核对：2026-11-11，DSH 客户端 UI primitives `0.2.2-rc.1`。

## 1. 总则

1. **只用 `--dsw-*` token 取主题值。** 颜色、圆角、字号、焦点环、菜单材质、toast、阴影都从 token 来；CSS 里不允许出现「看起来像主题色」的写死值。
2. **浅色 / 深色都必须成立。** token 在 `body` 与 `body[data-ds-dark-theme]` 下分别解析；新组件要在两种主题下各看一遍。
3. **宿主组件优先。** 如果 `@deepseek-ai/dsh-client-ui-primitives` 提供对应组件，就走适配层用它；只有模块缺失（测试 / harness）时才回退到本地实现。
4. **样式只作用于自己的 `.mp-*` 命名空间。** 不改宿主类的全局行为，不覆盖 `--dsw-*` 的定义。
5. **风险边界。** 宿主 client 包是 DSH 内部 API，官方明确不建议第三方插件依赖；所有访问都收敛在 `src/00-host-ui.js`，模块不存在时自动回退，升级出问题只修适配层。

## 2. Token 速查

| 用途 | Token |
|---|---|
| 应用底色 | `--dsw-alias-bg-base` |
| 抬升表面（卡片 / 弹层） | `--dsw-alias-bg-layer-1` / `-2` / `-3` |
| 正文 / 次要 / 三级文字 | `--dsw-alias-label-primary` / `--dsw-alias-label-secondary` / `--dsw-alias-label-tertiary` |
| 主色背景上的文字 | `--dsw-alias-label-primary-foreground` |
| 分隔线 / 描边 | `--dsw-alias-border-l1` / `-l2` / `-l3` |
| 悬停 / 按下 | `--dsw-alias-interactive-bg-hover` / `--dsw-alias-interactive-bg-active` |
| 主按钮 | `--dsw-alias-button-primary-fill` / `--dsw-alias-button-primary-hover` |
| 强调 / 选中 / 焦点蓝 | `--dsw-alias-state-business-primary`（浅色 `#4176E6`，深色 `#7AAAFF`） |
| 焦点环 | `--dsw-focus-ring-color` + `--dsw-focus-ring-width`（2px） |
| 菜单材质 | `--dsw-menu-surface-fill` + `--dsw-menu-backdrop-filter` |
| 阴影 | `--dsw-elevation-panel` / `--dsw-elevation-prominent` / `--dsw-elevation-soft` |
| Toast | `--dsw-alias-toast-bg` / `--dsw-alias-toast-label` |
| 开关滑块 | `--dsw-alias-switch-thumb` |
| 错误 / 成功 | `--dsw-alias-state-error-primary` / `--dsw-alias-state-success-primary` |
| 圆角 | `--dsw-radius-sm` 8 / `--dsw-radius-md` 12 / `--dsw-radius-lg` 16 / `--dsw-radius-xl` 20 / `--dsw-radius-panel` 28 |
| 字体 | `--dsw-font-family`；字号阶 24 / 22 / 20 / 18 / 16 / 14 / 13 / 12 / 11，正文 13px / 20px |

**Fallback 规则**：`var(--dsw-..., #151517)` 里的兜底值只服务于测试 / harness，必须是中性深色，不能是另一套主题色。真实 DSH 中 token 始终存在。

## 3. 组件规则

| 场景 | 必须使用 | 说明 |
|---|---|---|
| 对话框 / 确认框 / 设置 | `KitModal`（`src/ui/01-primitives.js`） | 标题、关闭、footer 都用 props；宿主可用时走 `Modal`（焦点陷阱、Escape、portal）。设置面板用 `headless` 保留两栏布局。**禁止**再手写 `.mp-overlay + .mp-dialog`。 |
| 顶栏菜单 / 右键菜单 | `HeadMenu`（`src/ui/16-header.js`）或宿主 `Menu` | 右键菜单用 contextual + 指针锚点；不要再写自绘弹层。 |
| 开关 | `Switch` | 宿主 `Switch` 自动带 `role="switch"` / `aria-checked`；不要直接用 `<input type=checkbox>` 画开关。 |
| 播放模式胶囊 | `KitPill` | 宿主 `Pill`；普通小 chip 用 `mp-chip`。 |
| 按钮 | `Button` | 主按钮使用官方**单色** primary（浅色近黑 / 深色近白），不要用蓝色实心按钮。 |
| 图标 | `icon(name, size)` | 宿主有对应图标的，先加到 `HOST_ICON_MAP`（`src/00-host-ui.js`）；音乐专用图标（上一首/下一首/随机/循环/音量/音符）保留本地 SVG。 |
| 提示 | `showToast(...)` | 宿主可用时走 `Toast`，不要另造 toast 容器。 |
| 输入框 | `mp-kit-input` 或 `.mp-field input` | 颜色 / 边框 / 圆角全部 token 化，不写内联颜色。 |

### 焦点与键盘

- 所有可交互元素必须可见 `:focus-visible`：2px `--dsw-focus-ring-color`。
- 对话框 / 菜单的 Escape、外部点击、焦点回收由宿主组件负责；自定义控件要自己补齐。

### 圆角与字体

- 只用 8 / 12 / 16 / 20 / 28 这几档；不要出现 6 / 7 / 9 / 10 / 11 / 14 / 18。
- 正文 13px / 行高 20px；次要 12px；小号 11px；标题 16 / 20。不要用 12.5 / 11.5 / 10.5。

## 4. 宿主适配层

- `src/00-host-ui.js` 是唯一 `require('@deepseek-ai/dsh-client-ui-primitives')` 的地方，`try/catch` 后得到 `hostUi`。
- `hostComponent(name)` 同时接受函数组件与 `forwardRef` 对象；拿不到返回 `null`。
- 每个适配组件都必须有等价 fallback，fallback 的 DOM / 类名保持与之前一致，测试环境才能跑。
- 启动会打印 `[dsh-music-panel] host UI kit: native|fallback`；设置 → 外观 底部也有「宿主组件」状态行。
- 如果 DSH 升级导致宿主 API 变化：只改适配层，不要改业务组件；fallback 兜底"模块不存在"，兜不住"API 变更"，需要按报错修映射。

## 5. 反例（review 直接打回）

- 写死颜色：`#141417`、`#5686fe`、`#f4f4f5`、`rgba(255,255,255,.07)` 作为最终颜色（阴影 / 遮罩 / 封面叠层除外）。
- 圆角 `6/7/9/10/11/14/18px`。
- 字号 `12.5px` / `11.5px` / `10.5px`。
- 新对话框直接写 `mp-overlay + mp-scrim + mp-dialog`。
- 新图标直接手写 `<svg>`，没有进 `HOST_ICON_MAP`。
- 蓝色实心主按钮（官方 primary 是单色）。
- 在适配层之外 `require` 宿主 client 包。

## 6. 文件地图

| 文件 | 职责 |
|---|---|
| `src/90-theme.js` | 全部 CSS 与 `--dsw-*` 使用 |
| `src/00-host-ui.js` | 宿主模块加载、`hostComponent`、`HOST_ICON_MAP` |
| `src/ui/01-primitives.js` | `IconButton`（宿主 Tooltip）、`Button`、`Switch`、`KitPill`、`KitModal` |
| `src/ui/16-header.js` | 顶栏、`HeadMenu`、播放模式胶囊 |
| `src/15-icons.js` | `icon()` 本地 SVG + 宿主图标分流 |
| `src/ui/06-settings.js` | 设置面板（headless Modal） |
| `docs/screenshots/v2-light.png` / `v2-dark.png` | 浅色 / 深色基准图 |

## 7. 验证清单

新增界面后至少跑：

1. `node scripts/build-client.mjs --check`
2. `npm test`（17 个测试，含 `theme.test.mjs` 主题守卫）
3. harness 注入官方 token，分别在浅色 / 深色截图对比 `v2-light.png` / `v2-dark.png`
4. 真实 DSH 里刷新后确认：
   - 控制台 `[dsh-music-panel] host UI kit: native`
   - 设置 → 外观 →「宿主组件」显示 `native`
   - 对话框 Tab 锁焦、Esc 关闭；菜单方向键可走
5. 新图标 / 新组件若走宿主，确认 fallback 环境（测试）不报错`n6. 主题守卫会拦住：非 8/12/16/20 圆角、10.5/11.5/12.5 字号、旧蓝色 `#5686fe`、适配层之外 require 宿主包、非 KitModal 的对话框

## 8. 变更记录

| 日期 | 变更 |
|---|---|
| 2026-11-11 | 初版：从 0.15–0.18 的官方主题对齐与宿主组件接入整理而成 |

