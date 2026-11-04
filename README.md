# dsh-music-panel

DeepSeek Harness 的本地音乐插件：左侧栏一个音符入口，点开是整页播放器；扫描你指定的音乐文件夹，读取封面、标题、歌手、专辑、时长与音质信息。

[![npm](https://img.shields.io/npm/v/dsh-music-panel.svg)](https://www.npmjs.com/package/dsh-music-panel)
[![license](https://img.shields.io/npm/l/dsh-music-panel.svg)](LICENSE)

```
左侧栏 × dsh-music-panel ×───────────┐
          │ 歌曲  268        ✓ ⇅ ⌕ ↻ │
          │ [列表循环] [随机] [×]     │
          │ ┌──┐ 心如止水      成语接龙 03:05
          │ │▣│ CD Ice Paper            │
          │ └──┘ フタリ (Inst.)  ...     │
          │ ...                        │
          │ [▣] Trap  ──●── ⏮ ⏯ ⏭ ≡  │
          └────────────────────────────┘
```

## 功能

- **左侧栏入口**：`sidebar.panellist` 注册 `music` 图标，点开切换到独立主面板（与「插件市场」「定时任务」同一套宿主机制）。
- **歌曲列表**：封面缩略图、标题、歌手（带 CD 徽标）、专辑、时长、采样率；当前曲高亮。
- **播放控制**：列表循环 / 单曲循环 / 不循环，随机播放，上一首、下一首、进度拖动、音量与静音。
- **播放队列**：底部「队列」按钮展开当前队列，点击任意条目跳转；「更多」里显示格式 / 码率 / 采样率，可复制文件路径。
- **列表操作**：搜索、排序（标题 / 文件名 / 专辑 / 艺术家 / 大小 / 年份 / 文件夹 / 播放次数 / 时长 / 修改时间 / 添加时间，点击同项切换升降序）、多选后「播放选中」或加入播放列表、清空列表。
- **设置面板**：主面板右上角齿轮打开，含「外观 / 歌词 / 音乐库」三个标签页：外观调整迷你浮窗与圆形封面显示，歌词调整来源顺序、对齐、字号、翻译与状态栏歌词，音乐库管理音乐文件夹与子文件夹深度（保存后主面板自动重新扫描）。
- **外观设置**：迷你浮窗（右下角可拖动、记忆位置）、播放页圆形封面 / 黑胶底盘 / 封面旋转。
- **歌词设置**：歌词来源顺序（内嵌 / LRC，可调）、对齐方式、字体大小与粗细、模糊非当前歌词、翻译开关与翻译字号缩放、状态栏歌词（输入框内或输入框上方显示当前唱词）。
- **播放列表**：顶栏「全部歌曲」与每个歌单各占一个 tab，**页面结构完全一致**（搜索、排序、多选、播放全部、循环/随机、队列）；「全部歌曲」是不可编辑集合，歌单可点标题改名、删除、逐首移除。右侧 `+` 新建歌单（自动命名，重名递增）并立即选中。歌单存于 `<DSH_HOME>/music/playlists.json`。
- **播放页**：点击底栏空白处（封面/标题/进度条以外）以滑入动画打开全屏播放页——左侧黑胶唱片（外盘 + 圆形封面，播放时旋转、暂停即停在当前角度），右侧歌词；点歌词可跳转，Esc 或顶部按钮收起。
- **歌词**：优先读歌曲**内嵌歌词**（ID3 USLT/SYLT、FLAC LYRICS、MP4 ©lyr），带时间戳的自动滚动高亮，纯文本的静态可滚动展示；没有内嵌时回退到同目录同名 `.lrc`。支持一行多时间戳、元数据标签、原文+翻译同时间戳合并。
- **封面与标签**：走 [`music-metadata`](https://github.com/Borewit/music-metadata)，支持 mp3 / flac / m4a / wav / ogg / opus / aac。

## 安装

```bash
# 方式 1（推荐）：从 npm 安装
dsh plugin --profile <profile> add dsh-music-panel

# 方式 2：从 GitHub 安装
dsh plugin --profile <profile> add github:Aliboder/dsh-music-panel

# 方式 3：本地目录（开发用）
plugin_manager install_bundle D:/SystemFiles/Documents/Project/DSH/plugins/dsh-music
```

也可以在 DSH 的 Plugin Manager 里直接 `install_bundle dsh-music-panel`。

安装后**完整重启 DSH**（Host 侧 `index.js` 变化需要重启），然后刷新页面。

首次使用：主面板右上角齿轮 → 音乐库 → 添加音乐文件夹 → 保存 → 回到左侧栏点音符图标。

## 接口

前缀 `/music`，全部只接受本机回环地址（远程访问下音乐面板不可用）。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/music/config` | 生效配置、DSH home、配置文件路径 |
| POST | `/music/config` | 校验并保存 `{ roots, depth, extensions }` |
| GET | `/music/library?refresh=1` | 扫描所有根目录，返回曲目与告警 |
| GET | `/music/stream?path=…` | 支持 `Range` 的音频流（`206` / `416`） |
| GET | `/music/lyrics?path=…` | 内嵌歌词或同名 `.lrc`；返回 `lines`、`timed`、`source` |
| GET | `/music/playlists` | 全部播放列表 |
| POST | `/music/playlists` | 新建，body `{ name }` |
| PATCH | `/music/playlists/:id` | 重命名 / 加曲 / 删曲：`{ name?, add?: string[], remove?: string[] }` |
| DELETE | `/music/playlists/:id` | 删除播放列表 |
| POST | `/music/play` | 记一次播放，body `{ path }` |
| GET | `/music/cover?path=…` | 内嵌封面；无封面返回 404 |

`stream` / `cover` 的 `path` 会 `realpath` 后重新校验是否位于已配置的根目录内，越界一律 404。

## 配置

patch 的 `config` 是首次启动的种子：

```yaml
- insert:
    - id: music
      name: dsh-music-panel
      config:
        roots: []
        depth: 4
        extensions: []
```

用户在设置面板的音乐库标签页保存后，以 `<DSH_HOME>/music/settings.json` 为准（`extensions: []` 表示使用全部支持的格式）。播放次数与首次入库时间存在 `<DSH_HOME>/music/stats.json`。

## 播放宿主与后台播放

- `<audio>` 元素挂在宿主的 `shell.overlay`（常驻浮层）里，主面板切走、会话切换都不会卸载它，所以播放不中断；播放状态由 `client.js` 里的引擎单例（`window.__dshMusicPlayer`）持有，模块被 HMR 重新执行也复用同一实例。
- **曲目以本地 Blob URL 播放**（`fetch` → `blob:` → `URL.createObjectURL`）。Desktop（Electron）的媒体栈会静默丢弃对 HTTP 流写 `currentTime` 的 seek 请求（`readyState` 已是 4 也会返回 0），Blob 是本地媒体，拖动进度可靠。下载走本地回环，代价是一次磁盘读取；切歌时会 `abort` 旧请求并 `revokeObjectURL`。
- 接入 MediaSession：曲目信息（标题/歌手/专辑/封面）同步到系统媒体面板，媒体键 / 锁屏的播放、暂停、上一首、下一首、跳转都能用。
- 插件自身卸载时只 `suspend()`（暂停），不销毁引擎。

## 已知限制

- 收藏、播放历史尚未实现（播放列表已支持）。
- m4a 的文本标签可读，内嵌封面暂不解析（封面支持 mp3 / flac）。
- 扫描缓存 30 秒；文件变化后点「重新扫描」强制刷新。
- 播放依赖浏览器的 `<audio>`：DSH 的 Web GUI 在 `http://127.0.0.1` 下可用；远程访问（非回环）会返回 403。
- 首次点歌需要把整首文件读成 Blob（本地回环，通常不到 1 秒），超大单曲会占用同等大小的内存。
- 单个根目录最多 5000 首，超出会截断并在 `truncated` 标出；列表目前是全量渲染，超大库首次打开会有渲染开销。

## 开发

```bash
git clone https://github.com/Aliboder/dsh-music-panel.git
cd dsh-music-panel
npm install
npm test           # 8 个测试文件
npm run check
npm run pack:check
```

生效方式：`index.js` / `lib/**` 改动需完整重启 DSH；`client.js` / `locale` 改动刷新页面。
