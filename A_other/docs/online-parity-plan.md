# 在线平台向 Folia 对齐 · 修改文档

> 状态：**阶段 1.1 / 1.2 / 1.3、阶段 2 主要能力、阶段 3 推荐与云盘已完成代码；0.38.0 酷狗 high/lossless 404 回归已修复**。探索页、个别平台写操作与修复后的本机实播复核仍待完成。
> 确认日期：2026-11-19
> 范围：现有在线平台（网易云 / QQ / 酷狗概念版 / 波点 / 汽水 / Navidrome）
> 标杆：Folia `A_other/upstream/folia-major-main`
>
> 本文只定义方向、边界、差距、阶段和验收标准。确认后按阶段改代码；未确认前不动代码。

---

## 1. 用户已确认的决定

| # | 决定 | 结果 |
|---|---|---|
| D1 | 是否新增平台 | **不新增**。YouTube Music、Spotify、Apple Music、fnmusic 等暂不考虑 |
| D2 | 歌单搜索页 | **不做**。搜索页不出现歌单入口或歌单栏目 |
| D3 | 歌手搜索 | **不新增独立 `searchArtists` 接口**。按 Folia 的做法：搜索歌曲，从结果中派生歌手并进入歌手页 |
| D4 | 酷狗播放 | **精确归一化后，按 Folia 的 metadata → hash-only 顺序取流**；修复“点 A 播 B”，不能用错误 album ID 换正确性 |
| D5 | 对齐重点 | **先把现有功能对齐 Folia**；能力补齐放在现有功能稳定之后 |
| D6 | 额外 provider | 本轮不做 |
| D7 | UI 结构 | 保持现有产品决定：搜索页是“歌手 → 专辑 → 歌曲”，歌单搜索不上屏 |

---

## 2. 目标

### 2.1 总目标

对现有平台，让下面五层的行为与 Folia 一致或可解释地等价：

1. **平台层**：同一个平台，不换源、不换供应商；
2. **接口层**：同类资源走同类上游接口和参数；
3. **数据层**：歌曲、专辑、歌手、歌单、歌词、音质、错误码的形状一致；
4. **能力层**：provider 能力位与 Folia 对齐，支持才显示；
5. **行为层**：分页、空结果、fallback、缓存、写操作结果一致。

### 2.2 不是目标

- 不复制 Folia 的 Electron/React 架构；
- 不把 Folia 的 UI 整体搬到 DSH；
- 不为了“能力齐全”添加假按钮、假数据或空实现；
- 不在本轮新增平台；
- 不恢复搜索结果中的歌单栏目；
- 不改音频引擎、Folia 歌词显示管线；
- 不修改 `A_other/upstream/folia-major-main` 的上游代码。

---

## 3. 对齐原则（第一性原理）

### 3.1 资源来源 = 平台，不是聚合站

现有平台都使用与 Folia 相同的上游包/平台接口：

| 平台 | 上游包 | 版本 |
|---|---|---|
| 网易云 | `@neteasecloudmusicapienhanced/api` | 4.41.1 |
| QQ | `@yakult-green-tea/qq-music-api` | 3.3.6 |
| 酷狗 | `kugoumusicapi` | 1.6.0（vendored） |
| 波点 | `bodian-music-api` | 0.1.2 |
| 汽水 | `qishui-music-api` | 0.2.2 |

因此“来源一致”主要落在**接口选择和参数正确性**，不是换数据源。

### 3.2 搜索的歌手不是独立资源

Folia 的 `OnlineSearchProvider` 只有：

```text
searchSongs
searchAlbums
searchPlaylists
```

没有 `searchArtists`。Folia 输入歌手名能搜到，是因为：

1. 平台按歌手名返回歌曲；
2. 结果行里的歌手是实体链接；
3. 点击后进入歌手详情。

因此本插件的目标也是：

```text
searchSongs(query) → 从结果构造 best artist → 进入歌手页
```

不新增歌手搜索 endpoint，不伪造歌手分页。

### 3.3 能力位是 UI 的唯一开关

- Provider 先声明能力；
- 能力为 `true` 且方法真实实现，UI 才显示；
- 未实现的能力不显示入口；
- 不用平台 id 写死 UI 分支。

### 3.4 先修现有，再补能力

现有功能（搜索、播放、歌词、播放列表、喜欢、专辑/歌手详情）必须优先稳定。
推荐、云盘、排行、探索、歌单订阅等属于能力补齐，放在后续阶段。

---

## 4. 当前差距

### 4.1 搜索

| 资源 | Folia | 当前 | 差距 / 处理 |
|---|---|---|---|
| 歌曲搜索 | `searchSongs` | 有 | 对齐分页、字段、空结果、失败 |
| 专辑搜索 | `searchAlbums` | 网易云 / QQ / 酷狗 / Navidrome 有 | 校验接口与分页；不要扩展到没有专辑搜索的平台 |
| 歌单搜索 | `searchPlaylists` | 网易云 / QQ / 酷狗有；汽水无 | 后端可保留；**不加入搜索页 UI** |
| 歌手搜索 | 无独立接口，从歌曲派生 | 从歌曲派生 best artist | 保持；不新增 `searchArtists` |
| 搜索页结构 | Folia 是搜索工作区 | 歌手 → 专辑 → 歌曲 | 保持用户已确认的混合结构 |
| 歌单结果 | Folia 有独立歌单结果 | UI 隐藏 | 按 D2，不显示 |

**当前已知需要修的点：**

1. QQ 歌单搜索已改为后端 `/search type=playlist`；
2. 酷狗歌单搜索已改为 package `search type=special`；
3. 汽水歌单搜索后端已补 `search_playlists`；三者均不进入搜索页 UI；
4. 搜索专辑的分页/加载更多尚未完整；
5. 歌手派生只在结果中有匹配歌手时出现，需核对与 Folia 的匹配口径。

### 4.2 播放 / 取流

| 平台 | Folia | 当前 | 差距 |
|---|---|---|---|
| 网易云 | 上游 `song/url/v1` + 质量/试听语义 | 有 | 校验试听、免费/VIP、错误码 |
| QQ | package `song/url` + 质量 | 有 | 校验付费/试听/错误码 |
| 酷狗 | 精确 providerData；metadata → hash-only | 精确归一化；package metadata → hash-only，网关/v6 hash-only | 待真实歌曲复核 |
| 酷狗概念版 | 概念版 package/legacy | 精确归一化；package/legacy metadata → hash-only | 待真实歌曲复核 |
| 波点 | package playback + preview | 有 | 校验 preview 标记 |
| 汽水 | package stream | 有 | 校验音质/错误 |
| Navidrome | Subsonic stream | 有 | 校验 direct/transcode URL |

**酷狗根因（已确认）：**

Folia 只从精确字段取：

```ts
albumAudioId = album_audio_id / albumAudioId
albumId = AlbumID / album_id / albumId
```

旧代码使用了：

```js
o.album_audio_id || o.Audioid || o.audio_id
```

`Audioid` / `audio_id` 不一定是专辑音频 ID，可能属于另一条记录。旧 package/legacy 路径又把这个值传给 `song_url`，于是返回另一首歌。

**目标：**

- 归一化改用精确字段；
- `song_url` 每个质量档先 metadata，再 hash-only；
- metadata 返回空 URL 时进入 hash-only；
- 如果真实环境仍出现错歌，停止 metadata-first，保留 hash-only 并写入差异说明。

### 4.3 歌词

我们的 [lyricSources.ts](../../src/client/utils/lyrics/lyricSources.ts) 来源表已与 Folia 基本一致：

```text
netease → amll → qq → kugou → qishui → spotify → appleMusic
```

现有差距不是“来源表缺项”，而是：

- 各来源适配器是否完整；
- 自动匹配顺序、别名、换歌手重试是否一致；
- 逐字/逐行/合唱窗口是否一致；
- 汽水/波点等平台自身歌词与跨源歌词的边界；
- Spotify/Apple 在本插件没有 provider，来源表保留但不产生来源。

本轮先做**逐来源审计**，不重写 [lyric-alignment-plan.md](lyric-alignment-plan.md) 已完成的架构。

### 4.4 资料库 / 写操作

| 能力 | Folia | 当前 |
|---|---|---|
| 我的歌单 | 有 | 有 |
| 歌单歌曲 | 有 | 有 |
| 喜欢/取消喜欢 | 有 | 有 |
| 加入歌单 | 有 | 有 |
| 从歌单移除歌曲 | 有 | 无 |
| 创建/重命名/删除歌单 | 有 | 无 |
| 订阅/取消订阅歌单 | 有 | 无 |
| 收藏/取消收藏专辑 | 有 | 有部分（平台能力不一） |
| 云盘 | 有 | 无 |
| 听歌排行 | 有 | 后端有，UI 入口不完整 |
| 播放上报 | 有 | 部分平台有 |

### 4.5 推荐 / 探索

Folia 的推荐能力包括：

- 每日推荐；
- 私人 FM；
- 推荐歌单；
- 历史推荐；
- 不喜欢/替换；
- 风格推荐；
- 推荐偏好；
- 探索页。

当前插件基本没有推荐页；旧模块里有推荐歌单的零散实现，但没有接入 provider 契约。

---

## 5. 目标能力矩阵

> 目标 = Folia 在对应平台声明/实现的能力；实现后本插件按真实实现声明。  
> “派生”表示不新增独立接口。

| 能力 | 网易云 | QQ | 酷狗概念版 | 汽水 | 波点 | Navidrome |
|---|---|---|---|---|---|---|
| 歌曲搜索 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 专辑搜索 | ✅ | ✅ | ✅ | — | — | ✅ |
| 歌单搜索 | 后端保留 | 后端保留 | 后端保留 | 可选补齐 | — | — |
| 歌手结果 | 派生 | 派生 | 派生 | 派生 | 派生 | 派生 |
| 播放 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 歌词 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅（Subsonic） |
| 喜欢/写 | ✅ | ✅ | 概念版按实际 | ✅ | ✅ | ✅（Subsonic） |
| 云盘 | ✅ | ✅ | ✅ | — | — | — |
| 排行 | ✅ | ✅ | ✅ | — | — | — |
| 推荐 | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| 歌单订阅 | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| 歌单增删 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 收藏专辑 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 探索 | ✅ | ✅ | — | ✅ | — | — |

> 表中“—”是 Folia/平台没有该能力，不是本插件暂缺；后续按平台实际能力实现，不能凭空打开。

---

## 6. 实施阶段

### 阶段 0：审计矩阵 + 契约测试

**目标**：先知道差什么，再改。

- 新建/更新对照矩阵，逐平台逐操作列出：Folia 方法、上游路径、当前实现、差距、能力位、测试；
- 在 `src/host/services/core/contract.js` 补齐能力常量；
- 在 `src/host/providers/sources/adapter.js` / `omni.js` 建立方法映射测试；
- 不改变 UI，不改变现有行为。

**验收**：矩阵中每行都有“已对齐 / 待改 / 有意差异”状态。

### 阶段 1：现有功能对齐

#### 1.1 搜索

- 歌曲搜索：分页、字段、错误、空结果；
- 专辑搜索：校验网易云/QQ/酷狗/Navidrome 接口；
- 歌手结果：保持从歌曲结果派生，不新增接口；
- 歌单搜索：后端已有保留；**不上搜索页**；
- QQ/酷狗歌单搜索旧接口是否改为 Folia 路径：只改 provider 方法，不显示 UI；
- 汽水歌单搜索：如果没有使用入口，标记为待补，不阻塞页面。

**验收**：
- 输入歌手名，搜索歌曲有结果且能进入歌手详情；
- 输入专辑名，有专辑的平台显示专辑行；
- 搜索页没有歌单栏目；
- 分页不重复、不丢结果。

#### 1.2 酷狗身份与取流

- 重写 `normalizeSong` 的 album 字段：
  - `albumAudioId` 只取 `album_audio_id` / `albumAudioId`（含嵌套 album/base 的安全字段）；
  - `albumId` 只取 `album_id` / `AlbumID` / `albumId` / 嵌套 album；
  - **移除** `Audioid` / `audio_id` 作为 albumAudioId 的 fallback；
- `packageStreamUrl` 支持 metadata/hash-only 两种参数；
- 只有 `album_audio_id` 存在时才发 metadata；半套 album_id 直接 hash-only；
- `getDownloadURL` 按请求音质档位的 Folia 阶梯取流，并统一使用主 hash；
- 概念版同样处理，但概念版 legacy 端点保留 hash-only 兜底；
- 新增测试：
  - 搜索/歌单/专辑来源归一化；
  - 取流参数顺序；
  - 错误 ID 不会被传入；
  - 真实问题歌曲手工复核。

**验收**：点 A 播 A；相同 hash 的不同来源一致；若 metadata 仍错，立即停止并回到 hash-only，记录差异。

**0.38.0 回归**：精确身份改造后，概念版歌单行只剩 album_id、没有 album_audio_id，却仍先发 metadata，导致 high/lossless 的 CDN 地址 404；标准路径又固定从 flac 开始并使用 hqHash/sqHash。已改为半套身份直接 hash-only、嵌套 package 保留 album_audio_id、按 Folia 的请求档位 + 主 hash 取流，并在 Host 的 CDN 404 分支按 Folia 阶梯降档。

#### 1.3 歌词

- 运行现有完整测试；
- 核对 `lyricSources.ts` 与 Folia 的来源表；
- 核对自动匹配顺序、别名、换歌手、合唱、纯音乐判定；
- 不重写已对齐的显示管线；
- 缺口只补适配器，不新增来源表条目。

**验收**：现有歌词回归全绿；跨来源匹配顺序与 Folia 文档一致。

### 阶段 2：资料库与写操作

- 云盘列表/播放；
- 听歌排行入口（后端已有）；
- 收藏专辑；
- 歌单订阅/取消；
- 歌单添加/移除歌曲；
- 创建/重命名/删除歌单；
- 播放上报补齐。

**要求**：
- 先 Host 方法，后 UI；
- 写操作失败必须回滚 UI 状态；
- 新增持久化时同步更新 `data-reset.md`；
- 新增 UI 前读 `A_other/docs/theme-guidelines.md`。

### 阶段 3：推荐 / 发现

- 每日推荐；
- 私人 FM；
- 推荐歌单；
- 历史；
- 不喜欢/替换；
- 风格推荐/偏好；
- 探索页。

按平台能力逐项打开，不做“所有平台都显示但点不动”的入口。

### 阶段 4：收尾

- 更新对照矩阵；
- 更新 README / CHANGELOG / provider-architecture；
- 全量测试；
- 安装并完整重启验证；
- 记录未验证的账号能力。

---

## 7. 文件级改动清单

### Host

| 文件 | 改动 |
|---|---|
| `src/host/services/core/contract.js` | 能力位、方法能力映射、provider namespace |
| `src/host/providers/sources/index.js` | 各平台能力声明 |
| `src/host/providers/sources/adapter.js` | 新方法转发 |
| `src/host/providers/sources/omni.js` | 能力门控与新方法 |
| `src/host/providers/index.js` | 搜索、播放、资料库、推荐、写操作 facade |
| `src/host/providers/kugou.js` | 精确归一化、metadata/hash 取流 |
| `src/host/providers/kugou-lite.js` | 精确归一化、metadata/hash 取流 |
| `src/host/providers/netease.js` / `netease-legacy.js` | 搜索/推荐/云盘/排行/写接口对齐 |
| `src/host/providers/qq.js` / `qq-legacy.js` | 歌单搜索、推荐、云盘、排行、写接口 |
| `src/host/providers/sources/qishui/index.js` | 推荐/探索/歌单写接口按能力补 |
| `src/host/providers/sources/bodian/index.js` | 资料库/推荐/写接口按能力补 |
| `src/host/providers/navidrome.js` | Subsonic 对应能力 |
| `src/host/http/routes/online.js` | 新路由、错误、能力门控 |

### Client

| 文件 | 改动 |
|---|---|
| `src/client/panel-v3/p3-pages.js` | 搜索派生、分页、详情入口；不添加歌单搜索 |
| `src/client/panel-v3/p3-core.js` | 新能力行/卡片 |
| `src/client/panel-v3/p3-shell.js` / `p3-nav.js` | 新页面入口，仅在能力允许时 |
| `src/client/services/api/api.js` | 新接口调用 |
| `src/client/components/online/online.js` | 搜索/收藏/歌单写入状态 |

### Tests

- `test/host/kugou-upstream.test.mjs`
- `test/host/netease-upstream.test.mjs`
- `test/host/qq-upstream.test.mjs`
- `test/host/sources.test.mjs`
- `test/host/online.test.mjs`
- `test/client/panel.render.test.mjs`
- 新能力对应 route/client 测试。

### Docs

- 本文；
- `A_other/docs/provider-architecture.md`；
- `A_other/docs/pitfalls.md`（新增问题按现象/原因/处理/防回归）；
- `CHANGELOG.md`；
- `README.md`；
- 涉及新存储时更新 `A_other/docs/data-reset.md`。

---

## 8. 测试与验收

### 8.1 自动测试

每个阶段必须：

```bash
node scripts/build-client.mjs   # 改 Client 后
npm test
npm run check
```

### 8.2 契约测试

每个 provider 方法至少覆盖：

- 正常返回；
- 空结果；
- 分页；
- 能力位为 false 时不调用；
- 上游错误透传/翻译；
- 参数正确（特别是酷狗 album ID）。

### 8.3 手工验收

- 搜索歌名、专辑名、歌手名；
- 打开歌手/专辑/歌单详情并返回；
- 播放免费/VIP/试听歌曲；
- 切换音质；
- 歌词来源切换与自动匹配；
- 写操作后刷新仍保持；
- 未登录/未配置平台的空态。

### 8.4 不能验证的项

真实账号、平台地区、版权限制、酷狗概念版账号权限无法只靠单元测试证明，必须在报告中标注“未验证”及验证方法。

---

## 9. 风险与处理

| 风险 | 处理 |
|---|---|
| 酷狗 metadata-first 再次错歌 | 真实歌曲复核；失败立即回退 hash-only，并记录为有意差异 |
| 平台接口变更 | 包版本钉死；对照 Folia 的版本；改前读 UPSTREAMS |
| 概念版能力与标准酷狗不同 | 以概念版实际接口为准；能力位按真实实现 |
| 账号接口无法自动测试 | 标记未验证；提供手工验证步骤 |
| 能力补齐导致 UI 过载 | 先 provider 后 UI；仅能力为 true 显示 |
| 新增存储破坏清理 | 读 data-reset，补分类与测试 |
| 搜索页与既有决定冲突 | 按 D2/D3 执行；不新增歌单栏目，不新增歌手 endpoint |

---

## 10. 完成定义

本轮“在线平台对齐”完成时，应同时满足：

1. 所有现有平台的搜索、播放、歌词、资料库入口行为有对照记录；
2. 能力位与实际实现一致，无假入口；
3. 酷狗 A→B 问题有回归测试和真实复核；
4. 歌词来源/顺序与 Folia 的既有对齐文档一致；
5. 推荐/云盘/排行/写操作按阶段实现，未实现项明确标注；
6. `npm test` / `npm run check` 全绿；
7. 安装到 desktop profile 并完整重启后验证；
8. 文档、CHANGELOG、pitfalls 更新。

---

## 11. 实施记录

### 2026-11-19 · 阶段 1.1 / 1.2 / 1.3 / 2 / 3（核心）

- 酷狗标准版与概念版：
  - `albumAudioId` 只取 `album_audio_id` / `albumAudioId`（含安全的嵌套/基字段），不再用 `Audioid` / `audio_id`；
  - 概念版不再把 `mixsongid` 当 `albumAudioId`；
  - package `song_url` 每档先 metadata，再 hash-only；网关与 v6 兜底保持 hash-only；
  - 新增身份归一化、metadata/hash 顺序测试。
- 搜索后端：
  - QQ 歌单搜索改为 package `/search type=playlist`；
  - 酷狗歌单搜索改为 package `search type=special`；
  - 汽水补 `search_playlists`；
  - 搜索页仍不显示歌单栏目。
- 歌词对齐：来源 id 兼容旧 `kugou`，默认首选来源 QQ；查询改为 `title - artist - album`；自动匹配保留歌曲自身平台。
- 推荐/云盘：
  - Host 新增 `dailySongs`、`recommendedCollections`、`personalFm`、`cloudSongs` 门面、路由与能力位；
  - panel-v3 新增「推荐」「云盘」Tab；推荐页含每日推荐、推荐歌单、私人 FM；云盘页含分页；
  - 网易云/QQ/酷狗（含概念版）已接入；汽水/波点没有对应能力，不显示入口。
- 资料库/写操作：
  - 网易云/QQ 支持歌单/专辑订阅；
  - 网易云/QQ/酷狗支持自建歌单行内移除；酷狗概念版沿用其能力位，未强行打开写操作。
- 未完成：探索页（NetEase/QQ 的 section 流）、歌单创建/改名、播放上报（QQ/酷狗平台无对应接口）。
- 全量 `npm test` / `npm run check` 通过；真实账号与真实问题歌曲尚未验证。

### 2026-11-19 · 0.38.0 酷狗 high/lossless 404 回归

- 真实报告：酷狗概念版登录普通账号，`quality=high` / `lossless` 的 CDN 地址 404，Host 回 502；`standard` 200。
- 根因：0.38.0 把歌单/专辑行的 `albumAudioId` 从旧的 `mixsongid` 改为精确字段后，行上只剩 album_id，却仍先发半套 metadata；接口返回另一个文件地址。标准路径的固定 flac 起点与 hqHash/sqHash 也偏离 Folia。
- 修复：半套身份直接 hash-only；嵌套 package 保留 album_audio_id；标准路径按请求档位（128 / 320 / flac）与主 hash 取流；Host 在 CDN 404 时按 Folia 阶梯降档重试。
- 回归：`kugou-upstream.test.mjs`、`online-stream-fallback.test.mjs`；真实问题歌曲待本机复核。

---

## 12. 开放项

以下不影响方向，但实施前/中需确认：

1. **酷狗 metadata-first 的真实结果**：如果精确归一化后仍错歌，是否接受保留 hash-only 并记录差异？（当前建议：接受）
2. **汽水歌单搜索后端**：搜索页不显示歌单，是否还需要为 API 契约补齐？
3. **缺失能力的优先级**：阶段 2/3 中推荐、云盘、排行、写操作按什么顺序做？当前建议：云盘/排行 → 写操作 → 推荐/探索。
4. **登录账号测试**：哪些平台有可用的真实账号用于手工验收。
