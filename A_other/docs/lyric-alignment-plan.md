# 歌词获取与 Folia 对齐执行计划

> 目标：让插件“播放一首歌时歌词怎么来、存哪、按什么规则选”与 Folia（`folia-major-main`）一致。
> 显示管线（解析 → 行规则 → staff 策略 → 副歌 → 字幕 → 分词）已经同源，不在本计划范围内。
> 关联：[folia-porting.md](folia-porting.md)、[data-reset.md](data-reset.md)、[pitfalls.md](pitfalls.md)。

---

## 0. 决策（2026-11-17，全部按 Folia）

| # | 决策 | 结果 |
|---|---|---|
| D1 | 音频是否等第一份歌词 | **等**。与 Folia 相同：第一份歌词就绪后才释放自动播放；**不等**可选的升级搜索（Folia 先 `onDone` 再搜）。回退路径见 §5 |
| D2 | 歌词状态与歌词正文存哪 | 按 Folia 的“歌曲记录拥有歌词”：每首一条记录（本地键 = 绝对路径，在线键 = `online:<provider>:<id>`），记录里带匹配到的歌词正文/来源/元数据，**不是可被“清空缓存”丢掉的缓存** |
| D3 | 旧 `lyricOrder` 设置 | 删除。改为 Folia 的三项：本地/在线优先级、首选歌词来源、本地格式顺序 |
| D4 | 来源表 | 按 Folia：`netease → amll → qq → kugouLite → qishui`。Bodian 不再参与跨源匹配（它自己的歌词照常显示）。来源 id = provider id（修掉 `kugou` / `kugouLite` 不一致） |
| D5 | 逐行匹配能否替换平台歌词 | 能。与 Folia 相同：首选来源胜出即替换平台自己的逐行歌词；门槛仍是 score ≥ 75 且不是自己的平台 |

---

## 1. Folia 的行为契约（本计划的验收口径）

### 1.1 本地歌曲

1. **选源**（`selectLocalSongLyricsSource`）：显式 `lyricsSource` → 纯音乐标记 → `localLyricsPriority==='online' && matchedLyrics` → 同目录 → 内嵌 → `matchedLyrics` → 无。
2. **自动匹配**（`matchLyrics`）：无本地/内嵌，或优先级为 online 时，用 title/artist/album/duration 跑多来源匹配；结果写回歌曲记录；纯音乐判定一并持久化。已标记纯音乐、`noAutoMatch`、手动选择不被覆盖。
3. **显式选择**：`local | embedded | online` 三种，按首保存；另有“纯音乐”作为可选项。
4. **导入歌词**：存记录（`localLyricsContent`），不写音频文件；任何音频格式都能导入。
5. **读取细节**：`track.lrc` 与 `track.mp3.lrc` 都认；翻译 `track.t.*` 可与主歌词不同格式；内嵌先 `common.lyrics` 再 native `uslt/sylt/lyric`，优先带时间轴；格式顺序用户可排，`.fia` 恒最高。

### 1.2 在线歌曲

1. **首份**：平台自己的歌词（`omni.getLyrics`），解析后立即显示。
2. **状态**（`OnlineLyricsState`）：`imported`（用户导入）/ `onlineOverride`（用户或自动匹配选定的别来源）/ `matchedIsPureMusic`。有状态时不再自动升级。
3. **升级**（`autoUseBestLyric`）：首份显示后后台跑匹配；命中条件 = 来源不是本平台、score ≥ 75；逐字优先，逐行可作结论（D5）；纯音乐判定持久化并清空显示。
4. **来源顺序**：用户首选来源在最前（默认 `qq`），其余按来源表。
5. **保留平台逐字**：只有 `prefersOwnWordByWord` 的平台（Folia 里是 Apple Music）才有意义，插件无该平台，保留设置位但不产生行为。

### 1.3 播放门控

`isLyricsLoading` 为真时不自动播放；歌词加载结束（`onDone`）后释放。升级搜索不在门控内。

---

## 2. 数据模型

`<DSH_HOME>/music/lyric-states.json`（索引，原子写）：

```jsonc
{
  "version": 1,
  "tracks": {
    "<绝对路径>": {
      "source": "local" | "embedded" | "online" | "imported" | null, // null = 自动
      "noAutoMatch": false,
      "markedPureMusic": false,
      "pureMusic": false,              // 匹配结果判定的纯音乐
      "matched": {                     // 匹配到的在线歌词（对应 Folia 的 matchedLyrics*）
        "source": "qq", "id": "…", "title": "…", "artist": "…", "album": "…",
        "coverUrl": "…", "score": 92, "wordLevel": true, "at": 1730000000000
      },
      "imported": { "name": "x.lrc", "at": 1730000000000 },
      "updatedAt": 1730000000000
    },
    "online:<provider>:<id>": { /* 同结构；source 额外支持 "imported" */ }
  }
}
```

歌词正文放在 `<DSH_HOME>/music/lyrics/<sha1(key)>.txt`（`<key>` 为上面的键），记录里只留元数据。理由：

- 与 Folia 一致：记录拥有歌词，清“缓存”不会丢；
- 索引小而稳定，避免一个大 JSON 每次整写；
- 目录在 `<DSH_HOME>/music` 下，`clearData()` 自动覆盖。

---

## 3. 接口

### 3.1 本地

| 路由 | 作用 |
|---|---|
| `GET /lyrics?path&priority=local\|online&formatOrder=lrc,vtt,…` | 按 §1.1 选源解析；`source` 增加 `online`；返回 `pureMusic`、`raw/formatHint/translation`、`matched` 摘要 |
| `GET /lyrics/sources?path` | `{ embedded, local, online, active, matchedSource, pureMusic, markedPureMusic, noAutoMatch, source }` |
| `GET /lyrics/auto?path&preferred=qq&force=0` | 跑自动匹配并写入记录；返回 `{ matched, pureMusic }`；命中缓存时直接返回 |
| `POST /lyrics/choice` `{ path, source }` | 写显式来源（`local/embedded/online/null`） |
| `POST /lyrics/pure-music` `{ path, marked }` | 纯音乐标记 |
| `POST /lyrics/no-auto-match` `{ path, on }` | 不使用在线数据 |
| `POST /lyrics/import` `{ path, text, name }` | 导入歌词到记录（不写音频文件） |
| `POST /lyrics/save`（保留） | 显式“写回音频标签”，仅 MP3/FLAC |

### 3.2 在线

| 路由 | 作用 |
|---|---|
| `GET /online/lyric?provider&id&…` | 先查状态（imported/override/pureMusic），否则平台歌词；平台无词时按首选来源顺序借词 |
| `GET /online/best-lyric?provider&id&…&preferred=qq` | 升级搜索（缓存命中直接返回） |
| `POST /online/lyric-choice` `{ provider, id, source: 'online'\|'imported'\|null, pureMusic }` | 写状态 |
| `POST /online/lyric-import` `{ provider, id, text, name }` | 在线歌导入歌词 |

客户端把 `priority`、`preferred`、`formatOrder` 作为参数传给 Host：偏好只有一处（`prefs`），Host 不存重复状态。

---

## 4. 阶段

| 阶段 | 内容 | 交付 |
|---|---|---|
| P0 | 本文档 + 契约 | 本文件 |
| P1 | 本地：状态 store、选源、自动匹配、显式选择/纯音乐/不使用在线数据、导入；设置项与面板来源切换 | Host 路由 + store + 客户端 |
| P2 | 在线：状态持久化、首选来源顺序、升级口径（`isWordByWord`、接受逐行、纯音乐持久化）、在线导入 | Host 路由 + 客户端 |
| P3 | 读取细节（sidecar 命名/翻译/格式顺序、内嵌 native 回退）、AMLL 候选探测、统一加载器、播放门控（D1） | Host + 客户端 |
| P4（可选） | 别名搜索、匹配窗三开关 | — |

每阶段：`npm test`、`npm run check`、`node scripts/build-client.mjs`（改客户端后），并单独 `git commit`。

---

## 5. 门控与回退

自动播放的释放点仍是 `player.js` 的 `playAfterLoudness`：新增一个“歌词就绪”闸门，与响度闸门并列，两者都就绪才 `play()`。

回退：`play()` 被浏览器拒绝（自动播放策略）时不重试、不回滚成“先播后补”，只保留现有行为（事件驱动更新 UI），并在 `console.info('[dsh-music] lyric gate …')` 记一行；下一次用户手动播放照常。这样不会为了门控牺牲“点击即响”。

---

## 6. 有意保留的差异

- 插件没有 Spotify / Apple Music，因此 `linesOnly`、`prefersOwnWordByWord` 只保留字段与判断，不产生来源。
- 插件没有曲库数据库：Folia 的“歌曲记录”由本 store 承担（键控方式不同，语义相同）。
- 本地歌词写回音频标签保留为显式动作（Folia 无此功能）；匹配结果不再走它。

---

## 7. 实现状态（2026-11-17）

| 项 | 状态 | 位置 |
|---|---|---|
| 每首歌的歌词记录 + 清理 | ✅ | `src/host/stores/lyric-state.js`、`plugin-data.js`、`data-reset.md` |
| 本地选源（Folia 顺序） | ✅ | `src/host/services/lyrics/local-lyrics.js`、`/lyrics`、`/lyrics/sources` |
| 本地自动匹配 + 写回 | ✅ | `src/host/services/lyrics/local-match.js`、`/lyrics/auto` |
| 每首来源切换 / 纯音乐 / 不使用在线数据 / 导入 | ✅ | `/lyrics/choice`、`/lyrics/pure-music`、`/lyrics/no-auto-match`、`/lyrics/import`；面板来源段与设置项 |
| 在线首选来源顺序 | ✅ | `/online/lyric`、`/online/best-lyric` 的 `preferred` 参数 |
| 在线升级口径（`isWordByWord`、接受逐行、纯音乐） | ✅ | `now-playing.js`、`mpPrepareLyrics` |
| 在线导入 / 在线-导入切换（服务端） | ✅ | `/online/lyric-import`、`/online/lyric-choice`、`/online/lyric-state` |
| 在线导入的界面入口 | ✅ | 面板来源段（在线 / 导入 / 纯音乐）与「导入 / 导出」窗口（导入写到歌曲记录） |
| sidecar 命名 / 跨格式翻译 / 格式顺序 | ✅ 读取与「优先格式」设置；完整排序界面未做 | `readSidecarLyrics`、`/lyrics` 的 `formatOrder`、设置页「同目录歌词优先格式」 |
| 内嵌 native 标签回退 | ✅ | `readEmbeddedLyrics` |
| AMLL 候选探测（按需） | ✅ | `online.js` 的 `findMatchedLyric` 与 `local-match.js` 的 `match` |
| 统一加载器 | ✅ | `src/client/services/lyrics/loader.js`：按歌去重，播放器、面板、播放页与输入框歌词条共用一次请求 |
| 播放门控（D1） | ✅ | `player.js` 的 `whenLyricReady`：响度闸门与歌词闸门并行，都就绪才 `play()`；超时 8s 放行 |
| 别名 / 换歌手再搜、匹配窗三开关 | ✅ | `findBestLyrics` 的 `searchAlias` / `alternateArtist` 重试；`providers.lyricSearchAlias` / `alternateArtistName`（网易云歌手 tns/alias、QQ 行内另一个名字）；匹配窗的歌词/元数据/封面开关与「不再为这首歌自动匹配」 |

### 门控与升级的分工

- **门控只等第一份歌词**：`MPLyricLoader.whenReady`，本地同目录/内嵌或在线平台歌词一到位就放行；
- **升级搜索不在门控内**：`/online/best-lyric` 在第一份歌词之后由 loader 自己发起（不 await），命中后写入 loader 的缓存并通过 `subscribe` 通知所有界面（面板、播放页、输入框歌词条），与 Folia 在 `onDone` 之后换词一致；
- 界面订阅晚于升级时，`subscribe` 会立刻回调已升级的结果，不会漏。
