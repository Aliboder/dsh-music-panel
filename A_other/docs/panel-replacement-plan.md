# DSH 音乐主面板 v3 正式替换方案

> 文档性质：汇报 + 执行计划（本文档是替换旧主面板的施工主依据）
> 状态：已按 P0–P6 实施（2026-11-18）；旧主面板 JS/测试已删除；构建、测试、check 通过，GUI 需重启 DSH 后验收
> 基线：dsh-music-panel 0.37.2，commit 223a302，2026-11-18
> 目标：完完全全替换旧的 Web 主面板（<code>main</code> 槽里的浏览区 + 播放条 + 队列）
> 不在范围：Host 接口、播放/音频引擎、设置页、播放页（Folia 舞台）、登录/标签/歌词弹窗、输入框歌词条、侧栏图标
> 关联文件：
> - 结构原型：<code>A_other/design/panel-prototype-v3.html</code>
> - 设计细案：<code>A_other/docs/panel-v3-plan.md</code>
> - 主题规范：<code>A_other/docs/theme-guidelines.md</code>
> - 官方规则：<code>docs/official/web-styling.zh.md</code>、<code>ui-radius.zh.md</code>、<code>ui-design-review-cases.zh.md</code>、<code>defensive-patterns/client-components.zh.md</code>

---

## 0. 一句话结论

新面板 = 一个稳定的壳（顶栏 + 视图栏/选择条 + 内容头 + 播放条 + 队列浮窗）+ 一套按页面注册表组织的页面（列表/网格/详情/搜索）+ 一套按运行时来源能力长出来的导航。

播放页、设置页、Host 接口、播放引擎、歌词/标签/登录弹窗都不动；旧主面板的文件、测试、CSS、文档在验收后完整删除。

---

## 1. 汇报：这次做了什么

### 1.1 我读过的材料

- 官方文档本地镜像 <code>docs/official</code>：Web 样式、圆角规范、UI 审查基准、客户端组件规则、Slots、Client Modules。
- 本仓主题规范 <code>A_other/docs/theme-guidelines.md</code>，以及官方 token 本地存档 <code>A_other/design/official/tokens/</code>。
- 旧面板源码：<code>panel.js</code>、<code>navigation.js</code>、<code>header.js</code>、<code>local.js</code>、<code>online.js</code>、<code>player-bar.js</code>、<code>track-row.js</code>、<code>queue.js</code>、<code>settings.js</code>、<code>now-playing.js</code>、<code>dialogs.js</code>、<code>stores</code>、<code>plugin.js</code>。
- 平台来源与能力：<code>src/host/providers/index.js</code>、<code>src/host/providers/sources/index.js</code>、<code>src/host/services/core/contract.js</code>、<code>src/client/components/common/ui.js</code>。

### 1.2 关键数字

| 项 | 数值 |
|---|---|
| 插件版本 | 0.37.2 |
| <code>client.js</code> | 10,477,107 字节，约 174,616 行（生成产物，不手改） |
| Client 片段 | 92 个，顺序由 <code>src/client/manifest.json</code> 决定 |
| 测试文件 | 88 个 <code>.mjs</code>；<code>npm test</code> 是串行脚本，不是 glob |
| 旧主面板核心 | <code>panel.js</code> 815 行、<code>local.js</code> 562 行、<code>online.js</code> 1049 行、<code>navigation.js</code> 272 行、<code>header.js</code> 281 行、<code>player-bar.js</code> 250 行、<code>track-row.js</code> 275 行 |
| 不动的大文件 | <code>now-playing.js</code> 3190 行、<code>settings.js</code> 1389 行、<code>dialogs.js</code> 1299 行、<code>player-sheet.js</code> 1754 行 |
| CSS | <code>styles/theme.js</code> 1278 行字符串数组 |
| 宿主 React | 固定 React 18.3.1，不允许第二个 React 渲染根 |
| 主面板挂载 | <code>main</code> 槽，key/id 为 <code>music</code>；改名会破坏侧栏选中 |
| 布局设置 | 设置 → 外观 → 布局：顶部/侧栏，<code>prefs.layout</code> 默认 <code>top</code> |
| 数据清理前缀 | <code>music.</code>、<code>dsh-music</code>、<code>mu.</code>、<code>lyric_</code>、<code>visualizer_</code>、<code>url_background_</code>、<code>folia.dev.</code> |

### 1.3 判断

旧主面板不是“某几个 bug 多”，而是结构上缺少四样东西：

1. **没有页面/路由模型**：<code>uiStore</code> 是一个扁平对象，source/nav/query/filter/playlistId/queueOpen/npOpen 混在一起；切页、切源、返回都靠手写 reset。
2. **没有统一的页面契约**：<code>local.js</code> 6 个分支、<code>online.js</code> 7 个分支，每页自己拼标题、计数、工具条、空态。
3. **没有统一的列表**：行高 84px、单击选中/双击播放、每行一个 Tab 停靠点；在线行、本地行、队列行各自实现。
4. **来源与能力没有真正驱动 UI**：来源标签、页面入口、收藏/歌单写入仍有静态列表和平台特判；可选包没装时也可能出现不该出现的入口。

所以这次的目标不是把旧面板修到能看，而是**换壳、换页面组织、换列表、换队列**，功能对齐、数据不动。

### 1.4 五个问题的回答（摘要）

1. **歌曲列表按钮点开是浮窗**：队列改成贴着播放条右上方浮出的面板，不占内容区第三列，不再挤窄列表。
2. **顶部平台不是实际支持的**：平台清单改为运行时注册表；0.37.2 内置在线平台只有 4 个（网易云/QQ/酷狗/Navidrome），波点/汽水是可选包；你截图里有 7 个是因为你的实例装了可选包。干净安装不会出现没有的平台。
3. **艺人页/专辑页**：专辑页是 160 大封面 + 艺人/年份/曲目/时长 + 播放全部/随机/更多 + 歌曲列表；艺人页是 96 圆头像 + 名字 + N 张专辑/M 首歌 + 播放全部/随机 + 热门歌曲 + 专辑网格。两者都进返回记录、恢复滚动、按能力显示入口。
4. **组件外观是否对齐 DSH**：最终实现全部走 DSH 宿主组件与本仓原语；demo 只是单文件 HTML 的结构近似，颜色已换成官方 token 值，但控件不是最终实现。
5. **交互是否对齐成熟播放器**：以 QQ 音乐/网易云桌面版为主，借 Spotify/Apple Music 的悬停播放、选择操作条、搜索页、队列浮窗。单击仍按你之前的要求做“选中”，并补上悬停播放按钮、双击播放、选择条和右键菜单；如果你要 Spotify 式单击播放，只需改一个动作。

### 1.5 demo 结果

原型：<code>A_other/design/panel-prototype-v3.html</code>。已用 Chrome 无头截图验证过歌曲页、专辑页、艺人页、来源菜单、浅色/深色、顶部/侧栏结构；截图在 <code>A_other/design/preview/</code>：

- <code>v3-check.png</code>：歌曲页（深色、新 token、内容头）
- <code>v3-rail.png</code>：侧栏布局 + 专辑网格
- <code>v3-queue.png</code>：队列浮窗
- <code>v3-album.png</code>：专辑详情
- <code>v3-artist.png</code>：艺人详情
- <code>v3-source.png</code>：来源菜单
- <code>v3-light.png</code>：浅色专辑页
- <code>v3-current.png</code>：最近一次结构截图

你说“这版非常不错，就用这一版的结构的排版”。本文档把这个结构冻结为**视觉/结构基线**：

- 顶栏：父级位置 + 来源菜单 + 搜索 + 账号 + 刷新 + 设置
- 视图栏：页面标签 + 排序/选择/视图/播放全部
- 内容头：20/28 页标题 + 数量，随内容滚动
- 歌曲行：56px、封面 40、标题/艺人、专辑、时长、喜欢、更多
- 详情页：大封面/圆头像 + 信息 + 主操作 + 列表
- 播放条：左中右三段、进度线贴顶
- 队列：浮窗
- 顶部/侧栏两种布局
- 浅色/深色

### 1.6 demo 目前还不是正式实现

demo 是结构原型，不是可发布代码。以下差异会在正式实现里补齐，不以 demo 现状为准：

| demo 现状 | 正式实现 |
|---|---|
| 来源菜单固定 7 个（含可选包） | 只显示运行时已注册来源；可选包没装不出现 |
| 搜索框是“就地过滤当前列表” | 聚焦搜索框进入搜索页；结果分组；250ms 防抖 |
| 队列浮窗的头部/分段是简化版 | 正在播放/接下来播放、清空、定位、移除 |
| 行尾“更多”和选择操作条未完全落地 | 悬停播放、选择条、右键菜单完整 |
| 自定义 HTML 按钮/菜单/标签 | 宿主 <code>Button</code>/<code>IconButton</code>/<code>KitSegmentedTabs</code>/<code>HeadMenu</code>/<code>KitModal</code> |
| 右上角主题/布局按钮 | 正式面板不提供主题切换；布局读设置里的“外观 → 布局” |
| 渐变假封面、假数据 | 真实曲库/在线数据 |

---

## 2. 已确认的决策

| # | 决策 | 说明 |
|---|---|---|
| 1 | 重做范围 = 浏览区 + 播放条 + 队列 | 彻底替换旧主面板 |
| 2 | 保留 = 播放页 + 设置页 | 不改结构、不重画、只做回归 |
| 3 | 布局 = 顶部默认，侧栏保留 | 尊重“设置 → 外观 → 布局”；窄屏自动回退顶部 |
| 4 | 单击行 = 选中 | 保留你之前的要求；补悬停播放/双击播放/选择条 |
| 5 | 在线来源 = 统一浏览模型 | 同一套页面；能力决定入口；不写平台特判 |
| 6 | 队列 = 浮窗 | 不占内容区第三列；Esc/外部关闭 |
| 7 | 本地专辑/艺人 = 详情页 | 不再只是筛选歌曲列表 |
| 8 | 歌单 = 独立页 | 顶部模式有歌单页；侧栏模式左栏直接列 |
| 9 | 行高 = 56px | 封面 40；详情页/网格同尺度 |
| 10 | 列表页 = 播放全部 | 视图栏一个图标；详情页 hero 主按钮 |
| 11 | 搜索 = 搜索页 | 顶部搜索框是入口；不再“一个框两种含义” |
| 12 | 组件 = DSH 对齐 | 宿主组件优先；demo 只做结构 |
| 13 | 来源清单 = 运行时 | 不硬编码平台；可选包缺失不出现 |
| 14 | demo 结构冻结 | 后续只补齐交互与工程化，不再改大结构 |

---

## 3. 现状审计：为什么要整体替换

### 3.1 旧主面板的组成

~~~text
main 槽
└─ Panel
   ├─ TopBar            品牌 / 7 个来源标签 / 搜索 / 账号 / 刷新 / 设置
   ├─ Workspace
   │  ├─ NavRail        188px 左栏（顶部模式隐藏）
   │  ├─ SectionBar     40px 横向分区（侧栏模式隐藏）
   │  └─ Content
   │     ├─ ContentHeader  标题 + 数量 + 选择/排序/搜索
   │     └─ LocalContent / OnlineContent（每页自己拼）
   ├─ PlayerBar         68px 三栏 + 独立进度线
   └─ OverlayRoot       菜单 / 登录 / 标签 / 歌词 / 设置 / 播放页
~~~

### 3.2 旧结构的具体问题

| 问题 | 证据 | 后果 |
|---|---|---|
| 三条横栏约 130px | 顶栏 48 + 分区栏 40 + 内容头约 46 | 内容被压缩；一屏歌少 |
| 7 个来源标签挤顶栏 | <code>panel.js</code> TopBar | 窄窗口没有溢出策略 |
| 扁平 UI 状态 | <code>ui.js</code> 的 <code>uiStore</code> | 没有返回/页面记录；切源切页靠手写 reset |
| 每页自己拼 | <code>local.js</code> 6 分支、<code>online.js</code> 7 分支 | 标题/计数/空态/工具条不一致 |
| 两套搜索 | TopBar 即时过滤 + ContentHeader 本页搜索 | 用户无法形成预期 |
| 行高 84px | <code>theme.js</code> <code>.mp-row</code> | 一屏只能看 8 行左右 |
| 每行一个 Tab 停靠点 | <code>track-row.js</code> <code>tabIndex: 0</code> | 268 首 = 268 个停靠点 |
| 播放条三栏等宽 | <code>theme.js</code> <code>.mp-playerbar</code> | 信息散；进度条另占一条 |
| 样式漂移 | 1px 边框、10px 标签、R8 输入框、<code>rgba(0,0,0,.08)</code> | 与主题规范不符 |

### 3.3 旧面板里必须保住的行为

- 单击选中、再次单击取消、Ctrl/Cmd 加选、区域选择、全选/反选。
- 双击播放、Enter 播放、Space 播放/暂停、Ctrl+←/→ 切歌。
- 右键单曲/多选菜单：播放、下一首、收藏、添加到歌单、批量编辑、标签编辑、歌词匹配、删除。
- 排序字段与方向、筛选胶囊、重复歌曲提示。
- 刷新、定位当前、睡眠定时、音量/静音、队列、登录/退出、VIP 标记、加载更多、错误 toast。
- 启动引导、<code>music_control</code> 的 <code>control/pending</code> 轮询、播放错误 toast。
- 设置页、播放页、输入框歌词条、侧栏播放控件。

### 3.4 共享资产：不能跟着旧面板一起删

| 资产 | 位置 | 处理 |
|---|---|---|
| <code>OverlayRoot</code> / <code>StartupGuide</code> / <code>NewPlaylistDialog</code> | 旧 <code>panel.js</code> | 新壳先用全局函数；P6 删除旧文件前搬进新壳 |
| <code>ContextMenu</code>（右键菜单层） | <code>dialogs.js</code> | 直接复用；不要重写 |
| <code>QueuePanel</code> / <code>QueueList</code> / <code>QueuePopover</code> | <code>queue.js</code> | 播放页/播放卡/输入框歌词条共用；不改结构 |
| <code>HeadMenu</code> | <code>header.js</code> | 新面板要用；先抽到公共文件，再删旧 <code>header.js</code> |
| 纯数据 helper（分组/排序/筛选/歌单） | <code>local.js</code>/<code>online.js</code> | 先抽到新数据模块，再删旧视图 |
| 在线数据加载（providers/歌单/专辑/艺人/搜索） | <code>online.js</code> | 先复用；P6 后再解耦 <code>uiStore.nav</code> |
| <code>selectionStore</code> / <code>overlayStore</code> / <code>player</code> / <code>prefs</code> | 现有 stores | 复用，尤其选择状态要让右键菜单继续工作 |
| <code>settings.js</code> / <code>now-playing.js</code> / <code>player-sheet.js</code> | 现有 | 不动；只回归 |

---

## 4. 目标与非目标

### 4.1 目标

1. 一个壳：顶栏、视图栏/选择条、内容头、播放条、队列浮窗；页面只声明内容，不自己拼壳。
2. 一套页面契约：列表/网格/详情/搜索；新增页面不改壳。
3. 一条页面记录：route + 返回记录 + 滚动位置；切源/切页/返回不再靠手写 reset。
4. 一套列表：本地/在线/队列同一种行；悬停播放、单击选中、双击播放、右键菜单、键盘。
5. 一套来源模型：运行时注册表 + 能力表；没有平台特判。
6. 一套视觉：DSH token/宿主组件/圆角/字号/发丝线/浅深色。
7. 队列浮窗；播放条重排；搜索页；专辑/艺人详情。
8. 旧面板完整删除；测试/文档/数据清理同步。

### 4.2 非目标

- 不改 Host 的扫描、在线接口、缓存、歌词、播放、登录协议。
- 不改设置页、播放页、登录弹窗、标签/歌词弹窗、批量编辑弹窗。
- 不改侧栏图标、输入框歌词条、播放页队列。
- 不引入 UI 框架、新构建器、新依赖、Tailwind。
- 不做移动端独立 App；只做面板宽度自适应。
- 不做跨来源混合搜索、专辑收藏、关注艺人、拖拽排序（本期不做，后续单独评估）。
- 不重写播放引擎、音频链路、Folia。

### 4.3 不变量

1. 单击选中、Ctrl/Cmd 加选、双击/Enter 播放。
2. 右键菜单行为不丢。
3. 选择不改变页面高度。
4. 切来源保留播放队列/进度/音量，只重置浏览状态。
5. 内容区只有一个主滚动条。
6. 任何按钮都有真实行为，没有假控件/假数据。
7. 播放页/设置页零改动。
8. 主面板仍挂在 <code>main</code>，key/id 仍为 <code>music</code>。

---

## 5. 五个问题的详细结论

### 5.1 队列改为浮窗

- 触发：播放条右侧队列按钮。
- 形态：340px 宽、最大高度 <code>min(560px, 62vh)</code>、R16、层级阴影、无遮罩；贴着播放条右上方，右 14、下 12。
- 关闭：队列按钮、Esc、点面板外、关闭按钮；关闭后焦点回队列按钮。
- 内容：头部（队列、数量、顺序/随机、清空、定位、关闭）；“正在播放”当前曲；“接下来播放”剩余；点行播放；悬停移除；清空只清后续。
- 窄屏：左右 8、全宽浮窗、最大高度 60vh。
- 不影响内容宽度；不隐藏专辑列；播放页队列不动。
- 为什么：成熟播放器的队列是浮层/抽屉；第三列在窄窗口只能隐藏，体验断裂。

### 5.2 顶部平台以运行时为准

- 0.37.2 内置在线平台只有 4 个：<code>netease</code>、<code>qq</code>、<code>kugouLite</code>、<code>navidrome</code>。
- 波点/汽水是可选包；装了就注册，没装就不注册。
- 浏览器端 <code>availableSources()</code> 目前会先放内置 5 个，再追加 <code>/online/providers</code> 返回的；这是一种早期渲染兜底，不是“已安装”的证明。
- 新面板规则：来源菜单以 <code>onlineStore.providers</code> 的 key 为准；加载中显示“正在加载来源…”；加载失败只显示本地 + 重试，不显示未确认的平台。
- Navidrome 已注册未配置：显示“未配置”，点击去设置。
- 可选包缺失：菜单不出现；设置 → 在线里管理。
- 能力表只用于文档/测试快照，UI 用运行时 <code>capabilities</code>。
- 你截图有 7 个，说明你的实例装了波点/汽水；干净安装可能只有 5 个。这不是“支持不支持”的矛盾，是可选包。

### 5.3 专辑页/艺人页

- **专辑页**：从专辑卡、歌曲行专辑名、右键“查看专辑”、搜索结果进入；160 封面 + 标题 24 + 艺人/年份/曲目/总时长 + 播放全部/随机/更多 + 歌曲列表；进返回记录、恢复滚动；本地按曲库分组，在线按能力；没有能力的平台不显示入口；空态/错误/窄屏规则见 §11。
- **艺人页**：从歌曲行艺人名、专辑页艺人名、右键、搜索进入；96 圆头像 + 名字 + N 张专辑/M 首歌 + 播放全部/随机；热门歌曲（5–8 首）+ 专辑网格；分节标题“全部歌曲”链接到该艺人全部歌曲；没有专辑能力不显示专辑节；不做假关注/粉丝；返回/恢复滚动；错误保留头部 + 重试。
- 两者都复用同一套列表行和详情头；在线/本地只差数据来源和入口能力。

### 5.4 组件与 DSH

- 最终实现：<code>Button</code>、<code>IconButton</code>、<code>KitSegmentedTabs</code>、<code>KitInput</code>、<code>HeadMenu</code>/宿主 <code>Menu</code>、<code>KitModal</code>、<code>Switch</code>、<code>Toast</code>、<code>Empty</code>、<code>Cover</code>、<code>SeekBar</code>。
- 唯一例外：队列浮窗是复合容器（不是菜单、不是对话框），用层级阴影 + R16 + 焦点管理；和现有 <code>QueuePopover</code> 同类。
- demo 不是最终外观：它不能加载宿主 React 组件；demo 的颜色已换成官方 token 值，但按钮/菜单/标签仍是 HTML 仿制。
- demo 右上角的主题/布局按钮是演示用；正式面板不提供主题切换，布局读设置。
- demo 的渐变封面/假数据不进正式实现。
- 最终验收要在真实 DSH 里看：控制台 <code>host UI kit: native</code>，设置 → 关于 → 测试页面逐项对照。

### 5.5 交互对齐成熟播放器

- 参考：QQ 音乐/网易云/酷狗桌面版为主，Spotify/Apple Music 作为补充。
- 保留单击选中（你之前的要求），补：
  - 行封面悬停播放/暂停按钮；
  - 双击播放；
  - 选择操作条（替换视图栏，高度不变）；
  - 右键菜单（播放、下一首、加入队列、收藏、添加到歌单、查看专辑/艺人、歌词匹配、标签编辑、删除）；
  - 队列浮窗；
  - 搜索页（聚焦搜索框即进入，250ms 防抖，回车立即）；
  - 详情页大封面/头像 + 播放全部/随机；
  - 键盘：Space、/、Ctrl+←/→、↑/↓、Enter、Esc。
- 如果你要 Spotify 式“单击就播”，把行单击动作换成播放，用复选框/右键选择；其余结构不变。默认按你之前的要求保留单击选中。

---

## 6. demo 说明与边界

### 6.1 demo 是什么

- 单文件 HTML/CSS/JS，假数据，不发起网络请求。
- 用来确认：结构、排版、信息层级、交互方向、浅深色、顶部/侧栏。
- 颜色已换成 DSH 官方 token 值；控件仍是 HTML 仿制。

### 6.2 demo 不是什么

- 不是正式实现；不能直接复制 CSS 到插件。
- 不代表所有交互都已落地；队列分段、来源安装态、选择条、搜索页等在正式实现里补齐。
- 不代表 DSH 宿主组件的真实外观/行为；正式实现以宿主组件为准。

### 6.3 深链

- <code>#page=albums</code>、<code>#album=叶惠美</code>、<code>#artist=周杰伦</code>
- <code>#source=netease</code>、<code>#menu=source</code>
- <code>#light</code>、<code>#rail</code>、<code>#queue</code>

### 6.4 已知 demo 限制

| 限制 | 正式实现 |
|---|---|
| 来源固定 7 个 | 运行时来源 |
| 搜索就地过滤 | 搜索页 |
| 队列头部简化 | 正在播放/接下来播放/清空/移除 |
| 行“更多”/选择条未完全落地 | 完整 |
| 主题/布局按钮 | 移除；主题随宿主，布局读设置 |
| 伪设置/伪播放页 | 保留现有真实页面 |

---

## 7. 关键工程发现

### 7.1 构建与清单

- <code>client.js</code> 由 <code>scripts/build-client.mjs</code> 按 <code>src/client/manifest.json</code> 拼接；92 个片段；不要手改 <code>client.js</code>。
- 构建脚本 <code>assertNoDuplicates</code> 会拦重复的顶层 <code>function/var/const/let</code> 声明；新面板所有顶层名加 <code>P3</code> 前缀。
- 新文件必须加入 manifest 的显式顺序；顺序错会出现“函数未定义/初始化顺序”问题。
- <code>package.json</code> 的 <code>files</code> 不含 <code>src/client/**</code>；交付物是生成后的 <code>client.js</code>，源码片段只参与构建。

### 7.2 来源与能力

- <code>src/host/providers/index.js</code> 的 <code>PROVIDERS</code> 只有 4 个在线平台。
- <code>src/host/providers/sources/index.js</code> 的 <code>ONLINE_SPECS</code> 注册 4 个；波点/汽水通过 <code>registerBodianSource</code>/<code>registerQishuiSource</code> 可选注册。
- 客户端 <code>availableSources()</code> 先放 <code>UI_SOURCES</code>（本地 + 4 个内置）再追加服务器返回；新面板要在 providers 加载完成后以服务器返回为准。
- 能力键在 <code>contract.js</code>；平台声明在各自 source；<code>supports(source, capability)</code> 是现有客户端判断。
- 新面板的 <code>p3-source.js</code> 负责：加载状态、可用来源、能力、登录状态、菜单项；页面只问能力，不问平台 id。

### 7.3 共享组件与依赖

- <code>QueuePanel</code> 被播放页（<code>now-playing.js</code>）使用；<code>QueuePopover</code> 被播放页、播放卡、输入框歌词条、旧播放条使用；<code>QueueList</code> 被播放卡使用。不要改这些结构。
- <code>ContextMenu</code> 在 <code>dialogs.js</code>，读 <code>selectionStore</code>；新面板右键菜单直接 <code>pushLayer('menu', ...)</code>，不要重写。
- <code>OverlayRoot</code>/<code>StartupGuide</code>/<code>NewPlaylistDialog</code>/<code>applyControlAction</code> 目前在旧 <code>panel.js</code>；新壳先复用，P6 删旧文件前搬走。
- <code>HeadMenu</code> 在 <code>header.js</code>；新面板要用，先抽到公共文件。
- 旧 <code>local.js</code>/<code>online.js</code> 里的纯 helper 和在线加载函数要先用后删；见 §12 文件表。

### 7.4 测试、守卫、数据清理

- <code>npm test</code> 是 88 个测试文件里的长串行命令；新增测试要手动加入 <code>package.json</code> 的 <code>test</code> 脚本。
- <code>theme.test.mjs</code> 的 <code>uiFiles</code> 是硬编码列表；新 <code>p3-styles.js</code>/<code>panel-v3/*.js</code> 不在里面，必须扩展，否则新代码绕过主题守卫。
- <code>client.smoke.test.mjs</code> 断言座位/模块 id；新面板不改变座位，保持通过。
- <code>panel.render.test.mjs</code>/<code>panel.hooks</code>/<code>panel.album-*</code> 针对旧面板；新面板要有自己的 render 测试，旧测试在旧面板删除时一起退役。
- <code>in-view-search.test.mjs</code> 针对旧“本页搜索”；新搜索页上线后退役/替换。
- <code>settings-data.test.mjs</code> 只检查 <code>music.</code> 等前缀；新 <code>music.ui.v3</code> 会被前缀覆盖，但 <code>A_other/docs/data-reset.md</code> 和测试要显式补上。
- 清空数据流程：<code>settings.js</code> 遍历 localStorage 前缀 + <code>POST /data/clear</code>；新面板的持久化键必须在清理范围内。

### 7.5 宿主与 React

- DSH 宿主固定 React 18.3.1；插件不新增第二个 React 渲染根。
- 新面板是 <code>main</code> 槽里的一个 React 组件树；宿主组件通过 <code>host-ui.js</code> 的 <code>hostComponent</code> 取，不能在其他文件 <code>require</code> 宿主包。
- 所有注册/监听/定时器走 <code>ctx.effect</code> 清理；新壳的定时器、ResizeObserver、键盘监听都要清理。
- 门面错误边界：一个页面抛错不能带崩 DSH；新壳入口保留 <code>MusicBoundary</code> 类似边界。

## 8. 目标架构

### 8.1 组件树

~~~text
P3Shell                     顶栏 / 视图栏 / 内容 / 播放条 / 队列 / 浮层宿主
├─ P3TopBar                 返回 · 父级 · 来源菜单 · 搜索 · 账号 · 刷新 · 设置
├─ P3ViewBar                页面标签 + 操作；选择时换成 P3SelectionBar
├─ P3Content                内容滚动容器
│  ├─ P3PageHead            20/28 标题 + 数量（详情页不要）
│  └─ Page                  列表 / 网格 / 详情 / 搜索 / 统计 / 空态
│     ├─ P3List             P3Row × N（虚拟滚动）
│     ├─ P3Grid             P3Card × N
│     ├─ P3Hero             专辑/艺人/歌单头部
│     └─ P3States           空态/骨架/错误/登录引导
├─ P3PlayerBar              左曲目 / 中传输 / 右工具
├─ P3QueuePopover           队列浮窗
└─ OverlayRoot              现有菜单/登录/标签/歌词/设置/播放页（复用）
~~~

### 8.2 分层职责

| 层 | 文件 | 职责 |
|---|---|---|
| 壳 | <code>p3-shell.js</code> | 组装、布局、错误边界、浮层宿主 |
| 顶栏 | <code>p3-topbar.js</code> | 位置、来源、搜索、账号、刷新、设置 |
| 视图栏 | <code>p3-viewbar.js</code> | 标签、操作、选择条 |
| 内容 | <code>p3-content.js</code> | 页面切换、滚动位置、内容头 |
| 页面 | <code>p3-pages-*.js</code> | 只声明标题/数据/操作/空态 |
| 数据 | <code>p3-data.js</code> | 分组/排序/筛选/集合模型/本地与在线适配 |
| 来源 | <code>p3-source.js</code> | 运行时来源、能力、登录状态、菜单项 |
| 路由 | <code>p3-router.js</code> | route + history + scroll |
| 导航 | <code>p3-nav.js</code> | 页面注册表 + 标签生成 |
| 列表 | <code>p3-list.js</code> | 虚拟列表、行、悬停播放、键盘 |
| 网格 | <code>p3-grid.js</code> | 专辑/艺人/歌单卡片 |
| 头部 | <code>p3-hero.js</code> | 专辑/艺人/歌单详情头 |
| 状态 | <code>p3-states.js</code> | 空/骨架/错误/登录引导 |
| 播放条 | <code>p3-player-bar.js</code> | 传输、进度、音量、队列入口 |
| 队列 | <code>p3-queue.js</code> | 浮窗、分段、清空、移除 |
| 运行时 | <code>p3-runtime.js</code> | 初始化加载、睡眠、轮询、全局键、错误 toast |
| 样式 | <code>p3-styles.js</code> | 新 CSS，<code>.mpv3-</code> 前缀 |

### 8.3 页面记录（route）

~~~text
route = { source, page, param }
page  = songs | albums | artists | folders | favorites | playlists | stats |
        recent | album | artist | playlist | search
~~~

- <code>source</code> 是 route 的一部分，不是平行状态。
- <code>param</code>：专辑 key、艺人名、歌单 id、搜索词。
- <code>history</code>：只记录详情/搜索；标签切换清空。
- <code>scroll</code>：内存映射 <code>source|page|param → scrollTop</code>。
- 持久化：只存 route（<code>music.ui.v3</code>）；search 页不持久化（保存时回默认页）；history/scroll 不持久化。
- 迁移：首次启动读旧 <code>music.ui.v2</code> 的 <code>source/nav/playlistId</code>，映射成新 route；之后写新 key。
- 旧的 <code>uiStore</code> 保留用于旧面板回退与部分服务；新面板不把 route 写回 <code>uiStore</code>（除必要的兼容）。

### 8.4 页面注册表

~~~text
P3PAGES = {
  songs:     { parent: '资料库', title: '全部歌曲', cap: 'songs',   kind: 'list' },
  albums:    { parent: '资料库', title: '专辑',     cap: 'albums',  kind: 'grid' },
  artists:   { parent: '资料库', title: '艺人',     cap: 'artists', kind: 'list' },
  folders:   { parent: '资料库', title: '文件夹',   cap: 'folders', kind: 'list' },
  favorites: { parent: '收藏',   title: '喜欢',     cap: 'favorites', kind: 'list' },
  playlists: { parent: '收藏',   title: '歌单',     cap: 'playlists', kind: 'grid' },
  stats:     { parent: '收藏',   title: '统计',     cap: 'stats',   kind: 'stats' },
  recent:    { parent: '在线',   title: '最近播放', cap: 'recent',  kind: 'list' },
  album:     { parent: '专辑',   title: '',         cap: 'albums',  kind: 'detail' },
  artist:    { parent: '艺人',   title: '',         cap: 'artists', kind: 'detail' },
  playlist:  { parent: '歌单',   title: '',         cap: 'playlists', kind: 'detail' },
  search:    { parent: '搜索',   title: '搜索',     cap: 'search',  kind: 'search' }
}
~~~

- 标签 = 注册表里 <code>cap</code> 为真且来源可用的页面，按来源类型排序；这里的 <code>cap</code> 是页面可用性键，来源能力键见 §9.2。
- 详情页标题来自数据（专辑名/艺人名/歌单名），不写死。
- 搜索页不需要标签；顶部标签在搜索页无 active。
- 详情页高亮父级标签。

### 8.5 统一集合模型

<code>p3-data.js</code> 暴露一个小的集合模型，页面只消费它：

~~~text
Collection = {
  kind: 'album' | 'artist' | 'playlist',
  key: string,
  title: string,
  subtitle: string,
  cover: { src?, seed, fallback },
  meta: string[],
  tracks: Track[],
  actions: { playAll, shuffle, more? },
  phase: 'idle' | 'loading' | 'ready' | 'error',
  error: string
}
~~~

- 本地：从 <code>libraryStore.tracks</code> 按艺人/专辑/歌单分组；不请求 Host。
- 在线：调用现有 <code>openOnlineAlbum</code>/<code>openOnlineArtist</code>/<code>openOnlinePlaylist</code> 或对应 store 数据；能力不足不打开。
- 页面（<code>p3-pages-detail.js</code>）只渲染 Collection，不判断平台。
- 搜索页也返回同一 Track/Collection 形状。

### 8.6 数据复用

| 数据 | 现有入口 | 新面板 |
|---|---|---|
| 本地曲库 | <code>loadLibrary</code>、<code>libraryStore</code> | 复用 |
| 收藏 | <code>loadFavorites</code>、<code>favorites</code> | 复用 |
| 本地歌单 | <code>loadPlaylists</code>、<code>playlists</code> | 复用 |
| 统计 | <code>loadStats</code>、<code>stats</code> | 复用 |
| 在线来源/能力/登录 | <code>loadProviders</code>、<code>onlineStore.providers</code> | 复用，作为运行时真相 |
| 在线歌单 | <code>loadMyPlaylists</code> | 复用 |
| 在线专辑/艺人/歌单 | 现有 open 函数 | 复用；加 data-only 包装 |
| 在线搜索/历史 | 现有 search/history | 复用 |
| 播放 | <code>player</code> | 复用 |
| 选择 | <code>selectionStore</code> | 复用，右键菜单才能继续工作 |
| 浮层 | <code>overlayStore</code> / <code>OverlayRoot</code> | 复用 |
| 偏好 | <code>prefs</code>（layout/sort） | 复用 |

### 8.7 订阅与重绘

- 顶栏只读 route + source + providers 状态。
- 视图栏只读 route + selection + capabilities。
- 列表只读当前列表数据 + selection + player 当前 id。
- 播放条只读 player snapshot + time；进度更新只改 DOM 文本/宽度，不重画列表。
- 队列只读 player queue/current；打开/关闭不重画内容。
- 派生数组用 <code>useMemo</code>，按来源/数据版本/查询/筛选/排序失效。
- 不使用一个顶层 <code>useStore</code> 读全部 store。

### 8.8 组件策略

| 需求 | 最终组件 |
|---|---|
| 普通按钮 | <code>Button</code>（宿主 Button，variant/size） |
| 图标按钮 | <code>IconButton</code>（宿主 Tooltip + 本地 fallback） |
| 页面标签 | <code>KitSegmentedTabs</code>（sm 34） |
| 搜索框 | <code>KitInput</code> |
| 菜单 | <code>HeadMenu</code> / 宿主 <code>Menu</code> |
| 对话框 | <code>KitModal</code> |
| 空态 | <code>Empty</code> |
| 封面 | <code>Cover</code> |
| 进度 | <code>SeekBar</code> 语义或带 range 的自定义进度 |
| 队列浮窗 | 本仓复合容器（例外） |
| 行/网格/详情头 | 一次性布局 + token |

- <code>hostComponent</code> 只在 <code>host-ui.js</code>；其他文件不直接 require 宿主包。
- 队列浮窗不是菜单、不是对话框：用 elevation + R16 + 焦点管理；Esc/外部关闭；播放页队列不动。
- 来源菜单用 <code>HeadMenu</code>，状态作为标签后缀（<code>网易云音乐 · 已登录</code>），当前项用 <code>selectedId</code>；不依赖宿主 Menu 不存在的 trailing 字段。

### 8.9 样式策略

- 新 <code>p3-styles.js</code> 导出 <code>P3_CSS</code>，在 <code>app/plugin.js</code> 作为第二个 style 标签注入；旧样式保留到 P6。
- 类名统一 <code>.mpv3-</code>；宿主组件自带类名不覆盖。
- 只用 <code>--dsw-*</code>；VIP 金色是唯一状态色例外，复用现有徽标实现。
- 0.5px 发丝线、R12/R16/R20/R28、13/12/11 字号、hover 媒体查询、焦点环、reduced motion。
- 主题守卫测试扩展扫描 <code>p3-styles.js</code> 与 <code>panel-v3/*.js</code>。

### 8.10 开关与回退

- 开发期：<code>localStorage['music.panel'] = 'v3'</code> 才挂新面板；默认仍挂旧面板。
- P6-01：默认 v3，旧面板保留 <code>music.panel = 'v2'</code> 回退一个版本窗口。
- P6-02（回退窗口结束，仍在 P6）：删除旧面板代码与开关；<code>music.ui.v3</code> 成为唯一页面记录。
- 任何阶段旧面板不受影响；回退只需清掉 flag 或装回上一个 <code>client.js</code>。

---

## 9. UI 合同（实施规格）

### 9.1 尺寸

| 区域 | 尺寸 |
|---|---|
| 顶栏 | 56 |
| 视图栏/选择条 | 44 |
| 内容头 | 最小 44（20/28 标题 + 12/18 数量） |
| 内容最大宽度 | 1280 居中；两侧最小 16 |
| 歌曲行 | 56；封面 40；行 R12 |
| 网格卡片 | 封面 1:1；最小 150；桌面 4–6 列 |
| 详情封面 | 160（R16）；窄屏 112 |
| 艺人头像 | 96（圆形）；窄屏 72 |
| 播放条 | 72 |
| 队列浮窗 | 340 宽；最大 <code>min(560px, 62vh)</code> |
| 侧栏 | 220；<1000 自动回顶部 |

### 9.2 顶栏

~~~text
[←] 资料库   [本地音乐 ▾]        [搜索] [头像] [刷新] [设置]
~~~

- 左：返回（有返回记录/详情/搜索/查询时显示）+ 父级位置；来源按钮紧跟父级。
- 右：搜索（32/R12）+ 账号（在线才显示）+ 刷新 + 设置。
- 不显示页面大标题（内容头/hero 负责）；不显示品牌/GitHub。
- 搜索聚焦即进入搜索页；输入 250ms 防抖；回车立即；清除/ Esc 回退。
- 来源菜单：已注册来源、状态、当前勾、管理来源；可选包缺失不出现。
- 账号：头像/首字母 + 菜单（账号、重新登录、退出、Navidrome 服务器设置）。
- 刷新：本地重扫；在线重载当前页；按钮短暂旋转；toast。

### 9.3 视图栏与选择条

- 正常：页面标签 + 操作（播放全部、排序、选择、视图、新建歌单）。
- 选择：整条换成选择条：已选 N 首、全选、播放、收藏、添加到歌单、批量编辑、删除、完成。
- 高度不变 44；窄屏横向滚动。
- 标签：<code>KitSegmentedTabs</code> sm；active 来自 route；详情页高亮父级。
- 排序：标题/艺人/时长/年份；专辑/艺人/歌单用名称/数量；方向升/降。
- 视图：专辑/歌单网格/列表切换。

### 9.4 内容头

- 列表/网格/搜索/文件夹/统计：<code>20/28 标题 + 12 数量</code>；随内容滚动。
- 详情页：不要内容头，hero 标题 24/32。
- 数量：歌曲 N 首、专辑 N 张、艺人 N 位、歌单 N 个、搜索 N 个结果。
- 搜索标题：<code>搜索“关键词”</code>。

### 9.5 歌曲行

~~~text
[封面 40 + 悬停播放] [标题 + VIP + EQ / 艺人] [专辑] [时长] [♥] [⋯]
~~~

- 行高 56，R12；封面 R8；标题 13/20，艺人 12/18 次要色，专辑/时长 12。
- 当前：左 2px 强调条 + 标题 600 + 三格 EQ；选中：淡强调底 + 封面勾；悬停：hover 底；焦点：2px 环。
- 单击选中；Ctrl/Cmd 加选；再次单击唯一选中取消；双击播放；Enter 播放；右键菜单。
- 封面悬停播放按钮：点它播放/暂停；不触发选中。
- 喜欢按钮：有 <code>likes</code> 才显示；<code>likeWrite=false</code> 时点击提示只读。
- 更多按钮：悬停/当前/选中显示；打开现有 ContextMenu 层。
- 专辑名/艺人名可点；能力不足时不可点。

### 9.6 网格

- 专辑/歌单：封面 1:1、R12、标题 13、副标题 12；点卡进详情。
- 艺人：列表（圆头像 48，名字 + N 张专辑/M 首歌）；点进艺人页。
- 网格不做假播放按钮；播放从详情/行开始。
- 歌单卡右键：打开/重命名/删除（本地）；在线歌单只读。
- 空态：说明 + 新建/去歌曲页/登录。

### 9.7 详情头（Hero）

- 专辑：160 封面 + 标题 24 + 艺人/年份/曲目/总时长 + 播放全部/随机/更多。
- 艺人：96 圆头像 + 名字 24 + N 张专辑/M 首歌 + 播放全部/随机。
- 歌单：160 封面 + 名称 + 数量/时长 + 播放全部/随机/更多。
- 更多：加入队列、查看艺人、刷新（在线）；不做假收藏专辑/关注。
- 窄屏：上下堆叠，封面 112/头像 72，标题 20。

### 9.8 搜索页

- 聚焦搜索框进入；当前来源范围。
- 输入 250ms 防抖；回车立即；在线请求带令牌。
- 分组：歌曲（最多 8）、专辑（4）、艺人（4）、歌单（4）；空组不显示；全空空态。
- 结果点击进详情/播放；返回恢复搜索词。
- 加载骨架；错误原因 + 重试；不跨来源混搜。

### 9.9 队列浮窗

- 340 宽、R16、elevation、右 14/下 12；窄屏左右 8 全宽。
- 头部：队列、N 首、顺序/随机、清空、定位、关闭。
- “正在播放”当前；“接下来播放”其余；点行播放；悬停移除；清空只清后续。
- Esc/外部关闭；焦点回队列按钮；播放页队列不动。

### 9.10 播放条

- 左：封面 44、标题/艺人、喜欢、来源小标。
- 中：随机、上一首、播放/暂停 36、下一首、循环。
- 右：时间、睡眠胶囊、定位、队列、音量、展开。
- 顶边 2px 进度线（悬停 4px）；点击/拖动；缓冲；时间预览。
- 空态、窄屏、错误 toast、播放页打开逻辑不变。
- 进度更新只改 DOM，不重画列表。

### 9.11 状态

| 状态 | 规则 |
|---|---|
| 空库 | 添加文件夹 + 刷新 |
| 空收藏/空歌单 | 去歌曲页 / 新建歌单 |
| 搜索空 | 清除搜索 |
| 未登录 | 登录引导，不显示空列表 |
| 登录过期 | 横幅 + 重新登录，保留已加载内容 |
| 加载 | 6 行骨架；加载更多底部一行 |
| 错误 | 页面级原因 + 重试；操作级 toast |
| 减少动态 | 关 EQ/骨架/滑入 |

### 9.12 断点

| 宽度 | 调整 |
|---|---|
| ≥1240 | 完整列；内容 1280 居中；队列浮窗 |
| 1000–1240 | 隐藏专辑列；队列浮窗 |
| 900–1000 | 搜索收窄；侧栏模式图标化 |
| 720–900 | 隐藏音量；标签横向滚动 |
| <720 | 单列；隐藏次要列；播放条核心；队列全宽 |

### 9.13 键盘与焦点

- <code>Space</code> 播放/暂停；<code>/</code> 搜索；<code>Ctrl/⌘ + ←/→</code> 切歌。
- 列表 roving tabindex：↑/↓、Home/End、Enter；Tab 只停一个行。
- 菜单/对话框 Esc 关闭，焦点回入口。
- Esc 顺序：菜单 → 区域选择 → 选择 → 搜索 → 返回 → 队列 → 播放页。
- 焦点环 2px 不被裁切；减少动态效果。

### 9.14 性能

- 1000+ 首滚动流畅；列表虚拟化；只画可见行。
- 搜索输入不卡顿；250ms 防抖；请求令牌。
- 播放进度不触发内容重画。
- 首屏骨架 → 数据；不出现大布局跳动。
- 封面懒加载；详情大图只在 hero。

---

## 10. 文件级改动

### 10.1 新增文件

| 文件 | 职责 | 阶段 |
|---|---|---|
| <code>src/client/panel-v3/p3-styles.js</code> | 新 CSS，<code>P3_CSS</code> | P1 |
| <code>src/client/panel-v3/p3-router.js</code> | route/history/scroll/持久化 | P1 |
| <code>src/client/panel-v3/p3-source.js</code> | 运行时来源/能力/状态/菜单 | P1 |
| <code>src/client/panel-v3/p3-nav.js</code> | 页面注册表/标签生成 | P1 |
| <code>src/client/panel-v3/p3-runtime.js</code> | 初始化加载/睡眠/轮询/全局键/toast | P1 |
| <code>src/client/panel-v3/p3-shell.js</code> | 壳/错误边界/浮层宿主 | P1 |
| <code>src/client/panel-v3/p3-topbar.js</code> | 顶栏 | P1 |
| <code>src/client/panel-v3/p3-viewbar.js</code> | 标签/操作/选择条 | P1/P2 |
| <code>src/client/panel-v3/p3-content.js</code> | 页面切换/滚动/内容头 | P1 |
| <code>src/client/panel-v3/p3-player-bar.js</code> | 播放条 | P1/P5 |
| <code>src/client/panel-v3/p3-queue.js</code> | 队列浮窗 | P1/P5 |
| <code>src/client/panel-v3/p3-states.js</code> | 空/骨架/错误/登录引导 | P1 |
| <code>src/client/panel-v3/p3-data.js</code> | 分组/排序/筛选/集合模型 | P2/P3 |
| <code>src/client/panel-v3/p3-list.js</code> | 虚拟列表/行/悬停播放/键盘 | P2 |
| <code>src/client/panel-v3/p3-grid.js</code> | 专辑/艺人/歌单卡片 | P3 |
| <code>src/client/panel-v3/p3-hero.js</code> | 详情头 | P3 |
| <code>src/client/panel-v3/p3-pages-library.js</code> | 歌曲/喜欢/文件夹/专辑/艺人/歌单/统计 | P3 |
| <code>src/client/panel-v3/p3-pages-detail.js</code> | 专辑/艺人/歌单详情 | P3 |
| <code>src/client/panel-v3/p3-pages-search.js</code> | 搜索页 | P4 |
| <code>src/client/panel-v3/p3-pages-online.js</code> | 在线最近/歌单/专辑/艺人适配 | P4 |

### 10.2 修改文件

| 文件 | 改动 | 阶段 |
|---|---|---|
| <code>src/client/manifest.json</code> | 按依赖顺序加入 20 个片段 | P1 |
| <code>src/client/app/plugin.js</code> | 注入 <code>P3_CSS</code>；按 flag 挂 <code>P3Shell</code> / 旧 <code>Panel</code> | P1 |
| <code>src/client/i18n/i18n.js</code> | 新文案 zh/en | 各阶段 |
| <code>src/client/components/common/head-menu.js</code> | P6 前从 <code>header.js</code> 抽出 <code>HeadMenu</code> | P6 |
| <code>package.json</code> | <code>test</code> 脚本追加新测试 | 各阶段 |
| <code>test/client/theme.test.mjs</code> | <code>uiFiles</code> 加入 <code>p3-styles.js</code>/<code>panel-v3/*.js</code> | P1 |
| <code>test/client/settings-data.test.mjs</code> | 显式断言 <code>music.ui.v3</code> 清理 | P6 |
| <code>A_other/docs/data-reset.md</code> | 新 key 分类/范围/测试 | P1/P6 |
| <code>A_other/docs/theme-guidelines.md</code> | 新文件地图/组件映射 | P1/P7 |
| <code>A_other/docs/pitfalls.md</code> | 新坑（manifest 顺序/虚拟列表头/队列焦点/来源加载/测试脚本） | 各阶段 |
| <code>README.md</code> / <code>docs/DETAIL.*</code> / <code>CHANGELOG.md</code> | 截图/功能/版本 | P7 |
| <code>A_other/design/README.md</code> | 加入 v3 原型 | P0 |
| <code>client.js</code> | 构建产物，提交 | 各阶段 |

### 10.3 保留文件

- <code>queue.js</code>、<code>settings.js</code>、<code>now-playing.js</code>、<code>player-sheet.js</code>、<code>dialogs.js</code>、<code>composer.js</code>、<code>batch.js</code>、<code>primitives.js</code>、<code>icons.js</code>、<code>host-ui.js</code>、<code>component-gallery.js</code>、<code>eq-panel.js</code>、<code>lyric-*</code>、<code>look-picker.js</code>、<code>online-lyric.js</code>、<code>trash.js</code>。
- <code>components/common/ui.js</code>（<code>uiStore</code>/<code>availableSources</code>）先保留；P6 审计后删死代码。
- <code>components/common/select.js</code>（<code>selectionStore</code>）复用。
- <code>components/library/list.js</code>（<code>VirtualList</code>）可复用；新 <code>p3-list.js</code> 做带 header 的适配。
- <code>stores/prefs.js</code>、<code>store.js</code>、<code>player</code> 全部保留。

### 10.4 P6 删除清单（P7 发布前完成）

| 文件 | 删除前先做 |
|---|---|
| <code>components/ui/panel.js</code> | 搬 <code>OverlayRoot</code>/<code>StartupGuide</code>/<code>NewPlaylistDialog</code>/<code>applyControlAction</code> |
| <code>components/ui/navigation.js</code> | 新 nav 已覆盖 |
| <code>components/ui/header.js</code> | 先把 <code>HeadMenu</code> 抽到公共文件 |
| <code>components/ui/local.js</code> | 先搬 helper/数据函数 |
| <code>components/ui/online.js</code> | 先搬在线加载/搜索函数 |
| <code>components/ui/player-bar.js</code> | 新播放条已覆盖 |
| <code>components/ui/track-row.js</code> | 确认 <code>TrackRow</code> 已无引用；<code>TrackListBody</code> 只被旧 local 用 |
| 旧 CSS 选择器 | 先 <code>grep</code> 使用面；分批删；截图回归 |
| 旧测试 | 新测试覆盖后删 <code>panel.render</code>/<code>panel.hooks</code>/<code>panel.album-*</code>/<code>in-view-search</code> |
| <code>contentFilterStore</code> | 新搜索页不依赖后删 |

### 10.5 manifest 顺序（建议）

~~~text
... 现有 stores / primitives ...
src/client/panel-v3/p3-styles.js
src/client/panel-v3/p3-router.js
src/client/panel-v3/p3-source.js
src/client/panel-v3/p3-nav.js
src/client/panel-v3/p3-states.js
src/client/panel-v3/p3-data.js
src/client/panel-v3/p3-list.js
src/client/panel-v3/p3-grid.js
src/client/panel-v3/p3-hero.js
src/client/panel-v3/p3-pages-library.js
src/client/panel-v3/p3-pages-detail.js
src/client/panel-v3/p3-pages-search.js
src/client/panel-v3/p3-pages-online.js
src/client/panel-v3/p3-topbar.js
src/client/panel-v3/p3-viewbar.js
src/client/panel-v3/p3-queue.js
src/client/panel-v3/p3-player-bar.js
src/client/panel-v3/p3-content.js
src/client/panel-v3/p3-runtime.js
src/client/panel-v3/p3-shell.js
src/client/app/plugin.js
~~~

- 页面/数据在壳之前；壳最后；<code>plugin.js</code> 最后。
- 所有顶层名 <code>P3</code> 前缀；构建脚本会拦重复。
- 新文件若依赖旧全局（<code>HeadMenu</code>、<code>OverlayRoot</code>），manifest 中旧片段仍在，运行时可取。

### 10.6 测试文件

| 文件 | 动作 |
|---|---|
| <code>test/client/panel-v3.render.test.mjs</code> | 新增：加载 client.js，强制 v3，渲染各页/各来源，断言标题、行、空态、队列 |
| <code>test/client/panel-v3.router.test.mjs</code> | 新增：route/history/scroll/来源切换（若纯函数不可直接访问，则通过渲染断言） |
| <code>test/client/panel-v3.source.test.mjs</code> | 新增：providers 响应 → 来源/标签/能力/可选包缺失 |
| <code>test/client/panel-v3.search.test.mjs</code> | 新增：搜索页分组/防抖/空/错 |
| <code>test/client/theme.test.mjs</code> | 修改：扫描新 CSS/新 UI |
| <code>test/client/settings-data.test.mjs</code> | 修改：显式 <code>music.ui.v3</code> |
| <code>test/client/panel.render.test.mjs</code> 等 | P6 删除 |
| <code>test/client/in-view-search.test.mjs</code> | P6 删除/替换 |
| <code>test/client/client.smoke.test.mjs</code> | 保持；座位不变 |
| <code>package.json</code> | 追加新测试到 <code>test</code> 脚本 |

---

## 11. 分阶段任务（WBS）

> 估算按 1 人连续投入、无 Host 接口变更；含自测，不含发版审批。实际以每阶段验收为准。

### 11.1 P0 基线与冻结（约 1 天）

| ID | 任务 | 产出 | 验收 |
|---|---|---|---|
| P0-01 | 建分支/标签，确认工作树 | <code>panel-v3</code> 分支；<code>pre-panel-v3</code> tag | 旧面板可随时回退 |
| P0-02 | 记录基线 | HEAD、<code>client.js</code> SHA、<code>npm test</code>/<code>check</code> 结果、5 档宽度 × 浅深色截图、<code>/online/providers</code> 实际来源/能力 | 基线可复查 |
| P0-03 | 冻结 demo/设计 | demo 文件、<code>panel-v3-plan.md</code>、本文档 | 结构不再改 |
| P0-04 | 预检 | 确认设置布局、已装平台、曲库规模、用户备份 | 无阻塞 |

### 11.2 P1 壳、路由、来源、开关（约 3 天）

| ID | 任务 | 文件 | 验收 |
|---|---|---|---|
| P1-01 | 建空片段/样式/manifest | <code>panel-v3/*</code>、<code>manifest.json</code> | 构建通过；无重名 |
| P1-02 | 路由/页面记录/滚动 | <code>p3-router.js</code> | route/history/scroll 正确；v2 迁移 |
| P1-03 | 运行时来源 | <code>p3-source.js</code> | providers 加载前/后/失败；可选包缺失不出现 |
| P1-04 | 壳/顶栏/视图栏/内容头 | <code>p3-shell</code>/<code>p3-topbar</code>/<code>p3-viewbar</code>/<code>p3-content</code> | 结构同 demo；空内容可见 |
| P1-05 | 运行时 effect/浮层/边界/全局键 | <code>p3-runtime.js</code>、<code>p3-shell.js</code> | 启动引导/设置/登录/轮询/睡眠/错误 toast 可用 |
| P1-06 | 播放条/队列骨架 | <code>p3-player-bar.js</code>、<code>p3-queue.js</code> | 能播/暂停/切歌/进度/队列开合 |
| P1-07 | 开关与样式注入 | <code>plugin.js</code> | flag v3 显示新壳；旧默认不变；卸载清理 |
| P1-08 | 构建/冒烟测试 | <code>client.js</code>、测试 | <code>build-client --check</code>/smoke 绿 |

### 11.3 P2 列表引擎与歌曲页（约 4 天）

| ID | 任务 | 文件 | 验收 |
|---|---|---|---|
| P2-01 | 虚拟列表 + 内容头 + 滚动恢复 | <code>p3-list.js</code> | 1000 首流畅；返回恢复位置 |
| P2-02 | 行结构/悬停播放/当前/选中/VIP/喜欢/更多 | <code>p3-list.js</code> | 与 demo 一致；单击选中/双击播放 |
| P2-03 | 选择 store + 选择条 | <code>p3-viewbar.js</code>、<code>p3-list.js</code> | 全选/区域/反选/批量菜单；高度不跳 |
| P2-04 | 右键菜单复用 | <code>p3-list.js</code> + <code>dialogs.js</code> | 单曲/多选菜单项目齐全 |
| P2-05 | 键盘/焦点 | <code>p3-list.js</code> | ↑/↓/Home/End/Enter/Space；焦点可见 |
| P2-06 | 歌曲页/排序/筛选/播放全部 | <code>p3-pages-library.js</code> | 与旧行为对齐；空/加载/查询 |
| P2-07 | 测试 | 新增 render/keyboard | <code>npm test</code>/<code>check</code> 绿 |

### 11.4 P3 本地页面与详情（约 5 天）

| ID | 任务 | 文件 | 验收 |
|---|---|---|---|
| P3-01 | 本地数据/集合模型 | <code>p3-data.js</code> | 分组/排序/筛选纯函数 |
| P3-02 | 喜欢/文件夹 | <code>p3-pages-library.js</code> | 与旧行为对齐 |
| P3-03 | 专辑/艺人/歌单网格 | <code>p3-grid.js</code>、<code>p3-pages-library.js</code> | 视图切换/排序/空态 |
| P3-04 | 统计 | <code>p3-pages-library.js</code> | 现有统计内容 |
| P3-05 | 专辑详情 | <code>p3-hero.js</code>、<code>p3-pages-detail.js</code> | 可进可回；播放全部/随机 |
| P3-06 | 艺人详情 | 同上 | 热门/专辑/全部歌曲；无假关注 |
| P3-07 | 歌单详情 | 同上 | 播放全部/随机/更多；右键管理 |
| P3-08 | 本地空/加载/错误 | <code>p3-states.js</code> | 空库/空收藏/空歌单/查询无结果 |
| P3-09 | 测试 | 新增 detail/grid | 每页 render 绿 |

---

## 12. P4 在线与搜索（约 6 天）

| ID | 任务 | 文件 | 验收 |
|---|---|---|---|
| P4-01 | 来源菜单运行时化 | <code>p3-source.js</code>、<code>p3-topbar.js</code> | 只显示已注册来源；加载中/失败有状态；可选包缺失不出现；管理来源打开设置 |
| P4-02 | 能力驱动标签/页面 | <code>p3-nav.js</code>、<code>p3-viewbar.js</code> | 没有 albums/artists/playlists 能力就不出现对应标签；默认页正确 |
| P4-03 | 在线最近/我的歌单/歌单详情 | <code>p3-pages-online.js</code> | 登录/未登录/空/加载更多；歌单不可写时不显示写入口 |
| P4-04 | 在线专辑/艺人详情 | <code>p3-pages-detail.js</code>、<code>p3-pages-online.js</code> | 能力允许才可进；头部先出、失败可重试；返回恢复 |
| P4-05 | 搜索页 | <code>p3-pages-search.js</code>、<code>p3-topbar.js</code> | 聚焦进入；250ms 防抖；分组；空/错/加载更多；清除/返回 |
| P4-06 | 登录/过期/分页/错误 | <code>p3-pages-online.js</code>、<code>p3-states.js</code> | 扫码登录、退出、过期横幅；分页统一；错误原因+重试 |
| P4-07 | 测试 | 新增 source/search/online render | 每个实际安装平台走登录/未登录；可选包缺失路径 |

**P4 注意**

- 在线数据加载先复用旧函数；旧函数里的 <code>setNav</code> 写入 <code>uiStore</code> 在旧面板未挂载时是死写，不影响新面板；P6 再解耦。
- 不在面板里写 <code>if (provider === ...)</code>；页面只问 <code>capabilities</code>。
- 汽水没有 albums 能力：不显示专辑标签、不可点专辑名；波点没有 playlists/likes：不显示歌单/心形。
- 酷狗 <code>likeWrite=false</code>：心形可见但点击提示只读；<code>playlistAdd=false</code>：不显示添加歌单。
- Navidrome 未配置：来源菜单显示“未配置”，点击去设置，不打开空页。
- 如果缺少某个 Host 路由，停止并报告；不新造接口、不用假数据。

---

## 13. P5 完成度（约 4 天）

| ID | 任务 | 文件 | 验收 |
|---|---|---|---|
| P5-01 | 队列浮窗完整 | <code>p3-queue.js</code>、<code>p3-player-bar.js</code> | 正在播放/接下来播放、清空、移除、定位、Esc/外部关闭、焦点回按钮 |
| P5-02 | 播放条打磨 | <code>p3-player-bar.js</code> | 进度线、拖动、缓冲、时间预览、音量/静音、睡眠、定位、空态、窄屏 |
| P5-03 | 响应式 | <code>p3-styles.js</code>、各组件 | 1582/1280/1024/900/720 无横向滚动、无重叠 |
| P5-04 | 浅/深色与宿主组件 | 组件/样式 | 两种主题可读；native/fallback 两套路径都可用 |
| P5-05 | 可访问性 | 列表/菜单/播放条 | 方向键/Enter/Space/Esc/焦点环/aria；reduced motion |
| P5-06 | 性能 | 列表/搜索/进度 | 1000+ 首滚动、输入、进度更新不重画列表 |
| P5-07 | 回归 | 播放页/设置页/歌词条/队列/播放卡/工具控制 | 零回归 |
| P5-08 | 截图/验收 | 5 档 × 2 主题 | 截图归档 |

**P5 注意**

- 队列浮窗无遮罩、非模态；不要用 <code>KitModal</code> 做队列（会抢焦点/遮背景）。
- 播放条进度更新只改 <code>#pbFill</code>/时间文本；不要每次 tick 重画整个 <code>P3PlayerBar</code>。
- 播放页/设置页共用 <code>QueuePanel</code>/<code>QueueList</code>，不改它们。
- 宿主 <code>SegmentedTabs</code> 在 7 个标签 + 窄屏时要能横向滚动；若宿主组件不支持，外层包一个滚动容器，不改成 Pill。
- 焦点环不要被 <code>overflow:hidden</code> 裁掉；列表行用内缩焦点或留出空间。
- 减少动态效果：EQ/骨架/滑入关闭。

---

## 14. P6 切换与清理（约 3 天）

### 14.1 切换

| ID | 任务 | 验收 |
|---|---|---|
| P6-01 | 默认切 v3；保留 <code>music.panel='v2'</code> 回退窗口 | 新用户/老用户默认新面板；flag 可回旧 |
| P6-02 | 用户验收后删除旧面板代码 | 旧文件/旧测试/旧 CSS 清理；构建通过 |
| P6-03 | 删除开发 flag（或保留一版） | 代码里不再有双重面板分支 |

> 建议保留一个短回退窗口（一个版本或 3–7 天）；如果你要求“立即完全替换”，P6-01、P6-02、P6-03 同日完成，回退改用 git/安装上一版。

### 14.2 删除前必须搬家

| 旧位置 | 搬到 | 说明 |
|---|---|---|
| <code>panel.js</code> <code>OverlayRoot</code> | <code>p3-shell.js</code> | 设置/登录/标签/歌词/播放页浮层宿主 |
| <code>panel.js</code> <code>StartupGuide</code> | <code>p3-shell.js</code> | 启动引导 |
| <code>panel.js</code> <code>NewPlaylistDialog</code> | <code>p3-shell.js</code> | 新建歌单 |
| <code>panel.js</code> <code>applyControlAction</code> | <code>p3-runtime.js</code> | <code>music_control</code> 播放指令 |
| <code>header.js</code> <code>HeadMenu</code> | <code>components/common/head-menu.js</code> | 新面板菜单 |
| <code>local.js</code>/<code>online.js</code> 纯 helper/加载 | <code>p3-data.js</code>/<code>p3-pages-online.js</code> | 先确认引用再删 |
| <code>selectionStore</code> | 保留 | 右键菜单依赖 |
| <code>queue.js</code> | 保留 | 播放页/播放卡/歌词条依赖 |

### 14.3 删除清单

- JS：<code>panel.js</code>、<code>navigation.js</code>、<code>header.js</code>、<code>local.js</code>、<code>online.js</code>、<code>player-bar.js</code>、<code>track-row.js</code>。
- 旧 CSS：<code>.mp-topbar</code>、<code>.mp-workspace</code>、<code>.mp-nav</code>、<code>.mp-sectionbar</code>、<code>.mp-content-head</code>、<code>.mp-row</code>、旧 <code>.mp-playerbar</code> 等；分批删，每批截图回归。
- 旧测试：<code>panel.render</code>、<code>panel.hooks</code>、<code>panel.album-*</code>、<code>in-view-search</code>；新测试覆盖后删。
- <code>contentFilterStore</code>（新搜索页不用）。
- <code>uiStore</code> 的旧 nav/filter/query 字段：审计引用后再删；不破坏 <code>music.ui.v2</code> 迁移。
- 旧文档描述：README/DETAIL/theme-guidelines 文件地图同步替换。

### 14.4 验收

- 全量测试、check、build-client --check 绿。
- <code>client.js</code> 中不再有 <code>Panel</code>/<code>TopBar</code>/<code>NavRail</code>/<code>SectionBar</code>/<code>LocalContent</code>/<code>OnlineContent</code>/<code>PlayerBar</code> 旧实现。
- 真实 DSH：默认新面板；设置/播放页零回归。
- 浅/深色、5 档宽度、键盘、native/fallback 全过。
- 旧 flag 回退路径（若保留）可用。

---

## 15. P7 发布与收尾（约 2 天）

| ID | 任务 | 产出 |
|---|---|---|
| P7-01 | 版本/CHANGELOG | 0.38.0；主面板替换说明；回退方式 |
| P7-02 | README/DETAIL/截图 | 新面板截图、功能描述、已知限制 |
| P7-03 | 设计/主题/踩坑文档 | <code>A_other/design/README.md</code>、<code>theme-guidelines.md</code>、<code>pitfalls.md</code> |
| P7-04 | 打包/安装冒烟 | <code>npm pack --dry-run</code>（若 npm 可用）、<code>install-local.mjs desktop</code>、完全退出重启 |
| P7-05 | 用户验收/发布 | 用户确认；未获授权不 push、不发 Release |

**发布前必须**

- <code>npm test</code>、<code>npm run check</code>、<code>node scripts/build-client.mjs --check</code>。
- 干净 profile 安装/启动；浅/深色；5 档宽度；至少一个在线平台登录/未登录。
- 播放页/设置页/歌词条/队列/播放卡回归。
- 数据清理：设置 → 数据 → 清空所有数据后，<code>music.ui.v3</code> 不再存在。
- 旧主面板代码已删除或明确不在默认路径。
- 没有新增网络域名、没有凭证写入仓库、没有假数据。

---

## 16. 验证矩阵与命令

### 16.1 每阶段命令

~~~bash
node scripts/build-client.mjs          # 改 src/client 后重建
node scripts/build-client.mjs --check  # 产物与 src 一致
npm test                               # 全量 Node 测试
npm run check                          # 语法 + i18n + client 同步
node scripts/install-local.mjs desktop # 装进 DSH profile
# 完全退出 DSH，再启动
~~~

### 16.2 开发开关

~~~js
localStorage.setItem('music.panel', 'v3')
location.reload()
// 回旧：localStorage.removeItem('music.panel') 或设为 'v2'
~~~

### 16.3 宽度 × 主题

| 宽度 | 深色 | 浅色 |
|---|---|---|
| 1582（用户截图） | 必测 | 必测 |
| 1280 | 必测 | 必测 |
| 1024 | 必测 | 必测 |
| 900 | 必测 | 必测 |
| 720 | 必测 | 必测 |

每档看：顶栏不挤、标签可滚、内容不横向滚、播放条不重叠、队列浮窗不出界、详情头不溢出。

### 16.4 平台矩阵

| 场景 | 必测 |
|---|---|
| 本地 | 曲库/专辑/艺人/文件夹/喜欢/歌单/统计/详情/播放 |
| 网易云 | 登录/未登录、最近、歌单、专辑、艺人、搜索、VIP 标记 |
| QQ | 同上 |
| 酷狗 | 登录/未登录、收藏只读、不能加歌单 |
| Navidrome | 已配置/未配置、歌曲/专辑/艺人/歌单 |
| 波点/汽水 | 已安装/未安装；未安装时菜单不出现；汽水无专辑 |
| 登录过期 | 横幅 + 重新登录；保留内容 |
| 网络失败 | 页面错误 + 重试；本地不受影响 |

### 16.5 功能矩阵

- 页面：12 个页面全部可进/可回。
- 行：单击/加选/双击/Enter/右键/悬停播放/喜欢/更多。
- 选择：全选/取消/区域/反选/选择条/批量。
- 排序/筛选/视图切换/播放全部。
- 播放条：播放/暂停/上下首/随机/循环/进度/音量/静音/睡眠/定位/队列/展开。
- 搜索：聚焦进入/输入/回车/Esc/清除/空/错/加载更多。
- 队列：开/关/点行/清空/移除/定位/Esc/外部关闭。
- 来源：切换/登录/退出/未配置/可选包缺失。
- 回归：播放页/设置页/歌词条/侧栏/播放卡/工具控制。

### 16.6 状态矩阵

- 空库、扫描中、扫描失败。
- 空收藏、空歌单、空搜索、空队列。
- 在线加载/失败/空结果/登录过期。
- 当前+选中、当前+悬停、选中+悬停、禁用项。
- 长标题、长艺人、长专辑、很多歌单、1000+ 曲目。
- 减少动态效果。

### 16.7 性能

| 项 | 目标 |
|---|---|
| 1000+ 首滚动 | 无明显掉帧；只画可见行 |
| 搜索输入 | 不卡顿；250ms 防抖 |
| 切页/切源 | 首屏 <300ms（本地数据） |
| 播放进度 | 只更新进度 DOM，不重画列表 |
| 队列开合 | 内容不重排/不跳动 |

### 16.8 可访问性

- Tab 焦点可见；列表 roving；方向键/Home/End/Enter。
- 菜单/对话框 Esc 关闭，焦点回入口。
- 图标有 aria-label/title。
- 触摸目标 ≥40px（coarse pointer）。
- reduced motion 下无 EQ/骨架/滑入。

---

## 17. 测试计划

### 17.1 测试类型

| 类型 | 覆盖 |
|---|---|
| 纯逻辑 | route/history/scroll、能力→标签、分组/排序/筛选、来源状态映射 |
| 渲染 | 每个页面 × 空/有数据/加载/错误；行/选择条/队列/播放条 |
| 集成 | flag 挂载、样式注入、OverlayRoot、座位不变、卸载清理 |
| 主题守卫 | 新 CSS/新组件扫描；无写死颜色/非法圆角/半像素字号 |
| i18n | 新 key 中英齐全；长英文不溢出 |
| 数据清理 | <code>music.ui.v3</code> 在清空范围 |
| 回归 | 播放页/设置页/歌词条/队列/播放卡/工具控制 |
| GUI | 16.3–16.8 |
| 性能 | 16.7 |

### 17.2 新增/修改测试

| 文件 | 内容 |
|---|---|
| <code>test/client/panel-v3.render.test.mjs</code> | 加载 client.js，强制 flag，渲染 12 个页面/空/错/登录 gate；断言标题、行、队列、播放条 |
| <code>test/client/panel-v3.source.test.mjs</code> | providers 响应 → 来源/能力/标签/可选包缺失/未配置 |
| <code>test/client/panel-v3.search.test.mjs</code> | 聚焦进入/输入/分组/空/错/返回 |
| <code>test/client/panel-v3.router.test.mjs</code> | 切标签/详情/返回/滚动/切源（通过渲染或纯函数） |
| <code>test/client/theme.test.mjs</code> | 扫描 <code>p3-styles.js</code>/<code>panel-v3/*.js</code> |
| <code>test/client/settings-data.test.mjs</code> | 显式断言 <code>music.ui.v3</code> |
| <code>test/client/client.smoke.test.mjs</code> | 保持座位/模块 id 断言 |
| <code>package.json</code> | <code>test</code> 脚本追加；建议加 <code>test:panel-v3</code> 快速脚本 |

### 17.3 测试写法

- 复用现有 <code>panel.render.test.mjs</code> 的 React mock/存储 mock；不联网、不跑 effect。
- 强制 v3：在加载 <code>client.js</code> 前设置 <code>localStorage['music.panel']='v3'</code>，或给 <code>P3Shell</code> 一个测试入口。
- 断言渲染树的结构/文本，不依赖真实 DOM 样式。
- 样式规则用文本扫描（theme guard），不截图断言。
- 每个新测试文件必须加入 <code>package.json</code> 的 <code>test</code> 串行命令；否则 CI 不跑。
- 旧测试在旧面板删除时一起删；不要保留引用已删文件。

### 17.4 手工验收

- 按 16.3–16.8 逐项勾选；截图归档到 <code>A_other/design/preview/</code>。
- 真实 DSH 里看控制台 <code>[dsh-music-panel] host UI kit: native</code>；设置 → 关于 → 测试页面。
- 播放页/设置页打开/关闭；歌词条；侧栏播放控件；<code>music_control</code> 工具播放。
- 数据清理后重启，确认无残留页面记录。

---

## 18. 数据与迁移

### 18.1 页面记录

| 项 | 值 |
|---|---|
| 旧 key | <code>music.ui.v2</code>：<code>{ source, nav, playlistId }</code> |
| 新 key | <code>music.ui.v3</code>：<code>{ source, page, param }</code> |
| 迁移 | 首次读 v2：local+songs/albums/artists/folders/favorites/playlists/stats；在线+recent/playlistId；非法回默认 |
| 写回 | 只写 v3；不覆盖 v2（旧面板回退仍可读旧状态） |
| 不持久化 | history、列表筛选 query、scroll、菜单、选择、队列开关；search 页保存时降级为默认页 |

### 18.2 清空所有数据

- <code>settings.js</code> 遍历 localStorage 前缀 <code>music.</code> 等；<code>music.ui.v3</code> 会被清掉。
- <code>A_other/docs/data-reset.md</code> 增加：页面记录 key、来源（客户端）、清理方式、测试。
- <code>test/client/settings-data.test.mjs</code> 增加显式断言；不要只依赖前缀。
- 清空后重启：面板回到默认 source/page，不残留旧页面/选择/搜索。

### 18.3 偏好与播放

- 复用 <code>prefs.layout</code>（top/rail）、<code>sortBy/sortDir</code>；不新增偏好项。
- 播放队列/进度/音量/模式仍由 player/Host 管理，不变。
- 不新增 Host 数据文件、不新增网络请求、不写凭据。
- 搜索历史/最近搜索本期不持久化。

### 18.4 i18n

- 新 key 命名：<code>p3.page.*</code>、<code>p3.source.*</code>、<code>p3.queue.*</code>、<code>p3.search.*</code>、<code>p3.selection.*</code>、<code>p3.empty.*</code>、<code>p3.error.*</code>，或复用现有 <code>page.*</code>/<code>v2.*</code>/<code>online.*</code>。
- 中英两份同时加；<code>npm run check</code> 的 <code>check-i18n-keys</code> 会拦。
- 动态文案用占位符，不拼句子；英文长标签要在 720 宽度下不溢出。
- 旧 key 在旧面板删除后审计删除；不要留下无引用 key。

## 19. 回退与灰度

### 19.1 开发期

- 默认旧面板；<code>music.panel='v3'</code> 才挂新壳。
- 每个阶段一个 commit/tag；旧面板始终可回退。
- 新样式 <code>.mpv3-</code> 前缀，旧面板不受影响。

### 19.2 切换期

- P6 默认 v3；保留 <code>music.panel='v2'</code> 回退一个版本窗口（或按你要求立即删）。
- 旧面板读 <code>music.ui.v2</code>；新面板写 <code>music.ui.v3</code>；互不破坏。
- 如果新面板严重问题：设 flag 回 v2、重启；或安装上一版 <code>client.js</code>。
- 旧面板代码删除后：用 git tag/上一版安装包回退。

### 19.3 数据回退

- v3 页面记录不影响旧面板；旧面板忽略 v3 key。
- 清空数据会同时清 v2/v3；不需要手工迁移。
- 播放队列/进度由 Host 管理，不受面板回退影响。

### 19.4 触发回退的条件

- 主面板白屏/崩溃/无法播放。
- 设置页/播放页被带崩。
- 在线登录/歌单/搜索大面积失败。
- 浅色/深色不可读、严重布局错位。
- 数据清理失效/残留。

---

## 20. 风险登记

| ID | 风险 | 概率 | 影响 | 处理 | 触发/负责人 |
|---|---|---|---|---|---|
| R1 | 单击选择与成熟播放器单击播放预期不一致 | 中 | 中 | 默认保留单击选中；悬停播放/双击/Demo 对照；一行切换 Spotify 模式 | 用户反馈 |
| R2 | 来源写死/可选包误显示 | 中 | 高 | 运行时 providers；加载/失败状态；可选包缺失不出现；测试覆盖 | P4-01 |
| R3 | Navidrome 未配置/登录过期 | 中 | 中 | 未配置去设置；过期横幅+重登；不清空内容 | P4-06 |
| R4 | 队列浮窗焦点/外部点击/窄屏 | 中 | 中 | 焦点回入口；Esc/外部关闭；全宽兜底；测试 | P5-01 |
| R5 | 播放页/设置页共享组件被改坏 | 低 | 高 | 不改 queue.js/settings.js/now-playing；回归清单 | P5-07 |
| R6 | OverlayRoot/StartupGuide 搬家遗漏 | 中 | 高 | P6 前逐项搬；启动引导/设置/登录/标签/歌词/播放页回归 | P6-02 |
| R7 | manifest 顺序/重名 | 中 | 高 | P3 前缀；构建重复名检查；每加片段构建 | P1-01 |
| R8 | 主题守卫未扫描新 CSS | 高 | 中 | <code>theme.test</code> 扩展；新 CSS 只用 token | P1 |
| R9 | 新测试没进 <code>npm test</code> | 高 | 中 | 手动追加；加 <code>test:panel-v3</code> 快速脚本；发布前核对 | 各阶段 |
| R10 | 数据清理漏 v3 key | 低 | 中 | 前缀已覆盖；显式文档/测试 | P6-03 |
| R11 | i18n 漏 key/长英文溢出 | 中 | 低 | 中英同时加；720 宽度检查 | 各阶段 |
| R12 | 虚拟列表 + 详情头滚动错位 | 中 | 中 | header 高度测量；resetKey；滚动恢复测试 | P2-01 |
| R13 | 1000+ 首/搜索卡顿 | 中 | 中 | 虚拟化、防抖、分区域订阅、进度不重画 | P5-06 |
| R14 | 宿主 native/fallback 外观差异 | 中 | 低 | 两条路径都看；fallback 同 DOM/class | P5-04 |
| R15 | 浅色不可读 | 中 | 中 | token + 8 项检查；截图 | P5-04 |
| R16 | 旧 CSS 删除破坏其他页面 | 中 | 高 | 分批删；grep 使用面；截图回归；回退单批 | P6 |
| R17 | <code>client.js</code> 体积/构建时间 | 中 | 低 | 旧面板删除后回落；不引入新依赖 | P6 |
| R18 | 估算偏乐观 | 中 | 中 | 每阶段验收；30% buffer；范围冻结 | 全程 |
| R19 | 发布未获授权 | 低 | 高 | P7 只准备；push/release 需用户确认 | P7 |
| R20 | 假按钮/假数据混入 | 低 | 高 | 需求清单逐项对真实接口；没有接口就标注/不做 | 全程 |

---

## 21. 附录

### 21.1 平台能力快照（0.37.2）

| 能力 | 本地 | Navidrome | 网易云 | QQ | 酷狗 | 波点（可选） | 汽水（可选） |
|---|---|---|---|---|---|---|---|
| 搜索 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 整库歌曲 | ✓ | ✓ | — | — | — | — | — |
| 专辑 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| 艺人 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 歌单 | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ |
| 收藏（读） | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ |
| 收藏（写） | ✓ | ✓ | ✓ | ✓ | — | — | ✓ |
| 加进歌单 | ✓ | ✓ | ✓ | ✓ | — | — | ✓ |
| 最近播放 | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 文件夹 | ✓ | — | — | — | — | — | — |
| 统计 | ✓ | — | — | — | — | — | — |
| 登录 | 不需要 | 服务器账号 | 扫码 | 扫码 | 扫码 | 扫码 | 扫码 |

### 21.2 组件映射

| 元素 | 最终组件 | 备注 |
|---|---|---|
| 按钮 | <code>Button</code> | 宿主 Button；variant/size |
| 图标按钮 | <code>IconButton</code> | 宿主 Tooltip + fallback |
| 标签 | <code>KitSegmentedTabs</code> | sm 34；7 项可滚动 |
| 搜索 | <code>KitInput</code> | 宿主 Input |
| 菜单 | <code>HeadMenu</code>/<code>Menu</code> | 来源/排序/选择/账号/行 |
| 对话框 | <code>KitModal</code> | 现有登录/标签/歌词/确认 |
| 开关 | <code>Switch</code> | 设置页 |
| 空态 | <code>Empty</code> | 本仓原语 |
| 封面 | <code>Cover</code> | 本仓原语 |
| 进度 | <code>SeekBar</code> 语义/自定义 | 播放条 |
| 队列 | 复合容器 | 例外；elevation/R16/焦点 |
| 行/网格/Hero | 一次性布局 | 只用 token |

### 21.3 Token 映射（官方存档）

| 用途 | 深色 | 浅色 |
|---|---|---|
| 应用底 | <code>rgb(21,21,23)</code> | <code>#fff</code> |
| 抬升层 1/2/3 | <code>rgb(35,35,36)</code>/<code>rgb(44,44,46)</code>/<code>rgb(53,54,56)</code> | <code>#fff</code>/<code>rgb(249,250,251)</code>/<code>rgb(241,243,245)</code> |
| 主/次/弱文字 | <code>rgb(249,250,251)</code>/<code>rgb(207,211,214)</code>/<code>rgb(173,178,184)</code> | <code>rgb(15,17,21)</code>/<code>rgb(97,102,107)</code>/<code>rgb(129,133,140)</code> |
| 描边 l1/l2 | <code>rgba(255,255,255,.06)</code>/<code>.12</code> | <code>rgba(0,0,0,.04)</code>/<code>.1</code> |
| 悬停/按下 | <code>rgba(255,255,255,.08)</code>/<code>.14</code> | <code>rgba(38,49,72,.06)</code>/<code>.1</code> |
| 强调 | <code>rgb(122,170,255)</code> | <code>rgb(65,118,230)</code> |
| 主按钮底/字 | <code>rgb(249,250,251)</code>/<code>rgb(15,17,21)</code> | <code>rgb(15,17,21)</code>/<code>#fff</code> |
| 菜单 | <code>rgba(48,49,54,.64)</code> + blur | <code>rgba(252,253,254,.7)</code> + blur |

### 21.4 页面/路由清单

| route | 父级 | 能力 | 类型 |
|---|---|---|---|
| songs | 资料库 | songs | 列表 |
| albums | 资料库 | albums | 网格 |
| artists | 资料库 | artists | 列表 |
| folders | 资料库 | folders | 列表 |
| favorites | 收藏 | favorites | 列表 |
| playlists | 收藏 | playlists | 网格 |
| stats | 收藏 | stats | 统计 |
| recent | 在线 | recent | 列表 |
| album | 专辑 | albums | 详情 |
| artist | 艺人 | artists | 详情 |
| playlist | 歌单 | playlists | 详情 |
| search | 搜索 | search | 搜索 |

### 21.5 demo 深链与截图

- 文件：<code>A_other/design/panel-prototype-v3.html</code>
- 深链：<code>#page=albums</code>、<code>#album=叶惠美</code>、<code>#artist=周杰伦</code>、<code>#source=netease</code>、<code>#menu=source</code>、<code>#light</code>、<code>#rail</code>、<code>#queue</code>
- 截图：<code>A_other/design/preview/v3-*.png</code>
- demo 不联网、不写仓库数据；只用于结构确认。

### 21.6 假设与待确认

1. 单击 = 选中（你之前的要求）；悬停播放/双击播放补齐。若要 Spotify 式单击播放，P1 前提出。
2. 搜索 = 搜索页；不再“就地过滤当前列表”。若你要保留就地过滤，P4 前提出。
3. 专辑收藏、关注艺人、拖拽队列排序本期不做（没有对应接口/宿主 primitive）。
4. 跨来源混搜、移动端独立布局本期不做。
5. 可选平台只按运行时注册表出现；不在面板里做“安装”入口。
6. 旧面板回退窗口建议保留一个版本；若要求立即删，P6 同日完成。
7. 估算为 1 人连续投入、无 Host 变更；实际以阶段验收为准。

### 21.7 决策记录

| 日期 | 决策 | 来源 |
|---|---|---|
| 2026-11-18 | 重做浏览区 + 播放条；保留播放页/设置 | 用户确认 |
| 2026-11-18 | 本地专辑/艺人进详情；加播放全部；歌单页；行高 56 | 用户确认 |
| 2026-11-18 | 队列改浮窗 | 用户反馈 |
| 2026-11-18 | 来源以运行时为准；可选包缺失不出现 | 用户反馈 + 代码审计 |
| 2026-11-18 | 组件最终走 DSH 宿主；demo 只做结构 | 用户提问 + 主题规范 |
| 2026-11-18 | 交互对齐 QQ/网易云桌面 + Spotify 补充；保留单击选中 | 用户提问 + 既有要求 |
| 2026-11-18 | demo 结构与排版冻结 | 用户确认 |

### 21.8 变更记录

| 版本 | 日期 | 变更 |
|---|---|---|
| v1 | 2026-11-18 | 汇报 + 执行计划初版：范围、现状、五问结论、架构、UI 合同、文件/测试/阶段/回退/风险 |

### 21.9 完成定义（Definition of Done）

- [ ] 旧主面板 JS 全部删除；共享资产已搬家；旧测试退役。
- [ ] 新面板默认挂载；开发 flag 清理（或只保留一版回退）。
- [ ] 12 个页面、所有操作、队列/播放条/搜索/详情全部可用。
- [ ] 来源运行时化；可选包缺失不出现；Navidrome/登录/过期正确。
- [ ] 宿主组件 native/fallback 两套可用；浅/深色可读；5 档宽度无溢出。
- [ ] 1000+ 首滚动、搜索输入、进度更新达到性能目标。
- [ ] 键盘/焦点/aria/reduced motion 达标。
- [ ] <code>npm test</code>、<code>npm run check</code>、<code>build-client --check</code> 绿。
- [ ] 真实 DSH 安装/重启验收；播放页/设置页/歌词条/侧栏/工具控制零回归。
- [ ] 数据清理覆盖 <code>music.ui.v3</code>；文档/截图/CHANGELOG 更新。
- [ ] 用户验收通过；未获授权不 push/不发版。




