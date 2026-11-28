# 酷狗音源对齐 Folia：上游宿主 API 契约规格

> 本文只读、只记录结论，不改任何代码。审计对象：`A_other/upstream/folia-major-main`（只读上游）；落点：本插件 `dsh-music-panel`。
>
> 引用约定：文中 `路径:行号` 的**上游**路径以 `A_other/upstream/folia-major-main/` 为根（如 `sources/kugou/core/kugouProvider.ts:1268`）；**插件**路径以仓库根为根（如 `src/host/services/kugou-api.js:21`）。每条结论都对应到具体文件与行号，没读过的文件不下结论。
>
> 记录时间：2026-11-28。上游是移动靶，升级后请先按本文行号复核。

---

## 0. 结论摘要（先看这一段）

1. **上游酷狗模组实现了 10 个能力族，全是标准能力，没有自定义能力**：`search@1`、`songs@1`、`playback.audio@1`、`lyrics@1`、`auth@1`、`library@1`、`catalog@1`、`recommendations@1`、`mutations@1`、`covers@1`（`sources/kugou/core/kugouProvider.ts:1268,1305,1314,1567,1574,1639,1697,1830,1889,2039`）。
   `mod.json` 的 `sources[0].requires` 恰好列这 10 个（`sources/kugou/mod.json:20-31`），与实现一一对应；不实现 `reports@1`、`explore@1`、`raw@1`、`playback.external@1`、`playback.surface@1`。
2. **文件已经在插件里，而且是逐字节的**：`src/folia-mods/sources/kugou/**`（19 个文件）与 `src/folia-mods/packages/folium-source-kit/**`（9 个文件）共 28 个，**全部**逐一 SHA256 与上游相同（本次实测，清单见 §6.1）。
3. **复制之外还要接线，而接线在记录时刻已经开工**（本文只记录上游契约，不审计插件的接线代码）：仓库里已出现 `src/folia-adapters/kugou/`（8 个适配文件：`errors/host/jsonFile/legacyStore/pageStore/rpc/seal/texts`）、`src/folia-build/kugou-host-entry.ts`、`scripts/build-kugou-folia.mjs` 与产物 `src/host/vendor/kugou-folia/source.bundle.mjs`（151396 B）。本文 §6 的「必须适配」清单正好可以逐条对照这些落点。
4. **接线的三块**：① `@folia/folium` 类型入口（只用于 `import type`，运行时擦除）与 `@folia/folium-source-kit` 运行时（真的会被 require）；② Host 侧 `FoliumSourceMainApi`（纯 Node，**没有 Electron**：`seal`/`legacy.store`/`net.fetch`/`media.allow` 都要另找实现）；③ Client 侧 `FoliumClientApi` 的 8 个成员（`sources.register`/`pageStore`/`error`、`i18n.key`/`text`、`lyrics.isPureMusicText`、`rpc.call`、`modId`）。
5. **酷狗用到的宿主面很窄**：main 只用 5 个 `api.*`（`rpc.handle`、`media.allow`、`net.fetch`、`legacy.store`、`seal`）加一个 `process.env.platform`；client 只用到 8 个成员（5 个命名空间）；`core` 只要求一个 7 字段的 `env`。移植成本集中在这几处，而不是 114 KB 的 `kugouProvider.ts`。

---

## 1. 宿主面：两个 `activate()` 收到的对象

两类入口拿到的不是同一个对象：client 入口 `activate(folium)` 收 `FoliumClientApi`（`mods/folium.d.ts:2924-2980`）；main 入口 `activate(api)` 收 `FoliumSourceMainApi`（`mods/folium.d.ts:4440-4480`），后者 `extends FoliumMainApi`（`mods/folium.d.ts:4210-4242`）。
`mods/folium.d.ts` 由 `npm run folium:types` 从 `src/mods/folium/contract.ts`、`src/mods/folium/sources/contract.ts`、`mainContract.ts` 生成（`mods/folium.d.ts:1-2`），**只给编辑器看，宿主不读它**（同文件 `:16`）。真正被宿主执行的约束在 `src/mods/folium/sources/contract.ts`。

### 1.1 `FoliumSourceMainApi` 成员全表

基础部分继承自 `FoliumMainApi`（`mods/folium.d.ts:4210-4242`）：

| 成员 | 签名 | 语义 | 酷狗 main 用到 |
|---|---|---|---|
| `manifest` | `FoliumManifest`（`:4245-4290`） | 本模组 `mod.json` 的只读副本，缺字段已补 | 否 |
| `host` | `FoliumHostInfo` | 宿主版本；`api.host.folium.minor` 用来判断新成员在不在（`:4360-4361`） | 否 |
| `log` | `FoliumLogger`（`:2914-2921`）：`info/warn/error(message, details?)` | `error` 会列在模组面板 | 否（用 `console.warn`） |
| `storage` | `FoliumMainStorage`（`:4296-4299`） | 与 client 共用的数据文件；source 模组配额 16 MB（`electron/modSystem/foliumShared.json` 的 `limits.source.storage.maxBytes=16777216`） | 否 |
| `secrets` | `FoliumSecretAccess` | `secret` 设置字段的值 | 否 |
| `paths` | `FoliumMainPaths`（`:4324-4333`）：`documents/downloads/music/videos` | 用户文件夹 | 否 |
| `onDispose(disposer)` | `(d: FoliumDisposer) => void`（`:4235`） | 模组停止时执行（后注册先跑） | 否 |
| `runtime` | `FoliumMainRuntime`（`:4336-4342`）：`getPlaybackSnapshot()` | 宿主播放状态 | 否 |
| `rpc` | `FoliumMainRpc`（`:4345-4364`）：`handle(name, handler)`、`send(name, payload?)` | client 的 `folium.rpc.call` 落到 `handle` | **是**（3 个 handler） |
| `render` | `FoliumMainRender`（`:4367-4376`）：`exportVideo(spec)` | 视频导出 | 否 |

source 模组专属（`mods/folium.d.ts:4440-4480`）：

| 成员 | 签名 | 语义 | 酷狗 main 用到 |
|---|---|---|---|
| `net` | `FoliumSourceNet`（`:4527-4542`）：`fetch(url, init?)`、`request(options)`、`session(name)`、`resolveProxy(url)` | Electron `net`；source 模组 `netFetch` **不需要权限**、默认 15 s 超时、无 body 上限（`foliumShared.json` 的 `limits.source.netFetch`） | **是**（只 `fetch`） |
| `legacy` | `{ store: FoliumSourceLegacyStore }`（`:4448`、`:4632-4641`）：`get/set/has/delete` | 受信表（或 `claims`）登记过的旧存储键；其它键抛 `legacy-key-not-claimed:<key>`（`:4444-4447`） | **是** |
| `paths`（覆盖基类） | `FoliumSourceMainPaths`（`:4489-4492`）：新增 `legacy(name)` | `<userData>/<name>`；未登记抛 `legacy-folder-not-claimed` | 否 |
| `seal` | `FoliumSourceSeal`（`:4643-4651`）：`available()`、`seal(text)`、`open(sealed)` | 系统凭据库加密（Electron safeStorage）；Linux `basic_text` 时 `available()` 为假 | **是** |
| `cache` | `FoliumSourceCache`（`:4654-4667`）：`dir()`、`requestPrune(limitBytes?)`、`provideEntries`、`legacyDir` | 音源缓存目录 | 否 |
| `media` | `FoliumSourceMedia`（`:4722-4738`）：`allow(rule)`、`parseRange(header,size)`、`serve(name, handler)`、`url(name, rest?)` | 跨域头与 `folia-mod://` 媒体流 | **是**（只 `allow`） |
| `windows` | `FoliumSourceWindows`（`:4741-4752`）：`hidden(options)`、`mainWindowPresent()`、`onMainWindowChanged` | 隐藏窗口 | 否 |
| `shell` | `openExternal(url): Promise<void>`（`:4460`） | 系统浏览器 | 否 |
| `dialog` | `pickFile(options?)`（`:4462`） | 选文件 | 否 |
| `host`（覆盖） | `FoliumSourceHostInfo`（`:4483-4486`）：新增 `locale` | 宿主界面语言 | 否 |
| `onBeforeUnload` / `onBeforeQuit` / `onPlayersOrphaned` | `(handler) => FoliumDisposer`（`:4466-4470`） | 卸载 / 退出 / 播放接管 | 否 |
| `diagnostics` | `FoliumSourceDiagnostics`（`:4495-4512`）：`register/snapshot/selfCheck` | 登录诊断与自检 | 否 |
| `native` | `FoliumSourceNative`（`:4515-4524`）：`path(name)`、`load(name)` | 随包原生文件 | 否 |
| `reportError(error, where?)` | `(e: unknown, where?: string) => void`（`:4479`） | 进崩溃报告，不打扰用户 | 否 |

### 1.2 酷狗 main 实际用到的子集（`sources/kugou/main/index.ts`）

| 用途 | 调用 | 行号 |
|---|---|---|
| 媒体跨域 | `api.media.allow({ hosts: ['kugou.com', '*.kugou.com'] })`；不传 `resourceTypes`，默认 `media/xhr/image`（`mods/folium.d.ts:4700-4701`） | `:43` |
| 加密 | `sealAsSafeStorage(api.seal)`：把 `available()/seal()/open()` 包成 Electron `safeStorage` 的 `isEncryptionAvailable()/encryptString()/decryptString()`（`Buffer` ↔ base64） | `:24-28`、`:63` |
| 会话存储 | `store: api.legacy.store` | `:63` |
| 请求通道 | `api.rpc.handle('request', (operation, params) => KugouBridgeResult)` | `:71-80` |
| 匿名搜索 | `api.rpc.handle('anonymousSearch', (keyword, page, pagesize) => KugouPlainAnswer)`；关键词截到 200 字符，`page` 是 1..10000 整数、`pagesize` 是 1..100 整数 | `:33-36`、`:91-97` |
| 旧播放接口 | `api.rpc.handle('legacyPlayInfo', (hash) => KugouPlainAnswer)`；hash 必须匹配 `/^[0-9a-zA-Z]{1,64}$/`（`core/kugouRequests.ts:83`） | `:99-102` |
| 出网 | `api.net.fetch(url, { method:'GET', headers, credentials:'omit' })`，再取 `response.status` 与 `response.text()` | `:82-89` |
| 运行时开关 | `process.env.platform = 'lite'`，在 `import('kugoumusicapi')` **之前** | `:49-60` |

> 没有一个 handler 读 `api.manifest`、`api.host`、`api.log`、`api.cache`、`api.windows`、`api.diagnostics`。接线时这些成员可以是空壳（占位以免类型报缺），但 `rpc`、`net`、`legacy.store`、`seal`、`media` 必须真实现。

### 1.3 `FoliumClientApi` 成员全表

`mods/folium.d.ts:2924-2980`，共 23 个成员：

| 成员 | 类型 | 语义 | 酷狗 client 用到 |
|---|---|---|---|
| `modId` | `string` | 本模组 id | **是** |
| `host` | `FoliumHostInfo` | 版本 | 否 |
| `env` | `{ context: FoliumContextKind }` | 在哪跑（`main` / `export`） | 否 |
| `log` | `FoliumLogger` | 日志 | 否 |
| `registries` | `FoliumRegistries` | 可注册的一切 | 否 |
| `events` | `FoliumEvents` | 事件总线 | 否 |
| `playback` | `FoliumPlaybackService` | 播放状态与控制 | 否 |
| `ui` | `FoliumUiService` | toast / 面板 / 文件 / embed / 图标 | 否 |
| `net` | `FoliumNetService`（`:1590-1593`）：`fetch(url, init?)` | 经宿主出网（需 `net.fetch` 权限） | 否 |
| `storage` | `FoliumStorage` | 数据文件 | 否 |
| `secrets` | `FoliumSecretAccess` | `secret` 设置字段 | 否 |
| `rpc` | `FoliumRpc`（`:2894-2911`）：`call<T>(name, ...args)`、`on(name, listener)` | 调 main 入口；参数与结果须可 JSON 化（`:2896-2898`） | **是**（只 `call`） |
| `lyrics` | `FoliumLyricsService`（`:1570-1587`）`extends FoliumLyricsHelpers`（`:2636-2666`） | 歌词助手；`isPureMusicText` 在 `:2665` | **是**（只 `isPureMusicText`） |
| `theme` | `FoliumThemeHelpers` | 主题 | 否 |
| `account` | `FoliumAccountService` | 谁登录着（不含 id/cookie/token，`:1618-1623`） | 否 |
| `omni` | `FoliumOmniService` | 宿主在线源，只读 | 否 |
| `equalizer` | `FoliumEqualizerService` | 均衡器 | 否 |
| `visualizer` | `FoliumVisualizerService` | 歌词显示设置 | 否 |
| `sources` | `FoliumSourcesService`（`:3247-3261`）：`register`、`supports`、`error`、`pageStore` | 音源注册 | **是**（`register` / `error` / `pageStore`） |
| `i18n` | `FoliumI18nService`（`:3009-3019`）：`key(key, params?)`、`text(key, params?)` | 模组自带语言表 | **是**（两个都用） |
| `every(ms, listener)` | `(ms: number, l: () => void) => FoliumDisposer` | 定时器（最小 16 ms） | 否 |
| `onDispose` | `(d: FoliumDisposer) => void` | 停止时执行 | 否 |
| `experimental` | `Record<string, unknown>` | 实验性接口 | 否 |

### 1.4 酷狗 client 的注册代码（`sources/kugou/client/index.ts:9-18`）

```ts
export default function activate(folium: FoliumClientApi): void {
    folium.sources.register(createSource({
        modId: folium.modId,
        call: <T>(name: string, ...args: unknown[]) => folium.rpc.call<T>(name, ...args),
        text: (key, params) => folium.i18n.key(key, params),
        translate: (key, params) => folium.i18n.text(key, params),
        error: (code, message, details) => folium.sources.error(code, message, details),
        isPureMusicText: text => folium.lyrics.isPureMusicText(text),
        pageStore: sourceId => folium.sources.pageStore(sourceId),
    }));
}
```

三个硬约束：

- **必须在 `activate` 的第一个 `await` 之前注册**，否则首屏找不到（`src/mods/folium/sources/contract.ts:274-275`、`client/index.ts:6`）。
- `register` 只接受 `mod.json` 已声明的 id；同一 id 二次注册、或定义没有 `capabilities` 会抛。用户关掉的源不会被注册，那时 `handle.unregister` 是空操作（`contract.ts:276-279`）。
- `pageStore` 是**同窗口同步字符串存储**，按 source id 隔离（`contract.ts:254-265`）；酷狗用 id `kugou`（`core/kugouTransport.ts:252`、`:380`）。

### 1.5 名字勘误：`folium.errors` / `folium.pageStore` 不存在

- 造错的入口是 **`folium.sources.error(code, message, details?)`**（`mods/folium.d.ts:3257-3258`、`contract.ts:282-283`），返回带 `code`、`httpStatus`、`retryAfterMs` 的 `Error`（`contract.ts:245-252`）。全仓库没有 `folium.errors`：`mods/folium.d.ts` 里 `errors` 只出现在登录表单的 `errors?: Record<string, FoliumText>`（`:3833`）。
- 页面存储是 **`folium.sources.pageStore(sourceId)`**（`mods/folium.d.ts:3260`），没有 `folium.pageStore`。

`FoliumSourceErrorCode` 共 10 个取值（`contract.ts:222-232`）：`auth-required`、`unsupported`、`not-public`、`unavailable`、`not-playable`、`preview-only`、`subscription-required`、`region-restricted`、`network`、`invalid-response`。酷狗只用 5 个：`auth-required`（`kugouTransport.ts:163`）、`unavailable`（`:163`、`:513`）、`not-playable`（`kugouFailure.ts:91`）、`network`（`:163`、`:332`、`:341`）、`invalid-response`（`:346`、`kugouProvider.ts:896`、`:1908`、`:1941`、`:1132`、`:1149`、`:1222`）。

### 1.6 清单里有、`api.*` 里没有的宿主行为

两条能力由**清单字段**触发，不经过 `api.*`，移植时最容易漏：

| 清单字段 | 上游宿主行为 | 证据 |
|---|---|---|
| `sources[].certificateExceptions` | 对这些主机放宽证书检查（酷狗声明了 `fs.youthandroid2.kugou.com`） | `sources/kugou/mod.json:32`、`electron/modSystem/manifest.cjs:100`、`electron/modSystem/modSystem.cjs:2141`、`electron/main.cjs:182` |
| `sources[].requires` | main 进程用 `foliumShared.json` 的 `sourceCapabilities` 拒收宿主不认的能力版本 | `src/mods/folium/sources/capabilities.ts:3-7`、`electron/modSystem/foliumShared.json:6-24` |

插件 Host 是纯 Node HTTP，没有 Electron 的 `webRequest`/证书钩子：`certificateExceptions` 必须换成 Node fetch 的等价处理（否则 `fs.youthandroid2.kugou.com` 的媒体会以证书名不匹配失败）。这一条属于适配项，见 §6.2。

---

## 2. `env`：`createSource(env)` 收到的精确形状

### 2.1 类型定义（`sources/kugou/core/index.ts:25-36`）

```ts
export interface KugouSourceEnv {
    modId: string;
    call<T>(name: string, ...args: unknown[]): Promise<T>;
    text(key: string, params?: Record<string, string | number>): FoliumText;
    translate(key: string, params?: Record<string, string | number>): string;
    error(code: FoliumSourceErrorCode, message: string, details?: FoliumSourceErrorDetails): FoliumSourceError;
    isPureMusicText(text: string | null | undefined): boolean;
    pageStore(sourceId: string): FoliumSourcePageStore;
    web?: KugouWebEnv;   // 只有网页版给
}
```

字段、类型、桌面 client 的来源（`sources/kugou/client/index.ts` 逐行）、`createSource` 怎么往下传：

| 字段 | 类型 | 来源 | 往下传 | 用途 |
|---|---|---|---|---|
| `modId` | `string` | `folium.modId`（`:11`） | **不传**（`core/index.ts:40-51` 只取 5 个字段） | 未使用 |
| `call` | `<T>(name, ...args) => Promise<T>` | `folium.rpc.call`（`:12`） | `transportEnv.call`（`core/index.ts:41`） | 3 个 rpc 通道 |
| `text` | `(key, params?) => FoliumText` | `folium.i18n.key`（`:13`） | `text: key => env.text(key)`（`:47`） | 5 个键 |
| `translate` | `(key, params?) => string` | `folium.i18n.text`（`:14`） | `translate: key => env.translate(key)`（`:48`） | 4 个键 |
| `error` | `(code, message, details?) => FoliumSourceError` | `folium.sources.error`（`:15`） | transport 与 provider 各一份（`:42`、`:49`） | 全部错误 |
| `isPureMusicText` | `(text) => boolean` | `folium.lyrics.isPureMusicText`（`:16`） | `:50` | 纯音乐判定 |
| `pageStore` | `(sourceId) => FoliumSourcePageStore` | `folium.sources.pageStore`（`:17`） | `:43` | 账号提示 `userid` |
| `web` | `KugouWebEnv`（`core/kugouTransport.ts:239-245`） | 桌面版不传 | 选 transport 分支（`core/index.ts:45`） | 桌面不看 |

装配（`core/index.ts:39-52`）：

```ts
export const createSource = (env: KugouSourceEnv): FoliumSourceDef => {
    const transportEnv = { call, error, pageStore };
    const transport = env.web
        ? createWebKugouTransport(transportEnv, env.web)
        : createDesktopKugouTransport(transportEnv);
    return createKugouSource({ text, translate, error, isPureMusicText }, transport);
};
```

> 结论：**`env` 里没有账号、没有运行时标记、没有窗口/存储/网络能力**。传输层要的账号 id、是否登录、跑在 electron 还是 web，全由 `KugouTransport` 自己回答（`core/kugouTransport.ts:193-214`）：桌面实现从 `pageStore('kugou')` 读 `userid` 提示（`:350-352`），网页实现从页面存储拼 cookie（`:540-549`）。插件只要提供这 7 个字段，`core` 就能跑。

`env.text` 用到的 5 个键：`name.short`（`kugouProvider.ts:1261`）、`name.lyrics`（`:1569`）、`login.title`、`login.note`（`:1575`）；`env.translate` 用到的 4 个：`cloud.name`（`:1684`）、`listeningRank.week`、`listeningRank.all`、`listeningRank.description`（`:1238-1239`）。键的原文在 `sources/kugou/locales/zh-CN.json:1-18`（`en.json` / `in.json` / `vi.json` 同构）。

### 2.2 `env.call` 在桌面分支里怎么用

实现只有一层壳 `KugouTransportEnv.call`（`core/kugouTransport.ts:232-236`），三种用法：

1. **请求通道**：`call('request', operation, params)` → `KugouBridgeResult`（`:293-303`）
   - 参数先滤掉旧渲染进程残留的凭据键 `token`、`vip_token`、`vip_type`、`viptype`、`dfid`、`cookie`（`:317-321`，键名按小写比较）。
   - 登录三条 operation（`login_qr_key`、`login_qr_create`、`login_qr_check`，`:33`）套 20 s 时限 `withLoginRequestLimit`（`:326`；常量在 `packages/folium-source-kit/src/loginRequestLimit.ts:5`）。其余请求不设时限，理由写在 `:322-324`：主进程那边停不下来，超时只是不再等。
   - `env.call` 自己 reject（主入口没跑）时包成 `KuGouApi[operation=<op> api=unloaded]: <detail>` 再走 `toKugouProviderError`（`:297-300`）；`result.ok === false` 时把 `result.message`（即桥的 `KuGouApi[...]` 那一行）包成 `Error` 当 `cause`（`:301`）。
   - 每次成功后调 `persistAccountHint`（`:327`）：清掉渲染进程里的 `cookie`/`token`/`dfid`（`:266-270`）；只有三种回答能写账号提示 `pageStore.set('userid', …)`——`logout`（清除）、`user_detail`（取 `data.userid`）、`login_qr_check` 且 `data.status === 4`（token+userid 成对，`:277-289`、`:223-229`）。
2. **匿名搜索**：`call('anonymousSearch', keyword, page, pagesize)` → `KugouPlainAnswer`（`{status, bodyText}` 或 `{unreachable:true, message}`，`:307-313`、`:330-334`）；非 2xx → `network`，正文不可读 → `invalid-response`，正文 `error_code` 非 0/200 也算失败（`:363-376`）。
3. **旧播放接口**：`call('legacyPlayInfo', hash)`（`:335-348`）；`unreachable` → `network`；非 2xx → `network` 并带 `httpStatus`；正文不可读 → `invalid-response`。

跨进程约束：`FoliumMainRpc.handle` 明写参数与结果都要可 JSON 序列化（`mods/folium.d.ts:4346-4352`）。桥交回的是 KuGouMusicApi 的 `body`（`sources/kugou/main/kugouApiBridge.cjs:379-404`、`:588`），Host 转发时不能改形状，也不能塞 `BigInt`/`Buffer`/`Date`。

### 2.3 网页分支（不移植也要知道它存在）

`KugouWebEnv`（`core/kugouTransport.ts:239-245`）= `{ apiBase: string; md5(text): string; relayUrl(url): string }`，由上游 `src/services/onlineMusic/web/kugou.ts` 提供（`sources/kugou/README.md:20-22`）。网页实现直接 `fetch(VITE_KUGOU_API_BASE + ENDPOINTS[op])`，把会话放进页面存储的 `cookie/token/userid/dfid`（`:485-508`、`:410-426`），匿名搜索与旧接口走歌词代理 `relayUrl`（`:522-539`）。
`env.web` 不传时这条分支整段不执行，插件可以完全不提供它。注意插件的规矩是**浏览器侧不直连外部平台**（`AGENTS.md` 的 Host/Client 分工），所以即使以后要网页形态，也应换成经 Host 的 transport，而不是照抄 `createWebKugouTransport`。

---

## 3. 能力与方法表

### 3.1 两种 DTO 先说清楚

**歌**：`normalizeKugouSong(raw)`（`kugouProvider.ts:281-358`）产出 `FoliumSourceSong`（字段定义 `contract.ts:332-374`）：

| 字段 | 酷狗的来源 |
|---|---|
| `id` | 大写的 track hash（`hashOf`，`:128-133`）。**歌的 id 就是 hash**，`lyricIds.kugou` 也是它（`:355`） |
| `title` | `SongName/ori_audio_name/OriSongName/FileName/name/audio_name` → 去重歌手前缀 / 无歌手时按 `歌手 - 歌名` 拆（`:253-278`、`:316-325`） |
| `artists` | `authors[].base` 或 `SingerName` 等；没有酷狗 id 的给 `kugou-artist-<下标>-<名字>` 且 `ref:false`（`:186-205`、`:276`） |
| `album` | `{id: AlbumID/album_id, name: AlbumName/album_name, coverUrl?, ref:false 当 id 为空}`（`:287-297`、`:342-353`） |
| `durationMs` | `Duration/duration/timelen/…`；值 < 10000 视为秒并 ×1000（`:298-303`） |
| `lyricIds` | `{ kugou: hash }`（`:355`） |
| `data` | `{hash, mixSongId, albumAudioId, catalogLookupId(albumAudioId ?? mixSongId), albumId, fileId, originalName?}`（`:308-315`、`:340`）——`data` 上限 16 KB JSON（`contract.ts:368-373`），酷狗这点数据远小于上限 |
| `variant` | 云盘歌由调用方补 `'cloud'`（`:1718`） |
| `row.listenCount` | 听歌排行补（`:719-724`、`:1224`） |

**列表（歌单/专辑/歌手/云盘/排行）**：`normalizeCollection(raw, type, owned)`（`:449-499`）产出 `FoliumSourceCollection`（`contract.ts:404-445`），`id` 按类型取：playlist 取 `global_collection_id/specialid/id`，album 取 `album_id/musiclib_id/list_create_listid`，artist 取 `author_id`；`data` 里带 `listId/globalCollectionId/specialId/owned/creatorUserId/creatorListId/creatorGid/musicSize/albumSize`（`:487-497`）——**写操作要靠这些字段**（见 3.10）。

### 3.2 分页游标形态（宿主只给 limit/offset）

`FoliumSourcePage`（`contract.ts:289-298`）= `{ items, total?, hasMore, nextOffset? }`，`nextOffset` 缺省是 `offset + items.length`。酷狗自己不发明游标字符串，有四种推进方式：

| 形态 | 规则 | 行号 |
|---|---|---|
| `pageOf` | `page = floor(offset/limit)+1`；`nextOffset = offset + items.length`；`hasMore = offset+items < total \|\| items.length === limit` | `:546-551` |
| `pageOfWithRawItemCount` | 混合列表按**原始条数**推进：`nextOffset = offset + rawItemCount`；`total` 取 `total/list_count/total_count/count` 第一个有限值 | `:526-544` |
| 整表读回再切片 | 排行（`user_listen` 一次给全表）：`slice(offset, offset+limit)` | `:727-730` |
| 按页号翻 | 专辑/歌单搜索：`nextOffset = page * limit`，整页空则 `hasMore=false` | `:937` |

`limit` 会被夹到 1..100（`KUGOU_MAX_PAGE_SIZE`，`:361`），专辑曲目夹到 ≤30（`:1782`）。唯一用字符串游标的能力族是 `explore@1`（`getFeed(cursor?)`，`contract.ts:1104-1141`），**酷狗不实现**。

### 3.3 `search@1`（`kugouProvider.ts:1268-1304`）

| 成员 | 入参 | 返回 | KuGou 请求 | 行号 |
|---|---|---|---|---|
| `access` | —（值，不是函数） | 固定 `'account'` | — | `:1269` |
| `searchSongs(query, limit, offset, context?)` | 关键词、limit、offset；`context.session` 未使用 | `FoliumSourcePage<FoliumSourceSong>` | 已登录：`search {keywords, keyword, type:'song', page, pagesize:limit}`；未登录或首屏空：`anonymousSearch` | `:1270-1301` |
| `searchAlbums(query, limit, offset)` | 同上 | `FoliumSourcePage<FoliumSourceCollection>`（`type:'album'`） | `search {type:'album'}` | `:1302`、`:913-938` |
| `searchPlaylists(query, limit, offset)` | 同上 | `FoliumSourcePage<FoliumSourceCollection>`（`type:'playlist'`） | `search {type:'special'}` | `:1303`、`:921-929` |

行为要点：

- `access: 'account'` 的注释说得很直白：搜索本身不需要账号，但联合搜索源只在登录后才列它（`:1266-1267`）——**插件若照搬，要注意这块语义**。
- 首页带凭据搜索为空 → 记住关键词并在后续页直接走匿名（`:1275-1277`、`:940-952`）；首页空时先退回匿名重试，匿名有进展才采用（`:1281-1290`）。
- 匿名查询词先过 `buildKugouLyricSearchQuery`：只取 `歌名 - 歌手` 结构里的歌名（`:242-250`、`:955`）。
- 匿名请求由 transport 拼：`buildKugouAnonymousSearch(keyword, page, pagesize, md5)`（`core/kugouRequests.ts:20-64`），签名 = `md5(salt + 按键名排序的 k=v 串 + salt)`，固定 `appid=3116`、`clientver=11070`、`platform=AndroidFilter`（`:29-49`）。
- 搜索结果按 hash 去重保序（`:554-564`）。

### 3.4 `songs@1`（`kugouProvider.ts:1305-1313`）

| 成员 | 入参 | 返回 | 请求 | 行号 |
|---|---|---|---|---|
| `metadataMatch` | —（值） | `true`：本地歌的元数据匹配会让它被搜索（`contract.ts:509-513`） | — | `:1307` |
| `getSong(id)` | hash | `FoliumSourceSong \| null` | `audio {hash:id}`；取 `listOf()[0]`，hash 为空给 null | `:1308-1312` |

未实现：`getSongs`、`songsPerRequest`、`getAvailability`、`getReplacement`、`getPlayedSong`、`getPageUrl`、`counterpartSources`、`getCounterparts`。

### 3.5 `playback.audio@1`（`kugouProvider.ts:1314-1566`）

只有一个成员：`getAudioSource(song, quality)` → `Promise<FoliumSourceAudio \| null>`（`:1315`）。`FoliumSourceAudio` 的字段定义在 `contract.ts:550-563`；酷狗只产出 `url`、`quality`、`replayGain`（`trackGain`/`trackPeak`）、`preview`，**从不设 `expiresAt` 和 `clipStartMs`**。

没有 `audioQualityLevels` → 宿主按默认「除 `ultra` 外全部」（`contract.ts:569-570`）；但代码接受 `ultra` 并降级（`:570-577`）。音质映射与降级表：

| 宿主音质 | 请求参数 `quality`（`:566-568`） | 降级链（`:570-577`） | 排名（`:581`） |
|---|---|---|---|
| `standard` | `128` | standard | 0 |
| `high` | `320` | high → standard | 1 |
| `ultra` | `320` | high → standard（**从不对酷狗发 ultra**） | 1 |
| `lossless` | `flac` | lossless → high → standard | 2 |
| `hires` | `high` | hires → lossless → high → standard | 3 |

取地址顺序（严格按代码）：

1. **`song_url_new`（VIP 特权地址）**，仅在 `!isCloud && transport.hasVipSession()` 时（`:1347-1387`）：参数 `hash`（小写）、`album_id`、`album_audio_id`；答 `data[0].url \| play_url` 可以是数组，数组下标对应 `['standard','high','lossless','hires']`（`:583`、`:1356-1363`）；只有 `priv_status > 0` 才算拿到（`:1365-1367`）；`fail_process` 有值或文件 < 200 KB 视为试听（`:632-636`）；`kgm/kgma/vpr/mflac/mgg` 加密容器跳过（`:647-654`）。失败只记日志，不影响后续（`:1382-1386`）。
2. **`song_url` × 音质降级 × 请求变体**（`:1390-1492`）：每个候选音质先发带 `album_id`/`album_audio_id` 的 `metadata` 变体，再发只带 hash 的 `hash-only` 变体（仅当有 album id 时，`:1399-1411`；注释解释搜索元数据里的专辑 id 可能不属于这个 hash，`:1413`）。云盘歌只发 `user_cloud_url {hash, id: data.fileId}`（`:1394-1397`）。
   - `auth-required` 立刻结束（换音质也一样被拒，`:1466-1469`）；`local-service-stopped`、`not-configured`、429、带 `retryAfterMs` 的不再继续（`:1480-1485`）；超时（`isKugouTimeout`，`core/kugouFailure.ts:30-35`）只停 `/song/url` 链（`:1486-1489`）。
3. **收藏页上下文**：`song_url {…, ppage_id:'356753938'}`，只在 electron 且链未停时（`:1499-1521`）。注释说明 `ppage_id` 只有 lite 平台读（`:1496-1498`）。
4. **`legacyPlayInfo(hash)`**：旧手机接口 `https://m.kugou.com/app/i/getSongInfo.php`（`core/kugouRequests.ts:70-80`），取 `url` 或 `backup_url`，音质固定 `standard`（`:1526-1556`）。
5. **只剩试听**：返回 `{...previewSource, preview:true}`（`:1559`）。
6. **都没有**：有酷狗答复就 `kugouNoUrlError`（`not-playable`，`cause` 带 `status`/`errorCode`/`signedOut`，`core/kugouFailure.ts:84-92`），否则抛第一个失败（`:1561-1564`）。

地址改写 `kugouPlaybackUrl(url, runtime)`（`:71-81`）：web 下把 `http://fs.*.kugou.com` 升成 https（混合内容），electron 原样。`actualKugouQuality` 从 `quality`/`fileSize`+`timeLength`/`bitRate`/`extName` 反推真实音质（`:591-612`）；ReplayGain 取 `volume`（dB）与 `volume_peak`（dB→线性峰值，`:614-623`、`:2053-2056`）。

### 3.6 `lyrics@1`（`kugouProvider.ts:1567-1573`）

| 成员 | 入参 | 返回 | 请求 | 行号 |
|---|---|---|---|---|
| `crossSource` | — | `{ name: env.text('name.lyrics') }`；没设 `linesOnly`（有副歌段） | — | `:1569` |
| `getLyrics(song, context?)` | song（`context.userId` 未用） | `FoliumSourceLyricsResult \| null`：`{ main:{format:'krc',text}, wordByWord:同一个, isPureMusic?, chorusRanges? }` | `search_lyric {hash,duration,man:'no',album_audio_id?}` → `lyric {id,accesskey,fmt:'krc',decode:true}` →（有定时行时）`song_climax {hash}` | `:999-1021` |
| `getChorusRanges(songId)` | hash（trim + 大写） | `Array<{startTime,endTime}>`（**秒**，上游毫秒 ÷1000） | `song_climax {hash}`，Promise 级缓存 | `:966-981`、`:664-674` |
| `getSearchAlias(song)` | song | `{title: data.originalName, artist: 歌手名逗号连接, album?} \| null` | 无 | `:1024-1032` |

- 纯音乐：`env.isPureMusicText(text)` 为真 → 返回两轨 + `isPureMusic: true`（`:1015`）。
- 只有标签、没有 `[start,duration]` 定时行（`KRC_TIMED_LINE`，`:239`）→ 返回两轨但**不请求副歌**（`:1016-1018`）。
- 候选歌词的 `album_audio_id` 取 `data.albumAudioId ?? mixSongId ?? catalogLookupId`（`:984-986`）。
- 未实现：`prefersOwnWordByWord`、`songIdOf`（→ 跨源歌词只能靠搜索匹配，不能只凭 id 取）。

### 3.7 `auth@1`（`kugouProvider.ts:1574-1638`）

| 成员 | 入参 | 返回 | 请求 | 行号 |
|---|---|---|---|---|
| `getLoginTexts()` | —（同步） | `{title: env.text('login.title'), note: env.text('login.note')}` | 无 | `:1575` |
| `getLoginStatus()` | — | `FoliumSourceUser \| null`（`id`+`nickname` 都有才算登录） | `user_detail {userid?}`；随后 `user_vip_detail {userid}`；概念版可能 `youth_union_vip`/`youth_day_vip`/`youth_day_vip_upgrade` | `:1576-1611`、`:844-856`、`:858-907` |
| `logout()` | — | `Promise<void>` | 先发 `logout`（失败吞掉），再 `transport.forgetAccount()` 清缓存 | `:1248-1255` |
| `signInRanOut` | = `logout` | | | `:1614` |
| `showsKeptAccountAtStart` | `true` | | | `:1615` |
| `startLogin(methodId?)` | 忽略 `methodId` | `Promise<string>`（登录 key = `qrcode/qrkey/key/ticket`） | `login_qr_key` | `:1616-1620` |
| `createQr(key)` | key | 图片 URL 或 data URL（`base64/qrimg/qrcode/url`） | `login_qr_create {key, qrimg:true}` | `:1621-1625` |
| `checkLogin(key)` | key | `FoliumSourceLoginState`：`0→expired`、`1→waiting`、`2/3→scanned`、`4` 或带 `data.token` → `confirmed`、其它 → `error` + `failure` | `login_qr_check {key, qrcode:key}` | `:1626-1636` |
| `describeLoginFailure(step, error)` | step、error | `FoliumSourceLoginFailure \| null`（TypeError→unreachable；`api=unloaded`→local-service-unavailable；`not-configured`→unknown） | 无 | `:1637`、`core/kugouLoginFailure.ts:8-22` |

- **未实现**：`getLoginMethods`、`resolveLoginMethods`、`getLoginForm`、`submitLoginForm`、`openLoginPage`、`opensLoginPageItself`、`cancelLogin`、`getLoginTtlMs`、`getLoginDiagnostics`、`canRunLoginSelfCheck`、`runLoginSelfCheck`、`checkAfterLogin`、`getSetup`、`runSetupAction`、`oldKeptAccount`、`forgetOldKeptAccount`、`localService` → 插件侧登录 UI 只有**扫码一条路**，登录有效期由宿主默认值决定（`contract.ts:942-995` 里这些全是可选项）。
- 概念版会员每日领取在**读账号时**做（`:1588`）：`youth_union_vip` 不是 VIP 才 `youth_day_vip`（`receive_day` 用 Asia/Shanghai 的日期，`:430-439`）再 `youth_day_vip_upgrade`；任一步失败只记日志（`:858-907`）。
- `login_qr_check` 回来 `status` 不在 0..4 时，`kugouCheckFailure(status, message)` 把酷狗的原码与原话交出去（`core/kugouLoginFailure.ts:20-22`）。

### 3.8 `library@1`（`kugouProvider.ts:1639-1696`）

| 成员 | 入参 | 返回 | 请求 | 行号 |
|---|---|---|---|---|
| `getUserPlaylists(userId, limit, offset)` | limit 夹 1..100 | `FoliumSourcePage<collection>`（只留 `type=playlist`；自建歌单没封面时补最近一首的封面） | `user_playlist {userid,page,pagesize}`（+ 可能 `playlist_track_all {id,page:1,pagesize:1}`） | `:1640-1654`、`:1160-1173` |
| `getUserAlbums(userId, limit, offset)` | 同上 | `page<collection>`（`type=album`） | 同一次 `user_playlist`，按 `source===2` 或 `musiclib_id` 区分 | `:1655-1664`、`:504-509` |
| `getLikedSongIds(userId)` | — | `{ ids: string[], whole: true }` | `user_playlist` 找「我喜欢」→ `playlist_track_all {id:globalCollectionId, page, pagesize:100}` 读完（≤200 页，读不完抛错） | `:1665-1673`、`:1093-1157` |
| `getLikedSongCount(userId)` | — | `number \| null`（歌单卡上的 count，不是读到的行数） | `user_playlist` | `:1677-1680` |
| `getCloudCollection(user?)` | — | 固定 `{id:'cloud', name: env.translate('cloud.name'), type:'cloud', coverUrl?:user.avatarUrl}` | **无请求** | `:1682-1687` |
| `getListeningRankCollections(user)` | — | 0~2 个 `type:'listening_rank'`，id 形如 `listening-rank-<week\|all>-<user.id>` | `user_listen {userid, type:0\|1}` ×2 | `:1688-1695`、`:1216-1245` |

未实现：`getSongLikeId`、`areSongsLiked`。

### 3.9 `catalog@1`（`kugouProvider.ts:1697-1829`）

| 成员 | 入参 | 返回 | 请求 | 行号 |
|---|---|---|---|---|
| `canResolveSongCatalogRefs(song)` | song | `boolean`（`data.catalogLookupId` 非空） | 无 | `:1698` |
| `resolveSongCatalogRefs(song)` | song | 补好专辑/歌手 id 的 song（**KRM 元数据的 hash 必须与歌相符**才采纳） | `krm_audio {album_audio_id, fields:'album_info,authors.base,base,audio_info'}`，按 lookupId 做 Promise 缓存 | `:1699`、`:785-842` |
| `getPlaylistTracks(id, limit, offset, collection?)` | limit≤100 | `page<song>`（推荐卡虚拟歌单走内存切片） | `playlist_track_all {id,pagesize,page}` | `:1700-1707`、`:766-783` |
| `getListeningRankTracks(range, limit, offset, collection?)` | range `'week'\|'all'` | `page<song>`，每行带 `row.listenCount` | `user_listen`（整表读回再切片） | `:1708-1710` |
| `getCloudTracks(limit, offset, collection?)` | — | `page<song>`，`variant:'cloud'` | `user_cloud {userid?,page,pagesize}` | `:1711-1720` |
| `getPlaylistDetail(id, collection?)` | — | `collection \| null`（与传入的 collection 合并兜底） | `playlist_detail {ids:id}` | `:1721-1749` |
| `getAlbumDetail(id, collection?)` | — | `collection \| null` | `album_detail {id}` | `:1750-1780`、`:1044-1049` |
| `getAlbumTracks(id, limit=30, offset=0, collection?)` | limit 夹 ≤30 | `page<song>`（专辑名缺失时用 collection.name 补） | `album_songs {id,page,pagesize}` | `:1781-1797` |
| `getArtistSongs(id, limit, offset)` | — | `page<song>` | `artist_audios {id,page,pagesize}` | `:1798-1801` |
| `getArtistAlbums(id, limit, offset)` | — | `page<collection>` | `artist_albums {id,page,pagesize}` | `:1802-1808` |
| `getArtistDetail(id)` | — | `collection`（`type:'artist'`） | `artist_detail {id}` | `:1809-1813` |
| `getSubscriptionStatus(type, id, collection?)` | type `playlist\|album` | `boolean`（读一次账号歌单前 100 条比对） | `user_playlist {userid,page:1,pagesize:100}` | `:1814-1828` |

### 3.10 `recommendations@1`（`kugouProvider.ts:1830-1888`）

| 成员 | 入参 | 返回 | 请求 | 行号 |
|---|---|---|---|---|
| `getDailySongs(refresh?)` | `refresh` 未使用 | `song[]` | `everyday_recommend` | `:1831-1834` |
| `getPersonalFm(options?)` | options 未使用 | `song[]` | `personal_fm` | `:1835-1838` |
| `getRecommendedCollections(limit)` | limit 夹 1..30 | `collection[]`（6 张推荐卡各作虚拟歌单，id `kugou-card-<卡id>`，`data.virtualRecommendation:true` + `data.cardId`） | `top_card_youth {card_id,pagesize}` ×6（单卡失败只记日志） | `:1839-1854`、`:362-404` |
| `getHistoryEntries()` | — | `[{id,label,data:{date,historyName}}]` | `everyday_history {mode:'list'}` | `:1855-1859`、`:1185-1198` |
| `getHistoryDates()` | — | `string[]`（`data.date` 或 id） | 同上 | `:1860-1866` |
| `getHistorySongs(entry)` | entry 对象或日期字符串 | `song[]` | `everyday_history {mode:'song', date, history_name}` | `:1867-1878`、`:1201-1208` |
| `dislikeSong(id)` | hash | `{ replacement? }` | `personal_fm {action:'garbage', hash:id, songid:id}` | `:1879-1887` |

未实现：`personalFmModes`、`getPersonalFmCatalog`、`getDailyStyleGroups`、`getDailyStyleSongs`、`setDailyStyle`、`preferenceEntries`、`getRecommendationPreferences`、`saveRecommendationPreferences` → 宿主不会给酷狗出电台模式选择、日推风格筛选与推荐偏好。

### 3.11 `mutations@1`（`kugouProvider.ts:1889-2038`）

| 成员 | 入参 | 返回 | 请求 | 行号 |
|---|---|---|---|---|
| `canAddToPlaylist(playlist)` | collection | `boolean`：`type==='playlist' && isOwned===true && data.listId !== '2' && name 不是「我喜欢/我喜欢的音乐」` | 无 | `:1890`、`:517-523` |
| `likeSong(song, liked)` | song 或 id | `Promise<void>` | 加：`playlist_tracks_add {listid, data:'标题\|HASH\|albumId\|mixSongId'}`；删：`playlist_tracks_del {listid, fileids}` | `:1891-1973`、`:690-698` |
| `updatePlaylistTracks('add'\|'del', playlist, tracks)` | | `Promise<void>` | 加：`playlist_tracks_add {listid, data: tracks 逗号连接}`；删：`playlist_tracks_del {listid, fileids: 逗号连接}` | `:1974-1986` |
| `subscribePlaylist(playlist, subscribed)` | | `Promise<void>`（虚拟推荐卡直接 return） | 取消：`playlist_del {listid}`；收藏：`playlist_add {name,type:1,source:1,list_create_userid,list_create_listid,list_create_gid}` | `:1987-2005` |
| `subscribeAlbum(id, subscribed)` | | `Promise<void>`（未登录直接 return） | 取消：`user_playlist` 查行号 → `playlist_del`；收藏：`album_detail` → `playlist_add {source:2,...}` | `:2006-2037` |

`likeSong` 的两个坑（代码注释明确写了，移植时必须保留）：

- **不能静默 return**：没有 userId 要抛 `auth-required`，否则 omni 会当成功并翻转红心（`:1894-1897`）。
- **fileid 是歌单内行号**，只在「我喜欢」这个歌单里有效；缓存里没有就强制重读一次，仍没有则视为目标状态已达成并 return（`:1947-1966`）。

未实现：`canEditPlaylistTracks`、`createPlaylist`、`canSubscribe`。

### 3.12 `covers@1`（`core/kugouCovers.ts:37-43`，在 `kugouProvider.ts:2039` 挂上）

| 成员 | 返回 | 说明 |
|---|---|---|
| `hosts` | `['kugou.com','*.kugou.com','kgimg.com','*.kgimg.com']`（`:11`） | 宿主只对这几个主机的 URL 问下面四个 |
| `sized(url, size)` | 换过尺寸的 URL 或 `null` | 路径里的 `/(stdmusic\|soft/collection)/<数字>/` 换成 size（`:8`、`:17-20`） |
| `identity(url)` | 形如 `kugou:/stdmusic/*/xxx.jpg` 或 `null` | 两张 URL 同一张图 → 同一个 identity |
| `original(url)` | 恒 `null` | 酷狗没有「原图」写法 |
| `requestedSize(url)` | 数字 / `null` / `undefined` | 从路径数字读；不是酷狗的图给 `undefined` |

封面 URL 还可能在 `kugouProvider.ts:111-126` 被归一：`{size}` 占位符替换成 1024，`12345678_xxx.jpg` 这种没有目录的补成 `https://c1.kgimg.com/stdmusic/1024/<前 8 位>/<文件名>`。

---

## 4. bridge：`createKugouApiBridge`

`sources/kugou/main/kugouApiBridge.cjs`（625 行，CJS）是主进程里唯一直接碰 KuGouMusicApi 的地方。它只 `require('crypto')`（`:1`），**不 require Electron**，所以理论上可以在纯 Node Host 里跑——前提是有人把 `safeStorage` 塞给它。

### 4.1 入参（`:284-290`）

| 参数 | 类型 | 语义 |
|---|---|---|
| `store` | `{ get(key), set(key, value), delete?(key) }`（`main/kugouApiBridge.d.cts:13-17`） | 会话存放处；上游是 `api.legacy.store`（`main/index.ts:63`） |
| `safeStorage` | `{ isEncryptionAvailable(), encryptString(text) => Buffer, decryptString(Buffer) => string, getSelectedStorageBackend?() }`（`d.cts:5-10`） | 上游由 `api.seal` 包出来（`main/index.ts:24-28`） |
| `platform` | `string`，默认 `process.platform`（`:287`） | 只用来判断 Linux 的 `basic_text` 后端（`:19-24`） |
| `warn` | `(...args) => void`，默认 `console.warn`（`:288`） | 会话相关日志都走它 |
| `apiLoader` | `() => Record<string, unknown>`（`:289`、`d.cts:36-37`） | 返回已加载的 KuGouMusicApi；没加载时抛 |

### 4.2 返回对象（`:591-616`）

| 成员 | 签名 | 语义 |
|---|---|---|
| `getStatus()` | `() => { available: boolean; authenticated: boolean; error: string \| null }`（`:592-608`） | 跑一次 `ensureCookies()` 与 `loadApi()`；`authenticated = Boolean(cookies.token && (cookies.userid \|\| cookies.user_id))` |
| `request(operation, params?)` | `(string, Record<string, unknown>) => Promise<unknown>`（`:609-615`） | 走 `performRequest`；任何失败都先过 `normalizeBridgeError(operation, error, error === loadError)` |

模块导出（`:619-625`）：`LEGACY_SESSION_KEY`、`SESSION_KEY`、`createKugouApiBridge`、`normalizeBridgeError`、`OPERATION_MODULES`。

### 4.3 支持的 operation（`OPERATION_MODULES`，`:53-91`，共 37 个）

值是该 operation 在包里的**候选模块名数组**，取第一个 `typeof === 'function'` 的（`:423-428`）；找不到 → 抛 `KuGouMusicApi module is unavailable: <op>`（`:428`），operation 不在表里 → 抛 `Unsupported KuGou operation: <op>`（`:426`、`:547`）。

| 分组 | operation | 模块名 |
|---|---|---|
| 设备/登录 | `register_dev` | `register_dev` |
| | `login_qr_key` / `login_qr_create` / `login_qr_check` | 同名 |
| | `logout` | **空数组**（在 `performRequest` 里特判，见 4.4） |
| 账号 | `user_detail` / `user_vip_detail` | 同名 |
| | `youth_union_vip` / `youth_day_vip` / `youth_day_vip_upgrade` | 同名 |
| 搜索 | `search` | `search` |
| 歌曲 | `audio` / `krm_audio` | 同名 |
| 取地址 | `song_url` / `song_url_new` | 同名 |
| 歌词 | `search_lyric` / `lyric` / `song_climax` | 同名 |
| 歌单 | `user_playlist` | `user_playlist` |
| | `playlist_track_all` | `['playlist_track_all', 'playlist_track_all_new']`（两个候选） |
| | `playlist_detail` / `playlist_add` / `playlist_del` / `playlist_tracks_add` / `playlist_tracks_del` | 同名 |
| 云盘 | `user_cloud` / `user_cloud_url` | 同名 |
| 排行 | `user_listen` | `user_listen` |
| 专辑/歌手 | `album_detail` / `album_songs` / `artist_detail` / `artist_albums` / `artist_audios` | 同名 |
| 推荐 | `everyday_recommend` / `everyday_history` / `personal_fm` / `top_card_youth` | 同名 |

客户端侧的同一份 allowlist 在 `core/kugouTransport.ts:15-24`（`KUGOU_OPERATIONS`），URL 表 `ENDPOINTS` 在 `:35-73`，两者也是 37 项且一一对应。**两处必须同时改**，否则 client 发的 op 桥不认（或反之）。

### 4.4 答复信封

调用链：client `env.call('request', op, params)` → main `api.rpc.handle('request')` → `bridge.request` → `performRequest`。

1. **成功**：`{ ok: true, data }`（`main/index.ts:71-80`），`data` 是包返回的 `body`（`bridge:379-404`、`:588`）。`cookie` 数组**不出主进程**，只在桥里并入会话（`:379-404`）。
2. **这几个 op 的 `data` 被改过**：
   - `logout` → 不调包，直接 `{ code: 200 }`，同时 `sessionGeneration++`、去掉账号类 cookie、`persistence.clear()`、`keepStored=false`（`:548-557`）。
   - `user_detail` → 会话里有 userid 时把 `body.data.userid` 改写成会话里的（`:584-588`）。
   - `login_qr_check` / `register_dev` → `sanitizeRendererBody` 从 `body` 与 `body.data` 剔掉 `token`、`vip_token`、`dfid`、`cookie`（`:409-421`）。
   - `song_url_new` 没有 `vip_token` → 不调包，直接 `{ status: 0, data: null, vip_credential: false }`（`:564-578`）。
   - `user_detail` 且 `keepStored && !token`（盘上有会话但本次读不出来）→ 抛 `sessionUnreadable`，最终写成 `session=unreadable`（`:560-562`、`:275`）。
3. **失败**：`{ ok: false, message }`（`main/index.ts:76-79`），`message` 是 `normalizeBridgeError` 造的一行：

   ```text
   KuGouApi[operation=<op> status=<http-like> error_code=<err> api=unloaded session=unreadable]: <detail≤160>
   ```

   字段按需出现（`:271-275`），`name` 是 `KuGouApiError`，detail 里**不带 Cookie**（`:233-243`）；原答复对象故意不挂在 Error 上（`:245-255` 注释：它带 cookie）。client 用正则 `KuGouApi\[([^\]]*)\](?::\s*(.*))?` 读回（`core/kugouTransport.ts:92`、`:116-137`）。
4. **设备校验重试**：非 `register_dev` 的请求答 `errcode === 20028` 或含「本次请求需要验证」时，强制 `register_dev` 一次再重发（`:225-229`、`:580-583`）。

### 4.5 会话存储键与加密流程

| 键 | 值 | 位置 |
|---|---|---|
| `KUGOU_API_SESSION_V1` | **旧的明文** cookie 对象（升级来的登录） | `:36` |
| `KUGOU_API_SESSION_V2` | `safeStorage.encryptString(JSON.stringify({ version: 2, cookies }))` 的 base64 | `:37-38`、`:167-177` |

流程：

- **可用性判断** `assertEncryptionAvailable`（`:12-25`）：safeStorage 存在 + `isEncryptionAvailable()` 为真 + Linux 下 `getSelectedStorageBackend() !== 'basic_text'`；任一不满足就认为**不能加密**。
- **首次加载是懒的**：`ensureCookies()`（`:307-318`）第一次被调时才 `persistence.load()`；拿不到就 `createDeviceCookies()` 现造一份设备身份；`keepStored = loaded.unreadable`。注释说明桥在 Electron ready 之前就构造好了，所以不能提前用 safeStorage（`:305-306`）。
- **load**（`:134-166`）：先 V2——解密失败且**当前不能加密**时记 `unreadable = true`（留给能加密的那次运行），能加密时的失败当作「没有存过」；再回落到 V1 明文：不能加密就**删掉** V1，能加密就暂留到 `save` 写成 V2 再删（早删会因一次写失败丢掉登录）。
- **save**（`:167-192`）：加密写 V2 后删 V1；写失败时——不能加密 → `removeStored()`（**只做一次**，`removedUnsealed` 防重复重写整个 store 文件）；能加密但写失败 → 盘上的留着给下次，除非是**另一个账号**的会话则删掉。
- **clear**（`:195-199`）：V1 与 V2 都删（登出时连读不出来的那份也不留）。
- **账号只在确认登录时写**：`login_qr_check` 且 `status === 4` 才 `adoptConfirmedSignIn`，且 token 与 userid 必须**成对**，否则整对不收（`:338-360`）；其它回答里的账号类 cookie 一律不收（`ACCOUNT_COOKIE_KEYS`，`:52`、`:371-377`、`:390-395`）。换号会扔掉上一号的 `vip_token`/`vip_type`/`t1`（`:342-345`）。
- **设备 cookie**（`createDeviceCookies`，`:204-216`）：`KUGOU_API_PLATFORM='lite'`、`GUID`=uuid 去横线大写、`MID`=`BigInt('0x'+md5(guid)).toString(10)`、`DEV`=5 字节随机大写 hex、`MAC`=6 字节冒号大写、`WEBGL`=`BigInt('0x'+8 字节随机大写 hex).toString(10)`。`dfid` 由 `register_dev` 发，缺就注册（`:525-544`）。
- **并发保护**：`sessionGeneration` 在登出时自增，请求中途变了就抛 `KuGou session changed during request`（`:430`、`:446`）；三个 `youth_*` op 若 `params.userid` 与会话账号不同，直接抛 `KuGou account changed during VIP operation`（`:432-435`）。

### 4.6 VIP 凭据续期时机

常量（`:39-48`）：

| 常量 | 值 | 含义 |
|---|---|---|
| `VIP_CREDENTIAL_MAX_AGE_MS` | 6 h | 续期成功（**给不给凭据都算**）后多久不再问 |
| `VIP_CREDENTIAL_REFUSED_RETRY_MS` | 10 min | 酷狗拒绝续期（status 0 / 带 error_code）后多久再问 |
| `VIP_CREDENTIAL_UNANSWERED_RETRY_MS` | 60 s | 没答（不可达、或 8 s 超时）后多久再问 |
| `VIP_CREDENTIAL_TIMEOUT_MS` | 8 s | 一次续期最多等多久 |

触发与等待（`:564-578`）：

- **只有 `song_url_new` 会触发续期**，没有定时器：每次运行**第一次用到时续一次**，之后按 6 h（`vipCredentialChecked = { token, until }`，`:295-297`、`:470`、`:498`）。
- 已有 `vip_token` 时**边用边续**，播放不等：`if (!ensureCookies().vip_token) await vipCredentialPromise`（`:573-574`）。
- 还没有凭据时才等，最多 8 s（`:476-481`）；拿不到凭据就**不去问酷狗**，直接回 `{ status: 0, data: null, vip_credential: false }`（`:575-577`）——注释说明这类账号在特权接口上也只有试听（`:574-575`）。
- 续期本身（`ensureVipCredential`，`:465-523`）：要 `token` + `userid` 都在；调包的 `login_token({ token, userid, cookie })`；失败只记日志、按 refused/unanswered 设 `until`，**不影响这次请求**（`:482-493`）；成功后校验「同一个会话对象、同一个 token、同一个 userid、`body.status === 1`、`data.userid` 相符」才写入（`:499-519`），`vip_type` 为 `'0'` 视为没有（`:518`）；答案里没有 `vip_token` 就把旧的删掉（`:456-459`）。
- 登出/换号：`sessionGeneration++` 与 `dropAccountCookies()` 会让进行中的续期结果作废（`:500`、`:548-557`）。

### 4.7 客户端侧对同一个信封的读法

`extractKugouFailureDetails`（`core/kugouTransport.ts:116-137`）把那一行拆成 `{operation, status, errorCode, detail, apiUnloaded, sessionUnreadable}`；`isKugouAuthFailure` 只认 `status ∈ {401,403}` 或 `errorCode === 152`（`:85-90`、`:140-143`）——注释明确说其它失败都是 502 且没有稳定的登录失效码（`:87-90`）。`toKugouProviderError` 据此给出 `auth-required` / `unavailable`（会话读不出来）/ `network`（`:153-167`）。

---

## 5. 依赖：`kugoumusicapi`

### 5.1 版本与钉法

| 位置 | 写的是什么 | 行号 |
|---|---|---|
| 模组自己的 `package.json` | `kugoumusicapi: https://github.com/MakcRe/KuGouMusicApi/archive/refs/tags/v1.6.0.tar.gz` | `sources/kugou/package.json:5-7` |
| 同上，声明装配方式 | `folia.dependencies.kugoumusicapi: asar` | `:8-12` |
| 上游根 `package.json` / `deploy/docker/kugou-api/package.json` | 同一个地址（README 说三处一起改） | `sources/kugou/README.md:9-11` |
| 本插件 `package.json` | 同一个地址（`dependencies`） | 仓库根 `package.json` 的 `dependencies.kugoumusicapi` |
| 本插件实际加载的副本 | `src/host/vendor/kugoumusicapi/`（`main.js`、`module/`、`util/`、`public/`、`server.js`，`package.json` 版本 1.6.0） | 本次实测 |

为什么是 `asar` 而不是普通依赖：包在加载时**扫自己的 `module/` 目录逐个 require**，要真实文件布局（`sources/kugou/package.json:4` 的 description）。

### 5.2 加载方式

- **桌面 main 入口**：第一次请求前设 `process.env.platform = 'lite'`，再 `await import('kugoumusicapi')`，然后 `loaded = { ...(module.default ?? {}), ...module }`（`main/index.ts:49-60`）。注释：包**在加载时**读这个变量（`:48`）。
- 因此**一个进程只能是一种平台**；同时要 `standard` 与 `lite` 就必须两个进程。插件的做法是两个 worker（`src/host/services/kugou-api.js:45-52` 的 `env: { ...process.env, platform }`，`:40-43` 的 `kugouPlatformOf`）。
- `main/index.ts` 里加载失败**不抛**，记在 `loadError`，之后每个请求答 `api=unloaded`（`:49-60`、`:65-69`），client 读成「本地服务没在跑」（`core/kugouFailure.ts:18-21`、`:109`）。
- 插件侧还有一条上游没有的补丁：`util/generate_simulate.js` 调 `generateWebGLHash` 却没 import，必须先从 `util/util` 取出来挂到 `globalThis` 再 require 包（`src/host/services/kugou-worker.js:26-34`）。

### 5.3 导出的形状

`main.js`（`src/host/vendor/kugoumusicapi/main.js`）全文的要点：

- `fs.readdirSync(module).reverse()` → 每个 `<名字>.js` 生成 `obj[名字] = (data = {}) => …`；字符串 `cookie` 自动转对象（`cookieToJson`），并注入 `createRequest` 工厂（懒 require，避免循环依赖）。
- 最终 `module.exports = { ...require('./server'), ...require('./util/request'), ...obj }`：**扁平对象**，键就是模块文件名。
- 本机副本实测 **168** 个 `module/*.js`（插件注释里的 171 是旧数字，`src/host/services/kugou-api.js:8`）；`login_token` 在（`module/login_token.js`）。
- 上游 `sources/kugou/main/deps.d.ts:4-7` 把它声明成 `const api: Record<string, unknown>; export default api;`，`main/index.ts:53-54` 同时兼容 `default` 与具名两种取法。
- source 模组能拿到的只有这个扁表，没有别的入口（`main/kugouApiBridge.d.cts:19-23`）。

---

## 6. 必须照抄 vs 必须适配

### 6.1 可以逐字节照抄（本次已核对 SHA256 相同）

| 上游文件 | 插件镜像 | 字节 |
|---|---|---|
| `sources/kugou/core/kugouProvider.ts` | `src/folia-mods/sources/kugou/core/kugouProvider.ts` | 114083 |
| `sources/kugou/core/kugouTransport.ts` | 同名 | 28946 |
| `sources/kugou/core/kugouRequests.ts` | 同名 | 3425 |
| `sources/kugou/core/kugouFailure.ts` | 同名 | 6942 |
| `sources/kugou/core/kugouLoginFailure.ts` | 同名 | 1449 |
| `sources/kugou/core/kugouCovers.ts` | 同名 | 2100 |
| `sources/kugou/core/index.ts` | 同名 | 2836 |
| `sources/kugou/client/index.ts` | 同名 | 1041 |
| `sources/kugou/main/index.ts` | 同名 | 6377 |
| `sources/kugou/main/kugouApiBridge.cjs` | 同名 | 32135 |
| `sources/kugou/main/kugouApiBridge.d.cts` | 同名 | 1569 |
| `sources/kugou/main/deps.d.ts` | 同名 | 227 |
| `sources/kugou/mod.json` / `package.json` / `README.md` | 同名 | 959 / 570 / 6024 |
| `sources/kugou/locales/{zh-CN,en,in,vi}.json` | 同名 | 各约 500 |
| `packages/folium-source-kit/` 全部 9 个文件（`package.json`、`README.md`、`tsconfig.json`、`src/{index,errorText,exploreReads,fmModes,krcDecrypt,loginRequestLimit}.ts`） | `src/folia-mods/packages/folium-source-kit/…` | 实测相同 |

理由：这些文件里只有 `import type`（编译期擦除）和两类真实 import——`@folia/folium`（纯类型）、`@folia/folium-source-kit`（`errorFields`、`withLoginRequestLimit`）。平台判定、签名、重试、降级、试听判据、行号语义全在里面，改一个字就是改写行为。

### 6.2 必须在插件侧替换实现（逐条给理由与落点）

| # | 上游依赖 | 为什么不能照搬 | 插件落点（记录时已存在 / 需要新建） |
|---|---|---|---|
| 1 | `import type … from '@folia/folium'`（`kugouProvider.ts:1-14`、`main/index.ts:2`、`kugouApiBridge.d.cts` 用 `declare module`） | 插件没有这个包，只有上游生成的 `mods/folium.d.ts`；且**必须写成 `import type`**，值导入会让运行时 require 一个不存在的模块 | TS 路径别名 → 镜像后的 `folium.d.ts`；适配层 `src/folia-adapters/kugou/host.ts` 等按此写（已有） |
| 2 | `@folia/folium-source-kit`（`kugouProvider.ts:15` 的 `errorFields`、`kugouTransport.ts:2` 的 `withLoginRequestLimit`） | 这是**运行时**依赖，必须真进 bundle；`loginRequestLimit` 还带模块级定时器集合 | 镜像到 `src/folia-mods/packages/folium-source-kit`；bundle 时别名指向它的 `src/index.ts`（`scripts/build-kugou-folia.mjs:22` 的 `KIT_INDEX` + `:31-36` 的别名插件已这么做） |
| 3 | `await import('kugoumusicapi')`（`main/index.ts:53`） | 上游靠 asar + 归档加载；插件的包在 `src/host/vendor/kugoumusicapi`，且插件是 ESM 包（`package.json` 的 type 为 module），要用 `createRequire` | `src/folia-adapters/kugou/host.ts` 提供 `apiLoader`；`src/host/services/kugou-worker.js:16-34` 是现成加载方式（含 `generateWebGLHash` 补丁） |
| 4 | `api.seal`（`FoliumSourceSeal`，`main/index.ts:24-28`） | 纯 Node Host **没有 OS 凭据库**；桥的加密语义（可用/不可用、失败降级、不可用就删盘上会话）必须如实模拟，否则要么「以为加密了其实明文」要么「静默丢登录」 | `src/folia-adapters/kugou/seal.ts` + `jsonFile.ts`（已有）；不能加密时**只能**走桥的内存分支（`kugouApiBridge.cjs:186-192`） |
| 5 | `api.legacy.store`（`bridge:101-201` 只用 `get/set/delete`） | 上游这个 store 只放行受信表/`claims` 登记过的键（`mods/folium.d.ts:4444-4447`）；插件必须有等价白名单，否则任意键可写 | `src/folia-adapters/kugou/legacyStore.ts`（已有） |
| 6 | `api.rpc.handle('request' / 'anonymousSearch' / 'legacyPlayInfo')`（`main/index.ts:71-101`） | 插件是 HTTP（`/music/*`），没有 Electron IPC；且结果必须可 JSON 化（`mods/folium.d.ts:4346-4352`） | `src/folia-adapters/kugou/rpc.ts`（已有）+ Host 路由；三个通道的参数校验要照抄（关键词 ≤200、page ≤10000、hash 正则） |
| 7 | `api.net.fetch(url, { method:'GET', headers, credentials:'omit' })`（`main/index.ts:82-89`） | Node fetch 没有 `credentials` 语义；上游 source 档默认 **15 s 超时、无 body 上限**（`foliumShared.json` `limits.source.netFetch`），要自己设；`fs.youthandroid2.kugou.com` 证书名不对，Node 会直接 reject | Host 出网层 + 清单里 `certificateExceptions` 的等价物；接口与媒体分开（接口走默认校验，媒体才放宽） |
| 8 | `api.media.allow({ hosts:['kugou.com','*.kugou.com'] })`（`main/index.ts:43`） | 那是 Electron 的跨域头注入；插件播放器直接吃 URL，媒体走 Host 代理/直连，要的是**媒体下载白名单**而不是 CORS 头 | 映射到插件现有媒体白名单（`src/host/http/` 的 URL 安全层），不要引入 Electron webRequest |
| 9 | `folium.sources.register/pageStore/error`、`folium.i18n.key/text`、`folium.lyrics.isPureMusicText`、`folium.rpc.call`、`folium.modId`（`client/index.ts:9-18`） | 插件 client 是浏览器片段，没有 Folium 模组运行时；这 8 个成员要自己拼（`pageStore` 必须**同步**、按 source id 隔离） | `src/folia-adapters/kugou/{pageStore,texts,errors,rpc}.ts`（已有）；`texts.ts` 读 `locales/` 那 4 个 JSON |
| 10 | `mod.json` 的语言表（`locales/`） | 插件 i18n 是 zh/en 两份，且 `env.text/translate` 返回的键必须能解析出文案，否则界面出现空字符串 | `src/folia-adapters/kugou/texts.ts`（已有）+ 插件 i18n；至少 zh-CN 与 en，`in`/`vi` 可留可去 |
| 11 | 网页分支 `createWebKugouTransport`（`core/kugouTransport.ts:379-553`） | 浏览器直连 `VITE_KUGOU_API_BASE`，违反插件「Client 只消费 Host HTTP」的分工；还要 md5 + 歌词代理 | 不传 `env.web` 即可整段不执行；以后要网页形态也应改成经 Host 的 transport |
| 12 | 编译链 | 插件 Host 是纯 JS（`package.json` 的 `files` 只有 `src/host/**/*.js` 等），`src/folia-mods/**` 是 TS 且不进包；`.cjs` 后缀正好保持 CJS | `scripts/build-kugou-folia.mjs` 产出 `src/host/vendor/kugou-folia/source.bundle.mjs`（已有，记录时 151396 B），由 `package.json` 的 `files` 发布 |

### 6.3 一句话判据

`src/folia-mods/**` 与上游 `diff` 起来应该只剩路径（本来就该逐字节相同）；所有差异都应出现在 `src/folia-adapters/kugou/**`、`src/folia-build/**`、`src/host/vendor/**` 与 `scripts/build-kugou-folia.mjs` 里。若在 `src/folia-mods/sources/kugou/**` 里看到改动，那是改写，不是移植。

---

## 7. 记录时的未解点与验收建议

### 7.1 未解点（需要负责人拍板，不是从上游能读出来的）

1. **`api.seal` 的等价策略**：插件 Host 没有 OS 凭据库。桥支持「不能加密就只留内存」（`kugouApiBridge.cjs:186-192`），代价是每次启动都要重新扫码；也可以自管密钥做可逆加密，但那不是 OS 级保护。两条路的用户可见差别很大，需要明确选一个。
2. **`certificateExceptions` 的口径**：只对媒体主机放宽，还是全部？上游只对一个主机放宽 `ERR_CERT_COMMON_NAME_INVALID`（`sources/kugou/mod.json:32`）。
3. **`access: 'account'` 的联搜语义**（`kugouProvider.ts:1266-1269`）：未登录时是否也把酷狗从搜索列表里藏起来，要和 `A_other/docs/在线平台对齐清单.md` 的口径对齐。
4. **`reports@1` 没有实现**：酷狗不做播放上报，播放统计只能留在本地，不要接线到这家。
5. **`folium.d.ts` 放哪**：模组自己的 `deps.d.ts` 只声明 `kugoumusicapi`；`@folia/folium` 的类型只能来自别名。别名指向的 d.ts 要不要镜像进 `src/folia-mods/mods/`，按 AGENTS.md 的「上游 src/ 以外的树」规则判断（`mods/` 与 `sources/`、`packages/` 同级）。

### 7.2 验收该看什么（照上游自己的测法）

`sources/kugou/README.md:33-36` 列了上游的四层测试与手测假网络：桥用替身包、main 入口测接到 `api.*` 的那一层、transport/provider 经注册着的模组跑并用替身代替请求、手测用 `test/manual/fakeSourceNetwork/kugou.mjs`。移植后的最小验收：

1. `getAudioSource` 的五段降级各命中一次（`song_url_new` 有/无凭据、`song_url` 降级、`ppage_id` 分支、`legacyPlayInfo`、只剩试听）；
2. `searchSongs` 的「首页带凭据为空 → 匿名」，以及后续页继续匿名；
3. `checkLogin` 的 0/1/2/3/4 五态（`kugouProvider.ts:1629-1636`）；
4. `likeSong` 的三条路：有缓存行号 / 无行号重读 / 服务端本来就没有（`:1891-1973`）；
5. 桥的 `session=unreadable` 与 `api=unloaded` 在界面上分别读成「账号未知」与「本地服务没跑」（`core/kugouFailure.ts:109`、`kugouTransport.ts:163`）。

---

## 附录：本文引用到的上游文件

```text
sources/kugou/mod.json                     能力声明与 certificateExceptions
sources/kugou/package.json                 kugoumusicapi v1.6.0 + asar
sources/kugou/README.md                    上游自述（用法、VIP、测试）
sources/kugou/locales/*.json               5 个 i18n 键的实际文案
sources/kugou/client/index.ts              client 入口：7 个 env 字段
sources/kugou/core/index.ts                createSource(env) 与 KugouSourceEnv
sources/kugou/core/kugouProvider.ts        10 个能力族的实现（2056 行）
sources/kugou/core/kugouTransport.ts       两条 transport、operation 表、错误映射
sources/kugou/core/kugouRequests.ts        匿名搜索与旧播放接口的地址/签名（纯函数）
sources/kugou/core/kugouFailure.ts         describeFailure 的事实表
sources/kugou/core/kugouLoginFailure.ts    登录失败的事实表
sources/kugou/core/kugouCovers.ts          covers@1
sources/kugou/main/index.ts                main 入口：api.* 接线 + 3 个 rpc 通道
sources/kugou/main/kugouApiBridge.cjs      会话/加密/operation 分发（625 行）
sources/kugou/main/kugouApiBridge.d.cts    bridge 的类型
sources/kugou/main/deps.d.ts               kugoumusicapi 的 module 声明
src/mods/folium/sources/contract.ts        能力族的公开契约（1213 行）
src/mods/folium/sources/capabilities.ts    宿主实现的版本表与必备成员
src/mods/folium/registries/sourceAdapter/parts.ts  从定义推导宿主能力开关
src/services/onlineMusic/web/foliumWebSource.ts    网页版如何自己拼 env 并注册
packages/folium-source-kit/src/*.ts        运行时共用纯函数
mods/folium.d.ts                           生成的公开类型（MainApi / ClientApi）
electron/modSystem/foliumShared.json       source 档的限额与能力版本（main 进程用）
electron/modSystem/modSystem.cjs           netFetch 与 certificateExceptions 的宿主侧
```



