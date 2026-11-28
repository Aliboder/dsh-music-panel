# DeepSeek Harness 官方文档镜像

本目录是开源仓库 `deepseek-ai/deepseek-harness` 中 `docs/` 的完整本地镜像，用于离线查阅、检索，以及作为「DSH 插件开发专家」的知识底座。

- 源仓库：https://github.com/deepseek-ai/deepseek-harness
- 镜像版本：`master` @ `ca33fd6843b205e279c7ccb6cb73a472c78f5760`（2026-11-18 抓取；该提交时仓库根 `package.json` 版本为 `0.2.2-rc.4`）
- 规模：795 个 Markdown（395 个中文 `*.zh.md` + 400 个英文 `*.md`），约 8.6 MB
- 在线文档站：https://deepseek-harness.github.io/deepseek-harness/ （默认中文，`/en/` 为英文）
- 元数据：`_meta.json`（commit、抓取时间、文件清单、失败项）；抓取脚本：`_fetch.mjs`

## 语言与命名

- `foo.zh.md` 为中文版本，`foo.md` 为英文版本，两者是同一页面的两个语言面。
- 中文文档不是机翻残页，术语与代码片段完整，优先读中文。

## 目录结构

| 路径 | 篇数 | 内容 |
|---|---|---|
| `user/develop/` | 20 | 插件开发主线：`basic`（第一个插件、工具、配置、打包）、`framework`（生命周期、服务、事件）、`practice`（三角色能力、LLM 适配器、动态配置） |
| `user/guide/` | 20 | 用户手册：快速上手、providers、插件市场、MCP 记忆、网络代理等 |
| `cordis-tutorial/` | 16 | Cordis 七章实践教程（含中英双份） |
| `cookbook/` | 26 | 专题实操：加工具、加设置卡片、扩展插件形态、加包、加 LLM 适配器 |
| `subsystems/` | 140 | 逐子系统参考（含 `cordis-surface` 生成区块）：tools、slots、settings、client-modules、web-client、session 等 |
| `cordis-api/` | 11 | Cordis 框架 API：context、events、fiber、registry、service、inherited |
| `upgrade-guide/` | 366 | 逐版本升级指南（仓库维护用，非插件开发必需） |
| `persistence-changes/` | 118 | 会话格式/持久化迁移记录（维护用） |
| `postmortem/`、`defensive-patterns/`、`i18n/` | 29 | 事故复盘、防御模式、文档国际化配置 |
| 顶层 `*.md` | 47 | 架构、Cordis 入门、能力 seam、agent 生命周期、工具执行管线、API 网关、config/tool 目录、Web 样式、测试、术语表等 |

## 插件开发主线（推荐顺序）

| 步骤 | 本地文件 | 在线页面 |
|---|---|---|
| 1. 第一个插件 | `user/develop/basic/index.zh.md` | https://deepseek-harness.github.io/deepseek-harness/develop/basic/ |
| 2. 开发一个工具 | `user/develop/basic/tool.zh.md` | https://deepseek-harness.github.io/deepseek-harness/develop/basic/tool |
| 3. 插件配置 | `user/develop/basic/config.zh.md` | https://deepseek-harness.github.io/deepseek-harness/develop/basic/config |
| 4. 打包与安装 | `user/develop/basic/publish.zh.md` | https://deepseek-harness.github.io/deepseek-harness/develop/basic/publish |
| 5. 插件与生命周期 | `user/develop/framework/index.zh.md` | https://deepseek-harness.github.io/deepseek-harness/develop/framework/ |
| 6. 服务与依赖 | `user/develop/framework/service.zh.md` | https://deepseek-harness.github.io/deepseek-harness/develop/framework/service |
| 7. 事件系统 | `user/develop/framework/events.zh.md` | https://deepseek-harness.github.io/deepseek-harness/develop/framework/events |
| 8. 能力三种角色 | `user/develop/practice/index.zh.md` | https://deepseek-harness.github.io/deepseek-harness/develop/practice/ |
| 9. LLM 适配器 | `user/develop/practice/llm-adapter.zh.md` | https://deepseek-harness.github.io/deepseek-harness/develop/practice/llm-adapter |
| 10. Cordis 七章 | `cordis-tutorial/index.zh.md` | https://deepseek-harness.github.io/deepseek-harness/develop/cordis-tutorial/ |

## 参考手册（按需查）

| 主题 | 本地文件 | 在线页面 |
|---|---|---|
| 架构总览 | `architecture.zh.md` | https://deepseek-harness.github.io/deepseek-harness/reference/ |
| Cordis 入门 | `cordis-primer.zh.md` | https://deepseek-harness.github.io/deepseek-harness/reference/cordis-primer |
| 能力 Seam | `capability-seams.zh.md` | https://deepseek-harness.github.io/deepseek-harness/reference/capability-seams |
| Agent 生命周期 | `agent-lifecycle.zh.md` | https://deepseek-harness.github.io/deepseek-harness/reference/agent-lifecycle |
| 工具执行管线 | `tool-execution-pipeline.zh.md` | https://deepseek-harness.github.io/deepseek-harness/reference/tool-execution-pipeline |
| API 网关 | `api-gateway.zh.md` | https://deepseek-harness.github.io/deepseek-harness/reference/api-gateway |
| 配置目录 | `config-catalog.zh.md` | https://deepseek-harness.github.io/deepseek-harness/reference/config-catalog |
| 工具目录 | `tool-catalog.zh.md` | https://deepseek-harness.github.io/deepseek-harness/reference/tool-catalog |
| 工具编写参考 | `cookbook/adding-a-tool.zh.md` | https://deepseek-harness.github.io/deepseek-harness/reference/cookbook/adding-a-tool |
| 即时配置表单 | `cookbook/adding-a-settings-card.zh.md` | https://deepseek-harness.github.io/deepseek-harness/reference/cookbook/adding-a-settings-card |
| 扩展插件形态 | `cookbook/extension-cookbook.zh.md` | https://deepseek-harness.github.io/deepseek-harness/reference/cookbook/extension-cookbook |
| 子系统总览 | `subsystems/README.zh.md` | https://deepseek-harness.github.io/deepseek-harness/reference/subsystems/ |
| Web Client | `subsystems/web-client.zh.md` | https://deepseek-harness.github.io/deepseek-harness/reference/subsystems/web-client |
| Client 模块 | `subsystems/client-modules.zh.md` | https://deepseek-harness.github.io/deepseek-harness/reference/subsystems/client-modules |
| Slots | `subsystems/slots.zh.md` | https://deepseek-harness.github.io/deepseek-harness/reference/subsystems/slots |
| 设置表单 | `subsystems/settings.zh.md` | https://deepseek-harness.github.io/deepseek-harness/reference/subsystems/settings |
| 工具服务 API | `subsystems/tools.zh.md` | https://deepseek-harness.github.io/deepseek-harness/reference/subsystems/tools |

## 与在线站点的路由对应

- `user/develop/**` → `<站点>/develop/**`（去掉 `user/` 前缀，`index` 落到目录）
- `user/guide/**` → `<站点>/guide/**`
- `cordis-tutorial/**` → `<站点>/develop/cordis-tutorial/**`
- `cookbook/**` → `<站点>/reference/cookbook/**`
- `subsystems/**` → `<站点>/reference/subsystems/**`
- `cordis-api/**` → `<站点>/reference/cordis-api/**`
- `architecture.zh.md` → `<站点>/reference/`
- `cordis-primer`、`capability-seams`、`agent-lifecycle`、`tool-execution-pipeline`、`api-gateway`、`config-catalog`、`tool-catalog` → `<站点>/reference/<name>`
- `web-styling`、`testing`、`glossary`、`ui-radius` 等顶层文档在站点上未开独立路由，以本地文件为准。

## 检索建议

- 先看 `subsystems/README.zh.md` 找服务名，再进具体子系统页看 `cordis-surface` 生成区块（真实签名）。
- 查 API 签名用 `cordis-api/*.zh.md`；查行为约定用 `cookbook/` 与 `subsystems/`。
- 查「为什么这么设计」用 `architecture.zh.md`、`capability-seams.zh.md`、`agent-lifecycle.zh.md`。

## 注意事项

- 镜像反映开源仓库 `master`；本机桌面端为 `@deepseek-ai/dsh-desktop` `0.2.2-rc.3`，两者同代但可能有个别差异，冲突时以本机实测为准并标注。
- 官方文档描述的是 TypeScript 源码包形态（`@deepseek-ai/cordis`、`defineTool`、tsdown `clientBundle`）；本仓库插件是零构建 JS bundle，二者不是同一层，跨层使用前先说明对应关系。
- `upgrade-guide/`、`persistence-changes/`、`postmortem/` 是仓库维护记录，插件开发一般不需要。
- 镜像里保留了官方的 `AGENTS.md`（以及 `docs/` 各子树的同名文件），那是上游仓库的文档写作规范，只约束上游，不约束本工作区。
- 除 795 篇官方文档外，本目录还有本地索引 `README.md` 与抓取脚本 `_fetch.mjs`，它们不属于上游镜像。
- 更新镜像：重新执行 `node docs/official/_fetch.mjs`（需能访问 GitHub API 与 raw.githubusercontent.com），脚本会按当前 `master` 增量补齐缺失文件并刷新 `_meta.json`。
