# Changelog

## 未发布

### 在线音乐 · 酷狗

- 酷狗的实现从自研那套换成 **Folia 音源模组的原样移植**：`sources/kugou/**` 与 `packages/folium-source-kit/**` 逐字节镜像进 `folia/`，宿主面（rpc / 网络 / 会话存储 / 加密封装 / 文案表）由 `src/folia-adapters/kugou/` 提供，用 `node scripts/build-kugou-folia.mjs` 打成 `src/host/vendor/kugou-folia/source.bundle.mjs`。上游的 provider、请求签名、VIP 凭据续期、取流五段降级、歌词与歌单逻辑一行没改。
- 上游依赖 KuGouMusicApi v1.6.0 改用仓库里已 vendor 的同一份（与上游 tarball 逐字节相同），不再从 GitHub 安装。
- 门面（`providers/index.js`）40 个酷狗方法改为委派给移植源；客户端与已存的歌、歌单、历史 id 仍是 `kugouLite`。
- 行为变化：设备身份与登录态由移植源自己管（加密存在插件数据目录）；`/online/quality`、`/online/check-playable` 不再因为「lite 没补设备」而恒报不可播；副歌区间如实给出；推荐歌单来自上游的推荐卡。播放上报（reports）上游未实现，仍不上报。
- 旧的酷狗实现（自研标准版 / 概念版两个模块、本地 worker、会话与 cookie 管理、对应的 5 个测试）已删除；门面里只保留一行行委派，酷狗的一切平台细节都在 `folia/sources/kugou/`。

### 在线音乐 · 波点 / 汽水 / QQ / 网易云

- 四个平台与酷狗同一套做法：上游 `sources/<平台>/**` **逐字节镜像**进 `folia/sources/`（波点 24、汽水 26、QQ 45、网易云 35 个文件，SHA256 与上游全等），插件侧只写宿主面（`src/folia-adapters/source-host/`：seal、legacy store、pageStore、rpc、errors、文案表、net、media，加上 QQ/网易云要的 `rpc.send`、`paths.legacy`、`diagnostics`、`onBeforeUnload/onBeforeQuit`、`reportError` 与 `@folia/source-deps` 替身），再用 `scripts/build-folia-source.mjs` 打成各自 bundle（`src/host/vendor/<平台>-folia/`，网易云连 11 个工作线程用的 `.cjs` 一起核对）。
- 四个平台的「定义 → 本插件源对象」由一份共用映射 `src/host/providers/sources/folia-bridge/` 完成：缺的方法不出现，能力表随之关闭。QQ 与网易云的 `explore@1`、网易云的 `raw@1` 界面上没有入口，因此不声明；网易云的 `reports@1` 接到 `/online/report-playback`。
- 上游包版本对齐：`@yakult-green-tea/qq-music-api` 3.3.6 → **3.3.9**；网易云 `@neteasecloudmusicapienhanced/api` 4.41.1、波点 `bodian-music-api` 0.1.2、汽水 `qishui-music-api` 0.2.2 本就与上游相同。
- 补回了上游没有、而我们本来有的一层：**汽水的 ticket guard 续期**（约 6 小时过期）。移植源在「失败 → 续期一次 → 重放一次」上做 `withAuthRetry`，镜像不动。
- 网易云的后端跑在工作线程里，线程是 bundle 旁边的 `worker.cjs`（由上游 `neteaseApiWorker.cjs` 复制改名）；QQ 的内嵌后端在第一次问状态时拉起、监听本机端口。插件停用或退出时会关掉它们。
- **登录态需要重新扫码一次**：旧实现在 `sessions.json`（明文）里，移植源各自用插件数据目录下的加密存储（`<平台>-legacy-store.json` + `<平台>-seal.key`），两者不是一套格式。已存的收藏、歌单、播放历史、队列不受影响（歌曲 id 形态没变）。

### 目录结构 · Folia 镜像改成与上游仓库根 1:1

- **单根**：原来分散在 `src/folia/**`（上游 `src/**`）与 `src/folia-mods/**`（上游 `sources/**`、`packages/**`）的镜像，统一合并成 `folia/`，三条树的相对路径与上游完全一致：`folia/src/**`、`folia/sources/<id>/**`、`folia/packages/<包>/**`。以后移植一个上游文件就是「按上游路径拷到同路径」，升级上游按路径 diff 就行。
- **适配层按上游路径**：替换上游模块的替身改成同相对路径（`src/folia-adapters/services/onlineMusic/providerRegistry.ts`、`crossSource.ts`、`src/folia-adapters/utils/lyrics/providers/amllDbProvider.ts`、`src/folia-adapters/utils/lyrics/workerClient.ts`），文件头写「替身上游：…」；没有单一上游文件的宿主面仍按用途分组（`source-host/`、`kugou/`）。
- **镜像校验**：新增 `scripts/check-folia-mirror.mjs`（并入 `npm run check` 与 `npm test`）：镜像每个文件必须在上游同路径存在；内容默认逐字节相同。确有插件适配的 52 个文件登记在 `folia/mirror.manifest.json`，记录登记时的上游 SHA256，上游一变就报错复核。顺带修正了两处上游已移动的文件（`utils/colorMix.ts`、`utils/textMeasureCache.ts`）与三个上游不存在的旧文件。
### 在线歌词 · 平台自己的歌词按 Folia 的解析步骤还原

- **现象**：播放酷狗（以及其他四个移植平台）的歌，有的有歌词、有的整段空白；有歌词的那些其实都来自 AMLL 跨源匹配。
- **原因**：移植只搬了音源定义，漏了宿主侧的「音源歌词 → 应用歌词」一步。上游 `lyrics@1.getLyrics` 交回的是 `{ main: { format, text }, wordByWord: { format, text } }`（原始文本 + 格式），而两个宿主适配层（`folia-bridge` 的 `source.lyric`、`kugou-folia/playback.lyric`）都在读 `track.lines`——上游从不给这个字段，于是平台歌词被整段丢成空。
- **处理**：把上游 `src/mods/folium/lyricsSource.ts` 逐字节镜像进 `folia/src/mods/folium/`（连同它依赖的 27 个歌词工具文件），解析交给移植的 `resolveFoliumSourceLyricsResult`；Node 里没有 Web Worker，`workerClient` 用进程内替身（同一份 `parseLyricsByFormat`，格式归一与传参照抄上游 worker）。新增 `src/host/services/lyrics/folia-lyrics-source.js` 把结果换成本插件的行形状，并把原文作为 `raw` 交回客户端（客户端用它自己的 Folia 管线再解析）。
- **验证**：真实酷狗歌曲（发如雪）从 0 行变为 69 行、逐字、raw 8309 字节 KRC；新增 `lyrics-source-conversion` 覆盖 LRC/KRC/增强 LRC/翻译借用/纯音乐/坏轨/旧形状不算数。
### 匹配歌词 · 算法改为 Folia 原样移植

- **自动匹配、打分、来源顺序全部换成 Folia 的实现**：`folia/src/utils/lyrics/**`（29 个文件，SHA256 与上游全等）经 `src/folia-adapters/lyrics-match/` 的宿主替身打成 `src/host/vendor/lyrics-folia/match.bundle.mjs`；`lyrics-match-runner` 直接调用上游 `autoMatchBestLyric`，`lyrics-match.js` 的打分改为上游 `matchScore`。
- **行为随上游**：时长分档补回 ≤1s → ×1（旧自写版缺这一档）；未指定偏好时默认偏好是 QQ（上游的 `DEFAULT_PREFERRED_LYRIC_SOURCE`）；AMLL 探测走「先找网易云候选、再用它的 id 问 AMLL」这条上游路径，不再由插件自己预解析 id；别名重试只给标题时，宿主把 artist 补成歌手的名字（上游会对 `artist.trim()` 取用）。
- **界面不变**：匹配窗口仍是插件自己的对话框；它拿到的分数、排序来自上游，预览仍返回客户端需要的行/LRC/TTML 原文（AMLL 的原文仍随预览一起给）。
### 在线音乐 · 未登录体验

- **源菜单与账号菜单分开**：未登录的平台不再显示「重新登录 / 退出登录」（它们只属于已登录账号），改为一项「登录」；原因是客户端把「已配置」当成了「已登录」。
- **加载失败不再展示平台原始报错**：歌单、云盘、推荐、搜索、歌手页、专辑页加载失败时，未登录的平台显示「需要登录」+ 登录按钮；已登录时的失败显示「加载失败」+ 重试，平台原话收进悬停提示（`title`），排查时仍能看到。
- **Host 以移植源自己的账号为准**：`/online/providers` 对 Folia 移植源会核对源内的账号，旧 `sessions.json` 里的登录快照不再被当成「已登录」（迁移后它已失效，之前会让界面显示成登录着、歌单却报错）。
### 在线音乐 · 旧实现退役

- 四个平台（网易云 / QQ / 波点 / 汽水）的**旧实现整体删除**，请求路径只剩移植源：门面（`providers/index.js`）摘掉网易云与 QQ 的全部分支，只保留 Navidrome 与酷狗的一行行委派（1505 → 603 行）。
- 删除 `providers/netease.js`、`netease-legacy.js`、`qq.js`、`qq-legacy.js`、`yrc.js`、`qrc.js`、`krc.js`，`services/netease-api.js`、`netease-upstream.js`、`qq-api.js`，以及旧 `sources/bodian/**`、`sources/qishui/**`（共约 5.4k 行）；`sources/index.js` 不再有 `registerBodianSource` / `registerQishuiSource`，宿主入口不再收尾旧的本地服务与旧存储。
- 路由：`/online/login/local-service`（含重启/自检/诊断）对四个移植源答「恒 running」，不再有拉起旧服务的入口；账户资料/会员信息对四个平台改走注册表（`omni.profile` / `omni.vipInfo`），门面只留酷狗与 Navidrome。
- 「清空插件所有数据」的账户项去掉只属于旧实现的 `bodian-device.json` / `qishui-device.json` / `qq-auth-sessions.json`。
- 顺带修一处映射缺陷：`folia-bridge` 的 `artistSongs` 之前把上游的 `{items}` 直接交出去，路由读 `songs` 得到空数组——移植源的歌手「全部歌曲」页因此是空的；现在按页形状返回并过 DTO。新增 `test/host/folia-bridge.test.mjs` 守住分页、专辑、排行、试听标记、上报与逐字歌词的契约。
- 只测旧实现的 13 个测试文件删除；`kugou` 门面路径的测试保留并精简。

### 歌词样式

- 新增 Folia 的「隐喻」（metaphor）样式：three.js 墨球、半调网点与砂纸颗粒，按词硬切的镜头，反相镜头、画面反相、关键字着色、句间转场；参数在播放页「外观」里（节拍模型尚未接线，「湮灭对撞」参数暂不驱动画面）。
- 顺带修正：hanabi / nebbia / machi 等通过 `tuning.read(props.visualizerTunings)` 取参数的样式，之前宿主没有传按模式索引的 tuning 包，调参一直回退默认值；现在宿主同时传具名参数与 tuning 包。

## 0.47.2 — 2026-11-27

### 插件信息

- 新增新版本检查：面板打开后（空闲约 2.5 秒）和「设置 → 关于」页会问一次 Host；Host 依次从 npm（主源）、npmmirror（镜像）、GitHub Releases（tag）取最新版本，与已安装的 `package.json` 版本比较。有更新时顶栏品牌图标旁常驻「新版本 vX.Y.Z」角标；点击优先通过 `pluginNavigation.openBundle('dsh-music-panel')` 跳到 DSH 的插件面板（与 dsh-context 一致），该服务不可用时回退为打开最新 release 页。
- 版本检查全部在 Host 完成：结果写 `update-check.json`，默认每小时最多请求一次（可配 1/6/24 小时），失败只退避 30 分钟；离线静默，不弹提示。「设置 → 关于」显示当前/最新版本与上次检查时间，并有手动「检查更新」按钮和自动检查开关。

### 在线音乐

- 歌手页按 Folia 拆成两层：页面本身是热门 10 首 + 页头「全部歌曲」入口；点进去是独立的 `artistSongs` 集合层（Folia #918 的 `artist_songs`，带返回、按页加载 100 首），不再出现「写着几百首却只看到 10 首、也翻不了页」。
- 歌手歌曲分页对齐 Folia：QQ 用 `total_song`、网易云用 `more`/`total`、酷狗用响应顶层的总首数（实测 1143/3196 首），名称搜索与 Navidrome 一次性读取如实报告没有下一页。
- 「全部歌曲」入口按「已知超过 10 首」判断：平台一次性返回整份列表的歌手（名称兜底、Navidrome）也有入口。
- 最近播放保留歌曲自带的歌手/专辑引用，从那里点进歌手不再退化成按名字搜索；QQ 与酷狗缺歌手 id 时由 Host 用各自搜索结果补上（实测酷狗 Udit Narayan 3196 首、QQ 周杰伦 1012 首、网易云周杰伦 589 首，均可翻页）。
- 名称搜索/Navidrome 这类「一次性返回整份列表」的来源也改成分页契约：按 offset/limit 切片返回，翻页与计数不再依赖把整份列表塞进首屏。
- 「全部歌曲」这一层的健壮性：重启后从导航恢复不再被过滤掉；旧版本存下的这一层缺描述时也能按 `provider:artistId` 由 Host 解析歌手名并加载；没有任何标识时显示「返回」而不是空转。
- 歌手页「热门歌曲」列表底部新增「全部歌曲 · N 首」按钮（页头入口保留）：热门只显示 10 首，底部不给入口时容易以为这位歌手只有这几首歌。点击同样进入 `artistSongs` 集合层。
- 播放模式：顺序播放 → 单曲循环 → 随机播放，始终是一颗按钮轮转（底栏、播放页胶囊、播放页右侧同一套），不再有第二套模式控件（音频设置里重复的分段控件已移除）。
- 随机是真正的模式并保留原顺序：进入随机时正在播的歌继续播、固定为随机表第一位，其余随机；切出随机（顺序或单曲循环）时队列按原顺序还原、当前歌不跳；再次进入随机会重新生成一张新表。随机表放完一轮回到表头循环，不自动重洗；重启后保留当前这张随机表，原顺序始终保存作为还原点。
- 页面「随机播放」现在切到随机模式并按随机表开播；「一轮不重复」改为影响下一张随机表的排列（上一张表听过的歌排后面）。
- 汽水音乐：车机登录票据（ticket guard）约 6 小时过期，过期后账号读取会被平台拒绝（28001008）。现在自动续期一次并重放请求，不再出现「加载失败 · Qishui rejected the request」；续期失败时提示重新扫码登录。
- 搜索页的「加载更多」只在平台真能翻页时出现（酷狗/汽水是一次性搜索，不再给出点了没反应的按钮）。
- 专辑页核对：各平台都是整份读取（酷狗循环分页读完），没有只读一页的截断。

### 界面

- 顶栏「加入交流群」从透明文字按钮改成 DSH 主按钮样式，更显眼。
- 「设置 → 关于」的版本检查改用标准设置卡片，与同页其他选项的留白/分隔线一致；更新角标点击优先跳到 DSH 插件面板。

## 0.47.1 — 2026-11-27

### 在线音乐

- 酷狗「推荐」改成 Folia 概念版自己的卡片（`top_card_youth`，id 形如 `kugou-card-3006`）：点进卡片读卡片本身，不再把网页歌单的 `specialid` 送给概念版歌单接口。原实现下每张推荐卡点进去都是 `error_code 20010`（参数错误），界面显示「酷狗概念版请求失败（code=20010）」。
- 酷狗公开歌单（搜索、分类）改走接受 `specialid` 的公开页读取器；概念版 cloudlist 读取器只接受 `global_collection_id`，两者不再串用。
- QQ「加入歌单」改走包的 `/user/playlist/tracks`（Folia 的同一条路）：歌单卡片是 `tid`，写入路由自己解析账号里的 `dirId`（1–199）；原来把 `tid` 当 `dirId` 发 musicu `AddSonglist`，等于往不存在的文件夹里写。「我喜欢」改走红心。
- 「加入歌单」只列可写入的歌单：QQ 只给本人的普通歌单（收藏、「我喜欢」、系统目录不列），酷狗只给自建歌单（收藏与「我喜欢」不列），波点只给自己的歌单；其余平台不设额外规则（与 Folia 相同）。没有可写目标时显示「没有可用的歌单」。
- 酷狗概念版「从当前歌单移除」改由概念版客户端签名写入；原来用标准版 worker 发概念版的 `listid`，凭证与客户端不匹配。
- 酷狗概念版补声明 `playlistTrackMutations` / `mutations`：加/删歌单的实现早已存在，能力门却把「从当前歌单移除」的入口和路由一起挡住。
- 歌单排行卡片（`listening-rank-*`）标为不可写，不再出现在「加入歌单」的目标里。
- 修复酷狗歌单整页重复：分页游标原来按「规范化后剩下的行数」前进（一页 100 行丢 1 行 → `nextOffset` 99），offset 99 又落回第 1 页，同一页被反复追加。现在游标按上游这一页实际返回的行数前进，页号按上游实际服务的页大小推算；客户端合并改用 `provider:id` 作为歌曲身份，并在游标不前进时结束列表。同一条游标规则一并修到网易云、酷狗标准版、波点、汽水的分页读取器。

### 维护

- 新增 [在线平台对齐清单](A_other/docs/在线平台对齐清单.md)：id 归属、surface × 平台矩阵、Folia 对应位置、已知差距与改动必做项；AGENTS.md 的「总是做」与「参考」都挂上它。
- 新增 `test/host/online-capabilities.test.mjs`：能力声明为 true 时，对应方法必须能到达该平台，而不是落进「未知平台 / does not support」。

### 界面

- 修复右键歌曲「加入歌单」永远报「当前曲目没有在线平台」：弹窗从歌曲自身读来源（Folia `getPlaybackSourceRef(song)` 的做法），右键菜单与播放页星标传同一份 `{ provider, song }`。
- 「加入歌单」弹窗的歌单列表独立滚动（`.mp-pick-list`，上限 `min(56vh, 420px)`），歌单多时不再被弹窗裁掉。

## 0.47.0 — 2026-11-25

### 维护

- 目录结构对齐：`folia/src/` 只保留已移植的 Folia 文件，路径与上游 `src/` 一致；shims/vendor 移到 `src/folia-adapters/`，构建入口和 bundle 移到 `src/folia-build/`。

### 播放器

- 面板新增队列页签：窗口化渲染、当前行高亮、播放/下一首/移到末尾/移除/清空。
- 播放控制显示改为 Folia 三态：始终显示 / 自动隐藏 / 始终隐藏；默认始终显示，隐藏时同步隐藏鼠标。
- 修正播放页自动隐藏：改为 Folia `usePlayerChromeAutoHide` 的 window 级 `mouseout` / `mousemove` 时序，鼠标离开窗口约 300ms、静止约 3s 后收起；打开面板时仍保持显示。
- 播放页底部译文上移：Folia 共享字幕层的底距从 0 改为 96px（底栏底距 16 + Folia 的 80 净空），不再压在播放胶囊下面；控制条隐藏时保留 32px。
- 下一首/上一首、预取和错误跳过改用 Folia `nextQueueIndex` / `prevQueueIndex`；关闭列表循环时到边界不再绕回。

### 歌词样式

- 接入 Folia 的 16 个歌词样式渲染器：流光、静止、云阶、浮名、莫奈、倾诉、回环、心象、绘光、商籁、凝彩、花火、雾笺、镜台、町景、时计；每个样式带各自的渲染器与参数。
- 外观页承接选中样式的 Folia tuning：滑杆两列、开关两列、分段控件整行；样式参数选项补中文。
- 样式网格改用真实界面缩略图：16 个样式各一张 480px WebP，随机样式保留图标。
- classic（流光）改用 Folia 的全屏歌词舞台：不再被封面/信息列挤成单字，歌词按 Folia 的全宽布局绘制。
- 移除群唱（cappella）样式：入口、注册表、参数、Host 头像/表情路由与素材一并删除；旧 `lyricStyle: cappella` 仍迁移到 classic。

### 歌词

- 样式参数滑杆与底栏音量滑杆同源：原生 range + 共享的非被动 wheel 契约，一格 = 量程的 5%（按 step 吸附）；拖动连续跟手，滚轮只改数值、不再带动整页滚动。
- 样式调节项从「歌词」页移到「外观」页；样式选择仍在「歌词」页。
- 播放列表取消虚拟列表：按选中顺序完整渲染，高度按窗口自适应（最大 900px），复用播放队列的行样式（序号/波形、封面、标题、歌手、时长，悬停移调与移除）；打开时定位当前行且不打断点击。

## 0.46.4 — 2026-11-24

### 在线音乐

- 修复听歌排行（QQ 年度排行 / 最近一周、网易云、酷狗）加入队列后缺少 `provider`、`durationSec`、`coverUrl` 的问题：排行行与普通歌单统一经过 `shapeQueueSong`，并保留 `listenCount`；QQ 的 `source` 字段不再被误当成客户端可用的 provider。
- 已损坏的旧排行队列项无法反推平台，需要清空当前队列后从排行重新添加。

## 0.46.3 — 2026-11-24

### 启动

- 修复偶发启动崩溃：HTTP 路由暴露时 source registry 仍为空，账号读取调用 `omni.capabilities` 抛出 `MusicError`，成为未处理的 Host fatal。source 现在在暴露路由前同步注册；账号读取对不可用源降级，且永不 reject。

## 0.46.2 — 2026-11-24

### 播放器

- 修复浅色模式下播放页底部胶囊进度条仍继承播放页白色 seek：胶囊内轨道/缓冲/进度/滑块改用宿主 label/business token。
- 播放页右下角设置按钮改用宿主 surface/label token，激活态使用 business 色；移除按钮后方的胶囊底衬和重复图标。
- 移除播放页「当前主题」里的浅色/深色开关：该控件从未接入主题生成或舞台，插件主题统一跟随 DSH 宿主主题。
- 修复浅色模式下播放队列标题/歌曲名为白字、几乎不可见：队列自设 `label-primary` 文字色并跟随宿主主题，不再从深色播放页继承白色。
- 播放页右下角的控制卡片改为主题自适应：玻璃背景改用 `bg-layer-1` token，移除整张卡片的深色 token 固定，浅色主题显示浅色卡片。
- 修复底部胶囊播放/暂停键白底白图：前景从 `--dsw-alias-bg-base` 改为与 `--dsw-alias-label-primary` 配对的前景 token；同类的底栏播放键一并修正。

## 0.46.1 — 2026-11-24

### 音频效果器

- 修复设备预设点击后音频已生效、界面却回退的问题：本地 Tab/选中设备只在 prefs 明确为 `device` 时同步，不再被无关或滞后的 prefs 写清空。
- 修复浅色主题下音频效果器「设备预设」搜索框、耳机列表与频段曲线沿用深色固定样式导致白底白字、几乎不可见：窗口内嵌套控件改用 DSH 主题 token，深色 EQ 弹层保持原样。

## 0.46.0 — 2026-11-23

### 联系作者

- 弹窗标题由「联系作者」改为「加入交流群」，与按钮文案一致。
- 缩短联系作者弹窗的扫码提示，避免最后两个字单独换行。
- 搜索框左侧的联系入口改为带文字的「加入交流群」按钮，并使用用户提供的反馈群二维码原图。
- 搜索框左侧新增「联系作者」按钮，弹窗展示 `dsh-music-panel反馈群`（群号 495049439）二维码，支持复制群号；二维码已裁切并内联进 client，无需额外资源路由。

### 搜索

- 搜索改为按 Enter 提交：输入过程中不再每敲一个字就搜索；清空输入会退出结果页。
- 修复清除搜索按钮丢失样式后掉到搜索框下方的问题；按钮回到输入框右侧，输入为空时不显示。
- 搜索框新增最近 8 条搜索历史，保存在 prefs 中、可一键清空；点击历史直接再次搜索。

### 音频效果器

- 修复「设备预设」搜索框在设备预设容器右上角溢出的排版问题（`box-sizing: border-box`）。
- 音频效果窗口新增「设备预设」Tab：点开后显示「耳机预设」搜索、分页和型号曲线，与播放页均衡器面板共用同一个设备浏览器；选中后立即更新当前设备与高亮并开启处理，修复点击后音频生效但界面不刷新的问题。

## 0.45.2 — 2026-11-23

### 在线播放

- 修复部分在线歌曲拖动进度条后又从 0:00 重新播放：缓存命中的歌曲，以及超过 10 MiB、MSE 不支持的格式、MSE 失败后的回退，都改为整段取回成 Blob 再播放，获得和本地文件一样的随机访问；不再把 Host 代理 HTTP 流直接交给媒体元素。

## 0.45.1 — 2026-11-23

### 在线播放

- 修复 issue #31：网易云等在线歌曲超过约 12 MiB 时，MSE 的 SourceBuffer 会超 Chromium 配额，回退直连后又丢失播放意图，停在 0:00。现在超过 10 MiB 的响应直接交给媒体元素播放；MSE 中途失败时保留暂停/播放意图和当前进度，并补上 SourceBuffer 异步 error 兜底。
- 直连/Range 请求不会再在重试时降音质：同一播放会话的字节必须来自同一个文件，避免海外 CDN 节点重试时把不同音质的字节拼在一起。

---

更早的版本（到 0.45.0 为止，共 189 个版本）见 GitHub Releases：
https://github.com/Aliboder/dsh-music-panel/releases

> 本文件只保留最近 10 个版本；完整历史可用 `git log -- CHANGELOG.md` 查看。
