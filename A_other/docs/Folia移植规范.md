# Folia 移植规范

> 适用：把 Folia（`A_other/upstream/folia-major-main`，只读）的代码搬进本插件，以及后续跟进上游。
> 目标：移植是**机械动作**——上游文件的相对路径就是这里的相对路径；行为差异只允许出现在适配层；
> 任何偏离都会被 `npm run check` 拦下。

## 0. 三条总原则

1. **能照搬就照搬**：能逐字节复制的代码不要重写、不要“借鉴思路”。要改行为，先问“这能不能放进适配层”。
2. **镜像是最小子集**：只搬用得到的文件；上游有、这里没有不算错，反过来是错误。
3. **路径不许自创**：镜像内路径与上游仓库根 1:1；替身放在与上游相同的相对路径下。

## 1. 目录规则

### 1.1 镜像（`folia/`）

| 本仓库 | 上游仓库 |
|---|---|
| `folia/src/**` | `src/**` |
| `folia/sources/<id>/**` | `sources/<id>/**` |
| `folia/packages/<包>/**` | `packages/<包>/**` |

- 镜像根只允许这三棵树加 `README.md`、`mirror.manifest.json`。
- 新增移植：按上游相对路径复制（`src/x/y.ts` → `folia/src/x/y.ts`）。
- 上游把文件移了位置：按新路径刷新，**删除**旧路径，不要留兼容副本。
- 不要在镜像里加“桥接文件”“index 汇总文件”“插件特有文件”——这些属于适配层。

### 1.2 适配层（`src/folia-adapters/`）

- **替换上游某个模块的替身**：放在 `src/folia-adapters/<上游相对路径>`（文件名也保持一致），
  例：`src/folia-adapters/services/onlineMusic/providerRegistry.ts` ↔ 上游 `src/services/onlineMusic/providerRegistry.ts`。
  文件头第一段写：`替身上游：src/…（为什么替）`。
- **没有单一上游文件的宿主面**（RPC、`net.fetch`、`seal`、`pageStore`、`legacy.store`、`media.allow`、`texts` 等）：
  按用途分组（本插件是 `source-host/`、`kugou/`），不硬套路径。
- **shims / vendor**：构建期替身与因“只发一个 client 文件”而 vendored 的 npm 包，单独分组（`shims/`、`vendor/`）。
- 替身只能替换**上游模块的对外行为**，不要把上游逻辑抄一份进适配层再改——那会变成第二套实现。

### 1.3 构建入口与产物

- 入口：`src/folia-build/<名字>-host-entry.ts`（只做接线与再导出，不写业务逻辑）。
- 来源模组 bundle：`src/host/vendor/<id>-folia/source.bundle.mjs`；其它算法 bundle：`src/host/vendor/<名字>-folia/*.bundle.mjs`。
- bundle 生成脚本：

  ```bash
  node scripts/build-folia-source.mjs <bodian|qishui|qq|netease|lyrics>
  node scripts/build-folia-source.mjs --check      # 已并入 npm run check
  node scripts/build-kugou-folia.mjs [--check]      # 酷狗走的旧入口，行为一致
  ```

## 2. 内容规则（镜像 vs 适配）

**默认：镜像文件与上游逐字节相同。**

确需改镜像内文件时，只有这一条路：在 `folia/mirror.manifest.json` 的 `adapted` 里登记
（`node scripts/check-folia-mirror.mjs --update` 生成），每条记录登记时的上游 SHA256。
上游一变，check 会报「上游已变化」，逼人复核适配是否仍需要；不再需要就刷新上游并从清单移除。

判断流程：

```text
要改的行为能放进适配层（替身 / Shims / alias / 宿主输入）吗？
  能 → 放适配层，镜像一个字节都不改
  不能，且必须改上游逻辑本身？
        → 优先把这段逻辑抽成上游模块的“宿主注入点”（可注入的依赖）
        → 仍不行 → 登记 adapted（清单里写明为什么），并接受“每次上游变动都要复核”
```

禁止：为了通过 check 而把清单里的 `upstreamSha256` 改成当前值（先确认适配是否仍适用）；
把镜像里没有登记的文件改掉；把插件自己的文件塞进 `folia/`。

## 3. 移植一个上游能力的标准流程

1. **定位上游实现**：先读上游代码与它的 import 图（`mods/`、`utils/`、`services/`、`sources/`）。
2. **算闭包**：沿相对 import 递归，把“纯逻辑文件”（只依赖 types 与本地工具）和“宿主接口文件”分开。
3. **镜像**：纯逻辑文件按路径复制进 `folia/`，SHA256 核对。
4. **写替身**：宿主接口文件（`providerRegistry`、`crossSource`、`store`、`electron`、`workerClient` 等）
   在 `src/folia-adapters/<同路径>` 写替身，把插件的 `omni` / 注册表 / 客户端注入进去。
5. **入口与 bundle**：新增 `src/folia-build/<名字>-host-entry.ts`，在构建脚本里加一项（alias 指向替身、
   `external` 掉 npm 依赖、`define` 掉 `import.meta.env.*`；需要真实磁盘文件的（Worker、`.cjs` 兄弟文件）
   在 `files` 里声明）。
6. **接线**：用 bundle 替换插件里的旧实现；保持路由/客户端契约不变（界面归插件自己）。
7. **测试**：
   - 替身 provider / 桩的返回必须是**上游契约形状**（例如歌词是 `{ main: { format, text } }`，不是解析好的 lines）；
   - 不连网、不依赖真实会话；
   - 加一条 bundle 冒烟测试 + 一条“行为差异”断言（如阈值、顺序、单位）；
   - 镜像本身由 `test/host/folia-mirror.test.mjs` 守卫。
8. **文档与存档点**：`CHANGELOG.md`（用户能感知的变化）、`A_other/docs/踩坑记录.md`（新编号，写现象/原因/处理/防回归）；
   按 AGENTS 的规则做 `git commit` 与 `node scripts/install-local.mjs desktop`。

## 4. esbuild 接线的已知要点

- **alias**：把上游的宿主 import 指到替身（`'../../services/onlineMusic/providerRegistry'` → `src/folia-adapters/…`；
  `@/utils/...` 这类别名同样处理）。
- **define**：`import.meta.env.DEV/PROD/MODE/SSR`（上游用 Vite 约定）。
- **external**：npm 依赖外置（如 `@neteasecloudmusicapienhanced/api`、`wanakana`、`opencc-js/t2cn`），
  运行时装到 profile，由 `package.json` 的 dependencies 保证。
- **real files**：上游按磁盘路径找 Worker / `.cjs` 兄弟文件的，构建脚本要把它们拷到 bundle 旁边并在 `--check` 里比对；
  ESM 产物没有 `__dirname`，用 banner 补。
- **`@folia/source-deps`**：上游的归档 require，用 bundle 自己的 `createRequire` 替身。
- **DOM/Worker 依赖**：客户端专用的（Worker、`document`）必须有进程内替身或 shim，不能只在浏览器可用。

## 5. 校验与命令

```bash
node scripts/check-folia-mirror.mjs                 # 路径 1:1 + 内容逐字节（适配清单除外）+ 不许多文件
node scripts/check-folia-mirror.mjs --list-missing  # 列出还没镜像的上游文件（决定下一步搬什么）
node scripts/check-folia-mirror.mjs --update        # 有意适配后重写清单（记录当前上游 SHA256）
npm test                                            # 含镜像守卫 + 各 bundle / 行为测试
npm run check                                       # 镜像 + 语法 + i18n + client 同步 + 各 bundle 是否最新
node scripts/install-local.mjs desktop              # 装进本机 DSH profile 验证
```

## 6. 验收清单（提交前）

- [ ] 新文件都在 `folia/` 的上游同路径下；没有自创路径、没有镜像里多出的文件。
- [ ] 镜像内容除 `mirror.manifest.json` 登记项外与上游逐字节相同。
- [ ] 替身在 `src/folia-adapters/<上游相对路径>`，文件头写了「替身上游：…」。
- [ ] 构建入口与 bundle 已更新，`--check` 通过；构建产物已提交。
- [ ] 测试桩用上游契约形状；新增行为断言；没有真实网络/会话依赖。
- [ ] `npm test` 与 `npm run check` 全绿；已 `install-local` 并提示用户完全重启。
- [ ] CHANGELOG / 踩坑记录 / AGENTS（若规则变化）已更新。

## 7. 常见错法（都真实发生过）

| 错法 | 后果 | 正确做法 |
|---|---|---|
| 把“看起来像”的多个上游模块合并成一个 | 上游一变就整块重写 | 一文件对一文件；合并只发生在适配层 |
| 先改镜像再改适配层 | 上游无法 diff，升级时找不到差异 | 先写替身；确实必须改镜像才登记 adapted |
| 测试桩返回“顺手”的形状（如 `{ main: { lines } }`） | 测试全绿、真机整段失败（平台歌词曾因此全空） | 桩必须按上游契约写（`{ format, text }`） |
| 为了过 check 直接改 `upstreamSha256` | 吞掉“上游变了”的信号 | 先复核适配，再 `--update` |
| 镜像整棵目录（“以后可能用到”） | 仓库变大、升级核对爆炸 | 只搬闭包里的文件；用 `--list-missing` 看缺口 |
| 用 `cp` 而不是 `git mv` | 丢失重命名历史 | 大范围移动一定用 `git mv` |
| 适配层里抄一份上游逻辑再改 | 变成第二套实现，违背移植初衷 | 替身只做“接线/注入”，逻辑留在镜像里 |

## 8. 把本规范用到别的项目

1. 建镜像根 `folia/`，三条树与上游仓库根 1:1；`README.md` 写清映射与最小子集原则。
2. 复制 `scripts/check-folia-mirror.mjs`，把 `UPSTREAM` 指向你的上游检出；`--update` 生成 `mirror.manifest.json`。
3. 适配层目录用「上游相对路径」组织；替身文件头统一写「替身上游：…」。
4. 构建脚本里用 alias 接替身、`define` 掉 Vite 约定、`external` 掉 npm 依赖；入口只做接线。
5. 把镜像校验挂进 `check` 与 `test`，并在 `AGENTS.md` 写一条“镜像规则”指回本文件。

