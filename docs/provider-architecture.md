# 平台支持架构（对齐 Folia）

平台（本地与在线）都注册进同一个 `src/host/providers/sources` registry，上层只通过 `omni` 调用。这一层是
Folia `OnlineMusicProvider` 的最小对等实现：能力位、每平台音质档、登录方式、namespace API。

## 一个 source 的形状

```js
{
  id: 'netease',
  kind: 'online' | 'local',
  displayName: 'NetEase Cloud Music',
  capabilities: { search: true, playback: true, ... }, // 见 src/host/services/core/contract.js
  qualityLevels: ['standard', 'high', 'lossless', 'hires'],
  loginMethods: ['qr'],        // qr | password | external
  api: {                       // providerApi() 生成，按 namespaces 分组
    search: { search, searchPage, songs },
    playback: { stream },
    lyrics: { lyric, chorus },
    library: { myPlaylists, playlistSongs, liked, likedIds },
    catalog: { artists, albums, artistSongs, albumSongs },
    mutations: { setLiked, addToPlaylist },
  },
  // flat methods (search/stream/lyric/...) 继续保留，现有路线仍走它们
}
```

- **能力位**：`CAPABILITIES` 是 Folia 的并集；每个平台只声明自己真实现的。
- **本地音乐**是普通 source：`kind: 'local'`、`qualityLevels: ['original']`、没有登录方式。
- **音质**：`qualityLevels` 逐平台声明（汽水只有 `standard`，Navidrome 是 `original`），
  `omni.qualityLevels(id)` 读取；客户端按它过滤音质选项。
- **登录方式**：由 `loginQr` / `loginPassword` / `externalPlayback` 推导为 `qr | password | external`，
  登录页只按这个列表渲染，不再 switch 平台名。
- **providerApi**：`providerApi(source)` 把扁平方法按 namespace 分组，供登录页/新平台代码使用；
  路由暂时继续用扁平方法，两边指向同一实现。

## 加一个平台

1. 在 `src/host/providers/` 或独立目录实现协议（或 `src/host/providers/sources/<id>/`，像 Bodian）。
2. 在 `ONLINE_SPECS`（或 `registerXxxSource`）声明 `capabilities`、`qualityLevels`。
3. 登录方式由能力位自动得出；客户端无需新增平台分支。
4. 补 `test/sources.test.mjs` 的能力/音质/登录方式断言。

## 和 Folia 仍不同的地方

- 注册是静态的，不提供 mod 运行时增删。
- 路由仍调用扁平方法；`api` 分组是新增的契约视图，旧代码逐批迁移。
- 没有 `externalPlayback` 的实际实现；能力位先留好，Spotify/Apple 这类只登记外部播放。
