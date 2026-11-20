# 在线歌单分页执行计划

状态：阶段 1–3 已完成；剩余：把 QQ 收藏/Navidrome 的整表例外继续下沉，并补齐专辑/歌手/搜索的同类分页。

目标：把在线歌单从「Host 一次拉完整张歌单」改成 Folia 的 `getPlaylistTracks(id, limit, offset)` 形态。结果上限问题只是表象，真问题是接口形态、缓存和 UI 都把歌单当成一个全量数组。

## 验收标准

1. 首次打开歌单只请求一页（默认 100 首），响应带 `hasMore` / `nextOffset`。
2. 滚动接近底部才请求下一页；切换歌单时旧响应不能写入新歌单。
3. Host 不再为常规歌单请求把全部分页拼成一个大数组。
4. 歌曲数来自 `trackCount`，不是已加载条数。
5. 大歌单的请求、JSON、前端数组都不随总长度一次性增长。

## 接口

`GET /online/playlist-songs?provider=<id>&id=<playlistId>&limit=100&offset=0`

响应：

```json
{
  "ok": true,
  "provider": "netease",
  "name": "",
  "cover": "",
  "trackCount": 1200,
  "songs": [],
  "hasMore": true,
  "nextOffset": 100
}
```

- `limit` 限制在 1..200；`offset` 为非负整数。
- 不带 `limit/offset` 的旧请求只在迁移期保留，客户端切换完成后删除。
- `hasMore` 来自 provider 页面结果，不用 `songs.length === limit` 单独猜测。

## Provider 页面

新增统一方法：

```ts
playlistSongsPage(provider, id, { limit, offset }, ctx)
```

| 平台 | 页面来源 | 终止条件 |
|---|---|---|
| 网易云 | `/playlist/track/all?limit&offset` | trackCount / 短页 |
| 波点 | `playlist_tracks` | total / 短页 |
| 汽水 | `playlist_tracks` | hasMore / total |
| 酷狗标准版 | `special/song?page&pagesize` | total / 短页 |
| 酷狗概念版 | `playlist_track_all` | count / 短页 |
| QQ 自建/喜欢 | `/user/playlist-detail` / `/user/liked-songs` | total/more |
| QQ 收藏/公开 | 匿名整表，adapter 内切片 | total |
| Navidrome | `getPlaylist.view` 整表，adapter 内切片 | total |

没有分页能力的来源允许 adapter 先取整表再切片，但对外必须返回同一分页对象。之后按平台逐个替换为原生分页。

## 客户端

`onlineStore` 增加：

```js
playlistTrackCount
playlistHasMore
playlistNextOffset
playlistLoadingMore
playlistPageError
```

- `openOnlinePlaylist`：请求 offset=0；保留 collection 元数据；设置 hasMore/nextOffset。
- `loadMoreOnlinePlaylist`：按当前 playlistId/provider 防重；追加并去重；失败只在 footer 报错。
- 切歌单递增 token，旧响应丢弃。
- 缓存按页存，不缓存整张歌单。

## UI

`P3List` 增加 `hasMore`、`loadingMore`、`onLoadMore`：

- 滚动到距底部约 400px 时触发；
- 同一时间只允许一个请求；
- footer 显示「加载更多 / 正在加载 / 加载失败」；
- 歌单头部用 `playlistTrackCount`，不是 `items.length`。

## 迁移顺序

1. 新增 `playlistSongsPage`、route limit/offset、分页测试。
2. 客户端切到分页接口与滚动加载。
3. 删除 Host 全量拼接循环和旧 route 分支。
4. 缓存改为页级，补删除/新增后的失效。
5. 把同一契约用于专辑/歌手/搜索等后续列表。

## 风险

- QQ 收藏和 Navidrome 的原生接口仍返回整表：这是 adapter 层例外，必须在返回页对象时保持分页契约，并在文档中保留说明。
- 播放全部只播放已加载项；未加载部分如需加入队列，走单独的队列分页，不退回全量请求。
- 删除歌单歌曲后必须重新加载当前页附近，不能只改已加载数组造成 trackCount 漂移。
