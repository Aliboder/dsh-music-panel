# 在线来源与 Folia 对齐审计

目标：在线资源的取数必须走 Folia 同款平台 provider / transport 操作，不在插件里另写一套平台协议。

## 当前状态

| 平台 | 已对齐 | 仍是自有实现 | 说明 |
| --- | --- | --- | --- |
| 网易云 | 搜索、播放地址、歌词、歌单、喜欢、歌手、专辑 | 无（少量旧路由兜底） | 专辑曲目与 Folia 一样读 `/album` 顶层 `songs` |
| QQ | 搜索、播放地址、歌词、扫码登录（QQ/微信）、我的歌单、歌单曲目、喜欢读取/写入、专辑、歌手歌曲、歌手专辑 | 歌单创建/删除/加歌、用户资料等未迁移 | 登录已保存 `qqmusic_session`；歌单与喜欢走包路由 |
| 酷狗 | 搜索、歌词、扫码登录、专辑、歌手歌曲、歌手专辑；播放优先包 `song_url`，我的歌单/歌单曲目走 `user_playlist`/`playlist_track_all`，写入优先 `playlist_tracks_add`/`playlist_tracks_del` | 匿名/包失败时回退 gateway；榜单/推荐仍旧接口 | 包缺 `generateWebGLHash` 已在 worker 补上 |
| 酷狗概念版 | 搜索、歌词、扫码登录、专辑、歌手歌曲、歌手专辑；播放/歌单读取优先包 `song_url`/`user_playlist`/`playlist_track_all` | 匿名/包失败时回退旧签名接口 | 与酷狗共用 worker，`platform=lite` |
| Navidrome | Subsonic 协议（歌手/专辑/歌单/收藏） | 自有 Subsonic 客户端 | 协议相同，但不是 Folia 的 `navidromeService` 封装 |
| 汽水 | 搜索、播放、歌词、歌手歌曲、歌手详情、歌单、喜欢 | 推荐/探索等扩展 | 使用同一个 `qishui-music-api` 包 |
| 波点 | 搜索、播放、歌单、喜欢 | 歌手/专辑目录 | 波点没有专辑方法 |

## 已实测

用本机已保存的登录态调用 Host provider：

```text
netease  ALBUM 1  春日影
netease  ARTIST_SONGS 10
netease  ARTIST_ALBUMS 29 鹏泊
qq       ALBUM 11 叶惠美
qq       ARTIST_SONGS 10
qq       ARTIST_ALBUMS 43 周杰伦
kugou    ALBUM 11 叶惠美
kugou    ARTIST_SONGS 10
kugou    ARTIST_ALBUMS 49 周杰伦
kugouLite 同上
```

Navidrome 未配置服务器；Qishui/Bodian 当前没有登录态，未做真实账号测试。

## 这一轮修复

- 网易云专辑曲目改读 `/album` 顶层 `songs`，与 Folia 的 `getAlbumTracks` 完全一致。
- QQ 歌手专辑兼容包返回的 camelCase 字段（`albumMid` / `albumName` / `totalNum`），不再过滤成空列表。
- 酷狗专辑曲目兼容包返回的 `{base,audio_info,album_info,authors}`，并按 Folia 的 30 条分页读取。
- 酷狗歌手歌曲兼容包返回的平坦字段（`audio_name` / `author_name` / `album_name` / `timelength`）。
- QQ 包请求同时把整串 Cookie 放进 `?cookie=`，与 Folia 的 Electron transport 一致。

## 还需要迁移

1. **QQ 歌单写入**：创建、删除、加入/移出歌单仍走旧接口；读取与喜欢已经切到包路由。
2. **酷狗播放地址**：`song_url` 包操作，替换现在的 gateway 直连。
3. **酷狗用户/歌单/喜欢**：包操作替换旧接口。
4. **Navidrome**：要么继续按 Subsonic 协议对齐，要么接入 Folia 的 `navidromeService`。
5. **Qishui/Bodian 扩展**：推荐、探索、歌手目录等未迁移。
