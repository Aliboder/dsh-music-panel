# 在线缓存向 Folia 对齐 · 修改计划

面向维护者与 Agent。目标：把插件的在线缓存整体换成 Folia 的做法（**现有实现不再保留**），先把方案定下来，再动代码。

状态：**已完成**（P1 Host、P2 客户端、P3 歌词缓存、P4 歌词预取；P5 安装验证见下）

已确认的决定（用户 2026-11-17 确认）：旧缓存**升级时直接清空**；Folia 没有的缓存 UI（列表、徽标、单删、进度、`/online/cache/{list,remove,meta,status}`）**删除**；缓存目录**固定**在 `<DSH_HOME>/music/cache`，不做可配置。

---

## 1. 目标

- 在线音频只在**整首听完之后**才缓存（不是边播边存），默认**不开启**，可设置上限。
- 歌词、封面与音频在同一套生命周期里被缓存与清理，并有「存储」页可看用量、按类别清空。
- 删除我们现有的额外能力（流式落盘、按歌列表/徽标/单删、URL 键封面缓存、24 小时歌词宽限等），行为以 Folia 为准。
- 内部存储仍用插件自己的 Node 磁盘实现（插件没有 Electron 主进程 / IndexedDB / OPFS 三套后端），这点是**实现差异**，行为对齐。

---

## 2. Folia 的机制（调研结论）

### 2.1 音频：播完才写，默认关

| 事项 | Folia 的做法 | 出处 |
| --- | --- | --- |
| 写入时机 | `<audio>` 的 `ended` 触发；或单曲循环从结尾绕回开头（原生 loop 不触发 `ended`，用 `hasLoopedToStart` 判断）；automix 里淡出的那首由 settle 路径显式写 | `src/App.tsx` `onEnded` / `onTimeUpdate`；`src/components/app/playback/bridges/usePlaybackAudioBridge.ts` `cacheSongAssetsFor` |
| 开关 | 设置「缓存歌曲」`enableMediaCache`，**默认关闭**；关闭时只影响写入，**读取仍用缓存** | `src/stores/useAudioSettingsStore.ts` `readStoredEnableMediaCache`；读取路径在 `src/services/onlinePlayback.ts` 不看开关 |
| 上限 | 默认 **5 GB**，可选 1/2/5/10/20/50 GB、0 = 不限；每次写入后按 LRU 修剪 | `useAudioSettingsStore.ts`；`electron/audioCachePrune.cjs` |
| 后端 | 桌面版：Electron 主进程文件缓存（目录可配置），IndexedDB 兜底；浏览器版：IndexedDB | `src/services/audioCache.ts`；`electron/main.cjs` |
| LRU 依据 | 文件 mtime，**每次从缓存播放都会刷新**，含义是「最近播放」而不是「最近下载」 | `electron/audioCachePrune.cjs` |
| 质量档 | 每首歌的记录里存 `audioLevel_<key>`；请求的档与缓存档不同就**跳过缓存**重新取；只有在拿不到 URL 时才播放另一档的副本 | `src/services/onlineMusic/resourceCache.ts` `isCopyOfAnotherLevel`；`onlinePlayback.ts` `playCopyOfAnyLevel` |
| 读时校验 | 读缓存副本时在 300ms 内量一次时长；判定是片段就删掉并重新取 | `onlinePlayback.ts` `wholeCopy` / `measureSongAudio` |
| 写入校验 | 预览片段（provider 标记）不存；HTTP 失败、`text/*`、JSON/HTML、<16 KiB 不存；时长 <歌曲一半不存；要覆盖已有副本必须证明 ≥90%；解码失败在本会话标记 distrust，绕过缓存并允许重写 | `src/services/playbackRecovery/mediaCacheGuard.ts`；`src/services/wholeSongCheck.ts`；`src/services/playedTrackCache.ts` |
| provider 自带缓存 | `keepsOwnSongAudio` 的平台交给 provider 自己保留，不落我们的盘 | `src/services/onlineMusic/providerRegistry.ts` |
| 缓存键 | `audio_<songKey>`、`audioLevel_<songKey>`；`songKey` 由平台与媒体 id 组成（网易云云盘另有 legacy 键迁移） | `src/services/onlineMusic/resourceKeys.ts` |
| 分析复用 | automix / 音量平衡的读取优先用缓存副本，分析结果单独成类 | `src/services/analysis/trackAudio.ts`；`src/services/automix/profileService.ts` |

### 2.2 封面

- 与音频同一个「播完」事件里写入（`cachePlayedTrackAssets`）：只对在线歌、只对 `https:` 封面、已有副本不重写。
- 键 `cover_<songKey>`（酷狗用 `cover_v2`）；IndexedDB 存描述符，字节在 Electron 文件缓存或 OPFS，读取时返回 object URL。
- 出处：`src/services/playedTrackCache.ts`；`src/services/coverCache.ts`；`src/services/binaryAssetStore.ts`。

### 2.3 歌词

- 每首歌缓存**解析后的 LyricData**（`lyric_<songKey>`），播放开始时先读缓存立即显示。
- 同时持久化 `OnlineLyricsState`（`lyric_<songKey>_state`）：`lyricsSource`、`hasOnlineOverride`、`onlineOverrideLyrics`（auto-match 的结果就存在这里）、`matchedSongId`、`matchedLyricsSource`、`matchedIsPureMusic`、`importedLyrics` 等。
- auto-match 找到更好的歌词时**写回 state**；所有来源都判定「纯音乐」时也写回（`markOnlineLyricsPureMusic`），避免每次播放都重新全量搜索。
- 预取下一首/上一首时也会写歌词缓存。
- 出处：`src/services/onlinePlayback.ts` `loadOnlineSongLyrics`；`src/utils/onlineLyricsState.ts`；`src/services/prefetchService.ts`。

### 2.4 预取

- 轻资源窗口：**后面 2 首 + 前面 1 首**的 URL、歌词、封面 URL；URL 20 分钟 TTL；内存 LRU 200 条。
- 音频字节不会因为预取而下载；automix/analyser 需要读文件时才受「缓存歌曲」开关约束。
- 出处：`src/services/prefetchService.ts`。

### 2.5 存储页与清理

- 设置 → 存储与备份：
  - 「缓存歌曲」开关、缓存目录（桌面版）、上限选择、已缓存歌曲数 + 体积；
  - 分类清理：`playlist` / `lyrics` / `cover` / `media` / `analysis` / `volumeBalance`，每类显示大小并可单独清空；
  - 另有「清空全部数据」。
- 分类与计数规则见 `src/services/repositories/cacheUsage.ts`（`mediaCount` 只数字频，不数 ReplayGain/level）。
- 页面：`src/components/modal/settings/pages/StoragePage.tsx`；分类行：`src/components/modal/settings/pages/storage/options.ts`。

---

## 3. 我们现在的做法

| 资源 | 现在的插件 | 出处 |
| --- | --- | --- |
| 音频 | 边播边写临时文件，**下载完整就改名落盘**（通常开播几秒就完成，跳过也留下）；单文件 ≤120 MB；总量 **10 GiB** LRU；记录质量档 | `src/host/services/media/online-cache.js` `createSink`；`src/host/http/routes/online.js` stream 分支 |
| 歌词 | provider + id 键缓存 provider 原始 lyric 体（v6，缺翻译 24h 宽限）；每首歌另有 `lyric-states` 记录（source/matched/pure/imported + payload） | `routes/online.js`；`src/host/stores/lyric-state.js` |
| 封面 | `/online/cover?url=` 代理时按 URL 哈希缓存（`writeAsset`），与「播完」无关 | `routes/online.js` cover 分支 |
| 元数据 | `/online/cache/meta` 由客户端写入标题/歌手/封面，供缓存列表显示 | `routes/online.js`；`src/client/services/player/player.js` |
| UI | 在线列表显示已缓存标记与下载进度；设置「数据」页显示总用量与「清空在线缓存」；缓存歌曲列表 + 单删 | `src/client/components/online/online.js`；`src/client/components/ui/online.js`；`src/client/components/ui/settings.js` |
| 默认值 | 缓存无开关、始终开启；上限写死 10 GiB（注释曾误写 2 GiB） | `src/host/services/media/online-cache.js` |

---

## 4. 行为差异（要改的）

| # | 项 | 我们 | Folia |
| --- | --- | --- | --- |
| 1 | 写入触发 | 下载完整即写 | 整首听完（ended / loop 回环 / 淡出结算）才写 |
| 2 | 开关 | 无 | 有，默认关；关只影响写 |
| 3 | 上限 | 固定 10 GiB | 默认 5 GB，可设 1/2/5/10/20/50/0 |
| 4 | 跳过也缓存 | 会 | 不会 |
| 5 | 单文件上限 | 120 MB | 无单文件上限（受总量约束） |
| 6 | 质量档 | 记录并在读时跳过不同档 | 同左，且无 URL 时回退播放另一档 |
| 7 | 片头校验 | 只有「完整下载」与预览标记 | 读时/写时量时长：<50% 拒绝，≥90% 才能覆盖 |
| 8 | 坏副本 | 无处理 | 解码失败标记 distrust、绕过并允许重写 |
| 9 | 封面 | 按 URL 缓存（展示即写） | 播完随歌曲缓存（按歌） |
| 10 | 歌词 | provider/id 原始体，24h 宽限 | 按歌的解析结果 + 状态（含 auto-match 覆盖与纯音乐结论） |
| 11 | 预取 | 只有音频 URL/Blob 的交叉淡化预取 | 后 2 前 1 的歌词/URL/封面预取 |
| 12 | UI | 缓存列表、徽标、单删、进度 | 只有存储页的计数与分类清理 |

---

## 5. 决策

### D1 写入触发（对齐 Folia）

- 非交叉淡化的正常播完：播放器 `onEnded` 发一次「播完」事件。
- 单曲循环：我们的播放器没有用原生 `loop` 属性（`onEnded` 里手动回到 0 重播），所以每遍都会触发 `ended`，不需要 Folia 的回环检测。
- 交叉淡化：淡出方在重牌之后被 `finishCrossfade` 暂停，永远不会触发 `ended`。所以在 `beginCrossfadePlayback` 记下淡出曲目（item、duration、quality），在 `finishCrossfade` 暂停鬼影前按 `duration - currentTime <= 1.5s` 判断它已走到结尾并发「播完」事件（对应 Folia automix settle 对淡出曲目的处理）。淡化本身把 `fade` 夹到 `remaining - 0.05`，所以正常交叉淡化一定满足。
- 事件只带 `provider/id/quality/durationSec/coverUrl` 等身份信息，不做判定；判定在 Host。

### D2 存储：单一 Node 磁盘（实现差异）

- 保留「Host 自己实现一套缓存」这一形态（插件没有 Electron/IndexedDB/OPFS 三套后端），但**重写**为 Folia 语义的新 store。
- 目录：`<DSH_HOME>/music/cache/`
  - `audio/<provider>/<id>.<ext>` + `<id>.json`（`v, quality, size, mime, durationSec, storedAt, usedAt`）
  - `cover/<provider>/<id>.<ext>`（`<id>.json` 记 mime/ext）
  - `version.json`（缓存布局/规则版本，用于一次性迁移）
- LRU 依据：meta 的 `usedAt`，**每次命中播放就刷新**（对应 Folia 的 mtime 刷新）。
- 统计与清理都按目录/类别扫描，不依赖内存索引。

### D3 开关与上限：放客户端偏好，随写入请求传给 Host

- 新增偏好：`onlineCacheEnabled`（默认 **false**）、`onlineCacheLimitGb`（默认 **5**，可选 1/2/5/10/20/50/0）。
- 与 Folia 一致：写入请求携带 `limitGb`（0 = 不限），Host 写入后按它修剪；开关只在客户端（关闭时不发写入请求），Host 不单独存开关。
- Host 的 `/online/cache` 统计返回实际用量与歌曲数；上限显示取自偏好。

### D4 质量档

- 「播完」事件带本次播放的档位；Host 以该档写入并记录。
- 请求档与缓存档不同：不播缓存副本，取新 URL（保持现状）。
- 平台拿不到 URL（下线/未登录/离线）时：**回退播放另一档的缓存副本**（现在没有，补上）。

### D5 写入与读取守卫（对齐 Folia）

- 预览：`/online/stream` 已带 `x-music-preview`；Host 记住该 id 最后一次流是预览，播完事件直接忽略。
- 内容校验：HTTP 失败、`text/*`、`application/json|xml`、HTML、<16 KiB 不写。
- 时长校验：用 Host 现有的 `readTrackMeta`（music-metadata）读取下载文件时长，与歌曲时长比较：
  - < 50%：判定片段，不写；已有副本存在时**删除**该副本（对应 Folia 读时删除）；
  - ≥ 90%：可覆盖已有副本；
  - 介于两者或时长未知：无副本可写，有副本不覆盖。
- distrust：客户端播放报错（`onError`）时 POST `/online/cache/distrust`；Host 在内存里标记，`/online/stream` 绕过该歌缓存，成功写入新副本后清除。

### D6 歌词：缓存进「每首歌的歌词记录」

- 扩展 `lyric-states` 记录，让 `/online/lyric` 先查记录：
  - `imported`（已有）→ 直接返回；
  - `matched`（auto-match 结果，含 `source/id/wordLevel/isPureMusic`）→ 返回记录的 payload，并标注 `override: true`；
  - `pureMusic`（含「所有来源都没有歌词」的结论）→ 返回纯音乐，不再搜索；
  - `lyric`（平台自己的解析结果：`text/formatHint/translation/romaji/v/at`）→ 返回缓存体。
- 写入点：`/online/lyric` 解析成功后写 `lyric`；`/online/best-lyric` 找到更好的结果时（新增 `persist=true`）写 `matched` 与 payload；所有来源判定纯音乐时写 `pureMusic` 与 `autoMatched`。
- 对齐 Folia 的拆分：`/online/lyric` **不再**在请求内跨来源搜索（现在「平台没有歌词就同步找其它来源」要去掉），跨来源搜索只发生在播放开始后的升级路径；因此客户端加载器要**允许在歌词为空时也发起升级搜索**（现在 `maybeUpgrade` 遇到空歌词直接返回，要去掉），搜索无果时把纯音乐结论写回记录，避免每次播放都全量重搜。
- 升级路径命中并持久化后，下一次 `/online/lyric` 直接返回 `override`，加载器看到 `override` 就不再发起升级（对应 Folia 的 `hasOnlineOverride`）。
- 删除 `online-cache` 里的 lyric meta 与 24 小时宽限；清理走歌词记录（现有 `lyrics` 数据分类）。

### D7 封面：按歌缓存，播完写入

- 「播完」事件带 `coverUrl`；Host 下载并写到 `cover/<provider>/<id>.<ext>`（只 http(s)、只在线歌、已有不重写）。
- 新增 `GET /online/cover?provider=&id=`：命中缓存直接返回，未命中回落到按 URL 代理。
- 客户端 `trackCoverSrc()` 对在线歌改用 `provider/id` 形式（播放器、歌词舞台、队列统一走这个 helper）。
- 删除按 URL 的 `writeAsset/readAsset` 缓存；`/online/cover?url=` 仅作无缓存代理（头像、搜索页封面）。

### D8 预取：只预取歌词（实现差异）

- 当前曲目开始播放后，用加载器预取队列**后 2 首 + 前 1 首**在线歌的歌词（`MPLyricLoader.prefetch`），命中 Host 歌词缓存则几乎无成本。
- 不做音频 URL 预取（我们的 URL 由 Host 每次解析）与封面预取（播完才缓存），与 Folia 的差异记录在案。

### D9 删除我们的东西

- 删除 `/online/stream` 的流式落盘（`createSink`/缓存进度/120 MB 单文件上限）。
- 删除 `/online/cache/list`、`/online/cache/remove`、`/online/cache/meta`、`/online/cache/status`。
- 删除在线列表的「已缓存/下载进度」徽标（Folia 没有）。
- 删除 24 小时歌词宽限与 provider/id 歌词体缓存。
- 删除按 URL 的封面资产缓存与 `readAsset/writeAsset`。
- `/online/cache` 只保留「统计 + 按类别清空」。

### D10 迁移

- 缓存目录写 `version.json`（`{v: 2}`）。首次升级到新版本时：**清空旧缓存目录**（旧规则下的文件可能来自被跳过的播放、含 payload 的 lyric meta、按 URL 的 cover），重建目录结构。CHANGELOG 写明「升级会清空在线缓存」。
- 歌词记录做一次 schema 升级（新增字段均可选，旧记录照常可读；旧的 `matched` 语义不变）。

### D11 数据清理与文档

- `plugin-data.js` 的 `cache` 类别继续覆盖 `cache/`；歌词缓存归入现有 `lyrics` 类别（`lyric-states.json` + `lyrics/`）。
- 更新 `A_other/docs/data-reset.md`（音频/封面/歌词各自归属）、`CHANGELOG.md`、`pitfalls.md`（新坑：缓存写入时机与交叉淡化、时长校验）。
- 设置页新增的开关/上限属于客户端偏好，现有「清空数据」的 localStorage 前缀已覆盖。

### D12 测试

- Host：新 store 的单测（写入/丢弃/覆盖/修剪/LRU 刷新/distrust/统计/分类清理）；路由测试（played、stream 回退、cover 命中、lyric 记录优先、清除）。
- Client：`ended` 与交叉淡化触发、distrust 上报、预取窗口、设置读写、徽标移除后的列表不再请求 status。
- 数据清理：`plugin-data.test.mjs` 覆盖缓存类别。
- 全量：79+ 测试文件、`check`、`build-client`。

---

## 6. 数据模型

### 6.1 磁盘

```
<DSH_HOME>/music/cache/
  version.json                     { "v": 2 }
  audio/<provider>/<id>.<ext>      音频字节
  audio/<provider>/<id>.json       { v, provider, id, quality, mime, size, durationSec, storedAt, usedAt }
  cover/<provider>/<id>.<ext>      封面字节
  cover/<provider>/<id>.json       { v, provider, id, mime, size, usedAt }
```

- `id` 只保留 `[A-Za-z0-9_-]`（沿用现有 `safeId`）。
- 单曲条目（音频 + 封面 + 两个 meta）删除时一起删。
- 统计：`songs`（有音频 meta 的数量）、`files`、`bytes`、`categories: { audio, cover }`。

### 6.2 歌词记录（`lyric-states.json` 的 track 记录，新增字段）

```jsonc
{
  "source": "online | imported | local | embedded | null",
  "noAutoMatch": false,          // 用户选择，已有
  "markedPureMusic": false,      // 用户标记，已有
  "pureMusic": false,            // 结论（用户标记或自动判定），已有
  "autoMatched": { "at": 0, "pure": false },   // 新增：自动匹配已跑过，避免重复搜索
  "matched": { "source": "qq", "id": "…", "wordLevel": true, "isPureMusic": false, "at": 0 }, // 扩字段
  "imported": { "name": "…", "at": 0 },        // 已有
  "lyric": { "v": 1, "at": 0 }                 // 新增：payload 里存的是平台解析结果
}
```

payload（`lyrics/<sha1(key)>.json`）保持 `{text, formatHint, translation, romaji}`；`lyric` 与 `matched` 共用 payload，通过记录区分含义。

---

## 7. API 变更

| 接口 | 变化 |
| --- | --- |
| `POST /online/played` | **新增**。体：`{provider,id,quality,limitGb,durationSec,coverUrl}`；Host 校验开关语义（客户端只在开启时调用）、预览、质量、守卫后下载并写入；返回 `{stored, reason?}` |
| `POST /online/cache/distrust` | **新增**。`{provider,id}`；标记会话内 distrust |
| `GET /online/stream` | 不再写缓存；命中时刷新 `usedAt`；同档才命中；无 URL 时回退另一档副本 |
| `GET /online/cover` | **新增** `?provider&id` 形式（命中缓存）；`?url=` 保留为纯代理（不缓存） |
| `GET /online/cache` | 改为返回 `{songs, files, bytes, categories:{audio,cover}}` |
| `POST /online/cache` | 体改为 `{category: 'audio'|'cover'|'lyrics'|'all'}`；`lyrics` 清空歌词记录 |
| `GET /online/lyric` | 记录优先：imported → matched（`override:true`）→ pureMusic → lyric → provider；返回 `cached` 与来源 |
| `POST /online/best-lyric` | 支持 `persist=true`：命中更好结果时写 `matched` + payload + `autoMatched` |
| 删除 | `/online/cache/list`、`/online/cache/remove`、`/online/cache/meta`、`/online/cache/status` |

---

## 8. 触发时序

```text
播放一首在线歌
  ├─ /online/stream（Host）：缓存命中 → 返回本地字节并刷新 usedAt
  │                          未命中 → 代理上游；记录本次 quality / 是否预览
  ├─ 播放结束（ended）
  │    └─ 客户端 POST /online/played（fire-and-forget，不阻塞下一首）
  │         └─ Host：开关关 → 忽略；预览 → 忽略；已有同档 → 刷新 usedAt 返回
  │                  否则解析 URL → 下载 → 守卫 → 写 audio + meta（+ 封面）→ prune
  ├─ 交叉淡化
  │    ├─ beginCrossfadePlayback：记下淡出曲目（item/duration/quality）
  │    └─ finishCrossfade：暂停鬼影前判断已到结尾 → 同上
  ├─ 单曲循环
  │    └─ 每次 ended 都按「播完」处理
  └─ 播放报错
       └─ POST /online/cache/distrust → 下一次 /online/stream 绕过该歌缓存
```

---

## 9. 分阶段实施

### P1 Host：新缓存 store 与写入接口

- 新 `src/host/stores/media-cache.js`（音频 + 封面 + meta + LRU + 统计 + 分类清理 + 迁移/版本）。
- 删除 `src/host/services/media/online-cache.js` 的 sink/lyric/info/asset 能力（或整体替换为薄封装）。
- `routes/online.js`：新增 `/online/played`、`/online/cache/distrust`；重写 `/online/stream`（只读、usedAt、回退另一档）；`/online/cover` 新参数；`/online/cache` 统计/分类清理；删除四个旧接口。
- `index.js`：注入新 store；数据目录注册。
- 测试：store + 路由。

### P2 Client：触发、开关、设置、清理旧的 UI

- `player.js`：`onEnded`、`beginCrossfadePlayback`/`finishCrossfade` 的淡出曲目判断、`onError` → distrust。
- `prefs.js`：`onlineCacheEnabled` / `onlineCacheLimitGb` 默认值。
- 设置「数据」页：开关、上限、用量/歌曲数、分类清理（按主题规范，先读 `theme-guidelines.md`）。
- 删除在线列表徽标/进度与 `/online/cache/status`、`/online/cache/meta` 调用。
- i18n 两份字典；`settings-data` 测试。

### P3 歌词缓存重构

- `lyric-state.js`：新字段与 sanitize（`matched.isPureMusic`、`autoMatched`、`lyric`、payload 语义）。
- `routes/online.js`：记录优先的读取顺序；去掉请求内的跨来源搜索；`best-lyric` 的 `persist` 与纯音乐写回。
- 客户端加载器：空歌词也允许升级搜索；`override`/纯音乐时跳过升级。
- 测试：路由与 store。

### P4 封面 + 预取

- 播完写封面；`/online/cover?provider&id`；`trackCoverSrc` 切换。
- `MPLyricLoader.prefetch` + `player.js` 在换歌后预取后 2 前 1。
- 测试。

### P5 收尾

- 迁移清空（version.json）、CHANGELOG、pitfalls、data-reset 文档。
- 全量测试 + `check` + `build-client` + `install-local` + 重启验证。

---

## 10. 明确不做（与 Folia 的实现差异）

- 不引入 Electron 主进程 / IndexedDB / OPFS 多后端：插件只有 Host 磁盘，行为等价即可。
- 不做缓存目录可配置（保持 `<DSH_HOME>/music/cache`，便于数据清理）。
- 不做 ReplayGain、automix 分析、音量平衡、歌单等分类缓存（插件没有对应功能）。
- 不做音频 URL 预取（URL 由 Host 现取）与封面预取（播完才写）。
- 不做 provider 自带缓存的转交（我们的平台没有这种缓存）。

---

## 11. 待确认

1. **旧缓存**：升级时直接清空 —— **已确认**（实施为 `cache/version.json` 迁移，清 `cache/online`）。
2. **在线列表的「已缓存」标记与单删**：Folia 没有；**已确认删除**（列表/徽标/进度/`list|remove|meta|status` 全部移除）。
3. **缓存目录**：**已确认固定**在 `<DSH_HOME>/music/cache`，不可配置。

---

## 12. 验收标准

- 默认（缓存关闭）下：播完不产生任何音频/封面文件；列表无缓存标记。
- 打开缓存并听完一首：`cache/audio` 出现该歌条目 + meta，`cover` 出现封面；`GET /online/cache` 的 `songs/bytes` 增加。
- 听一半跳过：不产生条目。
- 单曲循环听完一遍：产生条目（每个循环只写一次）。
- 交叉淡化切歌：淡出方到结尾的，产生条目。
- 请求另一档：不使用缓存副本，重新取流；平台失败时回退另一档副本。
- 预览（`x-music-preview`）：不写入。
- 下载内容不是音频（HTML/JSON）：不写入。
- 下载时长不足一半：不写入；已有副本会删除。
- 播放报错后重试：绕过缓存；新副本写入后恢复正常。
- 上限设为 1 GB：写入后按 `usedAt` 修剪到 1 GB 以内；0 = 不修剪。
- 分类清理：清音频不影响封面以外的分类；清歌词只清歌词记录。
- 清空数据：缓存与歌词记录一起消失（现有数据页）。
