# 登录系统与在线平台支持对齐 Folia（草案）

> 状态：调研完成，**未改动任何代码**。范围确认后再拆执行计划并开工。
>
> 对照：`A_other/upstream/folia-major-main`（本地检出）。
> 我方：`dsh-music-panel` 0.36.0，`refactor/structure` 分支。
>
> 本文只谈登录、账户、在线平台接入；音频引擎已经单独对齐，不在本文范围。

## 1. 结论

Folia 的“登录”不是一个扫码弹窗，而是一套与平台无关的账户子系统：

- 每个平台声明自己的 `auth` 适配器，共用层只认契约，不认平台名。
- 登录会话有代次、有效期、取消、瞬时失败重试、扫码后超时、失败自检和诊断。
- 登录成功不等于“弹个 toast”：还要读账号、读歌单、读红心，写入账户快照，界面先显示快照再后台刷新。
- 登录窗口是一个完整的平台/账户界面：平台列、账号面板、登录方式选择、二维码/浏览器/表单、失败原因与操作、配置清单。

我方已有正确的骨架（source registry、omni、login store、login state machine），但目前只完成了“能扫码登录”这一层：

- `accountSessionOf` 里 `methods / inBrowser / localService / selfCheck / checksAfterLogin / texts` 全是占位值。
- 没有 `getLoginStatus`、`logout`、`cancelLogin`、`getLoginTtlMs`、`describeLoginFailure`、诊断、自检。
- 没有账户快照；`/online/providers` 每次靠 5 分钟缓存现场问 profile / VIP。
- 登录窗口只有固定 QR 卡片，QQ 的微信登录方式不可选，失败只显示一行原始错误。
- 平台名仍散落在路由、UI、provider store 里；新增平台仍要改多处。
- 还存在几个“看起来支持、实际不工作/不持久化”的半成品：Bodian、酷狗概念版的写入能力。

所以对齐应分三层，而不是直接抄 9 个平台：

1. **登录内核**：契约、会话生命周期、失败分类、取消/超时/自检。
2. **账户模型与登录界面**：快照、状态、活动平台、完整登录窗口。
3. **平台支持**：先修 Bodian，再按可移植性加汽水/飞牛；Spotify / YouTube Music / Apple Music 不 1:1 搬。

## 2. Folia 的做法（事实）

### 2.1 分层

```text
UI / hooks / stores
  -> omni.ts                       唯一公开入口
       -> providerRegistry.ts      注册、查找、按歌曲 sourceRef 选平台
            -> <id>/<id>Provider.ts
                 -> <id>/<id>Transport.ts（请求/IPC 边界）
       -> account/                  读账号、红心对账
       -> login/                    失败分类、请求时限
       -> providerAccountCache.ts   账户快照
  -> src/types/onlineMusic.ts      共享契约
```

只有 provider / transport 直接接触平台接口；UI、hook、store 不直接 import provider。平台按目录聚合，目录名就是 registry 的 id。

### 2.2 登录契约

`src/types/onlineMusic.ts:730-808` 的 `OnlineAuthProvider` 是可选能力集合，平台实现自己有的方法：

| 能力 | 作用 |
| --- | --- |
| `getLoginStatus()` | 问平台“现在谁登录着”，返回 `ProviderUser \| null` |
| `logout()` / `signInRanOut()` | 退出；平台说没人/拒绝时清掉本页保存的登录 |
| `showsKeptAccountAtStart` / `oldKeptAccount` | 启动时先显示已保存账号；旧版本缓存迁移 |
| `getLoginTexts()` | 平台自己的标题、说明、失败补充文案 |
| `localService` | 本地后端状态与重启 |
| `getLoginMethods()` / `resolveLoginMethods()` | QQ 的 QQ/微信等多方式 |
| `startLogin(methodId)` / `createQr(key)` / `openLoginPage(key)` | 取 key、生成二维码、或打开浏览器 |
| `checkLogin(key)` | 返回 `LoginState` |
| `cancelLogin(key)` | 关窗时释放这一把 key，幂等 |
| `getLoginTtlMs()` | 由前端计时过期 |
| `describeLoginFailure(step,error)` | 平台把错误翻成共用事实，或直接点名情况 |
| `getLoginForm()` / `submitLoginForm()` | 通用表单登录（账号密码类平台） |
| `getLoginDiagnostics()` | 失败后附进诊断报告 |
| `canRunLoginSelfCheck()` / `runLoginSelfCheck()` | 失败后主动查本地后端、DNS、TCP/TLS、HTTPS |
| `checkAfterLogin()` / `getSetup()` / `runSetupAction()` | 登录后的配置清单（如 Spotify 密钥、飞牛地址） |

`LoginState` 只有五种：`waiting / scanned / confirmed / expired / error`；`error` 带 `failure` 与 `transient`。

`LoginFailureDetail` 只放可公开的事实：平台码、原话、HTTP 状态、上游码、要求等多久、主进程代号；不包含 cookie/token/IP/账号。

### 2.3 登录会话生命周期

`library/core/account/providerLoginSession.service.ts` 是共用实现：

- **代次**：每次 `start/stop/到期` 都推进；每个 `await` 后先验代次，晚到的结果作废。
- **同一时间只有一轮**：再次开始先停上一轮；关闭窗口时取消 keyed 会话。
- **串行轮询**：上一次 `check` 结算后 2 秒才发下一次，不重叠。
- **瞬时失败**：网络层没拿到回答、码仍有效时，连续最多 2 次照常轮询；超过才算失败。
- **已扫码超时**：停在 `scanned` 60 秒未确认，按过期处理并给 `expired-after-scan`。
- **TTL**：平台声明 `getLoginTtlMs` 才由前端计时；到点先取消会话再报过期。
- **确认后**：`onConfirmed` 读账号；读账号失败进入 `account-not-read`，不会假装登录成功。
- **失败后**：自动跑一次自检，结果进诊断报告。

### 2.4 账户模型

`services/onlineMusic/account/accountRead.ts` 的规则：

- 读账号的时机：启动、登录完成、切换平台、手动同步；歌单在首页进入和改动后单独重读。
- 同一平台同时只有一次读；后到的请求加入，不并发。
- 读失败不把人踢下线：平台明确说没人登录、或返回 `auth-required`，才清账号；网络失败保留已显示的账号并标失败。
- 账户快照 `providerAccountCache.ts` 存 `user / collections / likedSongIds`，启动先显示快照，再后台问平台。
- 旧版本缓存有迁移路径；快照坏了逐项剔除，不整份丢弃。
- 红心读取与用户按下的心形有唯一对账规则（`keptAfterRead.ts`），不是简单覆盖。

`ProviderAccountSummary` 带 `availability / requiresAccount / status / user / collections / error / hydration / freshness / lastUpdatedAt`，UI 只看这些字段。

### 2.5 登录界面

`components/login/` 是一个完整的登录窗口，不是单卡片：

- 左边平台列：状态（已登录/失效/未登录/无需登录/不可用）、排序、搜索、不可用原因。
- 右边按场景切换：账号面板、登录方式选择、二维码、浏览器等待、已扫码、读账号、登录后检查、配置清单、失败。
- 失败场景：情况标题、共用说明、平台自己的补充、平台原话引用、按情况给“刷新二维码/重新登录/重新打开浏览器/重启本地服务”，以及“稍后再试”倒计时。
- 登录成功有完成动画；账号先落到界面，再关闭窗口。
- 所有平台名、标题、说明、失败文案由 provider 声明，窗口里没有平台名分支。

### 2.6 平台支持

Folia 当前注册 9 个在线平台 + 独立 Navidrome：

`netease / kugou / qq / bodian / ytm / spotify / qishui / appleMusic / fnmusic`

其中：

- 网页版可用的只有 `netease / kugou / qq`，且依赖部署好的 API 服务。
- 桌面端平台依赖 Electron 主进程桥、`safeStorage`、原生模块或伴生进程：
  - `ytm`：`youtubei.js` + BotGuard 沙箱 + 浏览器登录。
  - `spotify`：partner 查询服务 + `node-librespot` 原生模块 + Soloist。
  - `qishui`：纯 Node 包 `qishui-music-api`，主进程桥 + 会话加密。
  - `bodian`：纯 Node 包 `bodian-music-api`，主进程桥 + 会话加密。
  - `fnmusic`：飞牛 HTTP API + 主进程 `safeStorage` + 自定义协议。
  - `appleMusic`：WKWebView/WebView2 原生伴生，DRM 外部播放。
- Navidrome 不是 Omni provider，走独立 `navidromeService.ts` 的 Subsonic API。

平台接入规则在 `README.md` 的“接入一个新平台”：一个目录、一个 provider、一个 transport、注册一行；能力开关必须和实现一致。

## 3. 我方现状与差距

### 3.1 已有骨架

- `src/host/providers/sources/registry.js`：source 注册表，有 `capabilities`、`summaries()`、版本通知。
- `src/host/providers/sources/adapter.js`：把平台的扁平函数包成 source 对象。
- `src/host/providers/login/state.js`：一个登录状态机（unknown/anonymous/pending/authenticated/expired/error）。
- `src/host/providers/login/store.js`：`sessions.json` 版本化凭据存储。
- `src/host/services/core/login-failure.js`：Folia 风格的失败 case 表。
- 客户端已有在线页、设置页平台卡片、QR 登录弹窗、Navidrome 表单。

这些方向是对的，问题在完成度和边界。

### 3.2 契约差距（严重）

`accountSessionOf`（`src/host/providers/login/state.js:36-73`）把快照翻译成 Folia 形状时，以下字段是写死的：

```js
methods: [],
selectedMethodId: '',
inBrowser: false,
canReopenLoginPage: false,
localService: null,
selfCheck: null,
checksAfterLogin: false,
texts: null,
```

`failure` 也只按 `network ? 'B' : 'C'` 硬分，`action` 固定 `retry`，`details` 固定 `false`。

也就是说：客户端拿到的“Folia 形状”只是壳，后面没有对应的 provider 能力。

对比 Folia 的 `OnlineAuthProvider`，我方缺：

- `getLoginStatus` / `logout` / `signInRanOut` / `showsKeptAccountAtStart`
- `getLoginTexts` / `getLoginMethods` / `resolveLoginMethods`
- `getLoginTtlMs` / `cancelLogin`
- `describeLoginFailure` 的平台实现
- `getLoginDiagnostics` / `canRunLoginSelfCheck` / `runLoginSelfCheck`
- `getLoginForm` / `submitLoginForm`（Navidrome 是路由特判，不是通用能力）
- `checkAfterLogin` / `getSetup` / `runSetupAction`

### 3.3 会话生命周期差距（严重）

当前实现：

- 客户端 `LoginDialog` 每 2 秒 `GET /online/login/status?provider=...&key=...`（`src/client/components/ui/dialogs.js:501-544`）。
- Host 的 `login.poll(provider)` **忽略 key**，只轮询 provider 当前状态（`src/host/http/routes/online.js:845-869`）。
- 没有取消：关窗只清客户端定时器，Host 的 QR 会话留到平台自己过期。
- 没有 TTL：`createQrAdapter.start()` 不返回 `expiresAt`，Host 快照里 `expiresAt` 恒为 0。
- 没有“已扫码后超时”：平台一直回 waiting/scanned 就一直轮询。
- 没有瞬时失败：一次网络错误就进 error，停止轮询。
- 没有代次：Host 侧 `states` 每 source 一个状态；重新开始会 `delete` 旧状态，但没有 keyed 取消，旧二维码仍在上游有效。
- `/online/login/session` 为了取一个快照也调用 `login.poll(provider)`（`src/host/http/routes/online.js:871-893`），语义错误。

Folia 的对应实现见 `providerLoginSession.service.ts`：代次、keyed cancel、2 秒串行、瞬时 2 次、scanned 60 秒、TTL、确认后读账号。

### 3.4 失败与诊断差距（严重）

- `loginFailureOf` 在 `src/host/services/core/login-failure.js` 有 case 表，但只覆盖了一部分；没有 `browser-still-open / browser-closed-early / browser-unread` 等浏览器登录情况。
- 没有平台原话引用；错误直接 `errorText(error)` 上屏。
- 没有失败后的自检（本地 worker 是否在跑、DNS/TCP/HTTPS 是否通）。
- 没有诊断报告；Folia 的 `loginDiagnosticReport.ts` 会把时间线、自检、平台诊断拼成可复制的报告。
- `loginFailureFacts` 只从错误对象取 `status / retryAfterMs / code`，没有 provider 的 `describeLoginFailure` 入口。

### 3.5 账户模型差距（严重）

- Host 只有 `sessions.json`（凭据 + profile），没有 `user / collections / likedSongIds` 快照。
- `/online/providers` 每次（5 分钟缓存）现场问 `providerVipInfo` + `providerProfile`（`src/host/http/routes/online.js:1454-1490`）。启动时多个平台串行请求，慢且容易失败。
- 平台摘要没有 `availability / requiresAccount / status / error / hydration / freshness / lastUpdatedAt`；客户端只知道 `loggedIn`。
- 没有 `readAccount(reason)`；登录成功只是 `loadProviders + loadMyPlaylists`。
- 没有“网络失败保留账号、只有平台明确说没人/拒绝才退出”的规则。
- 没有旧账号缓存迁移与红心对账。
- 没有活动平台概念；客户端用 `music.ui.v2.source` 当当前 source，Host 不知道。

### 3.6 登录界面差距（明显）

`src/client/components/ui/dialogs.js:478-630` 的 `LoginDialog`：

- 只有一个二维码框 + 两步说明 + 重试/关闭；没有平台列、账号面板、方式选择、配置清单。
- `providerLabel` 硬编码：`netease ? ... : qq ? ... : kugou`（`dialogs.js:546-551`）。Bodian / 酷狗概念版都会显示成“酷狗”。
- QQ 的 `mode` 固定 `'qq'`；设置页、播放器页、在线页三处 pushLayer 都没有方式选择。
- 失败只显示 `errorText` / `statusfailed`；没有 case 标题、平台原话、倒计时、重新打开浏览器、重启服务。
- 没有登录成功后的账号读取；直接 toast + `popLayer`，账号面板可能还是旧数据。
- 没有自检/诊断入口。

Folia 的登录窗口场景在 `components/login/window/LoginScreen.tsx:26-77`，平台行规则在 `platformRows.ts`。

### 3.7 平台接入架构差距（明显）

虽然 registry 存在，平台名仍散落在上层：

- 路由：`/online/providers` 里硬编码 `['netease','qq','kugou','kugouLite','navidrome']`（`routes/online.js:1460`）；登录 bridge 适配器硬编码五个 id（`:87`）；酷狗设备特判（`:344`）；Navidrome 特判（`:897`）。
- UI：`UI_SOURCES` 硬编码六个（`components/common/ui.js:12`）；`sourceLabelOf` 硬编码（`:58-69`）；登录弹窗标签硬编码（`dialogs.js:546-551`）；Navidrome 卡片特判（`settings.js:743-836`）。
- Provider store：`EMPTY` 只列五个平台（`provider-store.js:20-35`）；`QR_PROVIDERS` 只列四个（`:41`）；`setLogin` 对不在列表里的平台直接 return（`:122`）。
- 结果：Bodian 虽然注册并出现在 UI，但登录成功写不进 provider store，卡片永远显示未登录。
- 能力声明不实：`kugouLite` 的 `likeWrite` / `playlistAdd` / `mutations` 都是 true，但 `setOnlineLiked` / `addOnlineSongToPlaylist` 对 kugouLite 直接抛“暂不支持”（`providers/index.js:932`、`:963`）。

这正是 AGENTS 里“不要在平台目录外按平台名分支”要避免的形态。

### 3.8 具体 bug / 半成品

1. **两个 login store 写同一个文件**
   `index.js:47-49` 创建了 `providerStore`（内部一个 `createLoginStore`）和单独的 `loginStore`（给 Bodian）。两个实例各有缓存，都写 `sessions.json`，会互相覆盖。Bodian 登录保存后，`providerStore` 的缓存可能还是旧的；反向也一样。
2. **Bodian 登录不持久化到摘要**
   `providerStore.setLogin` 只接受四个 QR 平台 + Navidrome；Bodian 被忽略。UI 永远 `loggedIn: false`。
3. **Bodian 启动 hydrate 是 fire-and-forget**
   `registerBodianSource` 里 `void sessions.hydrate()`，首批请求可能拿不到会话。
4. **`/online/login/session` 会触发轮询**
   取会话快照不应改变登录状态。
5. **QR `expiresAt` 被丢弃**
   `createQrAdapter.start()` 没把 provider 的 `expiresAt` 带进快照，客户端无法本地计时。
6. **关窗不取消**
   上游 QR 会话泄漏到过期；用户重开可能拿到旧 key 的状态。
7. **登录弹窗标签错误**
   Bodian / kugouLite 显示“酷狗”。
8. **QQ 微信登录不可选**
   协议层支持 `mode='wx'`（`providers/index.js:399-401`），UI 没有入口。
9. **KugouLite 能力声明不实**
   见上。
10. **`THIRD_PARTY_NOTICES.md` 与代码漂移**
    里面写“kugoumusicapi 未启用”，但 `kugou.js` 已经在用 `callKugou`；qishui 写“网络不可达”，但包已安装且未接入。

### 3.9 凭据安全差距（已验证）

- 我方：`sessions.json` 明文 JSON，文件 mode 0600；Windows 上 0600 的保证弱于 Unix。
- Folia 桌面端：QQ / 酷狗 / 汽水 / 波点 / 飞牛等会话由 Electron 主进程 `safeStorage` 加密；渲染进程不接触凭据。
- 我方边界是好的：客户端从不拿 cookie/token；但静态加密缺失。

对 DSH 运行形态的实际验证：

1. **Host 不是 Electron 主进程，拿不到 `safeStorage`。**
   DSH Desktop 的 Host 由 Electron shell 以独立子进程启动；`dsh-desktop-host/package.json` 自述
   "Private Node-mode host process for the Electron desktop application"，启动代码
   `desktopNodeEnvironment()` 强制设置 `ELECTRON_RUN_AS_NODE=1`。
   在 Electron-as-Node 下执行 `require('electron')` 直接报 `Cannot find module 'electron'`，
   `safeStorage` 不可用。
2. **DSH 有 `ctx.credentials`，但默认实现不加密。**
   `@deepseek-ai/dsh-credentials` 提供 `resolve / set / readRecord / modifyRecord / deleteRecord`
   等接口；默认 provider 是 `@deepseek-ai/dsh-credentials-local`，落在
   `$DSH_HOME/.credentials.yaml`，YAML 明文。README 明确写了：Windows 不检查 mode；
   agent 的工具进程与用户同权限，因此这个文件挡不住 agent。
3. **Windows ACL 并不等于“只有本人可读”。**
   本机 `$DSH_HOME/.credentials.yaml` 和 `$DSH_HOME/music/sessions.json` 的 ACL 都包含
   `S-1-5-21-…-1004:(I)(RX)`、`Administrators:(I)(F)`、`SYSTEM:(I)(F)`，不只是当前用户。
4. **真正的加密仍然可做：DSH 自带 `koffi`。**
   `koffi` 3.1.1 是 `dsh-desktop-host` 的依赖，位于 `app.asar/dsh/node_modules/koffi`，
   可从 `DSH_INSTALL_DIR` 解析。用 `koffi` 调 `crypt32.dll` 的
   `CryptProtectData` / `CryptUnprotectData` 已实测：15 字节明文 → 230 字节 DPAPI 密文，
   再解密回原文。该验证在 Electron-as-Node 下完成，和 Host 的运行方式一致。

结论：

- **不能**直接复用 Electron `safeStorage`。
- **可以**在 Windows 上用 DPAPI 做真正的用户级加密，且不需要给插件新增原生依赖
  （复用 DSH 自带的 koffi）。
- DSH 自己的 `ctx.credentials` 只解决“统一存放/锁定/热加载”，不解决加密；
  可以作为后续存储层，但不是加密方案。

## 4. 对齐方案

### 4.1 原则

1. **先内核，后平台数量**。先把登录/账户契约和生命周期做对，再加平台；否则每加一个平台都在补同一套洞。
2. **平台只在自己的目录里**。路由、UI、provider store 不再出现平台名；新增平台只改 `sources/<id>/`、注册行、i18n。
3. **能力声明必须可执行**。每个 `capabilities.* = true` 都要有一个测试证明对应方法可用；不能“先声明再抛错”。
4. **不照搬 Electron**。Folia 的 `safeStorage`、原生伴生、`net.fetch` 桥不能 1:1 搬进 DSH；只移植契约、状态机和交互规则。
5. **不为了数量做假平台**。Spotify / YouTube Music / Apple Music 依赖原生或浏览器沙箱，短期不做；在 UI 里明确“当前环境不可用”，而不是放一个点了报错的卡片。

### 4.2 P1：登录内核（优先，独立可交付）

**目标**：现有四个平台（NetEase / QQ / KuGou / KuGouLite）+ Navidrome + Bodian 的登录，具备 Folia 的会话语义。

改动：

1. **扩展登录契约**
   - `src/host/providers/sources/adapter.js`：source 增加 `auth` 命名空间，按能力暴露 `getLoginStatus / logout / signInRanOut / getLoginTexts / getLoginMethods / startLogin / createQr / checkLogin / cancelLogin / getLoginTtlMs / describeLoginFailure / getLoginDiagnostics / getLoginForm / submitLoginForm`。
   - `src/host/providers/index.js`：把 `loginStart/loginStatus` 的平台分支移进各平台模块（`netease.js`、`qq.js`、`kugou.js`、`sources/bodian/auth.js`、`navidrome-auth.js`）。
   - `registry.summaries()` 增加 `availability / requiresAccount / loginTexts / loginMethods / status`。

2. **重写登录会话**
   - `src/host/providers/login/session.js`（新）：每个 provider 一个 active session，带 `sessionId / key / methodId / phase / expiresAt / scannedAt / transientFailures`。
   - 代次校验；keyed `cancelLogin`；关窗/重开取消旧 key。
   - 串行轮询 2 秒；瞬时失败最多 2 次；scanned 60 秒超时；`getLoginTtlMs` 计时。
   - 确认后调用账户读取；读账号失败进入 `account-not-read`，不直接 toast 成功。
   - `src/host/providers/login/state.js` 的 `accountSessionOf` 改为真实字段，不再写死。

3. **失败与诊断**
   - 扩展 `core/login-failure.js` 的 case 表：`browser-still-open / browser-closed-early / browser-unread / browser-not-opened / local-service-*`。
   - 平台实现 `describeLoginFailure(step,error)`；共用层保留兜底。
   - Host 增加 `/online/login/cancel`、`/online/login/self-check`、`/online/login/diagnostics`。
   - 自检先做“本地 worker 状态 + 对平台域名的一次 HTTPS 探测”，不做 Folia 那么细的 DNS/TCP/TLS 时间线（可后续扩）。

4. **本地服务状态**
   - `netease-api.js` / `qq-api.js` / `kugou-api.js` 暴露 `status()` / `restart()`；登录失败时窗口可显示“重启本地服务”。
   - 这一步是 Folia `localService` 的最小可用版。

**验收**：

- 关窗后 Host 会话被取消；再次打开拿新 key。
- 网络断开一次，轮询继续；连续 2 次才报错。
- 扫码后 60 秒不确认，报 `expired-after-scan`。
- QQ 微信方式可选，且 key 与方式绑定。
- 登录成功后才读账号；读账号失败显示 `account-not-read`，不显示“登录成功”。
- 平台原话出现在失败详情里，不带 cookie/token。
- 以上全部有单测（假时钟、假 provider）。

### 4.3 P2：账户模型与登录窗口

**目标**：启动先显示账户快照；登录窗口达到 Folia 的信息结构；现有平台卡片不再靠现场请求。

改动：

1. **账户快照**
   - 新 `src/host/stores/accounts.js`：`accounts.json`（版本、每平台 `user / collections / likedSongIds / savedAt / freshness / error`），原子写 0600。
   - `src/host/services/account-read.js`：启动 / 登录完成 / 切换 / 手动同步四种 reason；同平台单飞；失败保留旧账号；只有平台明确 `auth-required` / 没人登录才清。
   - `/online/providers` 从 registry + 快照合成，不再现场问 profile/VIP；VIP 信息后台刷新。
   - `resetData` 扩展 `accounts.json`；按 `A_other/docs/data-reset.md` 更新范围与测试。

2. **活动平台**
   - 复用现有 `music.ui.v2.source`，不新增重复存储键；Host 在 `/online/providers` 或账户接口里接受客户端当前 source，用于摘要排序/状态。
   - 若后续需要跨客户端一致，再考虑 Host 持久化。

3. **登录窗口**
   - 新目录 `src/client/components/ui/login/`：`login-window.js`、`platform-column.js`、`account-panel.js`、`login-tile.js`、`login-message.js`、`login-form.js`。
   - 结构：左侧平台列（状态/排序/搜索），右侧场景（账号/方式选择/二维码/浏览器/读账号/失败/配置清单）。
   - 失败：case 标题 + 共用说明 + 平台补充 + 原话引用 + 操作（刷新/重登/重开浏览器/重启服务）+ 倒计时。
   - 登录成功：先显示账号，再关闭；保留现有 toast 作为兜底。
   - 响应式：窄宽度单列；遵守 `theme-guidelines.md`，只用 `--dsw-*` token。
   - 替换 `dialogs.js` 的 `LoginDialog`；设置页卡片保留为入口/状态，不再承载完整流程。

4. **通用表单登录**
   - Navidrome 从路由特判改为 provider `getLoginForm/submitLoginForm`；登录窗口统一渲染。
   - 这样以后飞牛等账号密码平台不用再改 UI。

**验收**：

- 启动时先显示上次账户，平台请求失败不白屏、不误登出。
- 退出登录清掉快照与凭据；重新登录显示新账号。
- 登录窗口在浅/深色、窄宽度下成立；没有平台名硬编码文案。
- 新增一个平台（测试用假 source）只改注册与 i18n，UI/路由不改。
- `npm test`、`npm run check` 通过；截图/渲染测试覆盖登录窗口主要场景。

### 4.4 P3：平台支持

按可移植性排序，**不是**按 Folia 的名单全抄。

| 平台 | Folia 依赖 | 我方可行性 | 建议 |
| --- | --- | --- | --- |
| NetEase / QQ / KuGou | 已用同一上游包 | 已有 | P1/P2 对齐登录与账户即可 |
| Bodian | 纯 Node `bodian-music-api` | 代码已有 80%，但持久化/摘要/图标/能力未接完 | **P3a 先修**，成本最低 |
| 汽水 Qishui | 纯 Node `qishui-music-api`（Node ≥24） | 包已在依赖里；可用全局 fetch；需会话存储/媒体代理 | **P3b 可做**，中等偏大 |
| 飞牛 FnMusic | 飞牛 HTTP API + safeStorage + 自定义协议 | 协议简单；可用 Host 文件存 token + `/online/stream` 代理 | **P3c 可选** |
| Spotify | partner API + node-librespot + Soloist | 需要原生模块/外部程序；DSH 不适合 | **不做**，标不可用 |
| YouTube Music | youtubei.js + BotGuard 沙箱 + 浏览器登录 | 需要浏览器/沙箱；维护成本高 | **不做**，标不可用 |
| Apple Music | WKWebView/WebView2 原生伴生 + DRM | 需要原生宿主 | **不做**，标不可用 |

P3a 具体：

- Bodian 的 `sessions` 改为走统一账户/凭据服务，不再单独 `createLoginStore`。
- `providerStore` 或新账户服务读取 Bodian 会话；修复 `loggedIn`、昵称、头像。
- 补 provider logo（或明确的 fallback，不冒充网易云）。
- 能力声明与实现对齐；加登录/持久化测试。

P3b 具体：

- 新 `src/host/providers/sources/qishui/`：`auth`（扫码）、`provider`（搜索/详情/歌词/歌单/推荐按能力）、`transport`（包调用）。
- 会话存 Host（不交给客户端）；音频地址经 `/online/stream` 代理，避免 CORS/请求头问题。
- 能力先只开 `search / playback / lyrics / auth / userLibrary`，推荐/探索后续。
- 更新 `THIRD_PARTY_NOTICES` 与数据清理范围。

P3c 具体：

- `sources/fnmusic/`：密码登录表单、token 存储、搜索/专辑/歌单、音频代理。
- 先作为实验平台，能力声明保守。

P3d 能力审计：

- 每个 provider 的 `capabilities` 与实现逐项对照；`kugouLite` 的 `likeWrite / playlistAdd / mutations` 改成 false。
- 加一个测试：对每个 `capabilities.* = true`，至少有一个方法存在且不被平台分支直接抛“不支持”。

### 4.5 P4：验证与发布

- 单测：登录状态机（假时钟）、路由、账户读取、能力矩阵、数据清理、i18n key。
- UI：登录窗口主要场景渲染测试；浅/深色、窄宽度截图。
- 真机：NetEase / QQ（QQ + 微信）/ KuGou / KuGouLite / Bodian / Qishui / Navidrome 各登录一次；断网、过期、关窗取消、重启。
- 打包：`npm pack` + 干净 profile 安装 smoke；版本号按发布流程升。
- 文档：`CHANGELOG.md`、`README` 在线平台说明、`THIRD_PARTY_NOTICES`、`pitfalls.md` 补登录相关坑。

### 4.6 明确不做

- 不搬 Folia 的 Electron 主进程桥、`safeStorage`、原生伴生、`net.fetch` 代理。
- 不为了“平台数量”接 Spotify / YouTube Music / Apple Music。
- 不重写已经用同一上游包的 NetEase / QQ / KuGou 协议层；只改登录/账户边界。
- 不把 Folia 的 React 组件/视觉直接搬进 DSH；只移植状态机、交互规则和信息结构。
- 不在本次做 Folia 的完整红心对账/推荐偏好/探索页；这些属于平台数据层，后续按平台单独评估。

### 4.7 凭据存储（已决定：不做加密）

2026-11-17 决策：**不投入凭据加密**，接受明文存储的风险。

仍然要做的：

- 只保留**一个** `sessions.json` 和一个 credential store；Bodian 也走同一个 store，
  去掉 `index.js` 里第二个 `createLoginStore` 和 `providerStore` 的双缓存。
- 文件 0600、原子写；客户端永远拿不到 cookie/token；日志/诊断/导出不包含凭据。
- “清空插件所有数据”必须清掉 `sessions.json`；测试覆盖。
- 文档写清楚：凭据未加密；能读该文件的用户/进程即可冒用账号。

不做的：

- 不新增 `SecretBox` / DPAPI / Keychain / Secret Service。
- 不把音乐凭据迁进 DSH `.credentials.yaml`（会和 LLM key 放在同一个明文文件里，扩大影响面）。

## 5. 已确认的范围与形态

2026-11-17 决策：

1. **平台支持**：对齐 Folia 的平台支持，按“7 个可用 + 1 个可选 + 3 个明确不可用”执行：
   - 可用：NetEase / QQ / KuGou / KuGouLite / Navidrome / Bodian / 汽水
   - 可选：飞牛
   - 明确不可用：Spotify / YouTube Music / Apple Music
   - 不把“平台名单”和“每个平台的推荐/探索/日推/私人 FM 全量能力”混在一起；
     能力面后续按平台单独补。
2. **登录窗口**：接受 Folia 式宽窗口（左平台列 + 右账号/登录面板，窄宽度单列）。
3. **凭据**：不做加密；按 4.7 的明文存储约束执行。

执行顺序不变：P1 登录内核 → P2 账户模型与登录窗口 → P3 平台支持。

## 6. 执行进度（2026-11-17）

已落地并验证：

- **P1**：统一 `sessions.json`（Bodian 不再建第二个 store）；Bodian 登录持久化；二维码 `expiresAt`；关窗取消；已扫码 60 秒超时；瞬时失败重试；旧 key 轮询隔离；QQ QQ/微信；登录弹窗平台名/图标不再错配。
- **P2**：`accounts.json` 快照（昵称、头像、歌单、喜欢 id），失败读取保留旧账号；登录窗口宽版面（平台列 + 账号/二维码/Navidrome 表单）；Navidrome 不再单独弹卡片。
- **P3a**：Bodian `profile` 与账号快照接通。
- **P3b**：汽水音乐 Host 侧平台（扫码、搜索、播放地址、歌词、歌单、喜欢）；`qishui-music-api` 注册进 source registry。
- **P4 部分**：酷狗概念版能力声明修正；`music_control` / README / notices 更新。
- **能力面**：听歌排行（网易云 / QQ / 酷狗，作为账号歌单条目）；播放上报（网易云，默认关闭，Host 侧 5 秒/每小时 60 次限流）。
- **登录契约**：本地服务状态/重启、Host 自检、诊断接口、登录窗口失败时的重启按钮、账号「同步数据」。
- **账户生命周期**：快照读取、失败保留、主动同步、退出清理、启动/登录/切换触发的后台刷新。
- **歌手/专辑渠道**：QQ 改到 `/getSingerHotsong`、`/getSingerAlbum`、`/getAlbumInfo`；酷狗改到 `artist_audios`、`artist_albums`、`artist_detail`、`album_detail`、`album_songs`；网易云保持 `/artist/songs`、`/album`；汽水补 `artist_detail`。QQ/酷狗/网易云现在能返回歌手信息和专辑列表。
- **歌手页入口**：从歌曲点歌手进入歌手页（头像、简介、专辑列表），可再进「热门歌曲」；歌手页专辑卡直接展开专辑曲目。
- **网易云专辑曲目**：与 Folia 一致读 `/album` 响应的顶层 `songs`；`album.songs` 为空不再是失败。

未做：

- P3c 飞牛（可选）。
- Spotify / YouTube Music / Apple Music（明确不可用，未注册）。
- P4 的干净 profile 安装 smoke、版本号/发布说明仍未做。

