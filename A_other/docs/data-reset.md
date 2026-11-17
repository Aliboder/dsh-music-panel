# 清空插件所有数据的实现说明

> 适用：设置 → 数据 →「清空插件所有数据」。
> 目的：以后新增任何持久化数据时，按本文扩充清理范围，避免“清空后还残留旧数据”。
>
> 最后核对：2026-11-17，目录重构后（`src/client/**`、`src/host/**`、`src/folia/**`）。
> 关联：[theme-guidelines.md](theme-guidelines.md)（新增 UI 必读）。

---

## 0. 不变式（先记这四条）

1. **只清插件自己的数据**：Host 数据目录、插件 localStorage、插件内存 store。
2. **绝不动**：用户音乐文件、DSH 会话/设置、其他插件数据。
3. **清空后是“全新安装”**：无 roots、无收藏/歌单/统计/播放状态/登录、缓存和回收站为空。
4. **roots 置空后不能被安装 seed 重新填回**：`settings.reset()` 显式覆盖 `roots: []`。

---

## 1. 全链路

```text
设置 → 数据 → 清空插件所有数据
  → 第一次确认（说明范围）
  → 第二次确认（不可恢复）
  → POST /music/data/clear { confirm: "clear-all" }
      → clearData(settings.dir, roots)
      → resetData()
          → 清内存 store / 清缓存目录 / 重置 settings
      → 200 { ok, removed, bytes, protected }
  → 清插件 localStorage
  → location.reload()
```

### 1.1 Host 接口

`src/host/http/routes.js`：

| 路由 | 作用 |
|---|---|
| `GET /music/data` | 返回 `{ ok, dir, files, bytes, categories[] }` |
| `POST /music/data/clear` | body 必须是 `{ "confirm": "clear-all" }`，否则 `400 CONFIRM_REQUIRED` |

清空逻辑在 `clearData()` 之后调用 `resetData()`；`resetData` 由 `index.js` 注入。
如果没有注入 `resetData`，接口返回 `503 RESET_UNAVAILABLE`。

### 1.2 Host 数据目录

默认：`<DSH_HOME>/music`（通常是 `~/.dsh/music`）。

`clearData()` 会删除该目录下**所有顶层条目**，但会跳过与已配置音乐 root 重叠的路径
（例如用户把数据目录本身加成了音乐 root 的极端情况），并在结果 `protected` 中报告。

当前已知数据：

| 路径 | 所有者 | 内容 |
|---|---|---|
| `settings.json` | `src/host/stores/settings.js` | roots / hiddenRoots / depth / extensions / onlineQuality |
| `favorites.json` | `src/host/stores/favorites.js` | 收藏 path → addedAt |
| `playlists.json` | `src/host/stores/playlists.js` | 本地歌单 |
| `stats.json` | `src/host/stores/stats.js` | 播放次数 / addedAt / 播放秒数 |
| `lyric-states.json` | `src/host/stores/lyric-state.js` | 每首歌的歌词选择、匹配结果与纯音乐标记（本地键=绝对路径，在线键=`online:<provider>:<id>`） |
| `lyrics/**` | `src/host/stores/lyric-state.js` | 匹配到或导入的歌词正文（`<sha1>.json`，不属于可清缓存） |
| `playback.json` / `.bak` | `src/host/services/playback/playback.js` | 队列 / 进度 / loop / order |
| `sessions.json` | `src/host/providers/login/store.js` | 各平台登录态与 profile（含 Bodian） |
| `accounts.json` | `src/host/stores/accounts.js` | 各平台账号快照：昵称、头像、歌单、喜欢 id |
| `providers.json` | legacy provider store | 旧登录数据（如存在） |
| `bodian-device.json` | `src/host/providers/sources/bodian/device.js` | Bodian 设备身份 |
| `qishui-device.json` | `src/host/providers/sources/qishui/device.js` | 汽水设备身份 |
| `qq-auth-sessions.json` | `src/host/services/qq-api.js` | QQ 包的 `qqmusic_session` 服务端登录仓库 |
| `cache/**` | `src/host/stores/media-cache.js` | 在线缓存：`audio/<provider>/<id>.<ext>` + meta、`cover/<provider>/<id>.<ext>` + meta、`version.json`（旧 `cache/online` 在升级时被一次性清掉） |
| `trash/**` | `src/host/services/media/trash.js` | 回收站 |
| `*.bak` / `*.tmp` | `src/host/stores/json-store.js` | 原子写备份/临时文件（随根目录清理） |

> **新增文件/目录时**：只要仍在 `<DSH_HOME>/music` 顶层或子目录下，`clearData()` 会自动删除；
> 但必须更新 `src/host/services/media/plugin-data.js` 的 `CATEGORIES`（用于界面分类）和本文清单。

### 1.3 Host 内存 store

`index.js` 的 `resetData()` 按顺序处理：

```js
library.clear()                 // 扫描 / 元数据缓存
stats.invalidate()
lyricState.invalidate()         // 每首的歌词选择/匹配结果（lyric-states.json）
playback.invalidate()
favorites.invalidate()
playlists.invalidate()
await providerStore.clear()     // 登录态（含 sessions.json）
await accountReads.clearAll()   // 账号快照（accounts.json）与进行中的读取
await mediaCache.clear('all')   // 在线音频与封面（Folia 语义的缓存）
settings.invalidate()
await settings.reset()          // 写入 roots: []，忽略 seed roots
library.clear()                 // 再清一次，防止 reset 期间产生新缓存
```

**新增内存缓存时**：必须提供 `invalidate()` / `clear()` / `reset()` 之一，并在 `resetData()` 中调用；
否则文件删了，内存仍会返回旧数据，直到重启。

### 1.4 Client localStorage

`src/client/components/ui/settings.js` 的 `clearPluginLocalStorage()` 按前缀/后缀清理：

| 类型 | 值 | 覆盖 |
|---|---|---|
| 前缀 | `music.` | prefs / UI / loudness / balance / startupGuide 等 |
| 前缀 | `dsh-music` | legacy prefs、player leader |
| 前缀 | `mu.` | 在线历史、legacy UI |
| 前缀 | `lyric_` | 分词、时间轴偏移、渲染质量 |
| 前缀 | `visualizer_` | 帧率、glow/blur 等 |
| 前缀 | `url_background_` | URL 背景列表/选中项 |
| 前缀 | `folia.dev.` | Folia 调试开关 |
| 后缀 | `_tuning` | 各 Folia 样式/背景的 tuning 记录 |

> 新 key 如果落在这几类前缀/后缀内，会自动清理；否则必须把精确 key 或前缀加到
> `clearPluginLocalStorage()`，并补测试。

### 1.5 Client 刷新

`clearAllData()` 成功后会：

1. 清 localStorage；
2. `showToast` 提示；
3. `window.location.reload()`。

刷新是“全新状态”的一部分：清掉内存里的播放器、UI store 和旧列表。

---

## 2. 新增存储时的检查清单（MUST）

### 2.1 新 Host 文件 / 目录

- [ ] 位置在 `<DSH_HOME>/music` 下（推荐）→ `clearData()` 自动覆盖。
- [ ] 更新 `plugin-data.js` 的 `CATEGORIES`（分类名 + 匹配名）。
- [ ] 更新 `A_other/docs/data-reset.md` 本表。
- [ ] 如需要分类文案，更新 `src/client/i18n/strings.js` 的 `data.category.*`。
- [ ] 添加测试：`test/host/plugin-data.test.mjs` 断言分类/字节/删除。
- [ ] 确认不删除用户音乐 root（`clearData` 的 protected 逻辑）。

### 2.2 新 Host 内存缓存

- [ ] 提供 `invalidate()` / `clear()` / `reset()`。
- [ ] 在 `index.js` 的 `resetData()` 中调用。
- [ ] 加测试：清空后下一次读取为空，而不是旧缓存。

### 2.3 新 Client localStorage

- [ ] 优先使用已有前缀（`music.` / `dsh-music` / `mu.` / `lyric_` / `visualizer_` /
      `url_background_` / `folia.dev.`）或 `_tuning` 后缀。
- [ ] 如果用了新前缀：更新 `clearPluginLocalStorage()` 的前缀/后缀列表。
- [ ] 在测试里断言该 key 会被清（可抽纯 helper 测）。

### 2.4 新 IndexedDB / CacheStorage / Service Worker / 远端 session

当前实现**没有**这些存储；一旦新增：

- [ ] 在 `clearAllData()` 中显式 `indexedDB.deleteDatabase(...)` / `caches.delete(...)` /
      `navigator.serviceWorker` 清理；
- [ ] 在 Host 侧清理对应远端 session / token；
- [ ] 加测试或至少加源码守卫；
- [ ] 更新本文“当前已知存储”表。

### 2.5 新数据类别 / UI

- [ ] `plugin-data.js` 的 `CATEGORIES` 增加 `{ id, label, names }`。
- [ ] `strings.js` 增加 `data.category.<id>`（中英各一条）。
- [ ] 设置 → 数据页应能显示新分类；无数据时不显示该行（当前行为）。
- [ ] 确认“清空缓存”仍只清缓存，不误清新数据。

---

## 3. 测试要求

至少覆盖：

1. `inspectData()`：分类、文件数、字节数正确。
2. `clearData()`：删除数据，但保护配置为音乐 root 的路径。
3. `POST /music/data/clear`：
   - 缺 `confirm` → 400 `CONFIRM_REQUIRED`；
   - 正确 token → 调用 `resetData` 并清空；
   - 无 `resetData` → 503 `RESET_UNAVAILABLE`。
4. `settings.reset()`：roots 为空，且不被 seed roots 覆盖。
5. 客户端：两步确认、localStorage 前缀/后缀、成功后刷新（可用源码守卫测试）。
6. 用户音乐文件/DSH 数据不被删除（至少用“数据目录之外的临时文件仍在”验证）。

当前测试：`test/host/plugin-data.test.mjs`。

---

## 4. 已知限制

- `clearData()` 只保证 `<DSH_HOME>/music` 下的条目；**新存储如果放在目录外，不会被自动清理**。
- localStorage 是**前缀/后缀启发式**；新 key 命名不规范时会漏。新增 key 必须检查本文表。
- 清空后会写入空的 `settings.json`、`sessions.json` 和 `accounts.json`，所以数据目录不是字面空目录，但状态是全新。
- `resetData()` 期间如果有并发刷新（例如 KuGou token 刷新）可能写回旧 session；执行清空时应避免播放/登录操作。
- 清空后需要重新添加音乐目录、重新登录在线平台；这是产品预期，不是缺陷。

---

## 5. 代码地图

| 位置 | 职责 |
|---|---|
| `src/host/services/media/plugin-data.js` | `inspectData()` / `clearData()` / 分类保护 |
| `src/host/http/routes.js` | `GET /music/data`、`POST /music/data/clear` |
| `index.js` | `resetData()` 组装所有 store 的失效/清理 |
| `src/host/stores/settings.js` | `reset()`：roots 置空，忽略 seed |
| `src/client/components/ui/settings.js` | 数据页、两步确认、localStorage 清理、reload |
| `src/client/i18n/strings.js` | `data.*` 文案 |
| `src/client/styles/theme.js` | 数据页/危险按钮样式 |
| `test/host/plugin-data.test.mjs` | 统计、清除、确认、保护 root 的测试 |

---

## 6. Review 结论

新增持久化但不更新清理范围 = **未完成**。
PR 里必须能看到以下之一：

- 数据仍在 `<DSH_HOME>/music` 下，且补了分类/测试；
- 或新增了 `resetData()` / localStorage 清理 / 外部存储清理，并补了测试和本文清单。
