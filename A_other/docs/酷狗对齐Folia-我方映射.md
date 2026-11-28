# 酷狗对齐 Folia · 我方调用面清单

> 基线：`1580486`（2026-11-28，`feat(酷狗): 原样移植 Folia 酷狗音源模组并接上插件宿主面`）。
> 本文只读梳理，未改任何代码；行号以该提交为准。
>
> 重要前提：该提交只落了 Folia 模组镜像（`src/folia-mods/sources/kugou/**`）与打包产物（`src/host/vendor/kugou-folia/source.bundle.mjs`），**没有改门面**——`git show --stat 1580486` 不含 `src/host/providers/index.js`，`src/host/**` 里也没有任何文件 import 新 bundle。所以下面描述的门面／路由／DTO 仍是当前线上行为，也是接线时必须保持的契约。
>
> 上游参照（只读）：`A_other/upstream/folia-major-main/sources/kugou/core/kugouProvider.ts`（`normalizeKugouSong` :281、`createKugouSource` :733）；桥接层 `sources/kugou/main/kugouApiBridge.cjs`。

---

## 0. 现状速览（6 条事实）

1. **真正注册的酷狗 id 只有一个：`kugouLite`。** `PROVIDERS` = `['netease','qq','kugouLite','navidrome']`（`src/host/providers/index.js:23`）；`SOURCE_IDS` 同（`src/host/services/core/contract.js:14`）；注册表条目 id 同（`src/host/providers/sources/index.js:142-147`）。
2. **门面里仍有 `kugou` 双分支，但它已不可达。** `provider-store` 的 `EMPTY` / `DEVICE_PROVIDERS` 只有 `kugouLite`（`src/host/providers/provider-store.js:28-31,43`）：`setLogin('kugou')` / `markExpired('kugou')` / `setSession('kugou')` 全部提前 return（同文件 :135-137, :155-156, :170-172），`session('kugou')` 恒为 `{}`（:107-132）。也就是说 `index.js` 里 40 处 `provider === 'kugou'` 分支在生产路径上跑不到。
3. **实现是两套模块**：`src/host/providers/kugou.js`（2123 行，标准版 appid 1005）与 `src/host/providers/kugou-lite.js`（808 行，概念版 appid 3116/clientver 11440）。门面里有的调用走 `KG.xxx(..., 'lite')`（平台参数），有的直接走 `KGL.xxx`（独立实现）——这就是移植后需要被统一掉的分叉。
4. **两套实现共用一个 worker 服务**：`src/host/services/kugou-api.js` 按 `platform` 起两个常驻 worker，worker 里 `require('../vendor/kugoumusicapi')` 后按操作名直调包函数（`src/host/services/kugou-worker.js:26-35,43-44`）。
5. **歌曲 id 就是酷狗 hash，全链路小写**：`normalizeSong` 用 `lowHash`（`kugou.js:362`），门面 `shape()` 的 `id` 直接取它（`index.js:57,73`）。写操作另需 `albumAudioId` / `mixSongId` / `fileId`，这些**不在**给客户端的 DTO 里，只活在 Host 内存 `rawSongs`（`index.js:43,1479-1483`）。
6. **客户端的酷狗硬编码面共 15 个文件**（source 顺序、歌词默认源、i18n、CSS、登录弹窗、logo 表，另有 Host 入口的 `music_control` 枚举与歌词源注册），见 §6。

---

## 1. 门面函数表（`src/host/providers/index.js`）

约定：`←` 读作「被谁调用」。路由均指 `src/host/http/routes/online.js`。所有函数都经 `src/host/providers/sources/adapter.js` 的 `call(method, ...)` 转发（:39-47），能力门见 §1.6。

### 1.1 搜索 / 目录

| 函数（行） | 入参 | 返回 | 使用方 / 酷狗要点 |
| --- | --- | --- | --- |
| `search` :111-144 | `(provider, query, cookie='', session={})` | `object[]`（`shape()` 形状） | ← `/online/search` kind=song（:580）；← `searchPage`（:167）；← `artistSongs` 名字回退（:632）；← `albumSongs` 回退（:750）。酷狗走 `KG.search(text, cookie, 1, kugouPlatform(provider))`，raw 存 `kugouLite:` / `kugou:` 前缀（:135-142）。空 query 直接 `[]`（:112-113）。 |
| `searchPage` :150-184 | `(provider, query, cookie, session, page=1)` | `{results, total, page, hasMore}` | ← `/online/search`（:580）。酷狗非 QQ，走「一次拿全」分支：恒 `page:1, hasMore:false`（:164-169）。 |
| `searchAlbums` :297-337 | `(provider, query, cookie, session, page=1)` | `{items, total, page}`，item = `albumCard` + `type:'album'` | ← `/online/search?kind=album`（:568）。酷狗走 `KG.searchAlbums(..., platform)` 的 `search type=album`（:317-324）。 |
| `searchPlaylists` :340-354 | 同上 | `{items, total, page}`，item = `playlistCard` | ← `/online/search?kind=playlist`。酷狗 `search type=special`（:347）。 |
| `artistSongs` :458-634 | `(provider, artist, cookie, session, artistId='', page={limit,offset})` | `{songs, total, hasMore, nextOffset}` | ← `/online/artist-songs`（:616）。酷狗分支 :580-631：artist id 非纯数字时先用 `KG.search` 反查 `artistsDetail[].id`（:586-602），再 `callKugou(platform,'artist_audios',{id,page,pagesize,sort:'hot'})`（:607-612）；`nextOffset = offset + rows.length`（:623）。 |
| `albumSongs` :643-760 | `(provider, id, cookie, session, hint={name,album,artist})` | `{id, name, cover, artist, songs}` | ← `/online/album`（:1852）。酷狗 :688-722：`album_detail` 取名字/封面/歌手，`album_songs` 每页 30 最多 20 页；失败回退 `KG.getAlbumSongs`（mobilecdn，:727）；再失败才按专辑名搜索（:747-759）。 |
| `artistAlbums` :1313-1370 | `(provider, id, cookie, session)` | `{artist, albums}` | ← `/online/artist`（:1782）。酷狗 :1339-1355：`artist_detail` + `artist_albums`（pagesize 50），产出 `artistCard` / `albumCard`。 |
| `songs` :1266-1275 | `(provider, cookie, session, size)` | `object[]` | ← `/online/songs`（:1732）。酷狗恒 `[]`。 |
| `nativeSongs` :1283-1288 | 仅 Navidrome | `{songs,total,offset}` | ← `/online/songs` native 分支（:1717）。酷狗恒空。 |
| `artists` :1301-1304 / `albums` :1307-1310 | — | 酷狗恒 `[]` | ← `/online/artists`、`/online/albums`。 |

### 1.2 推荐 / 云盘

| 函数（行） | 入参 | 返回 | 使用方 / 酷狗要点 |
| --- | --- | --- | --- |
| `dailySongs` :202-226 | `(provider, cookie='', session={})` | `object[]` | ← `/online/discover`（:1669）。酷狗 `everyday_recommend`，经 `KG.dailySongs(session, platform)`（:217-224）。 |
| `recommendedCollections` :229-240 | `(provider, cookie, session, limit=30)` | `playlistCard[]` | ← `/online/discover`（:1670）。酷狗不是网页歌单，而是 6 张概念版推荐卡 `kugou-card-<id>`（:233-239；卡片表 `kugou.js:662-670`）；`playlistCard` 只认 `id/name/cover/trackCount/playCount`（:187-199）。 |
| `personalFm` :243-254 | `(provider, cookie, session)` | `object[]` | ← `/online/personal-fm`（:1684）。酷狗 `personal_fm`（:247）。 |
| `cloudSongs` :257-269 | `(provider, cookie, session, page=1)` | `object[]`，100 条/页 | ← `/online/cloud`（:1698）。酷狗 `user_cloud`；行带 `variant:'cloud'` 与 `fileId`（`kugou.js:817-847`）；未登录直接 `[]`（:823）。 |
| `historyDates` :272-276 / `historySongs` :279-289 | — | 酷狗抛 `该平台没有日推历史` | 无路由调用；与能力声明不一致，见 §1.6 末条。 |

### 1.3 歌单 / 喜欢 / 写入

| 函数（行） | 入参 | 返回 | 使用方 / 酷狗要点 |
| --- | --- | --- | --- |
| `myPlaylists` :1376-1390 | `(provider, cookie, session)` | `shapePlaylist[]` | ← `/online/my-playlists`（:1797）。`kugouLite → KGL.getMyPlaylists(session)`，`kugou → KG.getMyPlaylists(session)`（:1386-1388）。 |
| `playlistSongs` :1443-1469 | `(provider, id, cookie, session)` | `{name, cover, trackCount, songs}` | ← `playlistSongsPage` 的兜底（:1650）；经 adapter 暴露但路由不直接调（路由只调 `playlistSongsPage`）。酷狗转 `kugouPlaylistSongs`（:1403-1437），那条内部函数决定三套 id 空间怎么读（见 §3.2）。 |
| `playlistSongsPage` :1532-1660 | `(provider, id, cookie, session, page={limit,offset})` | `{name, cover, trackCount, songs, hasMore, nextOffset}` | ← `/online/playlist-songs`（:1891）。酷狗分支 :1567-1649（推荐卡 / lite 直读 / 账号歌单 / 标准版 / 公开 specialid 五条路）。 |
| `onlineLiked` :1692-1715 | `(provider, id, cookie, session)` | `boolean` | ← `/online/liked`（:1924）。酷狗读「我喜欢」整表，用 `String(song.hash) === target` 比对（:1705-1710）。 |
| `onlineLikedIds` :1786-1804 | `(provider, cookie, session)` | `string[]`，元素为 `online:<provider>:<hash>` | ← `/online/liked-ids`（:1939）。生成点 :1800。 |
| `setOnlineLiked` :1717-1750 | `(provider, song, on, cookie, session)` | `boolean` | ← `/online/like`（:1963）。`kugouLite → KGL.setLiked(raw, on, session)`（:1725-1734）；`kugou` 走加/删「我喜欢」歌单（:1737-1747）。 |
| `addOnlineSongToPlaylist` :1752-1782 | `(provider, song, playlistId, cookie, session)` | `true` | ← `/online/playlist-add`（:1988）。`kugou` → `KG.addSongToPlaylist(kgWriteSong(...))`（:1766-1769）；`kugouLite` → `KGL.addSongToPlaylist(raw, playlistId, session)`（:1770-1779）。 |
| `removeOnlineSongFromPlaylist` :1863-1884 | `(provider, song, playlistId, cookie, session)` | `true` | ← `/online/playlist-remove`（:2051）。需要 `fileId`，缺失即抛「酷狗歌曲缺少 fileId」（:1874-1875）；lite 用 `KGL.removeSongFromPlaylist`（:1879）。 |
| `subscriptionStatus` :1887-1891 | `(provider, type, id, cookie)` | 酷狗恒 `false` | ← `/online/subscription` GET。 |
| `subscribeCollection` :1894-1898 | — | 酷狗抛「该平台不支持订阅」 | ← `/online/subscription` POST。 |
| `listeningRank` :1814-1860 | `(provider, range, cookie, session)` | `object[]`（`shape` + `listenCount`） | ← `/online/my-playlists` 注入卡片（:1806）、← `/online/playlist-songs` 的 `listening-rank-*` 分支（:1879）。酷狗 `callKugou(platform,'user_listen',{userid, type: week?0:1})`，读 `body.data.lists`，`shapeRankSong(..., item.listen_count)`（:1844-1858）。 |

### 1.4 播放 / 歌词

| 函数（行） | 入参 | 返回 | 使用方 / 酷狗要点 |
| --- | --- | --- | --- |
| `resolveStream` :832-866 | `(provider, id, cookie='', session={}, quality='high')` | `{url, quality, replayGain}` | ← `/online/stream`（:682）、`/online/quality`（:1288）、`/online/check-playable`（:1362）、媒体缓存写入（`src/host/services/media/cache-writer.js:102`）。酷狗把 `standard/high/lossless/hires` 翻成 `['128'] / ['320','128'] / ['flac','320','128']`（:856-861），再 `KGL.resolveStream` 或 `KG.getDownloadURL`（:862）。 |
| `resolveLegacyStream` :873-876 | `(provider, id)` | `{url, quality, bitrate, replayGain}` 或 `null` | ← `/online/stream` 的 `legacy=1` 分支（:678、:750）。仅酷狗；恒走 `KGL.resolveLegacyStream`（m.kugou.com getSongInfo，`kugou-lite.js:418-432`）。 |
| `createKugouDevice` :879-881 | `()` | `{guid, mid, dfid, dev, mac, webgl}`（`kugou.js:102-112`） | ← `/online/stream`（:663）、`/online/quality`（:1284）、`/online/check-playable`（:1349）、媒体缓存（`cache-writer.js:96`）；经 adapter 暴露为 `createDevice()`（`adapter.js:242-244`）。 |
| `requiresVip` :763-772 | `(provider, id)` | `boolean` 或 `null` | ← adapter（`adapter.js:197-199`）。只查 `rawSongs` 缓存；酷狗判据 `privilege >= 10`（:770）。 |
| `lyric` :1022-1151 | `(provider, id, cookie, session)` | `{lrc, translation, romaji?, lines?, wordLevel?, raw?}` | ← `/online/lyric`（:1033）、← 歌词匹配的 `fetchLyricSource`（:454）。酷狗 :1101-1146：先 `KG.getLyric` 取 LRC，再 `KG.getWordLines` 取 KRC；有 word 行时把 `lines` + `raw.formatHint='krc'` 一起给出去（:1123-1139）。 |
| `chorus` :1015-1020 | `(provider, id, cookie)` | 酷狗恒 `null` | ← `/online/chorus`（:1267）。能力门 `chorus → lyrics`（`contract.js:121`）会放行，但门面没实现副歌接口。 |
| `lyricSearchAlias` :787-802 / `alternateArtistName` :810-826 | `(provider, id)` | 酷狗恒 `null` | ← `/online/best-lyric` 的别名回退（:525-526）。 |
| `forgetProviderTokens` :1296-1298 | `(provider)` | 酷狗无操作 | ← `/online/logout`（:1647）经 adapter `forgetTokens()`。 |
| `reportPlayback` :1907-1933 | `(provider, song, report, cookie)` | 仅 NetEase；酷狗抛 | ← `/online/report-playback`，路由先看 `playbackReports` 能力（:1307），酷狗未声明所以不会调到。 |

### 1.5 登录 / 账号

| 函数（行） | 入参 | 返回 | 使用方 / 酷狗要点 |
| --- | --- | --- | --- |
| `loginStart` :916-946 | `(provider, session={}, mode='qq')` | `{key, imageDataUrl, url}` | ← `/online/login/start`（经 login bridge `start()`，`src/host/providers/login/bridge.js:50-59`）。酷狗 :930-944：先 `KG.registerDevice(device, platform)`，再 `KG.createQRLogin`，把出码用的 device 记进 `kugouDevices` Map（:888,942）。 |
| `loginStatus` :963-1004 | `(provider, key, mode='qq')` | `{status, cookie:'', token, userid, nickname, vipType, vipToken, avatarUrl, platform, device{mid,dfid,guid}}` | ← `/online/login/status`（经 bridge `poll()`，`bridge.js:60-105`）。酷狗 :985-1002：`KG.checkQRLogin(key, device, platform)`，`tokenInfo` 只映射 token/userid/vip_type/vip_token→`nickname`/`avatarUrl` 恒为空字符串（`kugou.js:244-251`）。 |
| `providerVip` :1934-1967 | `(provider, cookie, session)` | `boolean` 或 `null` | ← adapter `vip()`。lite → `KGL.getVip(session).vip`（:1951）；standard → `KG.getVip` 的 `data.is_vip/vip_type/su_vip_level` + `session.vipType` 兜底（:1952-1964）。 |
| `providerVipInfo` :1982-2015 | `(provider, cookie, session)` | `{vip, expiresAt}` | ← `/online/providers` 的 `vipInfoState`（:2316）。lite :1983-1986；standard :1987-2004（取 `vip_end_time` / `su_vip_end_time` 里最晚的未来时间）。 |
| `providerProfile` :2023-2056 | `(provider, cookie, session)` | `{nickname, avatarUrl, accountId}` 或 `null` | ← `/online/providers` 的 `profileState`（`online.js:2293` → `routes.js:349-362`，直调门面、不走 omni）、← 登录 bridge 的补资料（`bridge.js:84-94`）。lite → `KGL.getProfile(session)` + `session.userid`（:2035-2038）；standard → `KG.getMyUserInfo(session)`（:2039-2040）。 |

### 1.6 能力门（`src/host/services/core/contract.js` + `sources/index.js`）

- **方法→能力表** `METHOD_CAPABILITY`（`contract.js:97-137`）：`stream→playback`、`lyric/chorus→lyrics`、`myPlaylists→userPlaylists`、`playlistSongs(Page)→playlistSongs`、`liked/likedIds→likes`、`setLiked→likeWrite`、`addToPlaylist→playlistAdd`、`removeFromPlaylist→playlistTrackMutations`、`cloudSongs→userCloud`、`dailySongs/recommendedCollections/personalFm→recommendations`、`listeningRank→listeningRank`、`vip/vipInfo→vip`、`subscriptionStatus/subscribeCollection→playlistSubscription`、`reportPlayback→playbackReports`、`loginStart/loginStatus→loginQr 或 loginPassword`（:135-136）。`profile` / `forgetTokens` / `requiresVip` 明确不设门（:132-134）。
- **放行语义**（`contract.js:145-150`）：表里没有或为 `null` → 允许；数组 → 任一命中；单值 → `caps[key] !== false`。注意它**不是** `=== true`，所以「漏声明」会被放行；真正把未声明项关掉的是 `capabilities()` 把未声明填 `false`（:84-88），再由 adapter 用同一份 `buildCapabilities` 收口（`sources/adapter.js:37,39-47`）。
- **分组视图** `PROVIDER_API_GROUPS`（`contract.js:158-168`）只覆盖九个命名空间：`search / playback / lyrics / auth / library / catalog / mutations / recommendations / cloud`；`providerApi()` 只挂实际存在的函数（:171-181）。`adapter.js:250` 把它挂到 `source.api`。
- **酷狗能力声明** `KUGOU_LITE_CAPABILITIES`（`sources/index.js:78-97`）：CHINESE_CAPABILITIES（:24-39）加上 `auth / userLibrary / wordByWordLyrics / searchAlbums / recommendations / userCloud / historyRecommendations / likeWrite / playlistAdd / mutations / playlistTrackMutations`，显式 `userAlbums:false`。质量梯度 `['standard','high','lossless']`（:122,146），没有 hires。
- **两处已存在的声明/实现不一致**，移植时要么补实现要么降标志：① `historyRecommendations:true`（:86）但门面 `historyDates/historySongs` 对酷狗直接抛（`index.js:272-289`），且本仓没有对应路由；② `chorus` 被 `lyrics` 放行、adapter 也暴露它，但门面对酷狗恒 `null`（`index.js:1015-1020`）。

---

## 2. 路由分派点（`src/host/http/routes/online.js`）

先说结论：**路由层几乎不按 provider 分支**。除下面 2.1 的 11 处直连判断，所有能力都经 `omni.<method>` → `adapter` → 门面。因此「替换酷狗实现」的改动面应集中在门面；路由只需要保证 2.2 的门面形状不变。

### 2.1 路由里真正按 provider 分支的地方（全部 11 处）

| 行号 | 判断 | 它要求门面／依赖提供什么 |
| --- | --- | --- |
| :357-369 `localServiceStatus` | `kugou` 或 `kugouLite` → `kugouServiceStatus(provider)` | 服务层 `kugouServiceStatus(platform)` 接受 `kugou`/`kugouLite` 两种写法，内部 `kugouPlatformOf` 归一（`kugou-api.js:41-43,205-215`）。返回 `{running, starting, error}`，路由再包成 `{available, failed, error, restarting}`。 |
| :371-376 `restartLocalService` | 同上 → `restartKugouService(provider)` | 同上；`kugou-api.js:218-226`。 |
| :662-665 `/online/stream` | `kugou`/`kugouLite` 且 `session.mid` 为空 | `omni.createDevice(provider)`（→ 门面 `createKugouDevice`）必须返回带 `mid` 的会话；并把结果 `providerStore.setSession(provider, session)` 落盘。**这是唯一真正补设备身份的地方。** |
| :747-764 `/online/stream` | 上游 CDN 404 且非 `legacy=1` | `resolveLegacyStream(provider, id)`（路由直接 import，:678,750）必须能给出可播 URL；成功后以 `legacy=1` 内部重放一次请求。 |
| :768-780 `/online/stream` | 上游 CDN 404 | `nextLowerOnlineQuality(quality)`（:188-191）逐档降级，重放请求；酷狗不参与后面的 `refresh` 重签逻辑（:786）。 |
| :786-804 `/online/stream` | `kugouAlreadyDegraded`（= 酷狗且上游 404）时跳过「换节点重签」 | 酷狗的 404 已由 legacy + 降档两条退路处理，不再走通用 `refresh`；其它 CDN 状态（403/429/5xx）仍走 refresh 重试（:794）。 |
| :1283-1286 `/online/quality` | `provider === 'kugou'` 且 session 无 mid | 期望补设备身份——但 `setSession('kugou')` 是 no-op（`provider-store.js:43,170-172`），且 `kugouLite` 不在这条分支里。**实际效果：lite 未登录时该接口拿不到设备，`omni.stream` 抛「酷狗概念版 session 缺少设备标识」，被 :1290-1293 吞成 `{quality:'', playable:false}`。** |
| :1348-1351 `/online/check-playable` | 同上，`provider === 'kugou'` | 同上，同样是空操作；lite 未登录时逐首 `playable:false`（:1362-1366 异常被吞）。 |
| :1699 `/online/cloud` | `pageSize = netease ? 200 : 100` | 门面每页返回 100 条时 `hasMore` 才有意义（:1700）。 |
| :2268-2271 `/online/providers` | `kugouSessions.refreshIfDue('kugou')` + `validate('kugouLite')` | `refreshIfDue` 只接受 `'kugou'`（`kugou-session.js:43`）且依赖 `session.token`，而 `session('kugou')` 恒 `{}` → **恒 no-op**；真正跑的是 `validate('kugouLite')`（:88-108，用 `KGL.getMyPlaylists` 探活）。 |
| :2300-2315 `/online/providers` | `provider === 'kugouLite'` 且没有头像 | 用 `profileState('kugou')` 补同一账号的头像/昵称。该函数在 `routes.js:349-362`：直调门面 `providerProfile('kugou')` → `KG.getMyUserInfo`，异常被吞并转给 `markExpiredFromError`（对 `kugou` 也是 no-op）。因为 `session('kugou')` 恒 `{}`，`getMyUserInfo` 直接抛「未登录」，这条路同样拿不到东西——**头像只能靠 lite 自己的 `/v1/user_verify`。** |

另有 4 处「非酷狗专属但会决定酷狗行为」的分支，接线时别漏：`:1846`（只有 Navidrome 强制专辑 id，酷狗可以只带专辑名）、`:1716`（Navidrome native 列表）、`:1224`（非 Navidrome 的 replaygain 只读缓存）、`:1574-1628`（Navidrome 密码登录）。

### 2.2 经 omni 的分派点：路由 → 门面方法 → 必须的形状

| 路由（行） | 门面方法 | 路由对返回值的硬要求 |
| --- | --- | --- |
| `/online/search` :549-599 | `searchCollections`（album/playlist，:568）或 `searchPage`（:580） | `{items,total,page,hasMore}` / `{results,total,page,hasMore}`；搜索词空 → 400（:556）；`kind` 只认 song/album/playlist（:557）。 |
| `/online/artist-songs` :601-633 | `artistSongs`（:616） | 允许返回数组（一次性源）或 `{songs,total,hasMore,nextOffset}`；路由自己兜 `nextOffset`（:618-623）。`artistId`、`limit/offset` 从 query 来（:604-608）。 |
| `/online/stream` :635-908 | `stream`（:682） | `{url, quality, preview?, replayGain?}`；`url` 空即 404 `NO_STREAM`（:695-705）。Range 必须被代理并保留 206（:809-888）；`preview` 会写 `x-music-preview`（:829）。 |
| `/online/info` :910-939 | 媒体缓存，不调门面 | 只读 `mediaCache.lookup(provider,id)`；未命中 `cached:false`。 |
| `/online/lyric` :941-1066 | `lyric`（:1033） | `{lrc, translation, romaji?, lines?, wordLevel?, raw?}`。**LRC 为空就不写缓存**（:1036-1047）；返回时 `lines` 必须是 `[{t,text,words?}]`（客户端按此渲染）。 |
| `/online/best-lyric` :1072-1137 | `lyric`（另一源）+ `lyricSearchAlias` / `alternateArtistName`（:525-526） | 匹配结果要能组织成 `{source,id,score,wordLevel,isPureMusic,lrc,translation,romaji,lines,raw}`（:1082-1099）。 |
| `/online/lyric-state` / `-choice` / `-import` :1141-1217 | 歌词记录，不调门面 | 记录键 `online:<provider>:<id>`（`onlineLyricKey`，:226-228）。 |
| `/online/chorus` :1259-1272 | `chorus`（:1267） | 允许 `null`，路由照 200 返回。 |
| `/online/quality` :1274-1294 | `stream`（:1288） | `{quality, playable}`；任何异常都吞成 `{quality:'', playable:false}`（:1290-1293）。 |
| `/online/report-playback` :1296-1327 | `reportPlayback`（:1314） | 先看 `capabilities.playbackReports`（:1307）；`playedSeconds < 30` 直接 `reported:false`。 |
| `/online/check-playable` :1329-1371 | `stream`（:1362），并发窗口 6（:1357-1369） | 返回 `{playable: {id: bool}}`；单首异常记 `false`。 |
| `/online/login/start` :1373-1408 | `login.start`（bridge → 门面 `loginStart`） | `{key, imageDataUrl, url, expiresAt}`；`supportsQrLogin` 只看能力 `loginQr===true`（:351-354）。 |
| `/online/login/status` :1414-1448 | `login.poll`（bridge → `loginStatus`） | 必须返回**这次 key** 的快照；key 不匹配 409（:1422-1425）；`status` 归一成 success/waiting/scanned/…（:1438-1442）。 |
| `/online/login/session` :1450-1473 | `login.sessionOf`（bridge 内存态） | `{provider, login, lastLoginCompletion:null, setup:null}`；只读、不触发轮询。 |
| `/online/login/cancel` :1475-1490 | `login.cancel` | 按 key 取消（:1488）；adapter 的 `cancelLogin` 是恒真 no-op（`adapter.js:231-233`）。 |
| `/online/account-sync` :1494-1510 | `accountReads.read`（不直接调门面） | `{account}` 或 `null`。 |
| `/online/account` :1512-1519 | `accountStore.get` | 会话账号快照。 |
| `/online/login/local-service` :1521-1538 | `localServiceStatus` / `restartLocalService` | 见 2.1 前两条。 |
| `/online/login/self-check` :1540-1556 / `-diagnostics` :1558-1572 | 注册表 + 本地服务 | `checks[]` / `lines[]` 文本。 |
| `/online/logout` :1630-1652 | `login.logout` + `accountReads.signOut` + `omni.forgetTokens` | 三者都不许把登出变成失败（:1646-1650 catch）。 |
| `/online/discover` :1660-1676 | `dailySongs` + `recommendedCollections`（:1668-1671） | 先看 `capabilities.recommendations`（:1667），未声明返回空数组；两个调用都 `.catch(()=>[])`。 |
| `/online/personal-fm` :1678-1689 | `personalFm` | `{songs}`。 |
| `/online/cloud` :1691-1704 | `cloudSongs`（:1698） | `{songs, hasMore}`；页大小 100（:1699-1700）。 |
| `/online/songs` :1706-1737 | `songs` 或 `nativeSongs` | 酷狗恒空列表（`{songs:[],total:0,offset:0}`）。 |
| `/online/artists` / `albums` :1742-1771 | `artists` / `albums` | 酷狗恒 `[]`。 |
| `/online/artist` :1773-1787 | `artistAlbums`（:1782） | `{artist, albums}`。 |
| `/online/my-playlists` :1789-1835 | `myPlaylists`（:1797） | `playlist[]`；若 `capabilities.listeningRank`（酷狗未声明）才注入排行卡（:1801-1825）。 |
| `/online/album` :1837-1866 | `albumSongs`（:1852） | 传 `hint = {name, album, artist}`（:1852-1856）；酷狗允许空 id（:1846 只拦 Navidrome）。 |
| `/online/playlist-songs` :1868-1913 | `playlistSongsPage`（:1891） | 必须回 `hasMore` + `nextOffset`（:1902-1903）；`listening-rank-*` 前缀走排行（:1877-1888）。 |
| `/online/liked` / `liked-ids` / `like` :1915-1968 | `liked` / `likedIds` / `setLiked` | `{liked:boolean}` / `{ids:string[]}` / `{ok,liked}`；`like` 的 song 由 `{...rawSong,id:onlineSongId(rawSong)}` 组成（:1955-1959）。 |
| `/online/playlist-add` :1970-1993 | `addToPlaylist`（:1988） | 需要 `playlistId` 与 `song.id`（:1981）。 |
| `/online/subscription` :1995-2032 | `subscriptionStatus` / `subscribeCollection` | 酷狗没声明 `playlistSubscription`，能力门直接拒；前端应隐藏入口。 |
| `/online/playlist-remove` :2034-2056 | `removeFromPlaylist`（:2051） | 需要 `playlistId` + `song.id`；门面再要 `fileId`。 |
| `/online/cover` :2106-2175 | 无门面；按 provider 选 Referer | `ONLINE_REFERERS` 里 `kugou`/`kugouLite` 都是 `https://www.kugou.com/`（:44-45,176-178）；URL 还要过 `isAllowedCoverUrl`（:2138）。 |
| `/online/providers` :2267-2372 | `providerStore.summary` + `accountStore.summary` + `omni.summaries` + `profileState` + `vipInfoState` | 合并行字段见 §3.5；`summary[provider].loggedIn` 决定 status（:2359）。 |

### 2.3 路由给门面的隐含约束（替换实现时最容易被打破的 6 条）

1. **id 原样透传**：路由从 query/body 拿到 id 就直接给门面（:637,:912,:1870），不做大小写或前缀归一。门面必须自己兼容「客户端传来的小写 hash」与「旧缓存里的大写 hash」。
2. **错误只有两种出口**：门面抛 `MusicError`（adapter 转 `/online/*` 的 502），或返回空值让路由 200。酷狗当前大量 `catch → 空`（`lyric` :1147-1150、`resolveStream` 上层、`quality` :1290）。替换后要逐条决定「静默降级」还是「报错」，否则前端提示会变。
3. **`preview` 语义**：只有 `stream.preview === true` 才写 `x-music-preview` 并阻止缓存（:829, :890-894）。酷狗现在的取链从不返回 `preview`。
4. **`replayGain` 形状**：`{trackGain?, trackPeak?}`（`replayGainHeaders` :160-174）；酷狗从应答的 `volume` / `volume_peak` 换算（`kugou.js:1089-1100`、`kugou-lite.js:310-322`）。
5. **歌词缓存由路由独占**：门面返回的 `raw` 会被原样存进歌词记录（:1037-1047），客户端后续读的是记录而不是门面。改 `raw` 形状等于让旧记录失效。
6. **登录快照必须带 device**：`loginStatus` 的 `device.{mid,dfid,guid}` 会被 login bridge 写进凭据（`bridge.js:20-34`），后续取流/云盘都靠它。

---

## 3. 我方 DTO

### 3.1 歌曲（`shape()`，`index.js:56-104`）

| 字段 | 酷狗来源（`normalizeSong` / 应答） | 含义与注意 |
| --- | --- | --- |
| `provider` | 入参 | 路由回传的 provider 字符串；酷狗只有 `kugouLite` 会出现在真实响应里。 |
| `id` | `song.id`（= 小写 hash） | 字符串。QQ 用 `songmid`，酷狗用 hash（:57,73）。**门面所有身份判断都拿它当 hash**。 |
| `title` | `songname / SongName / audio_name / filename 的「歌手 - 标题」后半` | 已去 `<em>` 高亮并去掉重复的「歌手 - 」前缀（`kugou.js:372-380`）。 |
| `artist` | `artists.join(' / ')` | 多歌手用 ` / ` 连接；搜索行先剥 `<em>` 再按 `、/,` 拆（`kugou.js:363-371`）。 |
| `album` | `albumname / AlbumName / album_info.album_name` | 空字符串表示没有。 |
| `albumId` | `albumId / album_id / AlbumID` | **字符串**；酷狗标准版把它当数字用（`Number()`）。 |
| `durationSec` | `interval` | 秒（不是毫秒）；`normalizeSong` 里 `interval` 就是秒（`kugou.js:405`）。 |
| `durationMs` | `durationMs` 或 `interval * 1000` | 路由/客户端优先用它（:85）。 |
| `coverUrl` | `cover` → `kgCover()` | `{size}` 已替换成 240、`http:` 已升 `https:`（`kugou.js:267`）。 |
| `qualityHint` | `privilege` / `payType` | lite：`privilege >= 10 或 payType > 0` → `'VIP'`；standard：`payType > 0 或 privilege > 0` → `'VIP'`（:65，测试 `kugou-upstream.test.mjs:276-281` 锁这条）。 |
| `fee` | `fee` | 酷狗通常是 0（`normalizeSong` 不产出 fee）。 |
| `artistsDetail` | `artistsDetail` | `[{id:string, name:string}]`（`kugou.js:418-420`）。**artistId 查询靠它**（`index.js:591-593`）。 |
| `albumDetail` | `albumDetail` | `{id, name, coverUrl}`（`kugou.js:421-425`）。 |
| `aliases` / `translatedNames` | 固定 `[]` | 酷狗不提供（`kugou.js:426-427`）。 |
| `publishTime` / `popularity` | `PublishTime` / `HeatLevel` | 时间戳、热度。 |
| `songType` | 固定 0 | — |
| `mvId` / `isVideo` | `mvdata.mvhash` / `mvdata` 非空 | 酷狗 MV。 |
| `copyright` / `resourceState` / `noCopyright` | 0 / null / null | 占位，酷狗不提供。 |
| `privilegeDetail` | `{privilege, payType}` | `kugou.js:436`。 |
| `availableQualities` | 各档 hash 非空即算 | `['standard','high','lossless','hires']` 的子集（`kugou.js:438-443`）；hires 只在有 `SuperFileHash/hash_super/ResFileHash` 时出现。 |
| `variant` | `'cloud'` | 只有云盘行有（`kugou.js:844`）。 |
| `fileId` | `fileid` | 歌单行号；移除歌曲必需（`index.js:1874`）。 |

**不在 DTO 里、只在 Host 内存的字段**（重要）：`hash`（与 `id` 相同）、`hqHash`、`sqHash`、`hiResHash`、`superHash`、`albumAudioId`、`mixSongId`、`privilege`、`payType`、`source:'kugou'`。`shape()` 只挑上表字段，其它留在 `rawSongs: Map<provider:id, raw>`（`index.js:43`，写入点 :139,:1481,:1460）。
→ 后果：写操作（喜欢/加歌单/移除）优先读 `rawSongs`；缓存未命中时用最小行兜底，`albumAudioId/mixSongId` 直接丢成 0（`index.js:1725-1733`、:1770-1777、:1686-1690）。Folia 的 `FoliumSourceSong` 有 `data` 侧车（`src/folia-mods/sources/kugou/core/kugouProvider.ts:449-499` 的 collection 同款写法），映射时应当把 `albumAudioId/mixSongId/fileId` 放进侧车而不是丢掉。

### 3.2 歌单 / 卡片

**`playlistCard`（搜索、推荐；`index.js:187-199`）**：`{ id, name, cover, creator, trackCount, playCount, source, type:'playlist' }`。酷狗搜索歌单来自 `search type=special` 的 `specialid/specialname/nickname/songcount/listennum`（`kugou.js:913-925`）；推荐卡来自 `getRecommendedCollections` 的 `{id:'kugou-card-3006', cardId, name, cover, trackCount, description:''}`（`kugou.js:736-744`）。

**`albumCard`（`index.js:378-392`）**：`{ id, name, cover, artist, trackCount, provider }`；酷狗专辑搜索的原始行是 `albumid/albumname/img/singers/songcount`（`kugou.js:503-514`）。

**`artistCard`（`index.js:395-404`）**：`{ id, name, cover, description, provider }`；原始行 `author_id/author_name/sizable_avatar/intro`（`catalog-channels.test.mjs:104`）。

**`shapePlaylist`（账号歌单；`index.js:1240-1256`）**：`{ provider, id, name, cover, trackCount, creator, kind, isOwned, isLike, isDefault, addable? }`。两个来源的原始行不同：

| 来源 | 原始行字段 | 被 `shapePlaylist` 丢掉的东西 |
| --- | --- | --- |
| `KGL.getMyPlaylists`（lite，`kugou-lite.js:499-529`） | `source, id, listId, globalCollectionId, name, cover, trackCount, creator, kind('like'/'collect'/'own'), isLike, isDefault, addable` | `listId`、`globalCollectionId`、`addable` 的判定依据 |
| `KG.getMyPlaylists`（standard，`kugou.js:1756-1797`） | `normalizePlaylistItem`（`id,name,cover,playCount,trackCount,creator,creatorId,creatorGid,description,source,link`，:634-648）+ `globalId, kind, isDefault, isDef, isLike, originalId, creatorGid` | `globalId`、`creatorGid`、`originalId`、`link`、`isDef` |

→ 所以「按 id 读歌单歌曲」不能只靠 `myPlaylists` 的返回：`kugouPlaylistSongs` 会**重新**调一次 `KG/KGL.getMyPlaylists` 去找 `kind === 'collect'` 与 `creatorGid`（`index.js:1411-1425`），另有 30 秒缓存 `kugouPlaylistListCache`（:1498-1525）。

**三套歌单 id 空间（`index.js:1392-1437` 的注释与实现）**：

| id 形态 | 例子 | 唯一读取器 |
| --- | --- | --- |
| 推荐卡 | `kugou-card-3006` | `KG.kugouRecommendationCardId` 解析（`kugou.js:675-678`）→ `getRecommendationCardSongs`（:753-769），**绝不把卡 id 发给上游歌单接口** |
| 账号云歌单 | `collection_3_1_2_0`（`global_collection_id`）或 `18`（`listid`） | `kugouLite`：行 id 直送 `playlist_track_all`（`kugou-lite.js:666-709`）；`kugou`：先查账号列表拿 cloud id（`index.js:1608-1621`） |
| 公开歌单 | `8700677`（网页 `specialid`） | mobilecdn `special/info` + `special/song`（`kugou.js:966-1081`）；概念版 cloudlist 读它会 `error_code 20010`（`kugou-playlist-ids.test.mjs:41-42,156-170`） |

**`playlistSongsPage` 对 lite 的一个特别行为**：走「直读」分支时返回 `name:''`、`cover:''`（`index.js:1597-1606`），因为那一页的应答没有名字/封面；客户端必须继续用列表行上的元数据。

### 3.3 分页（`hasMore` / `nextOffset`）

| 门面 | 形状 | 游标规则 |
| --- | --- | --- |
| `searchPage` | `{results,total,page,hasMore}` | 酷狗一次性：`page:1`、`hasMore:false`、`total = results.length`（`index.js:164-169`；测试 `catalog-channels.test.mjs:217-228`） |
| `artistSongs` | `{songs,total,hasMore,nextOffset}` | `nextOffset = offset + rows.length`（上游原始行数，不是过滤后行数，`index.js:623`）；`hasMore` 优先用上游 total（:618-622） |
| `playlistSongsPage` | 同上 + `name/cover/trackCount` | 同上，`nextOffset = offset + rows.length`（:1620,:1631,:1646）；推荐卡用 `card.nextOffset`（:1577-1578） |
| `KGL.getMyPlaylistSongsPage` | `{songs,trackCount,hasMore,nextOffset}` | **按上游真实页宽前进**：先按请求页宽取，学到真实 stride 后按 stride 取（`kugou-lite.js:653,666-709`，测试 `kugou-playlist-ids.test.mjs:192-201`） |
| `KGL.getRecommendationCardSongs` | 同上 | 卡内本地切片：`nextOffset = at + songs.length`，`hasMore = at + n < total`（`kugou.js:753-769`） |
| `/online/cloud` | `{songs,hasMore}` | 路由层：`hasMore = songs.length >= 100`（`online.js:1699-1700`），门面不返回游标 |

**共同约定**：`nextOffset` 只能由「这一页实际消费掉的上游行数」推进；用「留下并展示的行数」推进会重复或漏页。这条已被两个测试钉死（`kugou-playlist-ids.test.mjs:177-190`、`kugou-playlist-page.test.mjs:44-56`），替换实现必须保持。

### 3.4 歌词

门面返回（`index.js:1022-1151`）：

```js
{
  lrc: '[00:01.000]第一行…',   // 有逐字行时由 lines 拼出（:1125）
  translation: '[00:01.000]译文…', // 来自 KRC 内嵌翻译，或双语 LRC 拆分（:1114-1122 / :1195-1238）
  lines: [{ t, end, text, words: [{ t, end, text }] }], // 秒，KRC 逐字（kugou.js:1421-1431）
  wordLevel: true,
  raw: { type: 'local', lrcContent: '<解密后的 KRC 原文>', formatHint: 'krc', tLrcContent?: '<翻译 LRC>' }
}
```

- 取不到 KRC 时回退普通 LRC：`KG.getLyric` 的 `{lyric}` 原文（`kugou.js:1348-1357`），不做逐字。
- 任何异常都被吞成 `{lrc:'', translation:''}`（`index.js:1147-1150`）——前端只会看到「无歌词」。
- 路由会把 `raw` / `lines` / `wordLevel` 写进 `online:<provider>:<id>` 记录（`online.js:1036-1047`），后续 `/online/lyric` 直接读记录；替换实现时 `raw.formatHint='krc'` 与 `lines` 的形状必须兼容旧记录，否则用户已缓存的逐字歌词会退化成行级。
- 客户端侧的 `kugouLite` 歌词源 id 与 Host 的 provider id 一致（`src/host/services/lyrics/lyrics-sources.js:35`）；`lyrics-sources.js:45` 另有别名 `kugou → kugouLite`。

### 3.5 账号资料 / VIP

`providerProfile`（`index.js:2023-2056`）→ `{ nickname, avatarUrl, accountId }`：

| 平台 | 数据源 | 备注 |
| --- | --- | --- |
| `kugouLite` | `KGL.getProfile(session)` → `/v1/user_verify`（`kugou-lite.js:456-470`） | 返回 `{nickname, avatarUrl}`；`accountId` 取 `session.userid`。失败时 `{nickname:'',avatarUrl:''}` 不抛。 |
| `kugou` | `KG.getMyUserInfo(session)` → `relation.user.kugou.com/v1/get_my_userinfo`（`kugou.js:1566-1601`） | 返回 `{userid,nickname,pic,signature,username}`，门面把 `pic` 改名 `avatarUrl`。 |

`providerVipInfo` → `{vip, expiresAt}`：lite 来自 `/v1/get_union_vip` 的多产品对象（`kugou-lite.js:249-282`，取最晚的未过期 `vip_end_time`）；standard 额外看 `is_vip` / `vip_type` / `su_vip_level`（`index.js:1992-2003`），最后回退 `session.vipType`。

`/online/providers` 合并行（`online.js:2344-2366`）：`displayName, kind, capabilities, searchKinds, qualityLevels, loginMethods, availability, configured, requiresAccount, status, user{id,nickname,avatarUrl}, collections, freshness, lastUpdatedAt, error, hydration`；另有 `providerStore.summary()` 的 `{loggedIn, nickname, avatarUrl}`，登录后补 `vip` / `vipExpiresAt`（:2316-2318）。

---

## 4. 存储与身份

### 4.1 会话文件：`sessions.json`

- 位置：`login/store.js` 在 provider store 目录下建 `sessions.json`（`src/host/providers/login/store.js:36`）。
- 结构：`{ version: 1, sessions: { <sourceId>: { credentials, profile, updatedAt, expiresAt } } }`（:19-30, :85-98）。
- **不加密**：直接 `writeJsonAtomic(file, cache, { mode: 0o600 })`（:58-60）；文件权限 0600 是唯一保护。
- 旧 `providers.json` 不再读（`provider-store.js:11-13` 注释），登录态迁移策略是「丢弃、重新扫码」。
- `providerStore.summary()` 只暴露 `{loggedIn, nickname, avatarUrl}`（`provider-store.js:81-99`），不泄 cookie。

### 4.2 `kugouLite` 凭据字段（磁盘名 ↔ 门面 `session()` 名）

| 磁盘字段（`EMPTY`，`provider-store.js:28-31`） | `session()` 暴露（:107-132） | 用途 |
| --- | --- | --- |
| `cookie` | 单独 `cookie(provider)`（:102-104） | 酷狗实际不用 cookie 串；登录桥仍会写（`bridge.js:23`） |
| `mid` | `mid` | 设备标识，`normSession` 强制要求（`kugou.js:115-121`） |
| `dfid` | `dfid` | 设备指纹；`register_dev` 返回后写回 |
| `guid` | `guid` | 设备 UUID；`mid = BigInt(md5(guid))`（`kugou.js:100-104`） |
| `token` | `token` | 账号 token |
| `vip_type` | `vipType` | 扫码应答的 `vip_type`（`kugou.js:248`） |
| `vip_token` | `vipToken` | `vip_token`（:249） |
| `userid` | `userid`（Number） | 账号 id |
| `nickname` / `avatarUrl` | 不暴露给 `session()` | 只出现在 `summary()`/账号快照 |
| `loggedIn` | 不暴露 | 登录状态 |
| `token_refreshed_at` | `refreshedAt` | 续期节流（`kugou-session.js:19,49`） |

登录写入路径：`loginStatus` 返回 → `credentialsOf(result)`（`bridge.js:20-34`）映射成 `{cookie, token, mid, dfid, guid, userid, nickname, avatarUrl, vip_type, vip_token}` → `providerStore.setLogin`（`online.js:410-416`）。`setLogin` 会补 `loggedIn:true` 与 `token_refreshed_at: Date.now()`（`provider-store.js:135-152`）。

**两个已知缺口（第一性原理核对后的事实）**：

1. `setSession(provider, value)` 只持久化 `mid` 与 `userid`（`provider-store.js:170-178`），**不写 `dfid` / `guid` / `dev` / `mac` / `webgl`**。而 `/online/stream` 在缺 mid 时用 `omni.createDevice()` 造了完整身份（`online.js:662-665`），只有 `mid` 被留下；进程重启后 `session.dfid === ''` → `kugouCookies` 用 `'-'` 占位（`kugou-cookie.js:39`），下次取流会重新 `register_dev` 拿新 dfid。
2. `session('kugou')` 恒为 `{}`、`setSession('kugou')`/`setLogin('kugou')`/`markExpired('kugou')` 全部 no-op（`provider-store.js:43,121,135-137,155-156,170-172`）。所以 `kugou-session.js` 的 `refreshIfDue('kugou')` 与路由里两处「补 kugou 设备」都跑不出效果（见 §2.1）。

### 4.3 设备身份与 cookie 词汇

`createDeviceIdentity()`（`kugou.js:102-112`）产出 6 个字段：`guid`（随机 UUID）、`mid`（`BigInt('0x'+md5(guid)).toString()`，约 39 位、超 Number 安全范围，全程按字符串）、`dfid`（进程内随机 24 位大写）、`dev`、`mac`、`webgl`（后三个是包要的设备指纹）。

`kugouCookies(device, platform)`（`kugou-cookie.js:30-43`）把它翻成包认的 cookie 对象：`KUGOU_API_PLATFORM`、`KUGOU_API_GUID`、`KUGOU_API_MID`、`KUGOU_API_DEV`、`KUGOU_API_MAC`、`KUGOU_API_WEBGL`、`dfid`（空则 `'-'`）、`userid`、`token`；缺 `dev/mac/webgl` 时用 `stableHex(guid, field)` 派生（:17,35-37），保证老会话也有稳定指纹。

`kugouSessionPatch(cookieEntries, body, {confirmedSignIn})`（:63-83）：只从应答 cookie 里取 `dfid`；`token`/`userid` **必须成对且 `confirmedSignIn` 为真**才写，半对丢弃。测试 `kugou-upstream.test.mjs:45-55` 锁这条。

### 4.4 会话维护

- 续期间隔 6 小时（`kugou-session.js:19`），`refreshIfDue(provider='kugou')`：先 `providerStore.session`，无 token 直接返回；成功后 `setLogin` 写回 `token/userid/vip_type/vip_token`（:52-59）。
- 续期失败**不直接登出**：先用 `profile(session)` 探活，只有探活也报 auth 错（20017/20018）才 `markExpired`（:61-71；测试 `kugou-session.test.mjs:57-67`）。
- `markExpired` 会清 `loggedIn/token/vip_type/vip_token` 并把 `token_refreshed_at` 归零（`provider-store.js:155-167`）。
- lite 不续期，只 `validate('kugouLite')`：用 `KGL.getMyPlaylists(session)` 探活（`kugou-session.js:88-108`），因为它的 profile 接口过期时可能返回空对象而不是错误。
- `isKugouAuthError` 认错误码 20017/20018 与一批中文文案（:22-27）。

### 4.5 歌曲 id 形态

- **主 hash**：酷狗文件 hash（32 位十六进制串），`normalizeSong` 一律 `lowHash` → 小写；`id === hash`（`kugou.js:362,391-392`）。
- **音质档 hash**：`hqHash`（320）、`sqHash`（无损）、`hiResHash`、`superHash`（`kugou.js:393-396`）也全部小写；`availableQualities` 由它们是否存在推导（:438-443）。
- **写操作用的行标识**：`fileId`（歌单行号，`kugou.js:1896,1956`）、`albumAudioId`（精确专辑音频 id）、`mixSongId`（`MixSongID`/`mixsongid`）。三者都不是 hash，也不在 DTO 里。
- **大小写风险**：`rawSongs` 的键是 `provider + ':' + id`（`index.js:139,1460,1481`），客户端若把 id 大写回传，缓存查不到；但 `getDownloadURL` / `KGL.resolveStream` 又会 `String(hash).toLowerCase()` 兜底（`kugou.js:1163,1195`；`kugou-lite.js:326`）。所以「取流能容错、写操作不能」。

### 4.6 `provider:id` 的形态（举例）

| 场景 | 形态 | 生成/消费点 |
| --- | --- | --- |
| 播放器 `track.path` | `online:kugouLite:8f3a…（32 位小写 hash）` | 客户端 `src/client/services/player/player.js:559`、`shuffle-round.js:18`、`src/client/services/api/api.js:163` |
| 喜欢列表 | `online:kugouLite:<song.hash>` | 门面 `onlineLikedIds`（`index.js:1800`）→ `/online/liked-ids` |
| 歌词记录 | `online:kugouLite:<hash>` | `onlineLyricKey`（`online.js:226-228`） |
| 收藏（本地） | 同 `track.path` 字符串直接当键 | `src/host/stores/favorites.js:4-7,43-60` |
| 播放统计 | 同 `track.path` | `src/host/stores/stats.js:145-166` |
| 媒体缓存 | `provider` + `id`（`<provider>/<id>` 目录） | `src/host/services/media/cache-writer.js` / `routes/online.js:281-343` |
| 排行榜虚拟歌单 | `listening-rank-week-<accountId>` / `…-all-…` | `online.js:1809`；读回 `online.js:1877-1888` |
| 客户端歌手页路由参数 | `kugouLite:<artistId>` | `test/client/panel.render.test.mjs:316` |

---

## 5. 测试与守卫

### 5.1 酷狗专用测试（5 个文件，全部纯离线，靠 `setUpstreamOverride` 假上游）

| 文件 | 断言要点 |
| --- | --- |
| `test/host/kugou-session.test.mjs`（97 行） | 续期成功只写一次 `setLogin` 且随后被 6 小时节流（:31-43）；`20017` + 探活 `20018` → `markExpired` 一次（:45-55）；**只有续期失败、探活通过时不许登出**（:57-67）；lite `validate` 成功不清登录（:69-79）、`20017` 才清（:81-91）；`isKugouAuthError` 只认 20017/20018/文案（:93-95）。 |
| `test/host/kugou-upstream.test.mjs`（475 行） | 质量降级顺序 `hires→lossless→high→standard→null`（:20-23）；cookie 词汇（platform/guid/mid/dfid/userid/token、指纹非空、空 dfid 用 `-`，:27-43）；`kugouSessionPatch` 的「成对才写」（:45-55）；标题去「歌手 - 」前缀只在匹配时（:59-79）；登录映射（出码/轮询/register/成功 tokenInfo，:81-132）；搜索映射（`HQ.Hash→hqHash`、`SQ.Hash→sqHash`，:134-176）；取流身份精确性（先带 `album_id/album_audio_id`、再 hash-only，:178-253）；质量档位（high→320、始终用主 hash，:210-232）；VIP 徽章（privilege/pay_type，:255-285）；推荐/云盘（未登录不发请求、登录带 userid+token+device cookie、文件名去扩展名、`variant:'cloud'`、`fileId`，:287-348）；云盘被拒要报错（:350-364）；专辑/歌单搜索（:366-427）；歌词 base64 解码（:429-450）；可选真上游（`DSH_MUSIC_UPSTREAM=1`，:452-474）。 |
| `test/host/kugou-playlist-page.test.mjs`（60 行） | lite 歌单分页**只调一次 `playlist_track_all`**，绝不先查账号列表（:26-41,:50）；第一页 100 条 / 总数 150 / `nextOffset=100`，第二页 50 条 / `hasMore=false`（:44-56）。 |
| `test/host/kugou-library.test.mjs`（100 行） | `user_playlist` → 2 个歌单、`globalId`、`isLike`（:53-56）；`playlist_track_all` 的 `fileId=916`（:58-63）；标准版加歌的载荷 `listid='2'`，`data` 是 `Song`、`kg-hash`、`1`、`2` 四段用竖线拼成的字符串（:65-68）；删歌 `fileids='916'`（:69-71）；lite 的喜欢/加歌/移除同样走 `playlist_tracks_add/del` 且用 lite 会话（:73-97）。 |
| `test/host/kugou-playlist-ids.test.mjs`（207 行） | 卡 id 正则只认 `kugou-card-\d+`（:127-129）；推荐 = 6 张卡、封面取卡内歌曲（:132-137）；点进卡只读卡、卡 id 不落到 `playlist_track_all`（:140-154）；公开 specialid 先被概念版读取器以 20010 拒绝、最终仍能从 mobilecdn 读到（:156-170）；游标按消费行数走（坏行不展示但 offset 前进，:177-190）；上游压页宽时按 30 前进（:192-201）。 |

### 5.2 交叉守卫（不是酷狗专用，但会一起挡住替换）

| 文件 | 与酷狗相关的断言 |
| --- | --- |
| `test/host/sources.test.mjs` | 注册顺序 `['netease','qq','kugouLite','navidrome']`（:196）；lite 能力 flags `likes/likeWrite/playlistAdd/mutations/playlistTrackMutations` 全 true（:204-208）；质量梯度 `['standard','high','lossless']`（:214）；`ONLINE_SPECS.kugouLite.capabilities.searchAlbums === true`（:296）。 |
| `test/host/catalog-channels.test.mjs` | 酷狗歌手页走 `artist_audios`（:112-115）；专辑页 `album_detail`+`album_songs`（:117-121）；歌手专辑页 `artist_detail`+`artist_albums`（:123-127）；lite 歌手翻页 `nextOffset/page`（:158-187）；lite 搜索 `hasMore=false`（:217-228）。 |
| `test/host/online-stream-fallback.test.mjs` | `kugouLite` 的 CDN 404 → legacy 重放（:54,:76）、octet-stream 的 mime 纠正（:97）、`bytes=0-` 转 206（:150）、`bytes=4-` 切片（:176）。 |
| `test/host/provider-store.test.mjs` | `QR_PROVIDERS`/`DEVICE_PROVIDERS` 精确等于含 `kugouLite` 的列表（:14-15）；lite `session()` 的 8 个字段（:32-40）；`setSession` 只留 `mid`（:53-55,:70-72）；`setLogin` 写 `token/vipType/vipToken/userid/refreshedAt`（:58-67）。 |
| `test/host/lyrics-sources.test.mjs` | `LYRIC_SOURCE_IDS` 含 `kugouLite`（:26）；`getPlatformLyricSource('kugouLite')`（:28）；优先级顺序（:33,:45）。 |
| `test/host/best-lyric-route.test.mjs` | 用 `kugouLite` 走「行级歌词 → 另一源逐字」的升级（:185,:313）。 |
| `test/host/rank-shape.test.mjs` | `listeningRank('kugou','week',…)` 产出 `provider:'kugou'` 与 `listenCount`（:44-56）。 |
| `test/host/rich-fields.test.mjs` | `normalizeSong` 的 `albumDetail.coverUrl` 必须是 `imge.kugou.com`（:119-140）。 |
| `test/host/core.test.mjs` | `SOURCE_IDS` 里是 `kugouLite`（:13）。 |
| `test/client/install-defaults.test.mjs` | 默认 `lyricPreferredSource === 'kugouLite'`（:34）。 |
| `test/client/online-song-key.test.mjs` | `key({provider:'kugouLite',id:'ABC'}) === 'online:kugouLite:ABC'`（:52）。 |
| `test/client/online-add-to-playlist.test.mjs` | 带 `onlineProvider:'kugouLite'` 的 track 能解析出 provider（:52-56）。 |
| `test/client/panel.render.test.mjs` | 源列表顺序 `local,netease,qq,kugouLite,navidrome,bodian,qishui`（:514）；`online:test:1` 的 track 用 `kugouLite` provider 渲染（:708）。 |

### 5.3 替换后**必须保持**的契约（按重要度）

1. **注册 id 仍是 `kugouLite`**，或同时保留别名：`sources.test.mjs:196`、`core.test.mjs:13`、`panel.render.test.mjs:514`、`install-defaults.test.mjs:34`、`online-song-key.test.mjs:52` 都会直接红。
2. **门面方法签名与返回值**（§1）：adapter 是按方法名直传的（`adapter.js:59-248`），少一个方法就是 `unavailable`。
3. **分页游标语义**：`nextOffset` 按消费行数前进（§3.3），两处测试锁死。
4. **写操作的行标识**：`fileId` 必须能从读歌单的返回里带到移除调用；lite 加歌载荷是 `[title, hash, albumId, mixSongId]` 用竖线拼接（`kugou-lite.js:551-557`）；hash 必须小写。
5. **`kugouSessionPatch` 的成对写入规则**与 `register_dev` 的 dfid 绑定。
6. **歌词 DTO**：`lines` 的 `{t,end,text,words[{t,end,text}]}`、`raw.formatHint='krc'`、`wordLevel`。
7. **取流退路顺序**：上游 404 → legacy → 降一档 → 报错（`online.js:747-804`），且 legacy 结果只用于重放。
8. **能力声明与实现同一次提交**：`sources/index.js` 的 flags 与门面实现必须同时改。声明了却漏实现时，`allowedBy` 会放行，随后在 `providers[method]` 处 TypeError（被路由兜成 502）——见 §1.6 的两处不一致。

---

## 6. 客户端硬编码面（`kugouLite` 这个 id 绑定的位置）

| 文件:行 | 内容 | 绑定方式 / 牵连 |
| --- | --- | --- |
| `src/client/components/common/ui.js:12` | `var UI_SOURCES = ['local','netease','qq','kugouLite','navidrome']` | 面板可选源顺序；由它派生 `availableSources()`（:29-39）。改 id 会丢内置顺序。 |
| `src/client/components/common/ui.js:61` | `if (source === 'kugouLite') return t('online.providerKugouLite')` | 源显示名分支；命中不到就走 `/online/providers` 的 `displayName`（:65-69）。 |
| `src/client/panel-v3/p3-core.js:36` | `P3_SOURCE_ORDER = ['netease','qq','kugouLite','navidrome','bodian','qishui']` | 首屏占位顺序（:44-54）。 |
| `src/client/stores/prefs.js:24` | 默认 `lyricPreferredSource: 'kugouLite'` | 已持久化的用户值也长这样；有测试锁（`install-defaults.test.mjs:34`）。 |
| `src/client/components/ui/settings.js:604` | `{ value: 'kugouLite', label: t('lyricSource.kugouLite') }` | 设置页「歌词源」下拉。 |
| `src/client/components/ui/lyric-match.js:127` | `{ id: 'kugouLite', label: 'KuGou Music' }` | 歌词匹配窗口的兜底源列表；label 是硬编码英文，未走 i18n（:123-129）。 |
| `src/client/components/ui/dialogs.js:837,845` | `provider` 为 `kugou` 或 `kugouLite` 时选 `loginTitleKugou` / `loginNoteKugou` | 登录弹窗的酷狗专属文案分支。 |
| `src/client/i18n/i18n.js:273-274,313`（中文）/ `:934-935,974`（英文） | `online.loginTitleKugou`、`online.loginNoteKugou`、`online.providerKugouLite` | 登录文案与源名。注意 `src/client/i18n/strings.js` 里**没有**这几个 key，只有 `lyricSource.kugouLite`（`strings.js:784` / `:1924`）。 |
| `src/client/styles/theme.js:717-718` | `.mp-online-card.is-kugou{--mp-brand:#2b7cff}` / `.is-kugouLite{--mp-brand:#6aa8ff}` | 在线卡片品牌色，按 `is-<provider>` 类名命中；替换 id 要同步改选择器。 |
| `src/client/components/online/provider-logos.js:2` | `PROVIDER_LOGOS` 里同时有 `kugou` 与 `kugouLite` 两个 data-URI key | logo 查表；只改一个会出现无图标。 |
| `index.js:233`（Host 入口） | `music_control` 的 `source.enum` 含 `kugouLite` | 工具 schema；提示词同文件 :272 也写死。 |
| `src/host/services/lyrics/lyrics-sources.js:35,45` | 歌词源 id `kugouLite`，别名表 `kugou → kugouLite` | Host 歌词匹配的源注册；`lyrics-match-service.js:24,107,183` 也有 `'kugouLite'` 字面量（查询串改写、展示名）。 |
| `src/host/services/core/contract.js:14` + `src/host/providers/sources/index.js:143` | `SOURCE_IDS` / spec `id:'kugouLite'` | 契约与注册表的唯一真源；`sources/adapter.js:36` 用 `spec.providerKey ?? spec.id` 传给门面。 |
| `src/client/utils/lyrics/lyricSources.ts:46` | `{ id: 'kugou', labelKey: 'lyricProvider.kugou', … }` | **用的是 `kugou` 不是 `kugouLite`**；Host 侧靠 `SOURCE_ALIASES` 兜（`lyrics-sources.js:45`），客户端这条没有兜。 |
| `src/client/utils/lyrics/sourcePriority.ts:24` | 旧值迁移只认 `'amll' / 'qq' / 'kugou'` | 历史偏好迁移；若统一成 `kugouLite`，老用户的 `'kugou'` 也要一并映射。 |

编译产物 `client.js` 里同一批字符串约在 `client.js:7073,7113,7734,7774,176380,193172`（`t('online.providerKugouLite')` 等），改源码后必须跑 `node scripts/build-client.mjs`。

---

## 7. 与已落地移植面的衔接（HEAD `1580486` 实测）

这一节只记录**能验证的事实**，不评价移植质量。

**已经存在的**：

| 位置 | 事实 |
| --- | --- |
| `src/folia-mods/sources/kugou/**`（6 个 core 文件 + main/client 入口 + locales + mod.json） | `core/` 与 `main/` 已用 `git diff --no-index` 对上游比对为 **IDENTICAL**（2026-11-28）；`core/kugouProvider.ts` 2056 行，`normalizeKugouSong` :281、`createKugouSource` :733 |
| `src/folia-adapters/kugou/**`（errors/host/jsonFile/legacyStore/pageStore/rpc/seal/texts） | 插件侧宿主面：`api.net.fetch`、`api.media.allow`（空实现）、`api.legacy.store`、`api.seal`、`api.rpc`，以及 client 侧 `folium`（`host.ts:47-127`） |
| `src/folia-build/kugou-host-entry.ts` → `src/host/vendor/kugou-folia/source.bundle.mjs`（3417 行） | 导出 `createFoliaKugou` 与 `KUGOU_OPERATIONS`（bundle:3396-3417）；`node scripts/build-kugou-folia.mjs` 生成 |
| `test/host/kugou-folia-bundle.test.mjs`（62 行） | 直接 import 产物：`createFoliaKugou({dir})` → `{definition, call, host}`；`definition.id === 'kugou'`、`displayName === 'KuGou Music'`；能力家族 `search@1 / songs@1 / playback.audio@1 / lyrics@1 / auth@1 / library@1 / catalog@1 / recommendations@1 / mutations@1`；rpc 名 `['anonymousSearch','legacyPlayInfo','request']`；seal / legacyStore / pageStore / texts 可用 |

**还没接的**：`src/host/**` 里没有任何文件 import 这个 bundle（`rg -n "kugou-folia|createFoliaKugouHost" src/host` 只命中产物自身）；`src/host/providers/index.js` 在 `1580486` 中未改动，门面仍走 `KG`/`KGL`。**下一步的接线点是门面，不是路由。**

**接线时必须跨过的差异（都能在上表文件里指认）**：

1. **id**：Folia 定义里是 `kugou`（`kugou-folia-bundle.test.mjs:19`），插件注册表是 `kugouLite`。`adapter.js:36` 已经支持 `spec.providerKey ?? spec.id`，这是最小改动路径；否则 `sources.test.mjs:196` 等会红。
2. **能力词汇**：Folia 是 `search@1` 这类版本化家族（同上 :22-23），插件是 `CAPABILITIES` 扁平布尔 + `METHOD_CAPABILITY` 门（`contract.js:25-63,97-137`）。需要一张家族→布尔的映射表，并且和 `sources/index.js:78-97` 的声明同一次提交。
3. **DTO**：Folia 用 `FoliumSourceSong` / `FoliumSourceCollection`。集合把 `listId / globalCollectionId / specialId / creatorGid / owned` 放在 `data` 侧车（`core/kugouProvider.ts:487-497`）；歌曲的 `data.fileId` 是移除歌单用的行号（:700-703），排行计数放在 `row.listenCount`（:719-724）。我方 `shape()`（`index.js:56-104`）没有侧车，`shapePlaylist()`（:1240-1256）还会丢掉这些 id。**侧车正好是 §3.1 里丢失的 `albumAudioId/mixSongId/fileId` 的天然载体**，映射时别压平。
4. **可加歌单的判据**：Folia 用 `listId !== '2'` 且名字不等于「我喜欢」（`core/kugouProvider.ts:517-523`）；我方 lite 用 `!isLike && !collected`（`kugou-lite.js:525`）、standard 用 `kind`/`isDef`（`index.js:1240-1256`）。两者要合成同一套 `addable`。
5. **分页与质量档的词汇**：Folia 的分页是 `{items,total,hasMore,nextOffset}`（`core/kugouProvider.ts:526-551`，注意 `pageOf` 用过滤后的 `items.length` 推游标），我方是 `{songs,…}` / `{results,…}`；Folia 的音质枚举含 `ultra` 且把 `hires` 映射成 `high`（:566-577），我方酷狗只有 `standard/high/lossless` 三档、`hires` 落到 flac。字段改名与档位归一都要在 adapter 里做。

---

## 8. 怎么复核这份清单

```bash
# 门面里所有酷狗分支
rg -n kugou src/host/providers/index.js
# 路由里的直连分支（应只有 §2.1 的 11 处）
rg -n "provider === 'kugou" src/host/http/routes/online.js
# 客户端硬编码面（应只有 §6 的 15 个文件）
rg -n kugouLite src/client
# 会话字段与不加密事实
rg -n "sessions.json|0o600|DEVICE_PROVIDERS|setSession" src/host/providers/login/store.js src/host/providers/provider-store.js
# 酷狗专用测试
node --test test/host/kugou-session.test.mjs test/host/kugou-upstream.test.mjs test/host/kugou-playlist-page.test.mjs test/host/kugou-library.test.mjs test/host/kugou-playlist-ids.test.mjs
```

---

## 附：一句话交给写映射的人

门面 `providers/index.js` 的导出就是全部调用面；路由只认它返回的形状（§1、§2.2）；真正会丢信息的是 `shape()` / `shapePlaylist()` 这两处压平（§3.1、§3.2），以及 `session()` 只留 `mid/userid`（§4.2）。把这三处对齐，Folia 源的 `data` 侧车就能无损穿过插件。

