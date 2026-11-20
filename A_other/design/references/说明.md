# DSH 设计参考（本地存档）

这里保存 **DeepSeek Harness 官方** 的 Web UI 设计规范与组件文档，作为 [`A_other/docs/theme-guidelines.md`](../../docs/theme-guidelines.md) 的上游依据。

> 这些文件是**设计参考**，不是插件运行时代码；`A_other/**` 不会打进插件包。
> 官方文档优先于本仓的 `theme-guidelines.md`：两者冲突时以官方为准，并回头修本仓文档。

## 抓取信息

| 项 | 值 |
|---|---|
| 抓取日期 | 2026-11-17 |
| 上游仓库 | <https://github.com/deepseek-ai/deepseek-harness> |
| 基准版本 | tag `dsh-v0.2.2-rc.3`（commit `38a6a5c965aa99ab525161efb7cc5cf1fe62fced`）——与本机运行的 DSH 版本一致 |
| 取文件方式 | `https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/dsh-v0.2.2-rc.3/<路径>` |

重抓时改上面的 tag 即可；tag 与 `HEAD` 的内容会不同（本次核对：`docs/web-styling.zh.md` 在 HEAD 只有 tag 版的一半左右），**不要混用两个 ref 的内容**。

## 官方文档

| 本地文件 | 内容 | 上游路径 | 大小 | sha256 |
|---|---|---|---|---|
| [dsh-web-styling.md](official/dsh-web-styling.md) | Web UI 样式参考（英文，规则全文更长） | `docs/web-styling.md` | 9.4 KB | `1446669A0333` |
| [dsh-web-styling.zh.md](official/dsh-web-styling.zh.md) | 同上，中文 | `docs/web-styling.zh.md` | 8.6 KB | `56D1FC19C92B` |
| [dsh-ui-radius.md](official/dsh-ui-radius.md) | 统一圆角规范（英文） | `docs/ui-radius.md` | 11.6 KB | `88C7EB34D379` |
| [dsh-ui-radius.zh.md](official/dsh-ui-radius.zh.md) | 统一圆角规范：按用途/尺寸选 R4–R28、嵌套几何、设置卡片材质 | `docs/ui-radius.zh.md` | 10.4 KB | `599CE2948D74` |
| [dsh-ui-design-review-cases.md](official/dsh-ui-design-review-cases.md) | UI 审查基准（英文） | `docs/ui-design-review-cases.md` | 51 KB | `BD7A2582A362` |
| [dsh-ui-design-review-cases.zh.md](official/dsh-ui-design-review-cases.zh.md) | UI 审查基准：对齐、空间分组、整屏密度、信息层级、控件状态与整页/整弹窗审查 | `docs/ui-design-review-cases.zh.md` | 44 KB | `D3DE6C5E1E29` |
| [dsh-ui-primitives.README.md](official/dsh-ui-primitives.README.md) | 官方共享 React UI 原子目录与行为（Button / Switch / SegmentedControl / Pill / Menu / Modal / SettingsForm…） | `packages/client/ui-primitives/README.md` | 65 KB | `6E1A2B6F0FE4` |
| [dsh-ui-primitives.README.zh.md](official/dsh-ui-primitives.README.zh.md) | 同上，中文 | `packages/client/ui-primitives/README.zh.md` | 61 KB | `02453A3723CB` |
| [dsh-ui-theme.README.md](official/dsh-ui-theme.README.md) | 主题包职责：`--dsw-*` 色阶/语义别名、排版、动效、明暗主题、滚动条 | `packages/client/ui-theme/README.md` | 21 KB | `0C6B486B1F52` |
| [dsh-ui-theme.README.zh.md](official/dsh-ui-theme.README.zh.md) | 同上，中文 | `packages/client/ui-theme/README.zh.md` | 20 KB | `D17CCEA3C1AA` |
| [dsh-ui-layout.README.zh.md](official/dsh-ui-layout.README.zh.md) | 布局包：把解析后的主题快照应用到文档 | `packages/client/ui-layout/README.zh.md` | 11 KB | `7CFCB77F8C40` |
| [dsh-settings.md](official/dsh-settings.md) | 插件设置页/配置表单的服务与组件 | `packages/settings/settings/README.zh.md` | 3.7 KB | `31AF6F9922CC` |

## Token 源文件

`docs/web-styling` 明确说 token 的**值**不写进文档，以源码为准。这里同步了生成本机主题的样式表（同一 tag）：

| 本地文件 | 内容 | 大小 | sha256 |
|---|---|---|---|
| [tokens/base.css](official/tokens/base.css) | 字体栈、动效曲线与时长、圆角档位（`--dsw-radius-xs/sm/md/lg/xl/panel`） | 1.9 KB | `803926CE39F5` |
| [tokens/design-platform.css](official/tokens/design-platform.css) | 静态色阶与语义别名（`--dsw-static-*`、`--dsw-alias-*` 等） | 30 KB | `3234F318769E` |
| [tokens/focus.css](official/tokens/focus.css) | 焦点环 | 1.0 KB | `F7398E773041` |
| [tokens/corner-shape.css](official/tokens/corner-shape.css) | 超级椭圆 `corner-shape` 曲线 | 1.1 KB | `D94F82E1332B` |
| [tokens/gradient-shadow-text.css](official/tokens/gradient-shadow-text.css) | 渐变/阴影/文字效果 token | 15 KB | `B6E1E8387EDB` |
| [tokens/scrollbar.css](official/tokens/scrollbar.css) | 滚动条 | 4.4 KB | `D83797AA9662` |

## 阅读顺序（按“外观与 DSH 一致”的目标）

1. [dsh-web-styling.zh.md](official/dsh-web-styling.zh.md)：先知道谁拥有样式、哪些做法被规范拒收（层级阴影、0.5px 发丝线、菜单材质、模态遮罩等）。
2. [dsh-ui-radius.zh.md](official/dsh-ui-radius.zh.md)：控件高度 ↔ 圆角档位、嵌套几何、设置卡片材质。
3. [dsh-ui-design-review-cases.zh.md](official/dsh-ui-design-review-cases.zh.md)：新增一整页/一整个弹窗时，按“整体 → 组间 → 组内”审查。
4. [dsh-ui-primitives.README.zh.md](official/dsh-ui-primitives.README.zh.md)：控件目录、行为与可用变体——决定“有没有现成的”。
5. [dsh-ui-theme.README.zh.md](official/dsh-ui-theme.README.zh.md) + [tokens/](official/tokens/)：token 语义与真实取值。
6. [dsh-ui-layout.README.zh.md](official/dsh-ui-layout.README.zh.md)、[dsh-settings.md](official/dsh-settings.md)：主题快照如何落地、设置表单如何接。

## 未收录

- `docs/BRAND_GUIDELINES.md` / `.zh.md`：官方 `docs/` 目录里有这两个文件，但该 tag 与 HEAD 的 raw 地址都返回 404（可能未随仓库发布），暂未收录；需要时再核对上游。
- 社区/第三方主题包文档：不属于官方规范，本文只收官方。
