# 目录结构优化方案（参考 Folia）

> 目标：只搬代码、改目录和路径，**不改功能/界面/交互/文案/行为**。
> 对用户完全无感；收益是 Host / Client / Shared 边界清晰、按职责分类、后续开发更容易找代码。
> 基线：`main` @ `pre-arch-rewrite-20261116`（`888ca88`）。

## 0. 硬约束（不可偏离）

这份文档是执行的唯一依据；任何一步如果必须改逻辑才能完成，**停止并报告**，不要顺手重构。

1. **只搬代码**：只允许改路径、相对 import、构建清单、测试引用、文档路径。
2. **行为冻结**：不改函数体、路由行为、状态机、CSS、文案、DOM 结构、全局变量名。
3. **不重写**：不新写 Client/Host，不引入新框架/构建器，不把 JS 改成 TS。
4. **不增删功能**：不新增面板/按钮/接口，不删除任何现有功能。
5. **不切新 Client**：`package.json exports["./client"]` 仍指向原 `client.js`；不启用任何“新 Client”。
6. **不做数据迁移**：旧 `~/.dsh/music`、localStorage、登录态不迁移；但这不改变插件行为。
7. **入口不变**：根 `index.js` 仍是 DSH 入口，只做内部转发。
8. **产物一致**：`client.js` 归一化 SHA-256 不变；Folia 四个 bundle 哈希不变。
9. **小步提交**：一次只搬一个领域组，一个 commit；每步可单独回退。
10. **不顺手优化**：遇到循环依赖、重复代码、类型问题，只记录到 `docs/pitfalls.md`，不在搬家 commit 里修。

## 1. 参考 Folia 的组织方式

Folia 的 `src/` 不是按“文件类型”散放，而是先按**角色**分层，再按**领域**分目录：

```text
src/
  App.tsx / bootstrap.tsx / index.tsx   # 应用入口
  components/<domain>/                  # 视图，PascalCase 组件
  services/<domain>/ + use*.ts          # 业务逻辑 / 服务
  stores/use*Store.ts                   # 全局状态
  hooks/use*.ts                         # 可复用 Hook
  utils/                                # 纯函数 helper，kebab-case
  types/                                # 类型
  workers/                              # Worker
  library/{app,core,suites}/            # 领域组合层
```

可以借用的原则：

1. **角色优先**：`app / components / services / stores / hooks / utils / types`；
2. **领域二级目录**：`components/player`、`services/onlineMusic`、`utils/lyrics`；
3. **命名稳定**：组件 PascalCase，Hook `useX`，Store `useXStore`，普通模块 kebab-case；
4. **入口独立**：根目录只放入口/装配，不堆业务；
5. **共享类型独立**：`types/` 不和业务混放。

## 2. 本插件的适配

本插件与 Folia 有两个关键差异，不能照抄：

- Client 仍是 **全局片段按顺序拼接** 成 `client.js`，不是 Vite 模块图；
- Host 是 Node 侧，不是浏览器 React。

因此保留 Folia 的“角色 + 领域”思想，但增加：

- `src/client/manifest.json`：片段拼接顺序的唯一事实源；
- `src/host/`：Node Host 的 app/http/services/providers/stores；
- 不把片段拆成独立 React 组件，不改变全局变量和加载顺序。

## 3. 目标目录

```text
src/
  host/
    app/                 # Host 入口/装配（由根 index.js 薄转发）
    http/                # routes、stream/media、assets
      routes.js          # 原 lib/routes.js
      routes/            # 原 lib/routes/**
    providers/           # 在线平台、登录、source registry
    services/            # 扫描/标签/歌词/播放/统计/回收站/缓存
    stores/              # 设置、收藏、歌单、provider/session 持久化
    assets/              # 原 lib/assets/**
  client/
    manifest.json        # 片段顺序
    app/                 # 00-runtime、00-host-ui、99-plugin
    components/          # 现有 UI 片段，按领域分组
      common/ player/ library/ online/ settings/ lyrics/ dialogs/
    services/            # api、player engine、prefs、theme、effects
    stores/              # 全局状态片段
    hooks/               # 如有可复用 Hook
    utils/               # 纯函数 helper
    types/               # 客户端类型
    i18n/                # 05-i18n、06-strings
    styles/              # base/theme/look/wave-color
    render/              # Folia 构建边界 + 生成的 bundles
    vendor/              # React 18 shims、framer、three、pixi
  shared/                # 真正跨 Host/Client 的契约/类型（先只搬不改）
  folia/                 # upstream / bridge / vendor / entries / assets
test/
  host/  client/  integration/
scripts/
```

根 `index.js` **保持原位**，内部改为从 `src/host/app` 引入，避免改 DSH 包入口。

## 4. 具体映射

### 4.1 Host

| 原路径 | 新路径 |
|---|---|
| `index.js` | 保持根入口，内部指向 `src/host/app` |
| `lib/routes.js` | `src/host/http/routes.js` |
| `lib/routes/**` | `src/host/http/routes/**` |
| `lib/core/**` | `src/host/services/core/**` |
| `lib/services/**` | `src/host/services/**` |
| `lib/data/**` | `src/host/stores/**` |
| `lib/login/**`、`lib/providers/**`、`lib/sources/**` | `src/host/providers/**` |
| `lib/config.js`、`settings.js`、`json-store.js`、`favorites.js`、`playlists.js`、`stats.js` | `src/host/stores/**` |
| `lib/library.js`、`meta.js`、`tags.js`、`trash.js`、`online-cache.js`、`replaygain.js` | `src/host/services/media/**` |
| `lib/lyrics.js`、`amll.js` | `src/host/services/lyrics/**` |
| `lib/playback.js`、`control.js` | `src/host/services/playback/**` |
| `lib/provider-store.js`、`kugou-session.js` | `src/host/providers/**` |
| `lib/http.js`、`url-safety.js` | `src/host/http/**` |
| `lib/assets/**` | `src/host/assets/**` |

### 4.2 Client 根片段

> 2026-11-17 后续：插件自有片段已去掉数字前缀，顺序统一由 src/client/manifest.json 负责；
> 下表左列是重构前文件名，右列最终目录中的文件名也已去前缀。

| 原片段 | 新路径 |
|---|---|
| `00-runtime.js`、`00-host-ui.js`、`99-plugin.js` | `src/client/app/**` |
| `05-i18n.js`、`06-strings.js` | `src/client/i18n/**` |
| `20-api.js` | `src/client/services/api/**` |
| `30-prefs.js`、`40-store.js` | `src/client/stores/**` |
| `50-player.js` | `src/client/services/player/**` |
| `45-crossfade.js`、`46-transition.js`、`47-likes.js`、`48-volume-balance.js`、`49-balance-meter.js`、`35-loudness.js`、`40-eq.js` | `src/client/services/player/effects/**` |
| `60-library.js`、`44-filter.js`、`17-list.js`、`18-stats.js` | `src/client/components/library/**` |
| `70-online.js`、`35-provider-logos.js` | `src/client/components/online/**` |
| `10-base.js`、`28-look.js`、`90-theme.js`、`47-wave-color.js` | `src/client/styles/**` |
| `15-icons.js`、`19-extra-icons.js`、`36-guide-shots.js`、`45-ui.js`、`80-overlay.js`、`85-select.js` | `src/client/components/common/**` |
| `02-autoanimate.js`、`02-layers.js` | `src/client/components/common/**` |
| `src/ui/**` | `src/client/components/ui/**` |
| `src/render/styles/**`、`src/render/lyrics/**` | `src/client/render/**` |
| `src/render/folia/**` | `src/folia/**`（顶层 Folia 树） |
| `src/vendor/**` | `src/client/vendor/**` |
| `src/stores/**` | `src/client/stores/**` |
| `src/services/**` | `src/client/services/**` |
| `src/types/**` | `src/client/types/**` |
| `src/utils/**` | `src/client/utils/**` |
| `src/types.ts` | `src/shared/types.ts`；Folia 构建 alias 同步更新 |

> `src/ui` 的 28 个文件是命令式 UI 片段，不是独立 React 组件；按领域分组即可，
> 不拆文件、不改内部实现。

## 5. 构建与 manifest

`scripts/build-client.mjs` 改为读 `src/client/manifest.json`：

```json
{
  "version": 1,
  "fragments": [
    "vendor/00-react-global.js",
    "app/00-runtime.js",
    "app/00-host-ui.js",
    "i18n/05-i18n.js",
    "..."
  ]
}
```

- 顺序 = 现在 `readdir + sort` 的结果，逐项列出；
- 片段内容、全局变量名、拼接边界都不改；
- `build-client --check` 校验 manifest 顺序 + 文件哈希；
- `build-styles/backgrounds/pendolo/lyrics` 只改入口/路径；
- `package.json files` 改为新目录；
- 根 `index.js` 入口不变。

## 6. 阶段

| 阶段 | 内容 | 验收 |
|---|---|---|
| P0 | 从 checkpoint 建 `refactor/structure`，记录 `client.js` SHA-256、测试、截图 | 基线 tag |
| P1 | Host `lib/**` → `src/host/**`，按 http/providers/services/stores 分批 | 每组全量测试 + `client.js --check` |
| P2 | Client entry + `manifest.json`，改 build-client | 归一化哈希不变；单独回退点 |
| P3 | Client `components/services/stores/utils/types/styles` 分批搬 | 每批重建 + UI/Folia 测试 |
| P4 | `render/vendor` + Folia 构建路径 | bundles 哈希不变 |
| P5 | `test/` 分类、docs、`package.json files` | pack/安装冒烟 |
| P6 | 全量验证 + 截图 | `structure-done` tag |

## 7. 实施状态（2026-11-17）

已完成：

- P1 Host：`lib/**` → `src/host/{http,providers,services,stores,assets}`；根 `index.js` 只改 import。
- P2 Client：根片段 + `ui/render/vendor/stores/services/types/utils` → `src/client/**`；
  `src/types.ts` → `src/shared/types.ts`；`src/client/manifest.json` 成为片段顺序来源。
- P4 Folia：`src/render/folia/**` → `src/folia/**`；`src/render` 已删除。
- 构建：`build-client` 读 manifest；build-styles/backgrounds/pendolo/lyrics 路径更新；
  `check` 改为 `check-syntax` + i18n + client 同步；`package.json files` 改为 `src/host/**`。
- 验证：108 个测试通过；`check` 通过；`client.js --check` 通过；Host/Client 源码语法通过；
  `client.js` 归一化后（去掉注释/空行/EOL）内容与基线一致。

剩余：

- P5：`test/` 仍平铺，未按 host/client/integration 分类；`npm pack`/安装冒烟未跑。
- P5 测试：62 个测试文件已分到 `test/host`、`test/client`、`test/integration`，`package.json`
  `scripts.test` 路径更新；`player-page` 也纳入脚本。`npm test`/`check` 全绿。
- 剩余：`npm pack --dry-run`/干净 profile 安装冒烟未跑（本机无 npm CLI）。

## 8. 验证

- `npm test`：108 个测试数量与结果不变；
- `npm run check`；
- `node scripts/build-client.mjs --check`；
- `client.js` 归一化 SHA-256 与基线一致（只允许路径注释差异）；
- 四个 Folia bundle 哈希不变；
- `npm pack --dry-run` 文件列表完整；
- 浅/深色截图一致；
- 干净 profile 安装/启动。

## 9. 约束

- 一次只搬一个领域组，一个 commit；
- 只改 import/路径/manifest，不改逻辑；
- 遇到循环依赖先记录，不在搬家 commit 里重构；
- 不引入新依赖、不换构建器、不改 UI；
- 旧数据不迁移，但插件行为不变。


