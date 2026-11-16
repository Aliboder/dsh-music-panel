# dsh-music-panel · UI v2 规格（M0）

> 本文件是「界面彻底重构」的施工图与验收依据。实现阶段的所有取舍以本文件为准；
> 与本文件冲突时，先在 PR 里改本文件，再改代码。

- 基线版本：`0.11.1`（commit `3931c14`，工作树干净）
- 回滚命令：`git checkout 3931c14 -- client.js`（Host 无需重启，刷新页面即可）
- 原型：`design/panel-prototype-v2.html`（单文件、无依赖、可直接双击打开）
- 影响面：**仅 Web Client 半边**；Host `index.js` / `lib/**` 与 `/music/*` 接口本次不改

---

## 1. 为什么重写

当前 `client.js` 是 11,101 行单文件，其中 `MusicPanel` 一个组件 5,209 行、85 个 `useState`、
19 个滚动容器、21 个不同的 `z-index` 取值、3 套浮层宿主。界面问题不是样式问题，是四个缺失：

| 缺失 | 后果 |
|---|---|
| 状态没有分层 | 来源/视图/在线 Tab/过滤四轴混用，靠 `lastLocalView`、`setTimeout` 打补丁 |
| 导航没有模型 | 本地视图是 Tab、在线歌单是横条、播放页是浮层，三套模型互相打架 |
| 浮层没有栈 | 播放页、队列、菜单、设置各自 `z-index`，互相遮挡 |
| 行没有统一 | 本地行/在线行/队列行/统计行/专辑行五套渲染，行为不一致 |

因此目标不是"换皮"，而是**重建这四个结构**，功能对齐、数据不动。

---

## 2. 架构

```text
client.js（唯一产物，仍是 window.__ModuleLoader__.load 的零构建单文件）
├─ core    api · prefs · store · player · library · online     纯逻辑，可单测
├─ ui      theme · primitives · row · playerbar · nowplaying    只读 store
│          queue · settings · dialogs · local · online · panel
└─ seats   sidebar · main · shell.overlay · composer             薄，只做挂载
```

源码分片放在 `src/`，由 `scripts/build-client.mjs` 按**显式清单**拼进模块外壳：

- 不引入任何运行时依赖；构建脚本不依赖 npm 包
- 构建脚本检测跨分片重名声明并失败（防 `cycleLoop` 这类重复定义）
- `--check` 模式供 CI 校验「产物与 src 一致」
- 产物 `client.js` 仍提交进仓库，`files` 清单不变

### 2.1 源码分片

| 分片 | 职责 |
|---|---|
| `00-runtime.js` | `MU` 命名空间、模块外壳、i18n `t()` |
| `10-base.js` | `h`、`cx`、`clamp`、`fmtTime`、`fmtBytes`、storage 包装 |
| `20-api.js` | 全部 `/music/*` 调用；统一超时、竞态令牌、错误映射 |
| `30-prefs.js` | 偏好默认值、读写、旧键迁移、订阅 |
| `40-store.js` | `createStore` / `useStore` / attach-detach |
| `50-player.js` | 播放引擎（从现 `client.js` L1703–L2697 平移，语义不变） |
| `60-library.js` | 曲库 store：扫描、排序、筛选、文件夹分组、多选 |
| `70-online.js` | 在线 store：平台、搜索、歌单、最近播放、缓存、登录 |
| `80-overlay.js` | 浮层栈：open/close/Esc/焦点/滚动锁 |
| `90-theme.js` | 全部 CSS（token + 回退） |
| `ui/*.js` | 组件与视图 |
| `99-plugin.js` | `return { name, inject, apply }` |

---

## 3. 布局

```text
<PanelFrame>  height:100%  grid: 48px / 1fr / 76px
├─ <TopBar>        品牌 · 来源切换 · 搜索 · 账号 · 刷新 · 设置
├─ <Workspace>
│  ├─ <SectionBar> 当前来源的分区（歌曲/专辑/… 或 最近播放/歌单/缓存）+ 排序/视图
│  ├─ <Content>    ★唯一滚动容器
│  │  ├─ 标题行     标题 · 数量 · 主操作
│  │  ├─ 工具行     仅上下文操作（有才显示）
│  │  └─ 列表区     TrackList / AlbumGrid / ArtistList / StatsView / PlaylistList
│  └─ <Queue>      队列侧栏（可开合；窄屏降级为抽屉）
├─ <PlayerBar>     曲目 · 进度 · 传输 · 音量 · 收藏 · 队列 · 播放页
└─ <OverlayRoot>   绝对定位铺满面板，isolation:isolate
   ├─ L10 ContextMenu / Popover
   ├─ L20 Dialog（登录 / 标签编辑 / 歌词搜索 / 确认）
   ├─ L30 Sheet（设置）
   └─ L40 Immersive（播放页）
```

**默认顶栏布局（`layout=top`）**：DSH 自带左侧栏，面板不再叠加第二条竖栏；分区用一条 40px 的横向栏表达。
`layout=rail` 保留为可选变体（一个常量切换），用于将来歌单数量变多、需要常驻可视导航时，代价是 188px 宽度与"栏中栏"观感。

| 尺寸 | 值 |
|---|---|
| 顶栏 | 48 |
| 分区栏 | 40（顶栏布局） |
| 左栏宽（变体） | 188（≥1100） / 56（<900） |
| 队列宽 | 304（≥1100） |
| 标题行 | 64 |
| 工具行 | 36（仅上下文操作时出现） |
| 列表行 | 56 |
| 队列行 | 44 |
| 播放条 | 76 |

断点：`≥1100` 内容 + 队列双栏；`900–1100` 队列改抽屉；`<900` 分区栏横向滚动；`<760` 播放条隐藏音量。

---

## 4. 状态模型

| 域 | 字段 | 持久化 |
|---|---|---|
| `prefs` | 21 项偏好 + 歌词偏移 + 音量 | localStorage `music.prefs.v2`（迁移 `dsh-music.prefs`） |
| `ui` | `source / nav / playlistId / query / sort / viewMode` | localStorage `music.ui.v2`（迁移 `mu.view`、`mu.source`） |
| `player` | 队列 / 索引 / 播放 / 模式 / 时间 / 缓冲 | Host `playback.json`（不变） |
| `library` | `phase / tracks / error / warnings` | 无 |
| `online` | `provider / phase / results / playlists / tab / cache / error` | 最近播放：localStorage（不变） |
| `overlays` | 栈 | 无 |

### 4.1 七条硬约束

1. 内容区是**唯一的主滚动容器**；顶栏、导航、工具行、播放条固定。队列与设置是各自独立的滚动面板，不与内容区嵌套。
2. 所有浮层只挂在 `<OverlayRoot>`；`z-index` 只能来自 `STACK` 常量，禁止字面量。
3. 本地与在线共用同一个 `<TrackList>` 与 `<TrackRow>`。
4. 跨视图跳转只改 `ui` 状态；禁止 `document.querySelector`、禁止 `setTimeout` 等渲染。
5. 组件不直接 `fetch`；view 只读 store。
6. 请求带令牌，过期响应丢弃（api 层统一实现）。
7. 监听器/定时器由 store 的 attach-detach 计数管理，卸载即释放。

---

## 5. 交互规则

| 场景 | 规则 |
|---|---|
| 切来源 | 保留播放队列与进度；重置该来源的导航到默认项；清空搜索 |
| 导航 | 只改 `ui.nav`；内容区替换；不产生"页面前进栈"、不出现"返回上一页" |
| 歌单 | 本地与在线统一为导航里的列表项；选中后内容区标题变为歌单名 |
| 搜索 | 全局唯一输入框；作用域=当前来源；本地即时过滤，在线回车/400ms 防抖 |
| 播放行 | 单击播放；双击同效；右键出菜单 |
| 定位正在播放 | 播放条「定位」按钮 → 切到所属来源/歌单 → 列表 `scrollToPath` |
| 队列 | 侧栏，永远在内容右侧；不覆盖内容；宽度不足时改抽屉 |
| 播放页 | Immersive 层，覆盖整个面板；关闭恢复原滚动位置 |
| 设置 | Sheet 层，左侧 6 个分页；单一滚动 |
| Esc | 只关最上层：菜单 → 对话框 → 设置 → 队列 → 播放页 |
| 右键菜单 | 贴指针显示并做视口钳制；滚动/缩放/Esc 关闭 |

---

## 6. 视觉 token

| 项 | 值 |
|---|---|
| 间距 | 4 / 8 / 12 / 16 / 20 / 24 |
| 圆角 | 行 8 · 卡片 10 · 浮层 14 · 胶囊 999 |
| 字号 | 20（页标题）/ 13 / 12.5 / 11.5 / 11 |
| 行高 | 1.5 |
| 强调色 | `--dsw-static-deepseek-450`（回退 `#5b8cff`），仅用于选中/正在播 |
| VIP | 金色 `#f2c14e`，只有徽标用 |
| 动效 | ≤160ms；`prefers-reduced-motion` 全关 |
| 主题 | 深/浅都只用 token，带硬回退；不写死背景色 |

---

## 7. 验收清单（M5 必须全过）

- [ ] 1. 面板内只有内容区一个滚动条；顶栏/导航/播放条固定
- [ ] 2. 切换来源不丢队列、不丢进度、不重置音量
- [ ] 3. 切换本地视图后返回，滚动位置恢复（不是回顶）
- [ ] 4. 搜索框全局唯一；在线模式下输入能搜在线，不再是死输入框
- [ ] 5. 在线歌单与本地歌单都在导航里，选中只换内容区
- [ ] 6. 右键菜单贴指针、不被裁、滚动即关
- [ ] 7. 播放页打开/关闭不改变列表滚动位置
- [ ] 8. 播放页与队列不再互相遮挡；队列是侧栏不是浮层
- [ ] 9. 定位按钮跨来源/歌单能滚到正在播放行（不靠 setTimeout）
- [ ] 10. 设置是整页 Sheet，6 个分页，无嵌套滚动
- [ ] 11. 音量可用，切歌不重置音量
- [ ] 12. 深色/浅色都能读；无写死颜色
- [ ] 13. 720 / 900 / 1100 / 1400 四个宽度无横向滚动、无重叠
- [ ] 14. 空库、扫描中、扫描失败、未登录、在线请求失败都有明确状态
- [ ] 15. 键盘可达：Tab 焦点可见，Space 播放/暂停，Esc 逐层关闭
- [ ] 16. `prefers-reduced-motion` 下无旋转/位移动画
- [ ] 17. 卸载后无残留监听器、定时器、`<style>`
- [ ] 18. `client.smoke` / `style` 测试更新后仍断言座位与样式注入
- [ ] 19. `npm test`、`npm run check`、`npm run pack:check` 全绿
- [ ] 20. GUI 里实际点一遍：本地播放、在线搜索、扫码登录入口、标签编辑、缓存列表

---

## 8. 原型与预览

- 文件：`design/panel-prototype-v2.html`（单文件、无依赖，双击即可打开）
- 深链：`#online`、`#np`、`#queue`、`#settings`、`#grid`、`#light`、`#narrow`、`#rail`、`#top`，可组合（如 `#queue&light`）
- 截图（默认顶栏布局）：`01-local-top` `02-online-top` `03-settings` `04-now-playing` `05-queue-light` `06-context-menu` `07-grid-narrow`；另附 `08-rail-local` 对比左栏变体

已在浏览器里逐项验证：本地列表、在线最近播放（含账号 chip）、设置 Sheet、播放页、队列侧栏 + 浅色、右键菜单、封面墙 + 窄屏。
原型数据全部是假的，不发起任何网络请求。顶部「布局」按钮可在顶栏 / 左栏两种布局间实时切换。

## 9. 明确不做（本次）
- 不改 Host、不改接口、不改数据文件格式
- 不改在线平台取链逻辑
- 不引入 UI 框架（仍然 `React.createElement`）
- 不做移动端独立布局（只做面板宽度自适应）
- 不做多选批量编辑之外的批量操作扩展

---

## 10. 里程碑

| 阶段 | 内容 | 状态 |
|---|---|---|
| M0 | 本规格 + 基线登记 | ✅ |
| M1 | 可交互原型（本目录 `panel-prototype-v2.html`） | ✅ |
| M2 | 构建脚本 + core 层 + 面板骨架 + 本地视图 | ✅ 已落地到 `src/`，`client.js` 由构建生成 |
| M3 | 在线视图（三平台 / 歌单 / 最近 / 缓存 / 登录） | ✅ 已迁移 |
| M4 | 播放页 / 队列 / 设置 / 标签编辑 / 歌词搜索 | ✅ 播放页回归 0.11 视觉；标签在线匹配、封面、在线歌词、偏移写回、重复清理、批量编辑、睡眠定时全部迁移 |
| M5 | 删旧代码与死 CSS、文档、发版 | ✅ 旧路径已下线，文档已更新；发版待定 |

