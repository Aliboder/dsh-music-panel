# 在线平台对齐 Folia：现状核查（网易云 / QQ / 波点 / 汽水）

> 目的：在动手移植前，把四个平台「我方现有实现」与「上游 Folia 音源模组」逐项摆在一起，给出差距、移植步骤、风险与工作量。
> 判据与写法沿用酷狗那两份（[上游规格](酷狗对齐Folia-上游规格.md)、[我方映射](酷狗对齐Folia-我方映射.md)）：
> `src/folia-mods/**` 与上游 diff 只应剩路径，所有差异只能出现在 `src/folia-adapters/**`、`src/folia-build/**`、`src/host/vendor/**` 与 `scripts/**`。
>
> 本文件由两份分平台核查合并而成，正文按平台分节，未做删改。

## 目录

1. [网易云与 QQ](#一网易云与-qq)
2. [波点与汽水](#二波点与汽水)

---

## 一、网易云与 QQ

# 核查：网易云（netease）与 QQ（qq）对齐 Folia

> 只读审计。本文只记录事实与结论，未改任何代码（唯一产出是本文）。
>
> **基线**：仓库 `dsh-music`，HEAD `88075be`（2026-11-28，`feat(波点): 镜像 Folia 波点音源模组，接上共用宿主面并产出 bundle`）。工作区除 `A_other/` 下的未跟踪素材外干净。
>
> **引用约定**：`路径:行号`。**上游**路径以 `A_other/upstream/folia-major-main/` 为根（如 `sources/netease/main/index.ts:41`）；**插件**路径以仓库根为根（如 `src/host/services/netease-api.js:129`）。每条结论都指到具体文件与行号；没读过的文件不下结论。
>
> 上游是移动靶，升级后按本文行号复核。字节数为 PowerShell `Length` 实测；行数为 read 工具的 `totalLines`（`Measure-Object -Line` 不计空行，会差几十行，本文一律用前者）。

---

## 0. 结论摘要

1. **两个平台的上游模组都比酷狗大一档**：netease 35 个文件 / 311,525 B（TS 210,283 B + CJS 79,430 B，11 个 `.cjs`）；qq 45 个文件 / 375,348 B（TS 312,403 B + CJS 32,769 B，4 个 `.cjs`）。酷狗基线是 19 个文件 / 210,614 B。
2. **netease 的 `main/` 里 10 个 `.cjs` 全是纯 Node**：只 require `node:` 内置与彼此（`neteaseApiWorker.cjs:1-25`、`neteaseLoginDiagnostics.cjs:1`、`networkRecorder.cjs:3-4`、`neteaseLoginIdentity.cjs:1-2`、`backendLifecycle.cjs:3`），**没有一个 require electron**。整个 netease 目录里 Folia 专有的运行时依赖只有两处：`@folia/source-deps`（`main/index.ts:3`）与 `@folia/folium-source-kit`（`core/netease.ts:2` 等）。
3. **netease 的「工作线程 + 改 require.cache」在纯 Node 宿主里完全成立**，而且我们已经在做同一件事的简化版（`src/host/services/netease-api.js:25-79`、`src/host/services/netease-upstream.js:129-141`）。差别在**产物形态**：上游的 worker 是磁盘上的真实文件（`main/index.ts:41` 的 `path.join(__dirname,'worker.cjs')`），我们是 `new Worker(source, { eval: true })` 的内联字符串（`netease-api.js:129-134`）。逐字节镜像要求前者。
4. **QQ 的「加载即监听 PORT」在纯 Node 宿主里是最大的一处形态冲突**：包在 `require` 时就 `app.listen(config.port)`（实测 `node_modules/@yakult-green-tea/qq-music-api/dist/src/app.js` 尾部），上游因此在加载前后开一个 `process.env` 窗口（`sources/qq/main/qqApiStartup.cjs:122-181`）。我们的 Host 与整个 DSH 进程共用 `process.env`，且没有「卸载模组」这回事；我们现在的做法是把它整个塞进 worker 并用 `PORT` 预置（`src/host/services/qq-api.js:22-75`）。
5. **QQ 的「main 按路径加载两个内部文件」必须在**加载了包的那个线程里**做**：`sources/qq/main/qqBackend.cjs:30-31` 按绝对路径 `require` 包内的 `dist/src/services/auth/qrLogin.node.js` 与 `dist/src/util/logger.js`，改的是 `require.cache` 里的同一个实例。跨线程改不到对方。
6. **宿主面不再从零开始**：`src/folia-adapters/source-host/`（9 个文件）已经是四个平台共用的宿主面，提供 `api.net`（`fetch`+`request`）、`api.media`、`api.legacy.store`、`api.seal`、`api.rpc.handle`、`folium.*`（`host.ts:59-103`）。netease/qq 缺的是 `api.rpc.send`、`api.diagnostics`、`api.paths.legacy`、`api.onBeforeUnload`/`onBeforeQuit`、`api.reportError`——全部没实现（`src/folia-adapters/**` 除 vendor 外无 `diagnostics`/`rpc.send`/`onBeforeUnload` 命中）。
7. **依赖版本**：`@neteasecloudmusicapienhanced/api` 我方 `4.41.1`（`package.json:86`）= 上游 `4.41.1`（`sources/netease/package.json:5-7`）✅；`@yakult-green-tea/qq-music-api` 我方 `3.3.6`（`package.json:87`）≠ 上游 `3.3.9`（`sources/qq/package.json:5-7`）❌。
8. **门面与路由基本不需要改**：路由里与这两家有关的字面判断/常量只有 8 处（`src/host/http/routes/online.js:359,360,372,373,528,529,699,1688`），其余全经 `omni.*` → `adapter` → 门面。移植的落点是门面（40+ 个方法）与 `sources/<id>-folia/`，这与酷狗那一轮选点一致。
9. **能力族差异是「多出来的」而不是「少掉的」**：netease 上游声明 13 族（含 `explore@1`、`raw@1`、`reports@1`），我方现状 11 族有入口、`explore`/`raw` 无入口；QQ 上游声明 11 族（含 `explore@1`），我方同样无 `explore`。按 `A_other/docs/在线平台对齐清单.md` 的口径，**没有界面入口的能力不许声明**。
10. **相对酷狗的工作量**：netease 约 **1.8–2.2×**，QQ 约 **2.2–2.8×**（依据见 §1.7、§2.7；差异来自按路径加载的包、消息式 rpc 之外的 `musicu` 通道、加密会话仓库、登录钩子与 PORT 窗口）。

---

## 0.1 两处「纯 Node 宿主」的准确含义

### 0.1.1 netease：工作线程 + 替换上游 `util/request` 导出 + 挂扫码钩子

上游做法（`sources/netease/main/`）：

| 动作 | 位置 | 对纯 Node 宿主的含义 |
| --- | --- | --- |
| 开线程 `new Worker(workerPath, { env: SHARE_ENV, workerData })` | `neteaseApiHost.cjs:12-17` | `worker_threads` 是 Node 内置，**不需要 Electron**。`SHARE_ENV` 表示线程与进程共用一份环境变量——这与我们现在的内联 worker（默认拷贝环境）**语义不同**，见风险 §1.6。 |
| 线程入口是磁盘文件 `worker.cjs` | `main/index.ts:41`；来源见 `sources/netease/package.json:12-14` 的 `folia.workers.worker: main/neteaseApiWorker.cjs` | 镜像后必须真的产出一个文件（`src/host/vendor/netease-folia/worker.cjs`），不能用 `eval`：worker 里要 `require('./neteaseApiStartup.cjs')` 等同目录兄弟文件，也要 `require.cache[requestPath]` 命中包自己加载的那一份。 |
| 替换 `util/request` 的导出 | `neteaseApiWorker.cjs:122-129`；策略在 `neteaseApiStartup.cjs:245-247,280-303` | 全部是 Node 侧操作：`ncmRequire.resolve` 得真实路径 → 先 `require` 填缓存 → 改 `require.cache[path].exports`。**线程内一份缓存**，必须在 worker 里做；主线程改不到 worker 的缓存。 |
| 换掉 `module/login_qr_check` | `neteaseApiStartup.cjs:321-325`（`installLoginQrCheck`） | 同上，且**必须赶在 `server.js` 首次按路径扫 `module/` 之前**（`neteaseApiWorker.cjs:130-131` 的调用顺序就是证据）。这要求包是真实文件布局、而不是被打包。 |
| 推迟 jsdom | `lazyJsdom.cjs:13-68`（`deferJsdom`），调用点 `neteaseApiWorker.cjs:124` | 往 `require.cache` 塞一个 `Module` 替身 + `Proxy`，纯 Node 手法。 |
| 改 DNS 与 autoSelectFamily | `upstreamAddressOrder.cjs:27-38` | 上游注释（`:21-22`）说明这两项**每个线程各自一份**；放进 worker 才安全，在主线程调会波及整个 DSH 进程。 |
| `process.env.ENABLE_GENERAL_UNBLOCK = 'false'` | `neteaseApiWorker.cjs:76`；主入口加载前记录、停止时还原 `main/index.ts:28,61-62` | 因为 `SHARE_ENV`，这一行改的是**整个进程**的环境变量。插件侧要不要跟着改整个进程，是要拍板的（§1.6 风险 3）。 |
| 监听地址固定 `127.0.0.1` | `neteaseBackend.cjs:19,65` | 对桌面插件是正确的（只本机可连）。 |

**结论**：netease 的 main 侧没有一处需要 Electron 语义；需要替换的只有 `api.*` 的接线（`main/index.ts`）与 `@folia/source-deps`。也就是说，**这 10 个 `.cjs` 可以逐字节复制到插件里直接跑**，只要我们提供同形状的 `api` 与一个能被 `new Worker(path)` 打开的文件。

### 0.1.2 QQ：加载即监听 PORT + main 按路径加载两个内部文件

| 事实 | 位置 | 对纯 Node 宿主的含义 |
| --- | --- | --- |
| 包在 `require` 时 `app.listen(port)` | 实测 `node_modules/@yakult-green-tea/qq-music-api/dist/src/app.js` 尾部 `exports.server = isTestEnv ? null : app.listen(config_1.serverConfig.port, ...)` | 谁 require 谁就**在谁的进程里监听**。放进 Host 主进程 = 在 DSH 进程里多一个 Koa；放进 worker = 与我们现在一致（`src/host/services/qq-api.js:22-75`）。 |
| 端口来自 `PORT`，加载前设、加载后还原 | `qqApiStartup.cjs:122-181`（键表 `:123-129`，赋值 `:141-146`，`restore` `:131-139`） | 纯 Node 可行，但改的是**进程级 `process.env`**；上游为此加了 `globalThis` 上的串行窗口（`:50-70`）。我们的 Host 与 DSH 共用环境，这层窗口的收益变小、副作用变大。 |
| 每次加载只能起一个服务 | `qqApiStartup.cjs:73-81` 的注释与 `require` 缓存 | 换源/重启用同一个进程做不到；上游靠模组卸载后清缓存（`:78-81`）。我们没有卸载流程 → 要么 worker、要么主动清 `require.cache`。 |
| 加载后按绝对路径 require 两个内部文件 | `qqBackend.cjs:30-31`（`dist/src/services/auth/qrLogin.node.js`、`dist/src/util/logger.js`），调用 `:68-125` | 需要**真实文件布局**（不能把包打进 bundle）且**与包同一份模块实例**。实测这两条路径在 3.3.6 里都存在（`Test-Path` 为 True），布局要求可满足；跨线程则必须在线程内安装。 |
| 会话仓库在加载后同步注入 | `qqApiStartup.cjs:151-164`（`configureAuthSessionRepository`） | 注入对象带函数（`load`/`save`），**不能跨 `postMessage` 传**。若包跑在 worker 里，仓库必须在 worker 内重建（我们现在就是：`qq-api.js:39-58` 在 worker 里建 json-file 仓库）。 |
| 监听不带 host | `app.js` 的 `app.listen(port)`；上游已知问题 `sources/qq/README.md:41-43` | 绑所有网卡。我们 `qq-api.js:33` 设了 `process.env.HOST='127.0.0.1'`，但包的 listen 不读 host（`app.listen(port)` 单参），**这一行没有约束力**，与上游同病。 |

**结论**：QQ 的「纯 Node」没有问题，问题在**进程归属**与**模块实例归属**。两条路都可做，但代价不同——见 §2.5 步骤 1。

---

## 0.2 依赖版本核对（任务点）

| 平台 | 上游钉的版本 | 上游出处 | 我方 `package.json` | 实际装上的副本 | 结论 |
| --- | --- | --- | --- | --- | --- |
| netease | `@neteasecloudmusicapienhanced/api` **4.41.1** | `sources/netease/package.json:5-7`（另见 `sources/netease/core/neteaseRaw.ts:195` 的 `NETEASE_RAW_BACKEND.version` 与 `README.md:8`） | `4.41.1`（`package.json:86`） | `node_modules/@neteasecloudmusicapienhanced/api/package.json` → **4.41.1** | ✅ 一致 |
| qq | `@yakult-green-tea/qq-music-api` **3.3.9** | `sources/qq/package.json:5-7`（另见 `sources/qq/README.md:7-8`） | `3.3.6`（`package.json:87`） | `node_modules/@yakult-green-tea/qq-music-api/package.json` → **3.3.6** | ❌ 不一致，差 3 个小版本 |

3.3.6 与 3.3.9 的差异会落到具体行为上（上游 `sources/qq/README.md` 自己写了）：

- **`3.3.7` 起 `/getMusicPlay` 一定返回请求那首歌自己的条目**（拿不到时给空链接），而 3.3.6 之前可能回别的条目（`README.md:76`）。镜像里的 `core/qqProvider.ts` 取流逻辑按 3.3.7+ 的语义写（`README.md:75-76`）。
- **`3.3.9` 起 `/song/replacement` 也会为下架歌找替代版本**（`README.md:79-80`），镜像的 `core/qqAvailability.ts:33` + `core/qqProvider.ts:1100` 依赖这条。
- 3.3.6 的路由表实测已包含 `qqTransport.ts` 操作表用到的大部分路径（`/login/refresh`、`/login/channels`、`/user/listening-rank`、`/song/replacement`、`/recommend/*`、`/radio/*`、`/user/guess-you-like*`、`/user/recommendation-preferences*`、`/user/song/like`、`/user/album/subscribe`、`/user/vip`、`/user/cloud`、`/user/playlist/create`），**但「有路由」不等于「有 3.3.7/3.3.9 的行为」**。

> 结论（任务点）：**netease 可直接开镜像；QQ 先把 `package.json` 的 `3.3.6` 升到 `3.3.9` 并同步 lock，再镜像**，否则镜像里的取流/替代版本逻辑按 3.3.9 语义写、跑在 3.3.6 上。

---
## 1. 网易云（`netease`）

### 1.1 模组结构（35 个文件，311,525 B）

上游 `sources/netease/` 的完整清单。**「镜像」= 可逐字节照搬**（只有 `import type` 与 `@folia/folium-source-kit` 两类依赖）；**「替换」= 必须由插件侧改写或另行提供**。

| 文件 | 字节 | 行 | 性质 | 说明 / 落点 |
| --- | --- | --- | --- | --- |
| `mod.json` | 1,104 | 38 | 镜像 | `client: client.mjs`、`main: index.cjs`（`:8-9`）；`sources[0].requires` 13 族（`:20-34`）；`keepForMatching`（`:35`） |
| `package.json` | 786 | 16 | 镜像 | 钉 `4.41.1`（`:5-7`）；`folia.dependencies…asar`（`:8-12`）；`folia.workers.worker`（`:12-14`）——**这三行是打包契约，插件侧要有等价物** |
| `README.md` | 6,626 | 56 | 参考 | 上游自述：桌面/网页两形态、`我们改了什么`（`:22-28`）、`上游变了怎么跟`（`:29-38`）、已知情况（`:40-43`） |
| `client/index.ts` | 1,921 | 34 | 镜像 | client 入口：8 个 env 字段 + `rpc.on('status')`（`:26-28`） |
| `core/index.ts` | 1,809 | 33 | 镜像 | `createSource` / `disposeSource`（`:22-33`） |
| `core/neteaseEnv.ts` | 4,905 | 90 | 镜像 | `NeteaseSourceEnv`（`:22-37`）、cookie 读法（`:87-90`） |
| `core/netease.ts` | 54,155 | 1,290 | 镜像 | 传输层：**全部请求都是 `fetch('http://127.0.0.1:<port><route>')`**（`getApiBase` `:217-246`、`fetchWithCreds` `:267`、`requestNeteaseRoute` `:373-375`）；`neteaseApi` 的对象表 `:823` 起 |
| `core/neteaseProvider.ts` | 57,986 | 964 | 镜像 | 13 个能力族的实现（族键见 §1.3）；`createNeteaseSource` `:468` |
| `core/neteaseFailure.ts` | 4,851 | 67 | 镜像 | `describeNeteaseFailure` `:38` |
| `core/neteaseLoginFailure.ts` | 1,853 | 27 | 镜像 | `describeNeteaseLoginFailure` `:8` |
| `core/neteaseLocalService.ts` | 4,478 | 97 | 镜像 | `localService`（`auth@1` 的成员）：`subscribe/getStatus/restart` `:63-89` |
| `core/neteaseLoginDiagnostics.ts` | 15,585 | 303 | 镜像 | 登录诊断报告排版 |
| `core/neteaseSelfCheck.ts` | 4,477 | 90 | 镜像 | `canRunNeteaseSelfCheck` `:72` / `runNeteaseSelfCheck` `:75`（桌面问 `rpc 'selfCheck'`：`:79`） |
| `core/neteaseCovers.ts` | 1,687 | 30 | 镜像 | `covers@1`（`:20-30`） |
| `core/neteaseFmCatalog.ts` | 3,520 | 72 | 镜像 | 私人 FM 模式与场景（`:68-72`） |
| `core/neteaseExplore.ts` | 37,412 | 589 | 镜像 | `explore@1`（`:190`、`getFeed` `:532`、`getSectionItems` `:550`） |
| `core/neteaseRaw.ts` | 10,680 | 204 | 镜像 | `raw@1` 端点表（`:33-131`）、`NETEASE_RAW_BACKEND`（`:195`） |
| `main/index.ts` | 4,294 | 66 | **替换（接线）** | 唯一碰 `api.*` 与 `@folia/source-deps` 的文件 |
| `main/neteaseBackend.cjs` | 5,908 | 121 | 镜像 | 控制面（状态/拉起/诊断/停）：`createNeteaseBackend` `:28` |
| `main/neteaseApiHost.cjs` | 5,249 | 108 | 镜像 | 线程封装：`createNeteaseApiHost` `:12` |
| `main/neteaseApiWorker.cjs` | 14,348 | 268 | 镜像 | 线程主体：加载/拉起/诊断三段（`:33-40` 的注释） |
| `main/neteaseApiStartup.cjs` | 16,030 | 345 | 镜像 | 启动纯函数、请求管线包装、`installLoginQrCheck` |
| `main/backendLifecycle.cjs` | 6,464 | 163 | 镜像 | 状态/启动记录/`findFreePort`/`waitUntilListening` |
| `main/lazyJsdom.cjs` | 3,328 | 72 | 镜像 | 推迟 jsdom |
| `main/neteaseLoginDiagnostics.cjs` | 8,049 | 198 | 镜像 | 线程侧登录诊断记录 |
| `main/neteaseLoginIdentity.cjs` | 5,005 | 112 | 镜像 | 身份轮换（`wrapRequest`） |
| `main/networkRecorder.cjs` | 10,258 | 225 | 镜像 | `diagnostics_channel` 记上游连接 |
| `main/networkErrorText.cjs` | 1,646 | 25 | 镜像 | 网络错文案表 |
| `main/upstreamAddressOrder.cjs` | 3,145 | 44 | 镜像 | IPv4 优先 |
| `main/packageRoot.ts` | 670 | 12 | **替换** | 只有一处：`depsRequire.resolve('<pkg>/package.json')` 求包目录（`:10-12`） |
| `main/neteaseBackend.d.cts` | 1,318 | 36 | 镜像 | 类型 |
| `locales/{zh-CN,en,in,vi}.json` | 2,873 / 2,934 / 2,972 / 3,199 | 各 92 | 镜像 | `env.text`/`env.translate` 的键（含 `name.short`、`login.*`、`fm.mode.*`、`explore.*`、`listeningRank.*`、`cloud.*`、`status.*`） |

**镜像 vs 替换的判据**（与酷狗那份文档 §6.3 同一条）：`src/folia-mods/sources/netease/**` 与上游 `diff` 起来应当只剩空；差异只许出现在 `src/folia-adapters/netease/**`、`src/folia-build/netease-host-entry.ts`、`src/host/vendor/netease-folia/**`、`scripts/build-folia-source.mjs` 的 `PLATFORMS` 表里。

**必须由插件侧产出的「非 .ts 产物」**（上游靠构建生成的）：

| 上游契约 | 上游怎么来的 | 插件侧怎么办 |
| --- | --- | --- |
| `worker.cjs`（`main/index.ts:41`） | `package.json` 的 `folia.workers.worker` 指向 `main/neteaseApiWorker.cjs`，构建复制成 `worker.cjs` | 把 `neteaseApiWorker.cjs` 连同它 require 的 8 个兄弟 `.cjs` 一起复制到 `src/host/vendor/netease-folia/`，并把 `workerPath` 指过去（`src/host/vendor/**` 已在发布清单里，`package.json:59`） |
| 包在 asar 里的目录（`main/index.ts:42` 的 `neteasePackageRoot(...)`） | `@folia/source-deps` 的 `depsRequire.resolve` | 用 `createRequire(<vendor 目录>)` 解析 `<pkg>/package.json` 求目录；包体保持真实文件布局（`@neteasecloudmusicapienhanced/api` **没有 `exports` 表**，实测 `exports=False`，深路径可用） |

### 1.2 宿主面

#### 1.2.1 main 入口用到的 `api.*`（逐个，带行号）

| `api.*` | 调用点 | 用途 | 共享宿主面是否已有 |
| --- | --- | --- | --- |
| `api.rpc.send` | `main/index.ts:31`（后端状态变化时推 `'status'`） | client 靠它更新端口与故障 | ❌ 缺（`src/folia-adapters/source-host/rpc.ts` 只有 `handle`/`call`/`names`） |
| `api.reportError` | `main/index.ts:34`（线程未处理的 rejection）、`:39`（线程未捕获异常） | 不把模组异常算成宿主异常 | ❌ 缺 |
| `api.diagnostics.register` | `main/index.ts:44` | 注册「后端」这一份诊断 | ❌ 缺 |
| `api.diagnostics.snapshot` | `main/index.ts:54`（rpc `diagnostics`） | 登录窗口的诊断报告 | ❌ 缺 |
| `api.diagnostics.selfCheck` | `main/index.ts:55`（rpc `selfCheck`） | 自检 | ❌ 缺 |
| `api.rpc.handle` | `main/index.ts:51`（`status`）、`:53`（`restart`）、`:54`、`:55` | client→main 四个通道 | ✅ `rpc.handle`（`source-host/rpc.ts:21-26`） |
| `api.onBeforeUnload` / `api.onBeforeQuit` | `main/index.ts:64`、`:65` | 停线程、还原 `ENABLE_GENERAL_UNBLOCK` | ❌ 缺 |
| `process.env.ENABLE_GENERAL_UNBLOCK`（非 api，但宿主面等价物） | `main/index.ts:28`、`:61-62`；写入在 `neteaseApiWorker.cjs:76` | 包读的环境开关 | ⚠️ 进程级副作用，需拍板（§1.6） |

**没有用到**的：`api.manifest`、`api.host`、`api.log`、`api.storage`、`api.secrets`、`api.paths`、`api.seal`、`api.legacy`、`api.net`、`api.media`、`api.windows`、`api.shell`、`api.dialog`、`api.native`、`api.cache`、`api.render`、`api.runtime`。→ **netease 的 main 侧比 QQ 窄**：不要 `net`、不要 `seal`、不要 `paths`。

#### 1.2.2 client 入口用到的 `folium.*`（逐个，带行号）

| `folium.*` | 调用点 | 语义 |
| --- | --- | --- |
| `folium.modId` | `client/index.ts:14` | 交给 core 的 `env.modId`（core 实际不读：`modId` 只在 `neteaseEnv.ts:23` 声明、`client/index.ts:14` 传入，镜像内无消费方——`rg modId` 只这两处） |
| `folium.sources.register` | `:13` | 注册音源定义（必须在第一个 `await` 之前） |
| `folium.rpc.call` | `:15` | `status` / `restart` / `diagnostics` / `selfCheck` 四个通道 |
| `folium.i18n.key` | `:16` | `env.text` |
| `folium.i18n.text` | `:17` | `env.translate` |
| `folium.sources.error` | `:18` | `env.error` |
| `folium.lyrics.isPureMusicText` | `:19` | 纯音乐判定（`neteaseProvider.ts:403`） |
| `folium.sources.pageStore` | `:20` | cookie 存储（`neteaseEnv.ts:87-90`） |
| `folium.rpc.on('status')` | `:26` | 收 main 推来的后端状态 |
| `handle.notify`（`env.notify`） | `:22`、`neteaseLocalService.ts:44-49` | 起不来时提示一次 |

→ client 侧带 9 个成员、5 个命名空间；**共享宿主面 `clientFacade` 已覆盖 8 个**（`source-host/host.ts:81-102`），缺的是 `notify`（`handle.notify`）与 `rpc.on`。

#### 1.2.3 运行时依赖（npm 包名与钉死版本）

| 依赖 | 版本 | 谁需要 | 备注 |
| --- | --- | --- | --- |
| `@neteasecloudmusicapienhanced/api` | **4.41.1**（`sources/netease/package.json:5-7`） | worker 里按路径加载 | 不需要打进 bundle；要真实文件布局（它自己扫 `module/`，实测 449 个 `module/*.js`）；**无 `exports` 表** |
| `@folia/folium-source-kit` | 镜像件（`src/folia-mods/packages/folium-source-kit`，9 文件 17,873 B） | `core/netease.ts:2`（`errorFields`、`withLoginRequestLimit`）、`neteaseProvider.ts:13`、`neteaseExplore.ts:11`、`neteaseFmCatalog.ts:2` | 运行时 import，必须进 bundle；`scripts/build-folia-source.mjs:34` 已有别名 |
| `@folia/folium` | 类型 only | 全部 `import type` | esbuild 直接擦除，无需解析（这也是为什么现在没有 `tsconfig` 也能 build） |
| `@folia/source-deps` | 虚拟模块 | `main/index.ts:3` | **唯一需要新增的别名/stub**：`{ depsRequire: createRequire(<vendor 目录>) }` |
| `jsdom` | 包自带依赖 | 被 `lazyJsdom.cjs` 推迟 | 不新增；只是加载顺序问题 |
### 1.3 能力族

`mod.json` 的 `requires`（`sources/netease/mod.json:20-34`）共 **13 族**，与 `core/neteaseProvider.ts` 的 `capabilities` 键一一对应（`neteaseProvider.ts:490-955`）。逐族：

| 族 | 上游成员（行号） | 宿主里它需要什么 / 谁在调 | 我方界面入口 |
| --- | --- | --- | --- |
| `search@1`（`:491`） | `searchSongs` `:492`、`searchAlbums` `:499`、`searchPlaylists` `:505` | 只经 rpc `status` 拿端口、随后自己 `fetch` 本地 API（`netease.ts:217-246,493`）。我方：`/online/search`（`online.js:549`）→ `omni.search|searchPage|searchCollections` → 门面 `search:109`/`searchPage:141`/`searchAlbums:280`/`searchPlaylists:316` | ✅ 搜索页（在线面板） |
| `songs@1`（`:512`） | `metadataMatch:true` `:513`、`getSong:514`、`getSongs:525`（每 50 首一次 `/song/detail`）、`songsPerRequest:542`、`getAvailability:543`、`getReplacement:546`（下架替代版本）、`getPageUrl:554` | 数据来自本地 API 的 `/song/detail`、`/song/copyright/rcmd`（`netease.ts:682,703,724`）。我方：`/online/songs`（`:1695`）→ `songs:1017`；`/online/check-playable`（`:1322`）→ `resolveStream`。**批量取歌/可用性/替代版本无路由** | ⚠️ 单曲与批量（列表）有入口；`getAvailability`/`getReplacement` **无入口**（客户端没有「换一个能放的版本」对话框） |
| `playback.audio@1`（`:558`） | `getAudioSource:559`（`/song/url/v1`、`preview` 由 `freeTrialInfo` 判定 `:569`、`replayGain` 取 `gain` `:570-575`） | 我方：`/online/stream`（`:635`）→ `resolveStream:697`（netease 分支 `:702-712`）、`/online/quality`（`:1271`） | ✅ 播放 |
| `reports@1`（`:579`） | `canReport:583`、`report:587`（`/scrobble/v1`） | 我方 `/online/report-playback`（`:1289`）先看能力 `playbackReports`（`contract.js:129`）→ 门面 `reportPlayback:1412` | ✅（netease 已声明 `playbackReports:true`，`sources/index.js:57`） |
| `lyrics@1`（`:614`） | `crossSource` `:615`、`getLyrics:616`（`/lyric/new`，`yrc` 逐字 + `chorusRanges`）、`getChorusRanges:617`（`/song/chorus`）、`getAlternateArtistName:618`、`songIdOf:619` | 我方 `/online/lyric`（`:938`）、`/online/best-lyric`（`:1069`，用 `lyricSearchAlias:652`/`alternateArtistName:675`）、`/online/chorus`（`:1256`） | ✅ 歌词（含逐字与副歌） |
| `auth@1`（`:621`） | `getLoginTexts:622`、`localService:624`（仅桌面）、`getLoginStatus:625`、`logout:656`、`signInRanOut:663`、`showsKeptAccountAtStart:670`、`startLogin:673`、`createQr:679`、`checkLogin:685`（800/801/802/803）、`describeLoginFailure:715`、`getLoginDiagnostics:716`、`canRunLoginSelfCheck:717`、`runLoginSelfCheck:718` | **契约与我方登录桥不同**：Folia 的音源自己管 cookie（pageStore），我方是 `/online/login/*`（`:1362-1561`）走 `login` bridge + `providerStore`。`localService` 有对应路由（`:1510`、`:1516`） | ✅ 扫码登录；⚠️ 语义要重接（§1.5 步骤 6） |
| `library@1`（`:720`） | `getUserPlaylists:721`、`getLikedSongIds:729`、`getLikedSongCount:732`、`getUserAlbums:735`、`getCloudCollection:740`、`getListeningRankCollections:756` | 我方 `/online/my-playlists`（`:1778`）、`/online/liked`（`:1904`）、`/online/liked-ids`（`:1920`）、`/online/cloud`（`:1680`）；排行卡由 `/online/my-playlists` 按能力注入（`:1790-1814`） | ✅ 我的歌单/收藏/云盘/排行 |
| `catalog@1`（`:765`） | `getPlaylistTracks:766`、`getCloudTracks:772`、`getListeningRankTracks:778`、`getAlbumDetail:787`、`getAlbumTracks:812`、`getArtistSongs:818`、`getArtistAlbums:825`、`getArtistDetail:830`、`getSubscriptionStatus:853` | 我方 `/online/playlist-songs`（`:1857`）、`/online/album`（`:1826`）、`/online/artist`（`:1762`）、`/online/artist-songs`（`:601`）、`/online/subscription` GET（`:1984`） | ✅ 歌单/专辑/歌手/订阅状态 |
| `explore@1`（`:928`） | `createNeteaseExplore({song,collection})`（`neteaseExplore.ts:190`；`getFeed:532`、`getSectionItems:550`） | 需要 `@folia/folium-source-kit` 的 `createHandedOut/cursorWords/errorMessage/stampCursor`（`neteaseExplore.ts:11`）、`/homepage/block/page` 等（`netease.ts:1195-1262`） | ❌ **无路由、无界面**（`src/client/components/online/**` 里 0 处 explore 命中；`contract.js:55` 只有能力名，没有实现） |
| `recommendations@1`（`:860`） | `personalFmModes:862`、`getPersonalFmCatalog:864`、`getDailySongs:868`、`getPersonalFm:872`、`getRecommendedCollections:876`、`getHistoryEntries:880`、`getHistoryDates:885`、`getHistorySongs:890`、`dislikeSong:894`、`getDailyStyleGroups:901`、`getDailyStyleSongs:909`、`setDailyStyle:920` | 我方 `/online/discover`（`:1649`）→ `dailySongs:194`+`recommendedCollections:214`；`/online/personal-fm`（`:1667`）→ `personalFm:224`。**FM 模式目录、日推历史、日推风格、不喜欢换一首：无路由** | ⚠️ 日推/推荐歌单/私人FM 有入口；模式与风格无入口 |
| `mutations@1`（`:929`） | `likeSong:930`、`updatePlaylistTracks:933`、`subscribePlaylist:945`、`subscribeAlbum:948` | 我方 `/online/like`（`:1935`）→ `setOnlineLiked:1281`；`/online/playlist-add`（`:1959`）→ `addOnlineSongToPlaylist:1296`；`/online/playlist-remove`（`:2023`）→ `removeOnlineSongFromPlaylist:1377`；`/online/subscription` POST（`:2000`）→ `subscribeCollection:1398` | ✅ 红心/加歌/移除/订阅 |
| `covers@1`（`:952`） | `hosts`、`sized`、`identity`、`original`、`requestedSize`（`neteaseCovers.ts:20-30`） | 我方封面不走音源规则：`/online/cover`（`:2095`）按 provider 选 Referer（`online.js:42`）并过 `isAllowedCoverUrl` | ⚠️ 有封面代理，但**没有「按尺寸要」的入口**；`covers@1` 的 `sized/identity` 在我们这里没有消费方 |
| `raw@1`（`:954`） | `backend/reservedParams/credentialFields/describeEndpoint/checkParams/request`（`neteaseRaw.ts:197-204`） | 需要「把任意后端模块名当端点」的通道（`neteaseRaw.ts:173-191` 走 `requestNeteaseRoute`） | ❌ 无路由、无界面、无实验性 API |

**与我方能力布尔（`src/host/providers/sources/index.js:48-63`）的对照**：

| Folia 家族 | 我方布尔 | 现状 |
| --- | --- | --- |
| `search@1` | `search`/`searchAlbums`/`searchPlaylists` = true（`:26,50,51`） | 一致 |
| `songs@1` | 无独立布尔（`songs` 门 = `search`，`contract.js:102`） | 部分（批量/可用性/替代无实现） |
| `playback.audio@1` | `playback` = true | 一致 |
| `reports@1` | `playbackReports` = true（`:57`） | 一致（门面 `reportPlayback:1412` 有 netease 分支） |
| `lyrics@1` | `lyrics` + `wordByWordLyrics` = true（`:29,53`） | 一致 |
| `auth@1` | `auth` + `loginQr` = true（`:39,52`） | 概念一致，契约不同 |
| `library@1` | `userLibrary`/`userPlaylists`/`playlistSongs`/`likes`/`userCloud`/`listeningRank`/`userAlbums` = true（`:30,31,32,56,59,60,54`） | 一致 |
| `catalog@1` | `artists`/`albums`/`playlistSubscription` = true（`:35,36,62`） | 一致 |
| `explore@1` | `explore` **未声明**（`CAPABILITIES` 里有名字，`contract.js:55`） | 不声明是正确的（无实现） |
| `recommendations@1` | `recommendations`/`historyRecommendations` = true（`:58,60`） | ⚠️ `historyRecommendations:true` 但**无路由**（`rg history` 在 `online.js` 只命中 :1344 的注释）——与酷狗那一轮相同的声明/实现不一致 |
| `mutations@1` | `mutations`/`likeWrite`/`playlistAdd`/`playlistTrackMutations`/`playlistSubscription` = true（`:55,33,34,61,62`） | 一致 |
| `covers@1` | 无布尔 | 无字段可声明 |
| `raw@1` | 无布尔 | 不声明 |
### 1.4 我方现状

#### 1.4.1 现在由哪些文件实现

| 文件 | 体量 | 职责 / 关键导出（行号） |
| --- | --- | --- |
| `src/host/providers/netease.js` | 692 行 / 27,141 B | 走本地 API 的传输层。`export * from './netease-legacy.js'`（`:18`）；匿名 cookie 缓存（`:31-49`）；`search:135`、`dailySongs:163`、`personalFm:173`、`recommendedCollections:180`、`cloudSongs:187`、`historyDates:194`、`historySongs:201`、`removeFromPlaylist:209`、`subscriptionStatus:225`、`subscribeCollection:234`、`searchAlbums:267`、`searchPlaylists:287`、`findArtistId:313`、`getArtistSongs:343`、`getChorus:372`、`getDownloadURL:390`、`getLyric:451`、`createQRLogin:476`、`checkQRLogin:495`、`getAccount:524`、`getMyPlaylists:546`、`getPlaylistSongsPage:587`、`getPlaylistSongs:615`、`getAlbumSongs:674` |
| `src/host/providers/netease-legacy.js` | 729 行 / 33,832 B | 自己实现 weapi/eapi 的老路径（`md5Hex:42`、`weapi:83`、`linuxapi:92`、`eapi:98`、`normalizeSong:166`），以及上游没有覆盖或被 `export *` 保留下来的入口：`getTopLists:336`、`getTopListSongs:350`、`getRecommendedPlaylists:371`、`getPlaylistCategories:378`、`getCategoryPlaylists:390`、`subscribePlaylist:500`、`createPlaylist:530`、`deletePlaylist:551`、`manipulateTracks:568`、`cookieValue:726` |
| `src/host/services/netease-api.js` | 323 行 / 11,100 B | 本地服务：内联 worker（`:25-79`）→ `serveNcmApi`（`:59-60`）→ 绑我们分配的端口 → 主线程 HTTP 调用 `callUpstream:267-307`、`assertOk:313-322`；状态/重启/停止 `:218-253`；测试接缝 `setUpstreamOverride:93` |
| `src/host/services/netease-upstream.js` | 141 行 / 6,456 B | 装进 worker 的策略：`withoutImplicitClientIp:24`、`installClientIpPolicy:37`、`withQrNetworkRetry:78`、`createLoginQrCheck:111`、`installUpstreamPolicies:129-141` |
| `src/host/providers/index.js` | 1505 行 | 门面：netease 分支散在 40+ 个方法里（`PROVIDERS` `:24` 仍只列 `netease/qq/navidrome`；`search:109`、`searchPage:141`、`resolveStream:697`（netease 分支 `:702-712`）、`loginStart:742`、`loginStatus:775`、`lyric:818`、`myPlaylists:1116`、`playlistSongsPage:1189`、`onlineLikedIds:1317`、`listeningRank:1342`、`reportPlayback:1412` 等） |
| `src/host/providers/sources/index.js` | 292 行 | `NETEASE_CAPABILITIES:48-63`、spec `:167-173`（`qualityLevels: FULL_QUALITY` = `['standard','high','lossless','hires']` `:159,172`） |
| `src/host/services/core/contract.js` | 224 行 | `SOURCE_IDS:14`、`CAPABILITIES:25-63`、`METHOD_CAPABILITY:97-137`、`PROVIDER_API_GROUPS:158-168` |
| `src/host/providers/provider-store.js` | 193 行 | `EMPTY.netease` 只有 `{cookie,nickname,avatarUrl,loggedIn}`（`:26`）、`QR_PROVIDERS:46`、`session()` 对非设备平台返回 `{}`（`:121`）、`setLogin:135-152` |
| `src/host/providers/login/store.js` | — | 凭据落 `sessions.json`（`:36`），`writeJsonAtomic(..., { mode: 0o600 })`（`:58-60`），结构 `{version:1, sessions:{<id>:{credentials,profile,updatedAt,expiresAt}}}`（`:19`、`:62-70`） |
| `src/host/services/lyrics/lyrics-sources.js` | 95 行 | `LYRIC_SOURCES` 里 netease 是第一顺位（`:31`），`LYRIC_SOURCE_IDS:39`，别名表只有 `kugou→kugouLite`（`:45`） |

#### 1.4.2 门面与路由的调用点

调用链（与酷狗一致，没有第二条路）：`routes/online.js` → `omni.<method>` → `sources/adapter.js`（`call()` `:39-47`，`spec.providerKey ?? spec.id` `:36`）→ `providers/index.js` → `NC.*` → `services/netease-api.js`。

路由里与 netease 有关的**字面判断只有 4 处**：

| 行 | 判断 | 影响 |
| --- | --- | --- |
| `:359` | `provider === 'netease'` → `neteaseServiceStatus()` | `/online/login/local-service`（`:1510`）与 `/online/providers` 的本地服务状态 |
| `:372` | `provider === 'netease'` → `restartNeteaseService()` | `/online/login/local-service/restart`（`:1516`） |
| `:528` | `provider === 'netease'` → `{ neteaseId: id }` | 歌词 AMLL 的 id 映射（`/online/best-lyric`） |
| `:699` | `provider === 'netease' && Number(stream.code) === 404` | 取流失败文案（「版权限制」） |

另外两处虽不是判断，但依赖 netease 的常量：`/online/cloud` 的页宽 200（`:1688`，`netease ? 200 : 100`）、排行卡名（`:1799`）。

#### 1.4.3 已存的 id 形态与存储兼容点

| 位置 | 现状 | 与 Folia 的差异 / 兼容风险 |
| --- | --- | --- |
| 歌曲 id | 网易云数字 id 的字符串：`normalizeSong` 给 `String(song.id)`（`netease-legacy.js:166` 起），门面 `shape()` 直接取 `song.id`（`index.js:72`） | Folia 相同（`neteaseProvider.ts:229` 的 `String(song.id)`）→ **兼容** |
| 播放器路径 | `online:netease:<id>`（`src/client/services/api/api.js` 的 key 规则；`test/client/online-song-key.test.mjs:52` 的形态） | 不变 |
| 歌词记录 | `online:<provider>:<id>`（`online.js:226-228` 的 `onlineLyricKey`） | 不变 |
| 本地收藏/统计 | 直接用 `track.path` 当键（`favorites`/`stats`） | 不变 |
| 媒体缓存 | `<provider>/<id>` 目录（`media/cache-writer.js`、`routes/online.js` 的缓存段） | 不变 |
| 登录凭据 | `sessions.json` 的 `credentials.cookie`（单条 cookie 串）+ `nickname`/`avatarUrl`/`loggedIn`（`provider-store.js:26`、`setLogin:135-152`） | **Folia 存在 page store**：`online_provider:netease:cookie` 与 `online_provider:netease:anonymous_cookie`（`sources/netease/README.md:16-17`；读法 `neteaseEnv.ts:87-90`）。镜像后要么把 pageStore 接到 `providerStore`，要么搬家（§1.5 步骤 7） |
| 匿名 cookie | 进程内缓存（`netease.js:31-49`），每次进程重启重新 `register/anonimous` | Folia 落在 page store 的 `anonymous_cookie`（`netease.ts:259-261`）并跨启动保留 |
| 设备身份 | netease 无（不需要） | 相同 |
| 能力声明 | `NETEASE_CAPABILITIES`（`sources/index.js:48-63`）：`historyRecommendations:true` 但无路由 | 见 §1.3 末条 |

---

### 1.5 差距与移植步骤

按「先镜像、再宿主面、再门面、再测试」的顺序，每步都可独立验证。

| # | 要做什么 | 落点 | 为什么 |
| --- | --- | --- | --- |
| 1 | 逐字节镜像 `sources/netease/**`（35 个文件）到 `src/folia-mods/sources/netease/**`，相对路径不变 | `src/folia-mods/sources/netease/` | AGENTS.md 的 Folia 移植规则；酷狗/波点同款 |
| 2 | 把 `main/*.cjs` 10 个文件复制成插件可运行的目录（含把 `neteaseApiWorker.cjs` 命名成 `worker.cjs`） | `src/host/vendor/netease-folia/`（`package.json:59` 的 `files` 已覆盖） | 上游 `main/index.ts:41` 用 `path.join(__dirname,'worker.cjs')`；线程内 `require('./neteaseApiStartup.cjs')` 等兄弟文件必须存在 |
| 3 | 写 `src/folia-build/netease-host-entry.ts`：`createSourceHost` + 补 `api.rpc.send`/`api.reportError`/`api.diagnostics`/`api.onBeforeUnload`/`api.onBeforeQuit`，再 `activateMain(api)`、`activateClient(facade)` | `src/folia-build/netease-host-entry.ts` + `PLATFORMS` 表新增一行（`scripts/build-folia-source.mjs:23-29`，`external` 为空、产物 `src/host/vendor/netease-folia/source.bundle.mjs`） | 上游 main 入口只要这 6 个成员；镜像件不许改 |
| 4 | 给 esbuild 加 `@folia/source-deps` 别名 → 一个提供 `depsRequire = createRequire(<vendor 目录>)` 的 stub | 同上（`foliumAliases`，`scripts/build-folia-source.mjs:31-39`） | `main/index.ts:3` 是运行时 import，不别名就 build 失败 |
| 5 | worker 的 `workerPath` 指到步骤 2 的产物；`workerData.packageRoot` 用 `createRequire` 求 `<pkg>/package.json` 的目录 | 宿主面（`netease-host-entry.ts` 内或 `src/folia-adapters/netease/worker.ts`） | 上游 `main/index.ts:42` 用 `depsRequire.resolve`；我们换成 node_modules 解析 |
| 6 | 登录契约适配：把 Folia 的 `auth@1`（cookie 在 pageStore）接到我方 `/online/login/*` + `login` bridge；或反过来让桥调用音源的 `startLogin/createQr/checkLogin` | `src/host/providers/login/bridge.js` + `src/host/providers/index.js:742,775` | 两套登录语义不同：Folia 的 `checkLogin` 自己写 cookie（`neteaseProvider.ts:685-714`），我方桥收到 cookie 才落盘（`online.js:409-416` 的 `store.save`） |
| 7 | pageStore 桥：`folium.sources.pageStore('netease')` 的 `cookie`/`anonymous_cookie` 必须与我方持久化对上（同步读、异步写） | `src/folia-adapters/source-host/stores.ts:46-70` 或 netease 专用包装 | 契约要求 `get/set` **同步**（`src/mods/folium/sources/contract.ts:254-265`），而 `providerStore` 是异步 → 需要启动时 hydrate 到内存 |
| 8 | 门面委派：每个 netease 方法开头 `if (provider === 'netease') return neteaseFacade('<方法>', arguments)`，并新建 `src/host/providers/sources/netease-folia/{instance,dispatch,read,library,playback,account,dto}.js` | 照抄 `sources/kugou-folia/`（`dispatch.js:17-64` 的路由表、`instance.js:21-45` 的生命周期） | 酷狗已成型的做法；门面函数签名不变，路由零改动 |
| 9 | DTO 映射：`FoliumSourceSong`/`FoliumSourceCollection` → 我方 `shape()` 形状（`artist` 字符串 vs `artists[]`、`data` 侧车 → `privilegeDetail`/`aliases`/`translatedNames`/`variant`） | `sources/netease-folia/dto.js` | `shape()`（`index.js:57-102`）是路由与客户端的唯一出口，字段一个不能少 |
| 10 | 能力声明与实现同一次提交：`NETEASE_CAPABILITIES` 与 Folia 家族对齐；`explore`/`raw` 继续不声明；`historyRecommendations` 要么补路由要么降为 false | `src/host/providers/sources/index.js:48-63` | 对齐清单第 3 条 |
| 11 | 测试：镜像 bundle 冒烟（定义 id/能力族/rpc 名）、DTO 映射、取流 preview、歌词 yrc、登录 800-803、分页游标 | `test/host/netease-folia-bundle.test.mjs`（照 `kugou-folia-bundle.test.mjs`）+ `netease-folia-mapping.test.mjs` | 与酷狗/波点同款守卫 |
| 12 | 若要多声明 `explore`：先补 `/online/explore*` 路由与客户端探索页，再一次提交声明 | 路由 + 客户端 | 没入口不许声明（对齐清单 §6.3） |

**必须适配（不能照搬）的清单**，逐条给理由与落点：

| # | 上游依赖 | 为什么不能照搬 | 落点 |
| --- | --- | --- | --- |
| 1 | `import type … from '@folia/folium'`（`neteaseProvider.ts:1-12` 等 11 个文件） | 插件没有这个包；值导入会运行时 require 失败 | 保持 `import type`（esbuild 擦除），不需要 aliases |
| 2 | `@folia/folium-source-kit`（`netease.ts:2`、`neteaseProvider.ts:13`、`neteaseExplore.ts:11`、`neteaseFmCatalog.ts:2`） | 运行时依赖，必须进 bundle | 别名到 `src/folia-mods/packages/folium-source-kit/src/index.ts`（`scripts/build-folia-source.mjs:20,34`） |
| 3 | `@folia/source-deps`（`main/index.ts:3`） | Folia 构建期虚拟模块，插件没有 | 新增 stub：`createRequire` 指向 vendor 目录 |
| 4 | `api.rpc.send`（`main/index.ts:31`） | 共享宿主面没这个成员 | 在 `source-host/rpc.ts` 加 `send`（把「推给 client」实现为「直接调注册的监听器」） |
| 5 | `api.diagnostics.*`（`main/index.ts:44,54,55`） | 没有诊断注册表；现有 `/online/login/diagnostics` 只是三行拼字符串（`online.js:1547-1561`） | 新增 `src/folia-adapters/source-host/diagnostics.ts` + 把路由改成读它 |
| 6 | `api.reportError`（`main/index.ts:34,39`） | 没有崩溃上报入口 | 实现为 `console.error` + 记一条诊断，不抛 |
| 7 | `api.onBeforeUnload` / `onBeforeQuit`（`main/index.ts:64-65`） | 插件没有卸载/退出钩子 | 接到插件 `apply` 的 `ctx.on('dispose')`（`index.js` 的装配处），停线程 |
| 8 | `process.env.ENABLE_GENERAL_UNBLOCK`（`neteaseApiWorker.cjs:76`） | 进程级副作用 | 判断：写进程（同 Folia）还是只写 worker（`SHARE_ENV` 要不要开）——见 §1.6 |
| 9 | 网页分支 `env.web.apiBase`（`neteaseEnv.ts:15-19`、`netease.ts:81-84,238-245`） | 插件规矩是浏览器只经 Host 出网 | 不传 `env.web`，网页分支整段不执行（`isNeteaseDesktop()` 恒真） |
| 10 | 编译链 / 产物命名 | 插件 Host 是纯 JS/ESM | `scripts/build-folia-source.mjs` 产 ESM bundle；`.cjs` 保持 CJS 复制 |

---

### 1.6 风险

1. **`os.tmpdir()` 的全局文件被两家共用**：`anonymous_token`、`xeapi_public_key` 由上游固定路径读写（`neteaseApiWorker.cjs:79-80`，注释 `:78` 明说「路径必须一致，不能另选目录」）。若同时开着 Folia 桌面版或另一个插件实例，两个进程会互相覆盖这两个文件。我们的现状同样如此（`netease-api.js:39`）。→ 无法在镜像内修；只能接受或与「同时只跑一个」的约束一起文档化。
2. **匿名 token 是「加载时读一次」的**：`neteaseApiWorker.cjs:105-109` 注释说明包在 `util/request` 首次 require 时同步读一次，之后写回的新 token 要下次启动才生效。这意味着 worker 必须在**写文件之后**才加载包——上游顺序是对的，改写时别调换。
3. **`ENABLE_GENERAL_UNBLOCK` 的进程副作用**：上游靠 `SHARE_ENV`（`neteaseApiHost.cjs:15-17`）让它对整进程生效，并在停止时还原（`main/index.ts:61-62`）。插件与 DSH 同进程，若照抄，开关会波及别的插件；若只给 worker 设（我们现在的默认拷贝环境行为），行为与 Folia 不同（可能影响解锁逻辑）。**需要拍板**。
4. **`dns.setDefaultResultOrder` / `setDefaultAutoSelectFamilyAttemptTimeout` 只能在 worker 里调**：上游注释（`upstreamAddressOrder.cjs:21-22`）说这两项每线程一份。若把包放进主线程，会改整个 DSH 的 DNS 行为。
5. **本地 API 的端口与生命周期**：`serveNcmApi` 没有关闭入口（`neteaseBackend.cjs:13` 注释），停服务只能结束线程。插件现在的 `stopNeteaseService` 也是 `worker.terminate()`（`netease-api.js:243-253`）。集成 Folia 的 backend 后要保证「只停自己的线程」。
6. **能力声明与实现不一致（已有）**：`historyRecommendations:true`（`sources/index.js:60`）但无路由；`chorus` 由 `lyrics` 放行（`contract.js:121`）且 netease 有实现（`netease.js:372`）——这条是好的，别在移植时丢掉。
7. **歌词缓存由路由独占**：门面返回的 `raw` 会被写进 `online:netease:<id>` 记录（`online.js` 的歌词缓存段）。镜像 DTO 若把 `raw` 形状换掉，老用户的逐字歌词会退化。
8. **`timestamp` 语义差异**：我们给每个上游请求都加 `timestamp`（`netease-api.js:276`），Folia 只对 `/login`、`/user`、`/playlist/detail` 加（`netease.ts:278-287`）。不影响正确性，但会让缓存全失效、请求数上升。

### 1.7 工作量估计（以「酷狗那次」为基准）

| 维度 | 酷狗（基线） | netease | 倍数 |
| --- | --- | --- | --- |
| 镜像字节 | 210,614 B | 311,525 B | 1.48× |
| 镜像文件 | 19 | 35 | 1.84× |
| 需逐字节复制的 `.cjs` | 1 个 / 32,135 B | 10 个 / 79,430 B | — |
| 新增宿主面成员 | 5（`rpc.handle`/`net.fetch`/`legacy.store`/`seal`/`media.allow`） | +6（`rpc.send`/`reportError`/`diagnostics.*`/`onBeforeUnload`/`onBeforeQuit`）+1 虚拟模块（`@folia/source-deps`） | 1.4× |
| 门面委派方法 | 40 个 | 与 netease 相关的门面方法 25 个（`search…albumSongs` 12 + `resolveStream…chorus` 6 + `myPlaylists…subscription` 7） | 0.6× |
| client 侧新增 | `pageStore`/`texts`/`errors`/`rpc`/`facade` | 基本复用 + `notify` + `rpc.on` | 1.1× |
| 额外一次性工作 | — | worker 文件产物、诊断注册表、登录契约适配、pageStore 桥 | — |

**结论：约 1.8–2.2×「酷狗那次」**（镜像 1.5×、宿主面 1.4×，叠加诊断/登录/storage 桥各一处一次性成本）。若只做「镜像 bundle + 冒烟测试、门面仍走旧实现」（波点现在的状态，见 `src/host/providers/sources/index.js:240-254` 与 `index.js:133`）则约 **1.2×**。

---
## 2. QQ 音乐（`qq`）

### 2.1 模组结构（45 个文件，375,348 B）

| 文件 | 字节 | 性质 | 说明 / 关键位置 |
| --- | --- | --- | --- |
| `mod.json` | 991 | 镜像 | `client: client.mjs`、`main: index.cjs`（`:8-9`）；`requires` 11 族（`:20-32`）；`keepForMatching`（`:33`） |
| `package.json` | 579 | 镜像 | 钉 `3.3.9`（`:5-7`）；`asar`（`:8-12`）；**没有 `folia.workers`**（包在主进程内监听，见 §0.1.2） |
| `README.md` | 10,969 | 参考 | 版本（`:7-8`）、桌面形态（`:9-20`）、网页形态（`:21-24`）、不经后端的请求（`:25-27`）、上游怎么跟（`:30-39`）、**已知情况：监听所有网卡**（`:41-43`）、能力（`:45-54`）、登录（`:56-62`）、请求/写入/试听/替代版本（`:68-80`） |
| `client/index.ts` | 1,576 | 镜像 | 8 个 env 字段 + `rpc.on('status')`（`:22-24`） |
| `core/index.ts` | 2,039 | 镜像 | `createSource` / `disposeSource`（`:21-35`） |
| `core/qqEnv.ts` | 4,565 | 镜像 | `QqSourceEnv`（`:24-37`）、`readQqStoredSession`（`:93`，page store 的 `cookie`） |
| `core/qqTransport.ts` | 35,955 | 镜像 | 操作表（`QQ_OPERATIONS` `:12-30`、`POST_OPERATIONS` `:36-40`、`ENDPOINTS` `:42-117`）、两类时限（`:120,124-131`）、`requestQqMusicu`（`:620`，`QQ_MUSICU_URL` `:538`，rpc `'musicu'` `:577`） |
| `core/qqProvider.ts` | 65,009 | 镜像 | 11 个能力族（族键 §2.3）；`createQqSource`（`:1076`）、`getAvailability`（`:1063`）、`getPageUrl`（`:1070`） |
| `core/qqNormalize.ts` | 23,460 | 镜像 | 归一化（song/collection/user） |
| `core/qrcDecrypt.ts` | 15,100 | 镜像 | QRC 歌词解密，纯查表（`:8` 起 SBOX），**无外部依赖** |
| `core/qqExplore.ts` | 30,553 | 镜像 | `explore@1`（`createQqExplore()`，在 `qqProvider.ts:1210` 挂上） |
| `core/qqRecommendations.ts` | 10,587 | 镜像 | `recommendations@1` 成员表（`:184-196`） |
| `core/qqGuessYouLike.ts` | 12,103 | 镜像 | 猜你喜欢电台（`getQqGuessYouLikeCatalog:150`、`getQqGuessYouLikeBatch:178`、`getQqGuessYouLikeCard:205`） |
| `core/qqPreferences.ts` | 6,794 | 镜像 | 音乐偏好读写（`getQqRecommendationPreferences:91`、`saveQqRecommendationPreferences:130`） |
| `core/qqMutations.ts` | 9,786 | 镜像 | `mutations@1`（`:161-171`）；`canEditQqPlaylistTracks:29`（只有本人普通目录 1–199 可写） |
| `core/qqLists.ts` | 7,354 | 镜像 | 排行/电台/云盘当集合（`getQqListTracks:106`、`getQqCloudCollection:123`、`getQqCloudTracks:143`） |
| `core/qqListeningRank.ts` | 4,247 | 镜像 | 听歌排行 |
| `core/qqSongDetail.ts` | 6,290 | 镜像 | 按数字 songid 直发 musicu（`requestQqSongDetail`，一批 25） |
| `core/qqSearch.ts` | 9,414 | 镜像 | 带会话的 `/search` + 匿名直连回落 |
| `core/qqLyricProvider.ts` | 6,898 | 镜像 | 歌词（musicu `musicu_lyric`） |
| `core/qqMusicuPlaylist.ts` | 2,113 | 镜像 | 匿名读歌单（musicu） |
| `core/qqAvailability.ts` | 3,138 | 镜像 | 下架判定（bit 27）与 `getQqSongReplacement:33` |
| `core/qqPreview.ts` | 2,030 | 镜像 | 试听片段 |
| `core/qqAccount.ts` | 4,281 | 镜像 | 账号归一化 |
| `core/qqFailure.ts` / `qqLoginFailure.ts` | 5,785 / 4,737 | 镜像 | 失败事实表 / 登录失败事实表（含 `qqAccountHintNote`） |
| `core/qqLoginIcons.ts` | 3,357 | 镜像 | 登录方式图标（字与颜色，不用商标） |
| `core/qqLoginDiagnostics.ts` | 12,001 | 镜像 | 登录诊断排版 |
| `core/qqSelfCheck.ts` | 4,457 | 镜像 | 自检（桌面 `rpc 'selfCheck'`） |
| `core/qqSessionRefresh.ts` | 3,874 | 镜像 | 每小时续期（`QQ_SESSION_REFRESH_INTERVAL_MS:11`、`refreshOnce:23`、`keepQqSessionFresh:57`）——**模块级 setInterval** |
| `core/qqCovers.ts` | 4,541 | 镜像 | `covers@1`（`:69-92`；`QQ_COVER_HOSTS:21`、`QQ_PROXIED_COVER_HOSTS:24`） |
| `core/qqBackendDeclaration.ts` | 991 | 镜像 | 记 `/login/channels` 的 `sessionMode`（`:8-11`；`sealed` / `stored`，`:18`） |
| `main/index.ts` | 6,863 | **替换（接线）** | 唯一碰 `api.*` 与动态 `import('@yakult-green-tea/qq-music-api')` 的文件 |
| `main/qqBackend.cjs` | 11,453 | 镜像 | 控制面 + 登录钩子（`installQqLoginHooks:68-125`、`createQqBackend:131-240`） |
| `main/qqApiStartup.cjs` | 7,005 | 镜像 | 加载窗口 + 启动（`startQqApi:82-118`、`loadWithEnvironment:122-181`） |
| `main/qqAuthSessionRepository.cjs` | 7,974 | 镜像 | 加密会话仓库（`SESSION_KEY:35`、`createQqAuthSessionRepository:102-159`） |
| `main/qqApiExports.ts` | 2,505 | 镜像 | 从 `import()` 结果里认导出（`:16-20`）与求包目录（`packageRootOf:27-43`） |
| `main/backendLifecycle.cjs` | 6,337 | 镜像 | 自己的一份拷贝（与 netease 同源，`qqBackend.cjs:5-10`） |
| `main/*.d.cts` | 1,320 / 899 / 1,106 | 镜像 | 类型 |
| `locales/{zh-CN,en,in,vi}.json` | 3,333 / 3,381 / 3,488 / 4,110 | 镜像 | `env.text`/`env.translate` 的键（`name.*`、`login.*`、`fm.*`、`guessYouLike.*`、`preferences.*`、`cloud.*`） |

**必须由插件侧产出的**（与 netease 不同，QQ 没有 worker 声明）：

| 上游契约 | 上游怎么来的 | 插件侧怎么办 |
| --- | --- | --- |
| 包的加载方式 | `main/index.ts:58-61` 的 `await import('@yakult-green-tea/qq-music-api')`（构建期不从 asar 解析，运行时从 deps 归档） | bundle 里保持 **external**，让 Node 从插件 `node_modules` 解析（`scripts/build-folia-source.mjs:35-37` 的 external 机制，bodian 已这么用） |

---

# 核查：波点（bodian）与汽水（qishui）对齐 Folia

> 只读核查，未改任何代码。审计对象：上游只读树 `A_other/upstream/folia-major-main/sources/{bodian,qishui}`、钉死的 npm 包 `node_modules/{bodian,qishui}-music-api`、本插件 `src/host/providers/sources/{bodian,qishui}` 与 `src/host/**` 的调用点。
>
> 引用约定：文中 `路径:行号` 的**上游**路径以 `A_other/upstream/folia-major-main/` 为根（如 `sources/bodian/main/index.ts:42`）；**插件**路径以仓库根为根（如 `src/host/providers/sources/bodian/index.js:318`）；`node_modules/...` 指安装的包（波点 0.1.2 / 汽水 0.2.2）。每条结论都对应到具体文件与行号，没读过的文件不下结论。
>
> 记录时间：2026-11-28。上游与两个包都是移动靶，升级后先按本文行号复核。

---

## 0. 结论摘要（先看这一段）

1. **两家的协议都不在我们手里**：签名、扫码、分页游标、歌词解码、播放权限、写入所有权校验全在钉死的包里（`bodian-music-api@0.1.2`、`qishui-music-api@0.2.2`），上游模组只是一层薄壳。这次移植的难点是**宿主面**与**会话/设备身份搬家**，不是协议。
2. **体量**：波点上游 = client 10 文件 563 行 TS + main 7 文件 221 行（不含 `.d.cts`）+ locales 4×9 行；我方 = `index.js` 576 + `sessions.js` 64 + `device.js` 42 = 682 行。汽水上游 = client 12 文件 675 行 + main 7 文件 161 行；我方 = `index.js` 501 + `sessions.js` 64 + `device.js` 43 = 608 行。**上游多出来的部分几乎全是「能力族覆盖」和「DTO/失败分类分文件」**，包内协议两边同源同版本。
3. **宿主面比酷狗窄**：波点 main 碰 `api` 的 5 个成员（`media.allow` / `net.request` / `legacy.store` / `seal` / `rpc.handle`），汽水 5 个（`media.allow` / `net.fetch` / `legacy.store` / `seal` / `rpc.handle`）；client 各碰 5 个 `folium` 成员。都不碰 `storage`/`secrets`/`log`/`cache`/`windows`/`diagnostics`/`paths`/`render`。
4. **能力缺口明确**：波点缺 `recommendations@1`（discover 卡 + 私人 FM）、`mutations@1` 的删歌、`library@1.getUserAlbums`、逐字歌词、`getAvailability`、`covers@1` 尺寸规则、歌词搜索别名；汽水缺 `explore@1`、`recommendations@1`（FM 模式 + 场景电台）、账号「最近播放」集合、`check_tracks` 可播性、`previewNotice`、场景封面、歌单移除（包已支持 `playlist_remove_tracks`）。
5. **汽水 ticket guard 续期分处两层**：包内续期只挂在 `login_status`（`node_modules/qishui-music-api/src/auth.cjs:42-72`，由 `:117-120` 的 `status()` 调），账号请求本身**不续期**（`src/client.cjs:81` 直接发一次）。上游模组没有「失败→续期→重放」；它的续期靠 `accountRead.ts:259` 每次读账号时发一次 `login_status` 顺带完成。我方把「失败→续期→重放一次」放在 source 的 `request()`（`src/host/providers/sources/qishui/index.js:186-227`）——这层是我方多出来的（踩坑第 123 条，`A_other/docs/踩坑记录.md:1056-1063`）。
6. **移植基础设施已在仓库（未提交）**：`src/folia-adapters/source-host/**`（9 文件，注释写「四个平台共用一份」）、`scripts/build-folia-source.mjs`（按 `PLATFORMS` 表驱动的通用打包脚本）、`src/folia-build/bodian-host-entry.ts`、`src/host/vendor/bodian-folia/source.bundle.mjs`。**本次实测：波点镜像 24/24 文件 SHA256 与上游相同，bundle 为最新（52443 B），`node test/host/bodian-folia-bundle.test.mjs` 通过（Node v24.22.3）**。缺的是 `bodian-folia` 门面与注册，以及汽水的全部。
7. **换实现会丢登录态，除非迁移**：我方会话在 `sessions.json`（`src/host/providers/login/store.js:36`，明文 0600）+ `bodian-device.json` / `qishui-device.json`；移植源对应 `<mod>-legacy-store.json` + `<mod>-seal.key`（`src/folia-adapters/source-host/stores.ts:21`、`seal.ts:26`）。不写迁移 = 两家都要重新扫码、设备指纹也换。
8. **依赖版本与上游一致**（§5）：上游 `sources/<id>/package.json`、上游根 `package.json`、我方根 `package.json`、安装版本四处相同；`bodian-music-api` 的传递依赖 `qrcode@1.5.4` 与我方根依赖同版本（`package.json:102`）。

---

## 1. 判据与做法

写法对齐 `A_other/docs/酷狗对齐Folia-上游规格.md`（宿主面/能力族/必须适配清单）与 `A_other/docs/酷狗对齐Folia-我方映射.md`（我方门面/路由/DTO），能力声明与 id 归属的规矩取自 `A_other/docs/在线平台对齐清单.md`（§1 id 归属、§2 对齐矩阵、§6 必做清单）。

本次核查的具体动作：

1. 通读上游两个模组的全部文件（波点 24 个、汽水 26 个），逐个记 `api.*` / `folium.*` 的调用行号。
2. 读安装好的两个包的全部 `src/*.cjs`，把「包做了什么 / 宿主做了什么」分开，用于第 4 节的分层对比。
3. 读我方 `sources/{bodian,qishui}/**`、注册点、`omni`、`contract.js` 能力表、`online.js` 调用点、`account-read.js`、`provider-store.js`、客户端入口。
4. 实测：波点镜像 SHA256 对比、`node scripts/build-folia-source.mjs --check`、`node test/host/bodian-folia-bundle.test.mjs`、两份 `node --version`（v24.22.3）。

---

## 2. 波点（`bodian`）

### 2.1 模组结构（文件清单与体量）

| 文件 | 行 | 字节 | 性质 | 移植时要处理什么 |
|---|---|---|---|---|
| `client/index.ts` | 17 | 903 | 纯逻辑 | 无需改（只调 `folium.*`） |
| `client/bodianProvider.ts` | 155 | 8868 | 纯逻辑 | 无需改（10 个能力族的定义） |
| `client/bodianTransport.ts` | 46 | 3142 | 纯逻辑 | 无需改 |
| `client/bodianNormalize.ts` | 97 | 6436 | 纯逻辑 | 无需改 |
| `client/bodianCatalog.ts` | 44 | 2804 | 纯逻辑 | 无需改 |
| `client/bodianLibrary.ts` | 75 | 4593 | 纯逻辑 | 无需改 |
| `client/bodianMutations.ts` | 30 | 1783 | 纯逻辑 | 无需改 |
| `client/bodianLyrics.ts` | 17 | 976 | 纯逻辑 | 无需改 |
| `client/bodianCovers.ts` | 43 | 2624 | 纯逻辑 | 无需改（宿主侧要有消费者，见 2.3） |
| `client/bodianFailure.ts` | 39 | 2954 | 纯逻辑 | 无需改 |
| `main/index.ts` | 54 | 3410 | 只调 `api.*` | 可逐字节；其 `api.*` 语义由适配层实现（见 2.2） |
| `main/bodianApiBridge.cjs` | 31 | 1729 | 纯 Node | 可逐字节 |
| `main/session.cjs` | 90 | 4075 | 纯 Node + safeStorage 形状 | 可逐字节；safeStorage 由 `main/index.ts:22-26` 适配 |
| `main/mediaCors.cjs` | 46 | 2167 | 纯逻辑 | 可逐字节；`test` 由宿主调用 |
| `main/*.d.cts`（3） | 47 | 2104 | 类型 | 可逐字节 |
| `locales/*.json`（4） | 36 | 801 | 文案 | 可逐字节（`name.short`、`login.title`、`login.note`） |
| `mod.json` | 18 | 694 | 清单 | 可逐字节（`requires` 10 族在 `:16`） |
| `package.json` | 8 | 278 | 钉版本 | 可逐字节（`:6` 钉 0.1.2） |
| `README.md` | 23 | 3410 | 文档 | 可逐字节 |

**结论**：24 个文件全部可以逐字节镜像（本次实测 `src/folia-mods/sources/bodian/**` 与上游 24/24 SHA256 相同）。**没有需要改写的模块文件**；必须替换的是它们依赖的宿主面，落点只能是 `src/folia-adapters/`（`AGENTS.md` 的目录规矩）。

### 2.2 宿主面

#### `api.*`（`main/index.ts`，逐个列出）

| 成员 | 调用 | 行号 | 语义/注意 |
|---|---|---|---|
| `media.allow` | `api.media.allow({ followRedirects: true, ttlMs: 2h })` 得到 `issued`，每次签发音频地址 `issued.add(url)` | `:32`、`:49-52` | 桌面版是 Electron 的跨域白名单；插件里是空登记（见 2.6 风险 2） |
| `media.allow` | `api.media.allow({ hosts: ['kuwo.cn','*.kuwo.cn'], test: r => mediaPolicy.allows(r), followRedirects: true, ttlMs: 2h })` | `:35-40` | **需要 `test` 谓词 + `followRedirects` + `ttlMs` 三个字段**，不只是 hosts |
| `net.request` | `const request = api.net.request(options); request.on('response', onResponse)` | `:41-45` | Electron `ClientRequest` 语义：`setHeader` / `end(body)` / `on('response')` / `destroy`；包用它发 **GET 带 JSON 正文**（见 2.6 风险 1） |
| `rpc.handle` | `api.rpc.handle('request', (operation, params) => bridge.request(...))` | `:55-57` | 唯一通道；参数/结果须可 JSON 化 |
| `legacy.store` | `store: api.legacy.store` 交给 bridge | `:47` | 键：`BODIAN_SESSION_V2`、`BODIAN_DEVICE_ID`（`main/session.cjs:5-6`） |
| `seal` | `sealAsSafeStorage(api.seal)`：`available/encryptString/decryptString`，Buffer↔base64 | `:22-26`、`:48` | 桌面版是 `safeStorage`；`session.cjs:15-16` 还会调 `getSelectedStorageBackend?.()` 判 `basic_text` |

#### `folium.*`（`client/index.ts`，逐个列出）

| 成员 | 行号 | 用途 |
|---|---|---|
| `folium.rpc.call` | `:12` | 全部请求交给 main 的 `request` 通道 |
| `folium.sources.error` | `:13` | 造带 `code` 的宿主错误（`bodianTransport.ts:41-43`） |
| `folium.sources.register` | `:15` | 在第一个 `await` 之前注册（`:10-18` 无 await） |
| `folium.i18n.key` | `:16` | 3 个键：`name.short`、`login.title`、`login.note`（`locales/zh-CN.json:1-8`；`bodianProvider.ts:92,130`） |
| `folium.lyrics.isPureMusicText` | `:17` | 纯音乐判定（`bodianProvider.ts:125`、`bodianLyrics.ts:17`） |

#### 运行时依赖

| 包 | 钉在哪 | 版本 | 备注 |
|---|---|---|---|
| `bodian-music-api` | 上游 `sources/bodian/package.json:6`、上游根 `package.json:279`、我方 `package.json:89`、安装版本 | 0.1.2（四处相同） | `engines.node >= 24` |
| `qrcode`（传递） | `node_modules/bodian-music-api/package.json` 的 `dependencies` | 1.5.4 | 我方根 `package.json:102` 也直接钉 1.5.4，无版本冲突 |

包本体是 `main: index.cjs` + `src/*.cjs`（`node_modules/bodian-music-api/package.json` 的 `files`），无需构建产物；宿主按 CommonJS `require`。

### 2.3 能力族（`mod.json` 的 `requires`，逐族）

`sources/bodian/mod.json:16` 声明 10 族，与实现一一对应（`client/bodianProvider.ts:98,107,111,122,129,139,140,141,142,163`）；不实现 `reports@1`、`explore@1`、`raw@1`、`playback.external@1`、`playback.surface@1`。

| 能力族 | 上游实现锚点 | 宿主里需要什么 | 我们界面的入口 | 我方现状（是否声明/实现） |
|---|---|---|---|---|
| `search@1` | `bodianProvider.ts:98-106`（`access:'account'`）；`transport` 把 `limit>100` 夹到 100（`bodianTransport.ts:49-50`） | `rpc` 通道 + `sources.error` | 有：搜索页按 `searchKinds` 出 `song`（`src/client/panel-v3/p3-core.js:120-129`） | 已实现 `search`，声明 `search:true`（`bodian/index.js:149-161`） |
| `songs@1` | `:107-110`（`getSong`、`getAvailability`） | 同上 | 部分：行上只有 VIP 徽章（`bodian/index.js:64`），**没有「下架/受限」状态位** | 只有 `getSong` 等价物（`song_detail`，`index.js:324`）；无 availability |
| `playback.audio@1` | `:111-121`（`preview` 透传） | `rpc`；宿主取流代理 | 有：`/online/stream` + `x-music-preview`（`online.js:826`） | 已实现（`index.js:318-347`），`preview`/`clipStartMs` 都给（`clipStartMs` 路由未消费，见 2.5 第 6 项） |
| `lyrics@1` | `:122-128`（`main` + `wordByWord` + `getSearchAlias`） | `lyrics.isPureMusicText`；歌词记录 | 有：`/online/lyric`（`online.js:1030`）；歌词源表里**波点不在**（`src/host/services/lyrics/lyrics-sources.js:10-12`，与 Folia 同） | 只有 LRC 行级（`index.js:349-357,367-374`），**丢 `wordByWordText`**；无歌词别名（`omni.lyricSearchAlias` 有通道，source 没实现） |
| `auth@1` | `:129-138`（含 `getLoginTtlMs: 5min`） | `rpc`；`sources.error` | 有：设置→在线扫码（`QR_PROVIDERS` 含 `bodian`，`provider-store.js:46`） | 已实现（`index.js:490-572`），但**未声明 `auth:true`** |
| `library@1` | `:140` + `bodianLibrary.ts`（我的歌单/收藏专辑/喜欢 id/喜欢数） | 同上 | 有：歌单页（`p3-core.js:109`）；`getUserAlbums` **无入口**（`contract.js:50` 的 `userAlbums` 没有任何消费者） | 有 `myPlaylists`/`likedIds`（`index.js:376-408,461-480`）；**无 `getUserAlbums`、无 `likedCount`** |
| `catalog@1` | `:139` + `bodianCatalog.ts`（含 `discover-<i>` 虚拟歌单、`source` 默认 4、`canResolveSongCatalogRefs`） | 同上 | 有：歌手页/专辑页/歌单页 | 有 `artistSongs`/`albumSongs`/`artistAlbums`/`playlistSongs(Page)`（`index.js:228-316,410-446`）；**discover 卡没有**（它属于 recommendations） |
| `mutations@1` | `:141` + `bodianMutations.ts`（`canAddToPlaylist` 只认 owned；≤100 首；`trackIds` 逗号拼） | 同上；行上的 `addable` | 有：红心、加入歌单、从歌单移除（`contract.js:114-116`） | 只有 `addToPlaylist`/`setLiked`（`index.js:448-454,482-487`）；**无 `removeFromPlaylist`**，故 `playlistTrackMutations` 不能声明 |
| `recommendations@1` | `:142-162`（`getRecommendedCollections` = discover 卡 + 常规推荐；`getPersonalFm`） | 同上 | 有：`discover` 页签（`p3-core.js:110` 要 `caps.recommendations`）+ 私人 FM 按钮（`p3-pages.js:579-603`）+ 路由（`online.js:1649-1678`） | **完全没有**：不声明、不实现 |
| `covers@1` | `:163` + `bodianCovers.ts`（酷我图床 240/800/≤1200 三档、`identity`/`original`/`requestedSize`） | 宿主的封面代理要问尺寸规则 | 有：`/online/cover`（`online.js:2117-2156`） | 没有尺寸规则：只做允许列表 + Referer + 缓存（`url-safety.js:64-71`、`online.js:2127-2138`） |

> 声明与实现对不上是**现在就能看到的事故源**：`auth` 有实现没声明、`playlistTrackMutations` 有实现（包支持 del）却没路由。对齐清单 §6.3 要求「能力与实现同一次提交」。

### 2.4 我方现状

#### 文件与职责

| 文件 | 职责 | 关键行 |
|---|---|---|
| `src/host/providers/sources/bodian/index.js`（576 行） | 整个 source：DTO、目录、取流、歌词、歌单、写入、登录 | `capabilities` `:149-161`；`toTrack` `:46-128`；`search` `:208-225`；`artistSongs` `:228-248`；`albumSongs` `:250-281`；`artistAlbums` `:283-316`；`getAudioSource` `:318-347`；`getLyrics` `:349-357`；`stream` `:361-363`；`lyric` `:367-374`；`myPlaylists` `:376-408`；`playlistSongs(Page)` `:410-446`；`addToPlaylist` `:448-454`；`liked/likedIds` `:456-480`；`setLiked` `:482-487`；`auth.*` `:516-572` |
| `sessions.js`（64 行） | 同步会话镜像 + 异步写穿 providerStore | `set` `:34-37`、`hydrate` `:45-57`、`whenReady` `:30-32` |
| `device.js`（42 行） | 32 位 hex 设备 id，落 `bodian-device.json` 0600 | `:27-42`、文件 `:28`、权限 `:40` |

#### 门面与路由的调用点

| 处 | 行号 | 说明 |
|---|---|---|
| 注册 | `index.js:133`（根入口） → `src/host/providers/sources/index.js:240-254` | 懒 `require('bodian-music-api')`，缺包就「平台不出现」 |
| **不在** `ONLINE_SPECS` | `sources/index.js:167-196` | 波点/汽水是「自带包的原生源」，不经过 `adapter.js` |
| **不在** 旧门面 | `src/host/providers/index.js:24`（`PROVIDERS` 只有 netease/qq/navidrome） | `resolveLegacyStream` 对它们恒 `null`（`:726-729`） |
| 统一分发 | `src/host/providers/sources/omni.js:19-42` | 能力门 `:31-36`（`allowedBy`） |
| 能力表 | `src/host/services/core/contract.js:25-63`、`97-137`、`145-150` | `METHOD_CAPABILITY` 决定哪个方法被哪个 flag 挡住 |
| 搜索/目录 | `online.js:503,568,580,616` | `/online/search`、`/online/search-collections`、`/online/artist-songs` |
| 取流 | `online.js:635-690`（`omni.stream` `:679`） | 预览标记 `:826`，缓存 `:890` |
| 歌词 | `online.js:1030-1044` | 门面返回的 `lrc/translation/lines/wordLevel/raw` 原样进记录 |
| 登录 | `online.js:395-416`；`bridge.js:74-105` | `session` 整块当凭据（`bridge.js:101-103`） |
| 账号读 | `src/host/services/account-read.js:66-159` | 经 `omni.profile` `:91`、`omni.myPlaylists` `:107-115`、`omni.likedIds` `:117-125` |
| 封面 | `online.js:41-48`（Referer）、`:2117-2156`；`url-safety.js:24-25` | 酷我 CDN 在允许列表 |
| 配置页 | `online.js:2256-2300` | 行来自 `omni.summaries()`；`searchKinds` `:2337` |
| 清空数据 | `src/host/services/media/plugin-data.js:24` | 含 `bodian-device.json` |

#### id 形态与存储兼容点

| 面 | 我方形态 | 证据 |
|---|---|---|
| 歌曲 id | 平台数字 id（`String(id)`） | `bodian/index.js:48,67,77` |
| 播放器/喜欢/歌词键 | `online:bodian:<id>` | `index.js:458`、`:472`；路由歌词键 `online.js:226` 同源 |
| 行侧车 | `providerData: { albumId, artistId, pay, freeSign }`（**不在 DTO 里的取流上下文另存内存** `rowMeta`） | `index.js:78-83`、`:24,60`；重启后回退 `song_detail` `:321-330` |
| 会话 | `sessions.json` 的 `bodian.credentials`（整块包会话） | `login/store.js:36`、`provider-store.js:37,76-78`；写入口 `index.js:62-66` |
| 设备 | `bodian-device.json`（`{deviceId}`，0600） | `device.js:28,40` |
| `providerStore.session('bodian')` | 恒 `{}`（非 DEVICE_PROVIDERS） | `provider-store.js:43,121` |
| 登录态显示名 | `credentials.nickname/avatarUrl` 由 `setLogin(provider, value, user)` 写入 | `provider-store.js:135-152` |

### 2.5 差距与移植步骤（逐条「要做什么」）

1. **镜像**：把 `sources/bodian/**` 24 个文件逐字节放到 `src/folia-mods/sources/bodian/**`。→ **已完成**（本次实测 24/24 SHA256 相同），差 git 提交。
2. **宿主面**：`api.media.allow`（要 `test`/`followRedirects`/`ttlMs`）、`api.net.request`（ClientRequest 语义）、`api.legacy.store`、`api.seal`、`api.rpc.handle`；`folium.rpc.call`/`sources.register`/`sources.error`/`i18n.key`/`lyrics.isPureMusicText`。→ **已完成**，落在 `src/folia-adapters/source-host/**`（`host.ts:50-58` 建 rpc/seal/store/pageStore/net/media/texts；`clientFacade` 在 `:44-47`），波点入口 `src/folia-build/bodian-host-entry.ts:32-51`。
3. **bundle**：`scripts/build-folia-source.mjs` 的 `PLATFORMS.bodian`（`:24-28`，`external: ['bodian-music-api']`）→ 产物 `src/host/vendor/bodian-folia/source.bundle.mjs`。→ **已完成且最新**（`--check` 输出 `OK bodian (52443 bytes)`）。
4. **门面（缺）**：新建 `src/host/providers/sources/bodian-folia/{dispatch,dto,read,library,playback,account}.js`，把 `omni` 的方法名映射到 `definition.capabilities` 的 10 族；写法照 `src/host/providers/sources/kugou-folia/dispatch.js:17-45` 的派工表。**必须做**，否则注册进来的只是一个没人调的定义。
5. **注册与能力表（缺）**：`sources/index.js` 现在用**手写**能力表（`KUGOU_CAPABILITIES:108-135`）+ `ONLINE_SPECS`（`:167-196`）。波点应从 `definition.capabilities` **推导** flags，而不是再手写一张——清单 §6.3「能力与实现同一次提交」，手写表正是上一轮 `auth` 漏声明的原因。**必须做**，落点 `sources/index.js`。
6. **缺口补齐（按必要性排序）**：
   - `recommendations@1`（`getRecommendedCollections` + `getPersonalFm`）：界面入口已经存在（`p3-core.js:110` 的 discover 页签、`p3-pages.js:579-603` 的私人 FM、路由 `online.js:1649-1678`），**只要实现 + 声明就能出**。discover 卡的读取链路在 `bodianCatalog.ts:19-27`（`discoverIndex` → `ai_playlist_detail`），不需要新界面。
   - `removeFromPlaylist`（包 `playlist_tracks_del`，`node_modules/bodian-music-api/src/api.cjs:16`）：路由已有（`online.js:2023`），能力 flag 是 `playlistTrackMutations`（`contract.js:116`）。
   - 逐字歌词：包已解出 `wordByWordText`（`src/lyrics.cjs:17-22`），`bodianLyrics.ts:14-18` 只是把它当第二条轨交出去；我方 DTO 要带 `lines[].words` + `raw.formatHint='awlrc'`，**旧歌词记录形状要兼容**（`online.js:1034-1043` 写记录）。
   - `getAvailability`：要先在 DTO 上留状态位（现在 `shape` 没有），并且路由/客户端要有消费点，否则实现了也看不到。
   - `covers@1`：`/online/cover` 现在不按平台改尺寸（`online.js:2117-2156`），要加一处「按 source 问尺寸」的钩子；不做也能播，只是封面分辨率不受控。
   - 歌词搜索别名：`omni.lyricSearchAlias`（`omni.js:192-200`）已有通道，source 补一个 `lyricSearchAlias(id)` 即可用 `originalName`（`bodianNormalize.ts:58-66`）。
7. **会话/设备迁移（决策项）**：迁移 = 把 `sessions.json` 的 `bodian.credentials` 解密后转存成移植源的 `<mod>-legacy-store.json`（键 `BODIAN_SESSION_V2`），并把 `bodian-device.json` 的 `deviceId` 写进 `BODIAN_DEVICE_ID`；不迁移 = 明确要求重扫，并在 CHANGELOG 写清。**必须在动手前定，改完再说就晚了。**
8. **测试**：把 `test/host/bodian.test.mjs` 的断言面（`:38` DTO、`:73` 目录、`:168` 喜欢 id、`:313-316` 错误码）改成「映射层契约」测试；bundle 测试已有（`test/host/bodian-folia-bundle.test.mjs`）。再补一条 **GET 带正文** 的用例（见 2.6 风险 1）。
9. **文档**：按酷狗那两份的体例补 `A_other/docs/波点对齐Folia-上游规格.md` 与 `-我方映射.md`，并把 `在线平台对齐清单.md:22-34` 的「波点/汽水」列从「adapter 内」改成实际状态。

### 2.6 风险

1. **GET 带 JSON 正文会从「有 Content-Length」变成 chunked（新引入、已可定位）**。包在 `requestFactory` 存在时**不设** `Content-Length`（`node_modules/bodian-music-api/src/http.cjs:86-89`，注释写明「Chromium 自己算」）；而 `src/folia-adapters/source-host/net.ts:32-40` 的 `request()` 只把 `url/method/headers` 交给 `http.request`，不碰 body —— body 由包的 `request.end()` 送出，Node 只能按 chunked 发。Electron 的 `net` 会算长度，我们这一层不会。现有 `test/host/bodian-folia-bundle.test.mjs:36-59` 用**本地 Node http 服务**验证，Node 服务接受 chunked，**挡不住这条**。落点：`net.ts` 的 `request()` 需要包一层，在 `end(chunk)` 前补 `Content-Length`；否则就要实测 `bd-api.kuwo.cn` 是否接受 chunked 的 GET 正文。
2. **`media.allow` 在插件里是空登记**（`media.ts:33-37`），波点 `main/index.ts:32` 拿到的 `issued.add` 与 `mediaPolicy.register`（`:49-52`）都不会真的放行任何东西。插件所有播放都走 Host 代理（`online.js:635-690`），所以**不影响播放**；但这条差异必须写进映射文档，否则以后接浏览器直连会漏。
3. **加密语义变了**：Electron `safeStorage` → `source-host/seal.ts` 的 AES-256-GCM + 数据目录密钥。上游把 Linux `basic_text` 当「加密不可用」（`session.cjs:15-16`），我们**永远可用**，于是会话会真的落盘成密文文件。安全口径需要在文档里说明。
4. **设备指纹换位置**：`BODIAN_DEVICE_ID`（上游 `session.cjs:6`）↔ `bodian-device.json`。设备 id 参与每个签名请求（`http.cjs:33` 的 `devid/qimei36`），换实现不迁移可能被平台当新设备。
5. **地区限制（`code 407`）**：包把它翻成 `region-restricted`（`http.cjs:112-116`），上游在 `bodianFailure.ts:41` 用「平台原话」提示；我方只有 `MusicError` 的 message，需要映射表才不丢这句。
6. **依赖可用性**：两个包都声明 `engines.node >= 24`；本机 DSH 运行时实测 **v24.22.3**，满足。但插件自身 `package.json` **没有** `engines`，装到更低 Node 的环境里会在 `AbortSignal.timeout`/`crypto.randomUUID` 之类位置才炸。
7. **真实文件布局**：bundle 里 `bodian-music-api` 是 external（`build-folia-source.mjs:27`），必须能从安装目录 `require` 到；npm 打包只带 `src/host/**`（`package.json:52-70`），依赖靠安装时装，**不是**打进 bundle。装包漏依赖时表现为「平台不出现」，不是报错。
8. **界面缺入口导致不能声明**：`covers@1` 的四个成员（`bodianCovers.ts:31-49`）我们宿主没有消费者；`songs@1.getAvailability` 没有 DTO 位；`library@1.getUserAlbums` 没有页面。这三项**即使实现也看不到**，先别声明。

### 2.7 工作量（相对「酷狗那次」，分项）

| 项 | 相对倍数 | 依据 |
|---|---|---|
| 镜像 | **0.24×** | 酷狗镜像 228,487 B（19+9 文件，`kugouProvider.ts` 单文件 ~114 KB）；波点 53,751 B / 24 文件 |
| 宿主面 | **已完成**（≈0.05× 新增） | `source-host` 20,563 B 是四平台共用的一次性投入；波点只需 `net.request`，已在 `net.ts:32` |
| 门面/映射 | **0.25×** | 酷狗门面 64,005 B / 9 文件 / 40+ 方法（三套 id 空间、云盘、排行、日推）；波点 10 族 ~30 方法、无 id 空间歧义 |
| 缺口补齐 | **0.15×** | recommendations + 删歌 + 逐字歌词 + 别名（界面入口都已有） |
| 测试/文档 | **0.10×** | 复用 bundle 测试 + 现有 `bodian.test.mjs` 断言面 |
| **合计** | **≈0.55×** | 其中镜像与宿主面已完成，**剩余 ≈0.35×** |

---

## 3. 汽水（`qishui`）

### 3.1 模组结构（文件清单与体量）

| 文件 | 行 | 字节 | 性质 | 移植时要处理什么 |
|---|---|---|---|---|
| `client/index.ts` | 17 | 922 | 纯逻辑 | 无需改 |
| `client/qishuiProvider.ts` | 106 | 7158 | 纯逻辑 | 无需改（10 族） |
| `client/qishuiTransport.ts` | 102 | 7046 | 纯逻辑 | 无需改；`:102-117` 用 `fetch` 读场景图标，移植后在 Host 的 Node 里也能跑 |
| `client/qishuiNormalize.ts` | 60 | 4086 | 纯逻辑 | 无需改 |
| `client/qishuiCatalog.ts` | 64 | 4188 | 纯逻辑 | 无需改（「最近播放」卡在 `:10,18-28,46-56`） |
| `client/qishuiPlayback.ts` | 72 | 3860 | 纯逻辑 | 无需改 |
| `client/qishuiLyrics.ts` | 22 | 1470 | 纯逻辑 | 无需改 |
| `client/qishuiMutations.ts` | 26 | 1664 | 纯逻辑 | 无需改（增删都在 `:19-29`） |
| `client/qishuiExplore.ts` | 59 | 3269 | 纯逻辑 | 无需改；依赖 kit 的 `createHandedOut/cursorWords/stampCursor`（kit 已镜像） |
| `client/qishuiRecommendations.ts` | 66 | 3998 | 纯逻辑 | 无需改；依赖 kit 的 `personalFmModes`（`src/folia-mods/packages/folium-source-kit/src/index.ts:8`） |
| `client/qishuiSceneCover.ts` | 47 | 2913 | 纯逻辑 | 无需改（拼 SVG data URL） |
| `client/qishuiFailure.ts` | 34 | 2551 | 纯逻辑 | 无需改 |
| `main/index.ts` | 55 | 3779 | 只调 `api.*` | 可逐字节；宿主面语义见 3.2 |
| `main/qishuiApiBridge.cjs` | 29 | 1845 | 纯 Node | 可逐字节（`withoutCookies` 在 `:8`） |
| `main/session.cjs` | 53 | 2759 | 纯 Node + safeStorage 形状 | 可逐字节 |
| `main/mediaCors.cjs` | 24 | 1487 | 纯逻辑 | 可逐字节 |
| `main/*.d.cts`（3） | 50 | 2474 | 类型 | 可逐字节 |
| `locales/*.json`（4） | 84 | 2447 | 文案 | 可逐字节（`name.short/name.lyrics/login/recentPlayed/recommended/previewNotice/fm.mode.*`） |
| `mod.json` | 34 | 845 | 清单 | 可逐字节（`requires` 10 族 `:20-31`，**没有 covers**） |
| `package.json` | 8 | 295 | 钉版本 | 可逐字节（`:6` 钉 0.2.2） |
| `README.md` | 45 | 9819 | 文档 | 可逐字节（能力与限制的权威说明） |

**结论**：26 个文件全部可逐字节镜像；没有需要改写的模块文件。必须替换的宿主面同波点，只差一处：**汽水用 `api.net.fetch`，波点用 `api.net.request`**（`qishui/main/index.ts:51` vs `bodian/main/index.ts:42`）。

### 3.2 宿主面

#### `api.*`（`main/index.ts`）

| 成员 | 调用 | 行号 | 语义/注意 |
|---|---|---|---|
| `media.allow` | 已签发音频地址（`followRedirects`、`ttlMs=2h`）→ `issued.add`，但**只加 https 的**（`isHttps` `:25-27`） | `:40`、`:52-56` | 与波点同样的空登记问题（3.6 风险 2） |
| `media.allow` | `hosts: IMAGE_HOSTS`（`byteimg.com/douyinpic.com/douyinstatic.com/pstatp.com` 各带 `*.` 变体，`:22`）+ `test: r => mediaPolicy.allows(r)` | `:42-47` | 需要 `test` 谓词 |
| `net.fetch` | `fetch: (url, options) => api.net.fetch(url, options)` | `:51` | 桥自己给每个请求加 `credentials: 'omit'`（`qishuiApiBridge.cjs:8`） |
| `legacy.store` | `store: api.legacy.store` | `:49` | 键 `QISHUI_SESSION_V1`、`QISHUI_DEVICE_ID`（`main/session.cjs:5-6`） |
| `seal` | `sealAsSafeStorage(api.seal)` | `:30-34`、`:50` | 同波点 |
| `rpc.handle` | `api.rpc.handle('request', ...)` | `:58-60` | 唯一通道 |

#### `folium.*`（`client/index.ts`）

| 成员 | 行号 | 用途 |
|---|---|---|
| `folium.rpc.call` | `:12` | 全部请求 |
| `folium.sources.error` | `:13` | `qishuiError`（`qishuiTransport.ts:60-62`） |
| `folium.sources.register` | `:15` | 第一个 `await` 之前（`:10-18` 无 await） |
| `folium.i18n.key` | `:16` | `name.short`（`:36`）、`login.*`（`:85`）、`previewNotice`（`:64`、`locales/zh-CN.json:12`） |
| `folium.i18n.text` | `:17` | `name.lyrics`（`:67`）、`recentPlayed`（`qishuiCatalog.ts:19`）、`recommended`（`:106`）、`fm.mode.*`（`qishuiRecommendations.ts:36`） |

#### 运行时依赖

| 包 | 钉在哪 | 版本 | 备注 |
|---|---|---|---|
| `qishui-music-api` | 上游 `sources/qishui/package.json:6`、上游根 `package.json:289`、我方 `package.json:101`、安装版本 | 0.2.2（四处相同） | `engines.node >= 24`；**无传递运行时依赖**（只有 devDependencies） |

### 3.3 能力族（`mod.json:20-31` 的 10 族）

| 能力族 | 上游实现锚点 | 宿主里需要什么 | 我们界面的入口 | 我方现状 |
|---|---|---|---|---|
| `search@1` | `qishuiProvider.ts:42-61`（`searchSongs` `:44-48`、`searchPlaylists` `:51-61`） | `rpc` + `sources.error` | 有：搜索页（`p3-core.js:120-129`，`searchKinds` 含 playlist） | 都已实现（`qishui/index.js:280-308`），声明 `search:true, searchPlaylists:true`（`:247-262`） |
| `songs@1` | `:63` + `qishuiPlayback.ts:51-68`（`getSong`、`getAvailability`、`getPageUrl`） | 同上 | 有：行点播；**可播性没有状态位** | 只有 `toTrack` 与 `VIP` 徽章（`index.js:94`）；无 `getSong`、无 availability、无 `getPageUrl` |
| `playback.audio@1` | `:64` + `qishuiPlayback.ts:74-78`（`audioQualityLevels:['standard']`、`previewNotice`） | `rpc`；`x-music-preview` | 有：`/online/stream` `online.js:826` | `stream` 写死 `quality:'standard'`（`index.js:331-341`），**`previewNotice` 没有**（试听提示文案不会出） |
| `lyrics@1` | `:65-71`（KRC 双轨、翻译轨、`songIdOf`、`crossSource`） | `rpc`；歌词记录 | 有：`/online/lyric`；**汽水在歌词源表里**（`lyrics-sources.js:36`），所以「别的歌也拿它的歌词」要靠 `crossSource` | KRC 解析写在 `index.js:343-365`（自带 `parseKrc`/`toLrc`）；**无 `crossSource`、无 `songIdOf`**，所以自动选歌词时不会把汽水当候选 |
| `auth@1` | `:72-103`（`describeLoginFailure`、`getLoginDiagnostics`、`signInRanOut`、`getLoginStatus`、`checkLogin` 的 transient、TTL 300000） | `rpc`；登录窗 | 有：设置→在线扫码（`QR_PROVIDERS` `provider-store.js:46`） | 有登录/轮询/登出（`index.js:446-493`），已声明 `auth:true`（`:251`）；**无失败分类、无诊断、无 transient**（`loginStatus` 失败只回 `case` `:475-479`） |
| `library@1` | `:105` + `qishuiCatalog.ts:45-66`（第一行「最近播放」卡、`getLikedSongIds`） | 同上 | 有：歌单页（`p3-core.js:109`）。**「最近播放」卡的点击不需要新界面**：卡 id `recent-played` 由 `getPlaylistTracks` 自己认（`qishuiCatalog.ts:23-28`） | `myPlaylists` 直接列 `/me/playlist/` 的 rows（`index.js:367-371`）；**无最近播放卡**（包支持 `recent_played`，`api.cjs:13`） |
| `catalog@1` | `:104` + `qishuiCatalog.ts:22-44`（歌单详情/曲目/歌手/歌手曲目；**没有专辑**） | 同上 | 有：歌单页/歌手页；专辑入口按能力不出 | 有 `artistSongs`/`artistAlbums`（`index.js:310-329`，返回 `albums: []` 是对的）；有 `playlistSongs(Page)` |
| `explore@1` | `:106` + `qishuiExplore.ts`（`stream` 一栏、`refreshReadsAnew`、一次最多 10 批、去重、`handedOut`） | kit + 宿主探索页 | **无入口**：`contract.js:55` 声明了 `explore`，但全仓没有任何消费者（客户端/路由都没有 `/online/explore`） | 无 |
| `recommendations@1` | `:107` + `qishuiRecommendations.ts`（`personalFmModes:true`、场景目录、`getPersonalFm` 的 SCENE_RCMD/FAMILIAR/EXPLORE 三路、`dislikeSong`、场景卡片） | 同上 | 有：discover 页签（`p3-core.js:110`）+ 私人 FM（`p3-pages.js:579-603`）。**FM 模式选择器没有入口**（`contract.js:56` 的 `personalFmModes` 无消费者） | 无任何实现（不声明） |
| `mutations@1` | `:108` + `qishuiMutations.ts`（`canAddToPlaylist`/`canEditPlaylistTracks`、红心、增删都要 owned） | 同上；行上的 `addable` | 有：红心、加入歌单、从歌单移除（`contract.js:114-116`） | 有 `setLiked`/`addToPlaylist`（`index.js:424-432`）；**无 `removeFromPlaylist`**（包 `playlist_remove_tracks` 已支持，`api.cjs:13`）；`myPlaylists` 行没有 `isOwned`（所以我们不给 `addable`，清单 §5 已记这条） |

### 3.4 我方现状

#### 文件与职责

| 文件 | 职责 | 关键行 |
|---|---|---|
| `src/host/providers/sources/qishui/index.js`（501 行） | 整个 source + 续期层 | `ERROR_CODE` `:20-27`；`renewAccount` `:186-194`；`request`（含续期重放）`:196-227`；`capabilities` `:247-262`；`search/searchPage/searchPlaylists` `:276-308`；`artistSongs/artistAlbums` `:310-329`；`stream` `:331-341`；`lyric` `:343-365`；`myPlaylists` `:367-371`；`playlistSongs(Page)` `:373-411`；`liked/likedIds/setLiked` `:413-427`；`addToPlaylist` `:429-432`；`profile` `:434-444`；`loginStart/loginStatus/cancelLogin/logout` `:446-493`；`forgetTokens` `:495-497` |
| `sessions.js`（64 行） | 同步镜像 + 写穿；`set` 同时把 `user` 交给 `setLogin` 的 profile | `set` `:36-41`（`store.save('qishui', {session: next}, user)`） |
| `device.js`（43 行） | 设备 id 用**包自己的**校验/生成 | `:29-42`（`sdk.isQishuiDeviceId` `:35`、`sdk.createQishuiDeviceId` `:39`） |

#### 门面与路由的调用点

与波点同一张表（omni/contract/online.js/account-read）；差异只有：注册点在 `index.js:134`（根）与 `sources/index.js:278-292`；能力表 `qishui/index.js:247-262`；`qualityLevels: ['standard']`（`:269`）；`profile()` **只读本地会话**（`:434-444`），不打网络。

#### id 形态与存储兼容点

| 面 | 我方形态 | 证据 |
|---|---|---|
| 歌曲 id | 平台数字 id（1–30 位，`^\d+$`） | `index.js:78`；包侧同一规则 `catalog.cjs:15` |
| 键 | `online:qishui:<id>` | `index.js:415`、`:421` |
| 歌单 id | `base_info.id`（数字串） | `index.js:112` |
| 会话 | `sessions.json` 的 `qishui.credentials.session` | `index.js:69-73`、`sessions.js:36-41`；`hydrate` 兼容 `credentials.session ?? credentials`（`:52`） |
| 设备 | `qishui-device.json`（19 位数字，包校验） | `device.js:31,35,39` |
| 登录态显示名 | `setLogin(provider, creds, user)` 写 `nickname/avatarUrl` | `provider-store.js:135-152` |

### 3.5 差距与移植步骤

1. **镜像**：26 个文件逐字节放到 `src/folia-mods/sources/qishui/**`（**未开工**）。
2. **宿主面**：与波点同一套（`source-host`），只把 `api.net.request` 换成 `api.net.fetch`（两者都已在 `net.ts:26-40`）。**无需新增宿主面**。
3. **bundle 与入口（缺）**：`src/folia-build/qishui-host-entry.ts`（照 `bodian-host-entry.ts:32-51`）+ `scripts/build-folia-source.mjs` 的 `PLATFORMS.qishui`（`external: ['qishui-music-api']`）。注意汽水 client 要 `@folia/folium-source-kit`（`qishuiExplore.ts:2`、`qishuiRecommendations.ts:2`），kit 已被 `build-folia-source.mjs:31-39` 别名到 `src/folia-mods/packages/folium-source-kit/src/index.ts`。
4. **门面（缺）**：`src/host/providers/sources/qishui-folia/**`，10 族 → omni 方法；同样照 `kugou-folia/dispatch.js:17-45`。
5. **注册与能力表（缺）**：`sources/index.js` 加 `qishui` 的 spec + `registerQishuiSource` 改走 bundle；能力表由 `definition.capabilities` 推导。
6. **缺口补齐（按必要性排序）**：
   - `recommendations@1`：界面已就位（discover 页签 + 私人 FM），实现即出；**私人 FM 的模式选择器没有入口**（`personalFmModes` 无消费者），要么补 UI，要么先不声明这一位。
   - `removeFromPlaylist`：包已支持（`api.cjs:13` → `library.cjs:142-148`），路由已有（`online.js:2023`），缺 source 方法与 `playlistTrackMutations` 声明；同时要按 `qishuiMutations.ts:10` 的规则（`type==='playlist' && isOwned && !isLiked`）把 owned 标记补出来——现在 `myPlaylists` 的行**没有 `isOwned`**（`index.js:367-371` + `toCollection` `:109-124`），这也是清单 §5 记的那条。
   - 「最近播放」集合：实现后自动出现在歌单页（卡 id `recent-played` 自解释），**不需要新界面**。
   - `check_tracks` 可播性 + `previewNotice`：要 DTO 状态位与客户端提示位；`clipStartMs`（包 `playback.cjs:58-61`）现在被路由丢掉（`online.js` 只读 `stream.preview`），要接进歌词时钟。
   - 场景封面（`qishuiSceneCover.ts`）：会把图标从 `douyinpic.com` 拉成 data URL（`qishuiTransport.ts:104`）；我们的封面允许列表**没有** `douyinstatic.com`/`pstatp.com`（`url-safety.js:26-30`），要评估是否补。
   - `explore@1`：**先别做**——界面没有探索页（`contract.js:55` 只有枚举，全仓无消费者），做了也声明不了。
7. **会话/设备迁移（决策项，与波点同）**：`QISHUI_SESSION_V1`（含 `guardKey/guardCert/guardTsSign/accessCode/expiresAt`，`main/session.cjs:27-28`）要转存；`QISHUI_DEVICE_ID` 要转到 `qishui-device.json` 或反向。**不迁移 = 重新扫码**；ticket guard 的 `expiresAt` 也要跟着搬，否则第一次账号读就会走一遍续期（能自愈，但要允许它发生）。
8. **测试**：现有 `test/host/qishui.test.mjs`（`:32` DTO、`:181` 喜欢 id、`:228-239` 注册）改成映射层契约测试；bundle 测试照 `test/host/bodian-folia-bundle.test.mjs` 写一份（断言 10 族、`host.rpc.names()`、`api.net.fetch`）。**续期序列**（踩坑第 123 条的断言，`qishui.test.mjs` 现有部分）必须跟着搬到新门面，否则这层最容易被搬丢。
9. **文档**：同上，补波点/汽水两份规格与映射，并更新清单 §2 与 §5。

### 3.6 风险

1. **续期层会搬丢（最高风险）**：现在的续期写在 `qishui/index.js:196-227`，是**我方独有**的一层。改用移植源后，请求走 `folium.rpc.call` → main 的 `request` → 包，**上游 main 入口没有这一层**（`qishuiApiBridge.cjs:14-27` 只做白名单 + 异常包装）。移植时必须把「失败→续期→重放一次」放到映射层的 transport（或 main 侧包一层），否则退回到「票据过期就报错」——这正是踩坑第 123 条的现象。**必改项。**
2. **`media.allow` 空登记**同波点（`media.ts:33-37`）；汽水还额外依赖 `isHttps` 过滤（`main/index.ts:25-27`），这条逻辑在镜像文件里、不经宿主，所以行为不变。
3. **`credentials: 'omit'` 在 Node 里没有意义**：上游桥加它是为了不带 Electron defaultSession 的 cookie（`qishuiApiBridge.cjs:5-8`）；`source-host/net.ts:26-31` 的 `fetch` 直接透传，`fetchImpl` 是 Node 的 undici，本来就没有 cookie jar。**行为等价**，但别以为这行在保护什么。
4. **`qishuiCredentialExpiry` 的 6 小时是兜底不是契约**：`protocol.cjs:108-113` 在平台没给 `expires_time` 时按 6 小时算。上游文档写「约 6 小时过期」（清单 §5），实测过期了 204 小时仍能续上（踩坑第 123 条），说明**过期不等于失效**，续期路径仍然有效。断言里别把 6 小时写死成「必须重扫」。
5. **设备 id 形态由包定义**（19 位数字，`protocol.cjs:5-6`）：我方 `device.js:35,39` 已经是调包校验，移植后必须继续用 `QISHUI_DEVICE_ID` 的值，不然每次请求的 `device_id/did/iid/vehicle_id` 全变（`protocol.cjs:30-40`）。
6. **搜索是「官方大分页 + 固定批」**：包内 `search()` 用 `search_id/from_search_id` 游标推进（`catalog.cjs:16-37`），`hasMore/nextOffset` 由它算；我方的 `searchPage` 是页码制（`index.js:280-293`），移植后页码→offset 的换算要照契约走，别在门面里再算一遍。
7. **无专辑是设计不是缺口**：`README.md:15`、`library.cjs:4-6` 都写明车机协议没有专辑；`artistAlbums` 现在返回 `albums: []`（`index.js:326-329`）是对的，别为了「对齐」硬造。
8. **歌单游标是有状态的**：包用 5 分钟、32 个歌单上限的「按行数记住 cursor」表（`catalog.cjs:86-107`），账号切换即清空。Host 侧并发分页会互相踩，移植源内部已串行（`:40-83`），门面不要并发调同一个歌单的下一页。

### 3.7 工作量（相对「酷狗那次」，分项）

| 项 | 相对倍数 | 依据 |
|---|---|---|
| 镜像 | **0.30×** | 汽水上游 68,875 B / 26 文件 vs 酷狗 228,487 B / 28 文件 |
| 宿主面 | **≈0.02×** | `source-host` 已覆盖 `net.fetch`/`seal`/`store`/`rpc`/`media`/`texts`；汽水无新成员 |
| 门面/映射 | **0.25×** | 10 族 ~28 方法；状态量比波点大（探索去重、FM 场景目录、歌单游标），但都在镜像文件里 |
| 缺口补齐 | **0.30×** | 私 FM 模式选择器要新 UI；可播性/试听提示要新位；owned 标记要补；探索页**不做** |
| 测试/文档 | **0.15×** | 续期序列断言必须搬（易漏）、bundle 测试、两份文档 |
| **合计** | **≈0.75×** | 全部是新增工作；若「只搬协议、不补能力」≈0.55× |

---

## 4. 分层对比：谁的逻辑更多、多在哪

| 层 | 波点（我方） | 波点（Folia） | 汽水（我方） | 汽水（Folia） |
|---|---|---|---|---|
| 协议（签名/请求/分页/解码/权限/写入校验） | **包**（`http.cjs:22-119`、`catalog.cjs:12-34`、`playback.cjs:20-52`） | 同一个包 | **包**（`protocol.cjs`、`catalog.cjs:16-83`、`playback.cjs:7-63`） | 同一个包 |
| 会话/加密/设备 | `sessions.js` + `device.js` + `providerStore`（明文 0600） | `main/session.cjs` + `api.seal` + `api.legacy.store` | `sessions.js` + `device.js`（包管设备 id） | `main/session.cjs` + `api.seal` + `api.legacy.store` |
| 宿主面（跨域/网络分域） | 无（Host 全代理） | `main/mediaCors.cjs` + `api.media.allow` | 无（Host 全代理） | `main/mediaCors.cjs` + `api.media.allow` |
| DTO 归一化 | `index.js` 内联（`toTrack` `:46-128`） | `client/bodianNormalize.ts` 独立 97 行 | `index.js` 内联（`toTrack` `:74-106`、`toCollection` `:109-124`） | `client/qishuiNormalize.ts` 60 行 |
| 能力族编排 | `omni` 方法名 + `buildCapabilities` | `FoliumSourceDef.capabilities`（10 族各一组成员） | 同 | 同 |
| 失败分类 | `MusicError` 的 `code` + 中文一句话 | `describeFailure` + `bodianFailure.ts` 43 行（区分 local-service / entitlement / preview / httpStatus / code / region） | `ERROR_CODE` 映射 + 一句「登录已过期」 | `describeFailure` + `qishuiFailure.ts` 34 行（多了 `no-audio`、`signedOut`、upstreamCode） |
| 续期 | 无（包内 `login_status` 本地返回，`auth.cjs:77-87`） | 无 | **我方 `request()` 失败续期 + 重放一次**（`index.js:196-227`） | 无失败重放；续期只在 `login_status`（包 `auth.cjs:42-72`），触发点 `accountRead.ts:259` |

**结论**：包内协议两边**完全相同**；上游在「能力族 + 归一化 + 失败分类」上比我们多（波点多约 35%，汽水多约 45%）；我们在「汽水续期重放」上比上游多一层（约 30 行）。所谓「我方把上游包嵌进 source 适配层」= 把上游模组的 client 侧（DTO/编排）和 main 侧（会话/跨域）**都挤进了同一个 `index.js`**，代价是缺能力和失败分类，收益是少一层进程边界。

---

## 5. 依赖版本核对

| 包 | 上游 `sources/<id>/package.json` | 上游根 `package.json` | 我方根 `package.json` | 安装版本 | 传递依赖 | engines |
|---|---|---|---|---|---|---|
| `bodian-music-api` | `0.1.2`（`sources/bodian/package.json:6`） | `0.1.2`（`:279`） | `0.1.2`（`:89`） | `0.1.2`（`node_modules/bodian-music-api/package.json`） | `qrcode@1.5.4`（我方根也钉 1.5.4，`:102`） | `>=24` |
| `qishui-music-api` | `0.2.2`（`sources/qishui/package.json:6`） | `0.2.2`（`:289`） | `0.2.2`（`:101`） | `0.2.2` | 无运行时依赖 | `>=24` |

**一致**：四处版本完全相同，不需要改任何一处。两个包都是 `main: index.cjs` + `src/*.cjs`，无构建产物、无 install 脚本；都要求 Node ≥ 24，本机 DSH 运行时实测 v24.22.3。

---

## 6. 工作量估计（以「酷狗那次」为基准）

| 口径 | 波点 | 汽水 | 合计 |
|---|---|---|---|
| **只搬协议**（镜像 + 宿主面 + 门面 + 注册 + 最小测试） | ≈0.35× | ≈0.55× | **≈0.90×** |
| **补齐能力**（再加上文 2.5/3.5 的缺口） | ≈0.55× | ≈0.75× | **≈1.30×** |
| 其中已经完成（未提交） | 镜像 + 宿主面 + bundle + bundle 测试 | 无 | — |
| **剩余工作量** | ≈0.35× | ≈0.75× | **≈1.05×** |

估算依据是字节量与文件数（第 2.7/3.7 的分项），不是感觉：酷狗那次 = 228,487 B 镜像 + 20,563 B 宿主面 + 64,005 B 门面 + 5 个专用测试 + 2 份文档。

---

## 7. 本次没能证实的事（别当成结论用）

1. **「GET 带 JSON 正文 + chunked」真实平台是否接受**：只能证明现在这条链路会变成 chunked（见 2.6 风险 1），没有对 `bd-api.kuwo.cn` 实测。→ 需要一次真实账号的取流验证。
2. **设备 id 换位置后平台是否视为新设备**：波点/汽水的设备 id 参与签名头，但「换 id 会不会掉登录」没实测（包内没有绑定校验的代码，平台侧不可见）。
3. **上游宿主是否会在票据过期前主动续期**：只能证明 `accountRead.ts:259` 会调 `getLoginStatus`（对汽水就是 `login_status` → 包内续期）；Folia 的 `useAccountReads.ts:44` 只在 `'start'` 时读一次，后续触发条件在渲染层的 store 里，本次没有逐行读完。
4. **汽水 FM 模式选择器在 DSH 界面上的落点**：`personalFmModes`（`contract.js:56`）没有消费者，但「补在哪一页」是产品决定，本文只给事实。
5. **Docker / 非桌面环境的差异**：上游 README 明确「网页版没有波点，Docker 里也没有」（`sources/bodian/README.md:7`、`sources/qishui/README.md:7-8`）；本插件只有一种 Host 形态，这条不影响移植，但没有实测。

---

