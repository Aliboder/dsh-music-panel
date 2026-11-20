# 踩坑记录

按「现象 → 原因 → 处理 → 防回归」记；遇到同类问题先查这里。解决后当场补一条：
**简洁、只增不改**；旧结论过时也保留，追加「（已过时：…）」。不要把结论只留在聊天记录里。

> **路径说明**：以下条目按记录当时的目录结构书写，旧路径保持原样；当前 Client 在 `src/client/**`、Host 在 `src/host/**`，Folia 源码在 `src/folia/**`（`src/render` 已不存在）。

## 快速索引

| 区域 | 条目 |
|---|---|
| 构建 / 生成物 | 2, 21, 22, 23, 28 |
| 主题 / UI | 1, 6, 7, 8, 9, 10, 11, 12, 19, 26 |
| 安装 / 本地调试 | 13, 14, 15, 16, 17, 18, 20 |
| 背景 / 音频 / 播放 | 1, 3, 4, 5, 6, 7, 8, 25 |
| 歌词 | 9, 28 |
| 偏好 / 迁移 | 27 |

---

## 1. 背景不随音乐扭曲、暂停后还在匀速动

- **现象**：隐现（流体/混合）只有缓慢流动，没有鼓点形变；暂停后背景仍按原速动。
- **原因**：Folia 跑 React **19**，函数组件把 `ref` 当普通 prop 透传；宿主固定 React **18.3.1**，
  `memo(function …)` 不转发 `ref`。`paperShaderMount` 恒为 `null`，latent 里逐帧的
  `setSpeed` / `u_distortion` / `u_swirl` / `u_pxSize` 全被 `if (currentMeshMount)` 跳过。
- **处理**：vendored `src/render/folia/vendor/paper-shaders-react/dist/shaders/*.js` 的 7 个
  包装改为 `memo(forwardRef(function …))`，并把 `ref` 传给底层 `ShaderMount`；重建
  `backgrounds.bundle.js`。
- **防回归**：`test/folia-backgrounds.test.mjs` 断言 bundle 里存在
  `forwardRef(function MeshGradientImpl(` 等包装。

## 2. 改了背景源码，画面却没变

- **现象**：改了背景/样式源码并重启，画面还是旧的；`client.js --check` 却通过。
- **原因**：`backgrounds.bundle.js`、`styles.bundle.js`、`pendolo.bundle.js` 是独立产物，
  `node scripts/build-client.mjs --check` 只校验 `client.js` 的拼接，不会发现 bundle 过期。
- **处理**：改背景源码或 `vendor/paper-shaders*` 后，顺序固定为
  `node scripts/build-backgrounds.mjs` → `node scripts/build-client.mjs`。
  时计/样式同理：`build-pendolo.mjs` / `build-styles.mjs`。
- **防回归**：提交前看 `git status` 是否包含对应 `.bundle.js`；不要手改生成物。

## 3. bands 归一化成 0..1，背景完全静止

- **现象**：背景有轻微流动，但鼓点完全不起作用。
- **原因**：Folia 背景用 `useTransform(spring, [10, 200], [0.95, 1.45])`，输入必须保持 0–255；
  0..1 永远落在映射的第一档。
- **处理**：`process(v, boost) = (v / 255) ** boost * 255`，五条 band 与 `audioPower` 都输出 0–255
  （见 `src/render/styles/folia-audio.js`）。
- **防回归**：`test/folia-audio.test.mjs` 断言输出范围；不要在客户端再做一次 0..1 归一化。

## 4. 「鼓动很弱」不一定是带宽，可能是分析器 smoothing

- **现象**：低频段有值，但鼓点看起来总是被抹圆。
- **原因**：插件旧 analyser `smoothingTimeConstant = 0.82`，Folia 是 **0.6**；额外平滑把鼓点抹圆。
- **处理**：`src/50-player.js` 改为 0.6。插件自己的频谱条会做峰值归一化，不会因此变噪。
- **防回归**：改动音频分析器参数时，对比 `folia-audio.js` 的输出与 Folia 的上游值。

## 5. 莫奈底部频谱条比 Folia 钝

- **现象**：莫奈样式的底部频谱条只有几段高低，没有细密频谱。
- **原因**：没提供 `audioBands.spectrum`，`Monet AudioOverlay` 回退到五段 band 插值。
- **处理**：每帧 `new Uint8Array(wave)` 写入 `spectrum`。不要直接复用 analyser 的 buffer
  （下一帧会覆盖已经发给 MotionValue 的值）。
- **防回归**：`test/folia-audio.test.mjs` / 样式测试覆盖 spectrum 字段。

## 6. 暂停时背景仍缓慢变化

- **现象**：按暂停后背景还在很慢地动。
- **原因**：Folia 的隐现暂停时是 `base × 0.12`，**不是 0**，观感是「几乎停住」，不是完全冻结。
- **处理**：先确认第 1 条的 ref 是否生效；12% 慢速符合上游行为，不要当 bug 修。
- **防回归**：不要用「暂停时完全不动」做断言；断言的应该是 bands 停止更新。

## 7. 不是所有背景都吃音频

- **现象**：切到莫奈/漫游/空/嵌入后，鼓点没有反应，以为音频分析坏了。
- **原因**：只有 **隐现（latent）** 与 **通用（common，几何图形）** 吃音频。莫奈/漫游/空/嵌入
  在上游就是封面或时间驱动，静止是设计如此。
- **处理**：想测音频响应就用隐现（流体/混合）或通用；不要把其他背景的静止当 regression。
- **防回归**：文档和测试里写清「哪些背景吃音频」。

## 8. 看到的还是旧背景（模糊封面 + 斜线）

- **现象**：刷新/重启后播放页仍是旧 ambient 背景，和新代码不一致。
- **原因**：旧 ambient 背景的封面回响层（`.mp-np-bg` 的 `is-echo`）还在运行中的旧 client 里；
  新播放页不再渲染它。
- **处理**：重启 DSH 或刷新页面；确认 `client.js` 是新的（安装目录里的哈希/关键字符串）。
- **防回归**：改播放页背景后检查运行的 client，不要只看仓库文件。

## 9. 没歌词时页面中央一直有「暂无歌词」

- **现象**：纯音乐/无歌词时，播放页中央出现占位文案，挡住视觉器。
- **原因**：两处占位（`src/ui/04-now-playing.js`、`src/ui/04-player-page.js`）及对应 CSS 已移除。
- **处理**：`page.noLyrics` 的 i18n key 仍保留，暂未使用；不要再把占位加回来。
- **防回归**：无歌词时只让视觉器/空舞台处理，不渲染文案占位。

## 10. 浅色主题下播放器卡片白底白字（主题 / UI）

- **现象**：浅色主题打开播放页的播放器卡片，圆角块、胶囊、输入框、页签变成白底白字，
  文字几乎看不见；深色主题正常。
- **原因**：卡片背景固定为深色玻璃（`rgba(23,23,26,.95)`，属于深色岛），但内部控件读的是宿主
  token（`--dsw-alias-bg-layer-2` 等）；浅色主题把它们解析成近白表面/深色文字。
- **处理**：在 `.mp-card` 作用域把用到的 token 钉成深色值（与 `.mp-np` 的深色岛一致），
  新浮层照此办理；不要逐个子组件打补丁。
- **防回归**：`test/theme.test.mjs` 的 `.mp-card` 断言；浅色主题下专门看卡片和浮层。

## 11. 主题守卫有扫描盲区：新 UI 文件 + 内联圆角（构建 / 测试）

- **现象**：在 `20-player-sheet.js` / `25-look-picker.js` 里写了 `borderRadius: '10px'`、
  `fontSize: '11.5px'`，`npm test` 仍然通过。
- **原因**：`test/theme.test.mjs` 的字号检查只扫手写的 `uiFiles`（到 `16-header.js`）；
  圆角检查只扫 `90-theme.js` 的 CSS，内联 `borderRadius` 根本没查。
- **处理**：新增 `src/ui/*.js` 时把文件名加进 `uiFiles`；内联圆角也按 8/12/16/20 写。
  扩大守卫前先清旧违规（卡片里还有 10px / 11.5px 等历史值），不要一次性打开。
- **防回归**：新增 UI 文件的 review 清单包含「更新主题守卫的 `uiFiles`」；扩守卫时分批提交。

## 12. 只在 native 宿主组件下看，fallback 坏了（主题 / UI）

- **现象**：真实 DSH 里控件正常，测试/harness 或旧版 DSH 里控件缺失、错位、无法点击。
- **原因**：`hostUi` 加载失败时 `hostComponent` 返回 `null`，走本地 fallback；测试环境固定
  fallback，但本地只验证了 native。
- **处理**：native 和 fallback 都看一遍；看控制台 `host UI kit: native|fallback` 和设置页状态行；
  fallback 保持同 DOM/class/props，不另起一套外观。
- **防回归**：新增宿主组件必须同时有 fallback 与渲染测试（测试环境默认 fallback）。

## 13. 改了源码，已安装插件却没变（安装 / 调试）

- **现象**：重新 build-client、刷新页面，界面还是旧逻辑。
- **原因**：profile 里的插件可能是从 tarball / `file:` 安装的**副本**，不是工作区 link；
  工作区构建只改仓库的 `client.js`。即使是 link，Host 模块也要重启才会换新的模块代际。
- **处理**：开发期用 link 安装；交付前 `npm pack` 后重新安装。装完刷新客户端加载新
  `client.js`，完全重启 DSH 加载新 Host。
- **防回归**：安装后直接检查安装目录的 `client.js` 是否含新字符串/哈希，不要只看 lockfile。

## 14. `install_bundle` 被 `ERR_PNPM_EXOTIC_SUBDEP` 拦下（安装 / 发布）

- **现象**：在 profile 里安装/更新插件时报
  `Exotic dependency "kugoumusicapi" (resolved via url) is not allowed in subdependencies when blockExoticSubdeps is enabled`。
- **原因**：`package.json` 里 `kugoumusicapi` 是 GitHub tarball URL；DSH 的 pnpm 供应链策略
  默认禁止子依赖里的 exotic dependency。
- **处理**：本地临时用
  `pnpm add <tgz> --config.block-exotic-subdeps=false --ignore-scripts` 安装；
  发布前必须解决（换成 registry 包，或让安装器允许该依赖/改为可选依赖），不要把这个参数
  当正式安装方式。
- **防回归**：发布前在干净 profile 走一遍 `install_bundle`；CI 加打包安装冒烟。

## 15. 同版本 tarball 改了内容，`pnpm add` 不换已装文件（安装 / 调试）

- **现象**：重新 pack 覆盖同名 tarball，`pnpm add` 成功、lock 的 integrity 也变了，但
  `node_modules/dsh-music-panel` 里还是旧文件。
- **原因**：hoisted linker 认为该版本已安装，只补依赖；或 store 命中了旧内容。
- **处理**：删掉 `node_modules/dsh-music-panel` 后按 tarball 重新解压/安装，或升版本号；
  装完用关键字符串/哈希确认 `client.js` 是新的。
- **防回归**：安装后校验安装目录文件，不只看 lockfile 或命令退出码。

## 16. 删除 junction 安装时可能误删源码（安装 / 调试）

- **现象**：清理 `node_modules/dsh-music-panel` 时，把链接目标（工作区仓库）一起删了。
- **原因**：Windows junction 在某些递归删除/资源管理器操作里会被跟随。
- **处理**：先 `Get-Item` 确认 `LinkType=Junction`，用 `cmd /c rmdir "<path>"` 只删链接；
  删完确认目标仓库还在。
- **防回归**：删除前打印 link target；不要对不确定的路径直接 `Remove-Item -Recurse`。

## 17. 卸载/重装前没停插件，数据又回来了（安装 / 数据）

- **现象**：删了 `~/.dsh/music`，几秒后又出现 `playback.json` / `cache`；重启后旧队列还在。
- **原因**：插件仍在运行，播放/切歌会写回；关闭窗口时 client 的 `beforeunload` 还会
  `flushOnHide()` 保存当前队列。
- **处理**：先用 `plugin_manager` 停用插件，再删数据；重装后先刷新页面丢掉旧队列，再退出重启。
- **防回归**：卸载/重装按「停用 → 删数据 → 安装 → 刷新/重启」顺序，不要先删目录。

## 18. 渲染层 localStorage 不随卸载消失（安装 / 数据）

- **现象**：重装后仍记得歌词样式、主题、引导已读。
- **原因**：`music.prefs.v2`、`dsh-music.prefs`、`music.startupGuide.intro.v1` 在 DSH 渲染进程
  的 localStorage，不在 `~/.dsh/music`；普通卸载不会删（与宿主行为一致）。
- **处理**：需要真正首次体验时，在 DSH DevTools 里 removeItem 这几个 key 再 reload；
  不要以为删数据目录就能清掉界面偏好。
- **防回归**：文档写清「磁盘数据」和「渲染层偏好」的边界；不要承诺卸载=清空所有偏好。

## 19. `--st-raise` 不是 Folia 注入的变量（主题 / UI）

- **现象**：想用 `--st-raise` 调选中胶囊的抬升色，改了没反应。
- **原因**：仓库里没有任何 `--st-raise:` 定义；`var(--st-raise, rgba(255,255,255,.18))` 永远走
  fallback。
- **处理**：深色岛用白色 alpha，主题化用业务 token / `color-mix`；不要依赖未定义变量。
- **防回归**：review 时看到没有定义的 CSS 变量直接指出；`Select-String '--st-raise:'` 为空。

## 20. 手工 insert、bundle selection 与 `set_plugin` 覆盖是三套状态（安装）

- **现象**：插件能跑，但插件管理器显示「已停用」；或删了 `insert` 后重启状态又不对。
- **原因**：正常安装是「依赖 + `dsh.profile.bundles` 选中 → 包内 `cordis.patch.yml` 插入」；
  手工在 profile 的 `cordis.patch.yml` 写 `- insert: id: music` 会绕开管理器。`set_plugin`
  禁用又会在 patch 末尾追加 `- id: music` + `disabled: true`，是另一层覆盖。
- **处理**：按 `install_bundle` 的形态安装：依赖 + `dsh.profile.bundles`，不要手工 insert；
  清理时全文搜 `music`，同时处理 insert 和末尾 override。
- **防回归**：用 `plugin_manager list_bundles` 看 `enabled` / `rows`，再对 `list_plugins` 的
  `include:music` 状态；两边一致才算装好。

## 21. 生成物清单：`client.js --check` 只管拼接（构建）

- **现象**：改完源码，`build-client --check` 通过，但样式/歌词/背景还是旧的。
- **原因**：`client.js` 是 `src/**` 的 fragment 拼接产物；独立生成物还有
  `lyrics.bundle.js`、`styles.bundle.js`、`backgrounds.bundle.js`、`pendolo.bundle.js`、
  `folia-tailwind.js`、`vendor/*.bundle.js`、`lib/assets/icu-folia/*.json.gz`。
- **处理**：按 `AGENTS.md` 的命令先重建对应 bundle，再 `build-client`；`icu-folia` 需要
  `folia-major-main` 检出。不要直接改生成物。
- **防回归**：提交前 `git status` 应包含预期的生成文件；review 时检查「源码改了，bundle 有没有改」。

---

## 22. client.js 顶层声明重名 / `.bundle.js` 被重复扫描（构建）

- **现象**：构建后浏览器报 `Identifier '…' has already been declared`，或新 fragment 的函数被同名旧声明覆盖。
- **原因**：`client.js` 是 `src/**` 拼接的单个 IIFE，所有 fragment 共享作用域，顶层 `var/function/const` 必须唯一；`.bundle.js` 是独立产物，构建时跳过重复扫描，不受这条约束。
- **处理**：新增顶层名一律带 `mp` 前缀并先搜同名；改 `.bundle.js` 走对应 `build-*` 脚本，不要直接改 `client.js`。
- **防回归**：`node scripts/build-client.mjs --check` + `node --check client.js`；CI 跑全量测试。

## 23. 只改 `folia-tailwind.css`，线上仍是旧样式（构建）

- **现象**：改了 `src/render/folia/folia-tailwind.css`，刷新后样式没变。
- **原因**：Tailwind 有两份。`.css` 是生成结果，`client.js` 实际注入的是 `folia-tailwind.js`
  里的字符串；仓库目前没有专门生成这份 `.js` 的 build 脚本。
- **处理**：改 Tailwind 后同步把新 CSS 写进 `folia-tailwind.js`（保持现有字符串格式），
  或先补一个生成脚本；最后 `build-client`。不要只改 `.css` 当交付物。
- **防回归**：提交前确认 `.css` 和 `.js` 都变了，并抽查一个新增 utility 是否在 `.js` 里。

## 24. Folia 资源 404 / `import.meta.glob` 不存在（Folia）

- **现象**：样式里的图片、字体、背景 404；或代码用了 `import.meta.glob` 直接报错。
- **原因**：插件运行在浏览器 IIFE，不是 Vite 构建；资源 URL 必须相对 `document.baseURI` 解析为绝对地址，也没有 Vite 的静态分析 API。
- **处理**：用 `new URL(path, document.baseURI).href`；资源走插件导出或 `/music/...` 路由；不要依赖 Vite 专有 API。
- **防回归**：在带子路径的部署下打开插件，确认资源请求 URL 正确。

## 25. 暂停判断信 snapshot，bands 继续写（播放 / 音频）

- **现象**：按暂停后背景/频谱仍在动，或恢复播放时状态错位。
- **原因**：player snapshot 可能滞后；真实 `<audio>` 的 `paused` / `ended` 才是权威状态。
- **处理**：暂停判断读 `<audio>` 的 `paused/ended`；暂停时停止写 bands（或写 0），恢复时重新启动。
- **防回归**：暂停/恢复测试断言 bands 停止/恢复；不要只断言 `snapshot.playing`。

## 26. `VisualizerShell` 没转发 ref，心象拿不到尺寸（Folia / UI）

- **现象**：心象样式的 `ResizeObserver` 尺寸为 0，画面不显示或错位。
- **原因**：`VisualizerShell` 必须 `forwardRef` 转发容器 ref；普通函数组件会丢掉 ref。
- **处理**：用 vendored 的 `forwardRef` 包装并转发到容器（与 paper-shaders 的 React 18 处理一致）。
- **防回归**：样式测试断言 ref 转发/容器有尺寸；新增 Folia 包装时先搜 `forwardRef`。

## 27. 移除功能后偏好没迁移（偏好 / 迁移）

- **现象**：老用户升级后样式空白或回退错误；旧 `classic` / `cappella` / `machi` 仍然生效。
- **原因**：已移除功能的偏好没有映射到 `monet`，或者迁移只改内存没写回。
- **处理**：在 `src/30-prefs.js` 的迁移里把旧 id 映射到 `monet`；新增移除功能保持同样行为，并一次性写回。
- **防回归**：注入旧偏好值跑迁移测试；不要只测全新用户。

## 28. 歌词 / icu-folia 生成物：不要手改（构建 / 歌词）

- **现象**：改了歌词解析或词典，线上没变；手改 `.json.gz` 后又无法复现。
- **原因**：`src/utils/lyrics/**` 是 Folia 上游逐字副本；`src/render/lyrics/entry.ts` 编成
  `lyrics.bundle.js`；`lib/assets/icu-folia/*.json.gz` 来自 `folia-major-main/dev/icuFolia`，都是生成物；
  `client.js --check` 不会发现它们过期。
- **处理**：改歌词源码后先 `build-lyrics` 再 `build-client`；重建词典跑 `build-icu-folia`
  （需要 folia 检出）；不要手改 `lyrics.bundle.js` 或词典。
- **防回归**：`git status` 应包含预期的生成物；跑 `test/lyrics-folia.test.mjs` 等歌词测试。

## 29. Bodian 登录成功，设置里仍显示未登录（登录 / 凭据）

- **现象**：Bodian 扫码成功，卡片还是“未登录”；重启后会话丢失。
- **原因**：`providerStore` 只认固定平台列表，`setLogin('bodian')` 被直接 return；同时 `index.js` 又建了第二个 `createLoginStore` 写同一个 `sessions.json`，两个缓存互相覆盖。
- **处理**：`provider-store.js` 接受 Bodian 等已登记平台；Bodian 的 `sessions` 通过适配器写同一个 store；删除第二个 `createLoginStore`。
- **防回归**：`provider-store.test.mjs` 覆盖 Bodian 的 `setLogin` / `summary`；`login.test.mjs` 覆盖会话适配。

## 30. 关掉登录窗口，二维码还能被扫（登录 / 会话）

- **现象**：关窗后重新打开，旧二维码仍有效；已扫码后一直转圈。
- **原因**：客户端只清定时器，Host 没有取消 key；没有 TTL / 已扫码超时；`/online/login/status` 也不校验 key。
- **处理**：`/online/login/cancel` + `createLoginState.cancel()`；启动时带回 `expiresAt`；客户端的过期/已扫码 60 秒超时；Host 对 key 不匹配返回 `LOGIN_STALE`。
- **防回归**：`login.test.mjs` 的 transient/cancel 用例；手动测试关窗后旧 key 不再被接受。

---

## 31. 播放页底部歌词后面有一块硬边深色方块（Folia / 样式）

- **现象**：切歌后底部歌词（字幕）后面出现矩形背景色块；歌词还没加载时屏幕中央显示 `ui.waitingForMusic`。
- **原因**：两处都来自移植边界。① `styles.bundle.js` 的 i18n shim 之前是 identity（`t(key)=>key`），Folia 的 `ui.waitingForMusic` 在其语言表里是空串；② `folia-tailwind.js` 是 Folia 编译出的完整 Tailwind 表，但插件从未定义 Tailwind 的主题变量（`--spacing`、`--blur-2xl`、`--radius-*`、`--text-*` 等），所有引用它们的工具类在浏览器里整条失效，并被排在 `FOLIA_CSS` 之后而覆盖手写值——字幕的 `-inset-x-10/-inset-y-6/blur-2xl` 失效后，径向渐变直接铺满内容盒，就成了硬边方块。
- **处理**：shim 改为走插件字典（未知 key 返回空串，见 `src/folia/shims/i18n.ts`）；`src/folia/folia-css.js` 开头补上 Tailwind v4 的默认主题变量。字幕背景本身是 Folia 的「字幕背景」设置（默认开），已接入 `prefs.subtitleOverlayBackground` 并在设置里可关。
- **防回归**：`folia-styles.test.mjs` 断言 `FOLIA_CSS` 里定义了 `--spacing` / `--blur-2xl`，且样式宿主把 `subtitleOverlayBackground` 传下去；改 `folia-css.js` 后跑 `build-client` 并手看一次播放页。

---

## 32. 改了插件、重启 DSH 却没生效（安装 / 开发）

- **现象**：仓库里改完、测试全绿、`client.js` 也重建了，重启桌面版后界面还是旧的（例如 Folia 样式仍显示 `ui.waitingForMusic`、字幕背景仍是硬块）。
- **原因**：DSH 从 `<DSH_HOME>/profiles/<profile>/node_modules/dsh-music-panel` 这个**真实副本**加载插件，桌面版的副本由 `local-packages/*.tgz` 安装而成；仓库里的改动不会自动进去。`web` profile 的同一路径是指向 desktop 副本的 junction，所以更新 desktop 副本就同时覆盖两者。
- **处理**：`node scripts/install-local.mjs desktop`（先校验 `client.js` 是最新，再把旧安装备份到 `~/.dsh/backups/`，然后复制 `index.js` / `client.js` / `src/host` / `locale` 等），之后**完全退出** DSH 再启动；只刷新窗口不会重载 Host 插件。
- **防回归**：安装后比较仓库与 `<installed>/client.js` 的 sha256；脚本在 `client.js` 过期时会拒绝复制并提示先跑 `build-client.mjs`。

---

## 33. 装上新构建后所有歌都不显示歌词（Client / 歌词）

- **现象**：更新到含统一歌词加载器的构建后，播放页、卡片、播放条都不显示歌词；调试报告里 `stage.lines=0`、`hasRaw=false`，而 Host 的 `/online/lyric` 直接请求能返回完整 LRC。
- **原因**：`src/client/services/lyrics/loader.js` 里写的是裸 `prefs.xxx`，但 `prefs` 只是各组件里的 `var prefs = usePrefs()`，不是全局；加载器调用时抛 `ReferenceError`，又被 `load()` 的 `.catch` 吞成空结果，于是「有歌词但没人拿到」。单测的 sandbox 恰好注入了全局 `prefs`，把问题遮住了。
- **处理**：加载器改为 `lyricPrefs()`，从 `prefsStore.get()` 读当前偏好；单测 sandbox 只留 `prefsStore`、删掉 `prefs`，让同类错误直接失败。
- **防回归**：`lyric-loader.test.mjs` 不再提供全局 `prefs`；新增服务代码读偏好看 `prefsStore.get()`（组件里才用 `usePrefs()`），不要假设组件局部变量在 service 里可见。

---

## 34. 在线缓存按「播完」触发时，交叉淡化的那首永远不缓存（播放 / 缓存）

- **现象**：打开「缓存歌曲」后，正常播完的歌能进缓存，但交叉淡化切走的歌始终不缓存。
- **原因**：淡化时换牌后淡出方由 `finishCrossfade` 暂停，`<audio>` 不会派发 `ended`；而缓存写入只挂在 `onEnded` 上。单曲循环则是我们手动回到 0（没有原生 `loop`），每遍都会触发 `ended`，不需要单独处理。
- **处理**：`beginCrossfadePlayback` 记下淡出曲目（item/duration），`finishCrossfade` 在暂停鬼影前按 `duration - currentTime <= 1.5s` 判断它已到结尾并发 `POST /online/played`；淡化的 `fade` 被夹到 `remaining - 0.05`，所以正常淡化一定满足。
- **防回归**：`media-cache.test.mjs` 覆盖写入/修剪/分类清理；手动验证开缓存播一首、交叉淡化切一首，两种都应出现条目；`online/played` 只在开关打开时发送。

---

## 35. 扫码成功却被判失败 / 新二维码被旧取消删掉（登录 / 波点·汽水）

- **现象**：波点音乐扫码后显示「平台拒绝了这次登录」；汽水音乐刷新二维码后显示「这次登录已经被新的尝试取代」，扫了也没反应。
- **原因**：① 波点包的 `login_qr_check` 成功态是 `confirmed`（session 已写进仓库），插件只认 `success`，把它归成失败；② 取消登录只带 provider，Host 无条件删掉当前状态，刷新/关窗的取消请求晚到就会删掉新一次尝试；汽水的 `error` 状态还丢了 `failure.case`。
- **处理**：bodian 映射 `confirmed` → success 并取回 session、二维码 TTL 改为包本身的 5 分钟；取消改为按 key 归属（客户端带 `key`，`state.cancel(key)`/bridge/route 只释放对应尝试）；qishui 透传 `failure.case`。
- **防回归**：`bodian.test.mjs`（confirmed）、`qishui.test.mjs`（refused case）、`login.test.mjs`（旧 key 取消不清新状态）。

---

## 36. 退出登录让整个 DSH 崩溃（Host / 在线源）

- **现象**：播放中点「退出」，DSH 弹出「应用无法启动或已意外停止」，crash log 为 `MusicError: Bodian Music does not support forgetTokens`。
- **原因**：`/online/logout` 对所有平台无条件调 `omni.forgetTokens`，波点原生源没有该方法 → 抛 `unavailable` 并从未捕获的路径逃出，Host 进程退出；退出瞬间 socket 已断时，500 兜底写回也可能再抛一次。
- **处理**：波点补 `forgetTokens` / `logout`（清 session 与行缓存）；`/online/logout` 的 token 清理改为 best-effort；`routes.js` 的兜底 catch 再包一层，写不出去时直接销毁响应。
- **防回归**：`bodian.test.mjs` 覆盖 `forgetTokens` 清 session。

---

## 37. 缓存对齐删掉 `refreshCacheStatus` 后，面板仍每 3 秒轮询（Client / 缓存）

- **现象**：crash log 的 renderer 段出现 `Uncaught ReferenceError: refreshCacheStatus is not defined`，面板有红灯级报错。
- **原因**：在线缓存对齐移除了缓存角标刷新函数，但 `panel.js` 里给「正在播放」歌曲轮询缓存状态的 `useEffect` 还在，定时器每 3 秒触发一次未定义引用。
- **处理**：删除这段轮询（缓存角标已随方案移除）。
- **防回归**：全量 `npm test` 的 client 构建 + 运行期无未定义引用；新增 UI 改动后按 `pitfalls.md` 检查残留符号。

---

## 38. 原生在线源的行没有 `provider`，封面和取流全变成 `provider=undefined`（在线源 / Client）

- **现象**：汽水、波点的歌曲列表全部是占位图；点歌弹出 `无法播放：Failed to load because no supported source was found.`。
- **原因**：`onlineTrackOf` 只读 `result.provider`，而原生源（qishui/bodian）的 `toTrack` 只带 `sourceRef`；客户端于是生成 `online:undefined:<id>`、`cover?provider=undefined`、`stream?provider=undefined`，Host 拒绝，媒体元素最后只报笼统的「no supported source」。
- **处理**：两个源的行补 `provider`；`onlineTrackOf` 回退 `result.onlineProvider` 与 `result.sourceRef.sourceId`；客户端取流失败不再回退同一 URL 当媒体源，而是展示 Host 返回的真实原因。汽水封面还要按 Folia 追加 `~<template_prefix>-image.image`（裸 `/img/<uri>` 会被抖音 CDN 400）。
- **防回归**：`qishui.test.mjs` / `bodian.test.mjs` 断言行带 `provider`；`panel.cover.test.mjs` 断言 `onlineTrackOf` 的 sourceRef 回退。

---

## 39. 歌手页只拿到歌手名 / 专辑卡片只认 `cover`（在线源 / Client）

- **现象**：汽水歌手页报 `Qishui singer has no id`；波点歌手页的专辑卡片全是占位图，且没有歌手头像。
- **原因**：`/online/artist-songs` 需要 `artistId`，但客户端从历史/恢复队列拿到的行可能只有歌手名；而歌手页的专辑卡片渲染读的是 `card.cover`（旧集合形状），`artist_albums` 却只返回了 `coverUrl`；`artist_detail` 也未被使用。
- **处理**：两个源在 `artistSongs` 里用歌手名走一次自己的 search 解析 id（Folia 用歌曲里的 `catalogRef`，效果等价）；`artist_albums` 同时带 `cover` 与 `coverUrl`，`artist_detail` 提供头部信息；播放快照保留 `artistsDetail`/`albumId`。
- **防回归**：`qishui.test.mjs` / `bodian.test.mjs` 覆盖「仅名字」解析、VIP 标记、专辑卡片 `cover` 与艺术家头部。

---

## 40. 在线歌曲点「在线匹配」没反应（Client / 歌词）

- **现象**：播放本地文件时「在线匹配」能打开搜索/匹配窗，播放在线歌曲时点了没有任何反应。
- **原因**：`matchOnline` 与 `openOnlineLyric` 都写死了 `!track.onlineProvider` 才打开窗口；Folia 对在线歌曲用 `OnlineSongLyricMatch`，同样有匹配窗，只匹配歌词。
- **处理**：在线歌曲也打开同一个窗，传 `online: true`：隐藏封面/元数据/停止匹配开关，只保留歌词匹配；保存走 `/lyrics/match-apply` 的 `online:` 路径，写入 `online:<provider>:<id>` 歌词记录，不写文件标签。
- **防回归**：`lyric-state.test.mjs` 覆盖 `online:` 路径的 match-apply（记录被写入、metadata/cover 为 false）。

---

## 41. 登录后没有平台头像 / Navidrome 又长出第二套表单（登录 / 账号）

- **现象**：登录窗平台列表只有 logo；QQ、酷狗、波点登录后账号页没有头像。Navidrome 同时存在设置页表单和登录窗口表单。
- **原因**：① QQ 的会话 cookie 只有 `qqmusic_session`，没有 `uin`，旧逻辑取不到头像；② 酷狗 Lite 的 `user_verify` 经常返回空昵称/头像，但同账号的酷狗完整会话有；③ 波点的 `login_status` 返回用户对象本身，适配器只读 `.user`，刷新时拿不到资料；④ `/online/providers` 只要 `account.user` 是空对象就跳过 profile；⑤ Folia 把 Navidrome 这种服务器连接放在设置里，登录窗只服务扫码平台，我们两处都做了一遍。
- **处理**：QQ 用 `session.userid` 生成 qlogo；酷狗 Lite 在没有头像时回退同账号酷狗资料；波点 `readUser` 兼容两种形状并映射头像字段；账号读取按字段合并，不用空值覆盖；登录窗有头像时显示头像；Navidrome 的单一表单归位到设置 → 在线，删除独立对话框与登录窗分支。
- **防回归**：`panel.render.test.mjs` 覆盖登录窗头像与「只列扫码平台」；`bodian.test.mjs` / `qq-upstream.test.mjs` 覆盖资料读取。

---

## 42. 设置页切到「歌词 / 数据」白屏（Client / 设置）

- **现象**：设置弹层里点「歌词」或「数据」，插件面板直接空白（React 渲染抛错）。
- **原因**：这两个标签用到的 `mpSmallButton`、`mpSegment` 只在 `player-sheet.js` 的组件函数内部定义；settings.js 在另一个组件里调用同名全局，实际是未定义引用，渲染一进入该标签就抛 `ReferenceError`。
- **处理**：把两个小控件抽到 `primitives.js` 作为共享顶层函数（player-sheet 内部同名局部函数会自然遮蔽原实现），settings 直接复用；新增「所有设置标签都能渲染」的回归测试。
- **防回归**：`panel.render.test.mjs` 遍历 appearance / lyrics / playback / online / library / cache / about 七个标签渲染面板。

---

## 43. 酷狗点 A 播 B（在线源 / 取流）

- **现象**：搜索结果点一首歌，实际播放另一首不相干的歌。
- **原因**：旧 `normalizeSong` 把 `Audioid` / `audio_id` 当 `albumAudioId`，概念版还把 `mixsongid` 当 `albumAudioId`；package/legacy 的 `song_url` 带着错误 ID 请求，解析到别的文件。
- **处理**：只从 `album_audio_id` / `albumAudioId` 取专辑音频 ID；package 每档 metadata → hash-only 回落；网关/v6 兜底保持 hash-only；测试断言参数顺序。
- **防回归**：`kugou-upstream.test.mjs` 覆盖精确字段、metadata/hash 顺序；真实问题歌曲手工复核。

---

## 44. TTS 避让渐变被 mute 重置（播放器 / 音频焦点）

- **现象**：避让设为 300ms，实际音量瞬间跳变，听不到渐变。
- **原因**：applyOutputVolume 先 setVolume(target, fade)，紧接着 setMuted(muted) 用默认 15ms ramp 再写一次 master gain，把长渐变取消；mute 状态没变时也会重写。
- **处理**：foliaGraph.setMuted 接受 rampSeconds；player 调 setVolume 与 setMuted 时传同一个 fade。
- **防回归**：player-folia-wiring 断言两个调用都收到 fade；audio-focus 测试覆盖 level/fade 状态。

---

## 45. 酷狗概念版 high / lossless 取流 502（在线源 / 取流）

- **现象**：0.38.0 播放酷狗概念版的任意歌曲，high / lossless 的 CDN 地址返回 404，Host 回 502；standard 仍可播放。
- **原因**：0.38 的精确身份改造让歌单/专辑行只剩 album_id、album_audio_id 为 0，却仍先发半套 metadata；接口回了一个别的文件的地址。同时标准路径的循环固定从 flac 开始、使用 hqHash/sqHash，和 Folia 的“请求档位 + 主 hash”不一致。
- **处理**：只在 album_audio_id 存在时发 metadata，否则直接 hash-only；嵌套 package 归一化保留 album_audio_id；标准路径按请求档位的 Folia 阶梯（128 / 320 / flac）并使用主 hash；Host 在已解析地址仍 404 时按 Folia 阶梯降一档再取。
- **防回归**：kugou-upstream 覆盖高音质 320、主 hash、半套身份不发送；online-stream-fallback 覆盖 404 → standard；真实问题歌曲复测。

---

## 46. 云阶 / 心象在英文歌里空白（歌词 / Folia 样式）

- **现象**：云阶（partita）和心象（cadenza）在英文歌里没有任何字形/布局，其他歌词样式正常。
- **原因**：这两个样式按 `line.words` 建列/落点；行级 LRC 或在线歌词回退只有 `fullText` 时，legacy 桥接生成 `words: []`，布局为空。中文/日文常见逐字词轴，所以不触发；Folia 的解析器总会用 `buildTimedWords` 合成词轴，本插件没有在桥接层补齐。
- **处理**：`legacyLinesToFolia` 对空 words 调用 FOLIA_PENDOLO 的 `buildTimedWords`；`foliaStyleLines` 在舞台入口再做一次空 words 修补。
- **防回归**：folia-styles 测试覆盖行级英文与空 words 输入；Partita/Cadenza 在有 words 时布局非空。

---

## 47. 重启后音量回到 100%

- **现象**：音量滑杆保存后，退出并重新打开 DSH 又回到默认值。
- **原因**：`player.js` 的初始 state 把 `volume` 固定为 1；`setVolume` 会写 `prefs.volume`，但新引擎创建时没有读回。
- **处理**：创建播放引擎时从 `prefs.volume` 恢复并 clamp 到 0–1；无效值回退 1。
- **防回归**：player-folia-runtime 测试用带 volume 的 prefs 启动，断言 snapshot 恢复且 setVolume 写回。

---

## 48. QQ 歌单只显示前 100 首

- **现象**：QQ 歌单总数正确（例如 211），但歌曲只有 100 首。
- **原因**：`/user/playlist-detail` 是分页接口，单页上限 100；旧代码只发一次 `offset=0, limit=1000`，把第一页当完整歌单。公开歌单走匿名接口不受影响。
- **处理**：按 Folia 的页模型每页 100 首，累计 offset，直到 total、空页或重复页；同时按 `dirName` 区分自建与收藏，收藏走匿名完整路径。
- **防回归**：QQ library 测试用 150 首 mock 分页，断言请求 offset 0/100 且最终 150 首。

---

## 49. 交叉淡入淡出后所有歌词样式冻结在每句第一个字

- **现象**：播放一段时间、发生切歌淡入淡出后打开播放页，所有 Folia 歌词样式的逐字/逐词动画停在每句第一个字，行索引仍会跳下一句。
- **原因**：共享时钟用 `document.querySelector('audio.mp-audio-host')`，查到的是文档里的旧 A deck；active deck 已切到 B，旧 A 在 `finishCrossfade` 里被 `removeAttribute('src') + load()`，时间归 0。行索引来自 active deck，时钟却停在 0。
- **处理**：播放器暴露 `getPlaybackTime()` / `getActiveAudio()`；Folia 样式、Pendolo、音频带全部读 active deck。Folia 也是如此：共享 lyric clock 来自 active transport。
- **防回归**：player-folia-runtime 断言 `getActiveAudio()` 与 `getPlaybackTime()` 跟随挂载的 deck。

---

## 50. 逐词歌词和实际进度对不准

- **现象**：逐词扫色/高亮和实际进度有偏差，行切换时尤其明显；Folia 同一首歌、同一词源正常。
- **原因**：Folia 舞台的 currentTime 是约 60Hz 的 rAF 时钟，但当前行索引来自父层 usePlayerTime() 的 timeupdate（约 4Hz）。两个时钟在行边界最多错开约 250ms，逐词动画和行索引不同步。
- **处理**：在 FoliaStyleStage 内用同一 clock 逐帧计算 foliaLineIndex（与 Folia 的 findLatestActiveLineIndex 一致，行间间隙返回 -1），不再依赖父层 active。
- **防回归**：foliaLineIndex 覆盖行内、行间、renderEndTime 与最后一行；player 测试继续覆盖 active deck 时钟。

---

## 51. 歌词记录标记 wordLevel，payload 却只有 LRC

- **现象**：酷狗/QQ 源有逐词歌词，但云阶、心象空白或逐词不准；`/online/lyric` 返回 `lines:null`、`raw:null`、`wordLevel:false`，而 `state.matched.wordLevel:true`。
- **原因**：旧版本的 override 记录只持久化了 LRC，词轴/raw 没有写进 payload；匹配记录仍保留 wordLevel 标记，造成“知道有词轴，实际没有词轴”。
- **处理**：`/online/lyric` 检测 `matched.wordLevel===true` 且 payload 无 words 时，用匹配来源重新取一次并写回 `lines/raw/wordLevel`；同时在线匹配获取歌词时带上来源 cookie/session。
- **防回归**：best-lyric 路由测试构造只有 LRC 的旧记录，断言 `/online/lyric` 回源后返回并持久化 words。

---

## 52. 来源菜单出现两个本地音乐，且首次打开列表不全

- **现象**：左上角来源菜单有两个「本地音乐」；第一次打开时只有部分平台，过一会才补全。
- **原因**：`/online/providers` 把注册表里的 local 也当作在线来源返回，客户端 `p3SourceList()` 先固定加 local，再由 provider map 追加一次；provider map 初始为空，来源菜单按异步结果逐项增长。
- **处理**：Host 只返回 `kind === 'online'` 的来源；客户端跳过 local，并在 `providersPhase` 不是 ready 时为已知平台渲染禁用占位项（状态「加载中」），加载完成后原位替换。
- **防回归**：runtime 断言 providers 不含 local；panel.render 断言 local 只出现一次、loading 阶段有占位项。

---

## 53. Monet 歌手名上下被截断

- **现象**：Monet 样式左上角歌手名（如「伍佰 & China Blue」）顶部/底部被裁掉一截，标题和其他样式正常。
- **原因**：Monet 的歌手行使用 `truncate`（`overflow:hidden`）且没有显式行高；Folia 全局由 Tailwind preflight 提供 `line-height:1.5`，本插件宿主的继承行高更紧，斜体字形超出行盒后被裁。
- **处理**：`VisualizerShell` 显式设置 Folia 的 `line-height:1.5`，恢复 Folia 的全局排版上下文；Monet 源码保持与上游一致。
- **防回归**：样式 bundle 重建并跑 Folia/panel 渲染测试；如再改 shell，需保留该行高。

---

## 54. 歌词样式列表顺序与 Folia 不一致

- **现象**：样式选择器顺序与 Folia 不同；部分样式的全局排版上下文也有偏差。
- **原因**：13 个样式目录虽与上游一致，但本地 `FOLIA_STYLE_META` 使用了另一套 order；`VisualizerShell` 移植时漏了 Folia 的 1.5 行高和 flex 居中。
- **处理**：按各 `entry.tsx` 的 order 重排（sonnet 10…still 130），shell 恢复 line-height 1.5、flex column 居中。
- **防回归**：folia-styles 测试断言完整顺序；styles/client bundle 重建并全量测试。

---

## 55. 在线账号卡片被服务器表单撑高，长 ID 溢出

- **现象**：酷狗卡片和 Navidrome 并排时被拉高；汽水音乐的长 ID 横向溢出卡片。
- **原因**：CSS grid 默认 `align-items:stretch`，同一行高度取最高的 Navidrome 表单；账号 ID 在 flex 子项中 `white-space:nowrap` 且没有 `min-width:0`/省略规则。
- **处理**：所有账号卡片设统一 `min-height`；Navidrome 表单默认收起，展开时 `grid-column:1/-1` 独占整行；`mp-online-id`/`mp-online-nick` 加 `min-width:0` + ellipsis，并补 `title`。
- **防回归**：设置页卡片不使用内容自适应行高；长 ID 必须可省略。
- **补充**：初版固定 152px 仍会在已登录卡片底部留白；现改为 120px，Navidrome 收起态用单行横排的「说明 + 连接」，四张已登录卡片内容刚好填满。
- **再补充**：固定最小高度仍会制造底部空白；现在卡片高度由内容驱动，`justify-content:space-between` 让头部/账号行分贴上下 padding。连接按钮加 `flex:none + min-width + white-space:nowrap`，避免两个汉字在窄槽里换行。

---

## 56. 酷狗个别老歌播放 404，其他歌正常

- **现象**：酷狗概念版播放某些老单曲提示「无法播放：HTTP 404」，同队列其他歌正常。
- **原因**：这些曲目的 search 行没有专辑身份（album / albumId 为空），现代 `/song/url` 返回的是已从 CDN 消失的旧对象地址；hash 本身仍有效。Folia 的酷狗 provider 在取不到/失效时会走旧版 `m.kugou.com/app/i/getSongInfo.php?cmd=playInfo`，本插件原先没有这层回退。
- **处理**：`resolveLegacyStream(hash)` 取旧版接口的 `url`/`backup_url`；`/online/stream` 在酷狗 CDN 404 时先尝试 legacy URL，成功才递归代理，失败继续原质量降级。
- **防回归**：online-stream-fallback 覆盖「现代地址 404 → legacy 地址成功」和「legacy 无地址 → 质量降级」两条路径。

---

## 57. 播放页底部字幕比 Folia 低

- **现象**：底部翻译字幕离底边比 Folia 近，控制条与字幕的呼吸感不同。
- **原因**：`usePlayerSubtitleBottomPx` 是宿主边界桩，固定返回 64；Folia 桌面档是 32px 基线 + 80px 净空 = 112px。字幕组件源码本身与上游一致。
- **处理**：边界 hook 恢复 112px；chrome 隐藏时退回 32px 基线；底部字幕组件、行解析、active/recent/upcoming 逻辑不改。
- **防回归**：styles bundle 重建；如改播放页底栏几何，同步改这个 hook，而不是改字幕组件。

---

## 58. 酷狗概念版点赞提示不支持，波点没有喜欢能力

- **现象**：播放页点喜欢只看到「暂不支持」；酷狗概念版和波点都无法取消/写入喜欢。
- **原因**：来源能力表把 `kugouLite.likeWrite` 写成 false，且 `setOnlineLiked` 对概念版直接抛错；波点 source 没有声明 `likes` / `likeWrite`，也没有实现 `likedIds` / `setLiked`。
- **处理**：概念版通过 cloudlist 的 `playlist_tracks_add` / `playlist_tracks_del` 写内置「我喜欢」；波点补 `liked_songs` 与 `like_song`。酷狗取消时按 hash 在「我喜欢」歌单里解析 `fileid`，不把其他歌单的行号传过去。
- **防回归**：sources 断言能力位；kugou-library 与 bodian 测试覆盖读写和变更参数。
- **补充：收藏到歌单**：酷狗概念版原先 `playlistAdd:false` 且 Host 直接抛错；波点没有 `myPlaylists`。现概念版用 cloudlist `playlist_tracks_add`，波点用 `user_playlists` + `playlist_tracks_add`。

---

## 60. 在线「添加到歌单」弹窗像自绘列表，不像 DSH

- **现象**：弹窗每行是裸按钮，自己写边框、背景、10px 圆角和错误色，和其他设置弹窗不一致。
- **原因**：`online-add-to-playlist-dialog.js` 早期直接写了一次性行布局，没有走主题规范要求的组件/样式层级。
- **处理**：改为 `SetRow` + `Button`，容器用 `.mp-set-card`，加载/空态用 `.mp-folder-state`，错误用 `.mp-online-error`；标题改用「添加到歌单」，页脚用 `Button ghost`。
- **防回归**：新增 UI 改动按 `A_other/docs/theme-guidelines.md` §1.3 / §3.1 检查，不在弹窗里手写控件。

---

## 61. 播放卡片「本地」页不是 Folia 的 SourceTab

- **现象**：在线歌曲仍显示「本地」标签和「在线曲目，没有本地文件」；来源页混入翻译开关、歌词分词、在线文件大小/时长，和 Folia 的信息层级不一致。
- **原因**：`player-sheet.js` 的来源页是自定义实现，标签固定为「本地」，facts 和歌词来源选项没有按曲目类型分支。
- **处理**：标签按 local/online/navidrome 动态化；在线不显示本地 facts，本地只保留文件名与大小/码率，Navidrome 显示 Song ID；纯音乐只作为无源状态标签；偏移支持直接输入；翻译开关与分词从来源页移回控制/音质页。
- **防回归**：来源页改动以 Folia `SourceTab` / `OnlineLyricsTab` / `LocalTab` 为参照，不再按曲目类型复制一套列表。

---

## 62. 播放页底栏改错组件

- **现象**：改的是 `player-page.js` 的 `.mp-page-pill`，但当前全屏播放页实际挂载的是 `now-playing/index.js` 的 `NowPlayingCapsule`，界面上没有任何变化。
- **原因**：仓里有两套播放页外壳；`p3-shell.js` 只挂载 `NowPlaying`，`PlayerPage` 是已经不再挂载的旧壳。没有先确认挂载点就按文件名改了“看起来最像”的底栏。旧壳、旧测试和 `.mp-page-*` 样式随后已删除。
- **处理**：改 `NowPlayingCapsule`：循环键按 Folia 的 off → all → one 三态调用 `player.setLoop`，不再用会改随机顺序的 `cyclePlayMode`；胶囊颜色改用 `--dsw-alias-*` token。队列作为插件额外入口保留。
- **防回归**：改播放页 UI 前先查 `p3-shell.js` 的挂载点；底栏组件以实际渲染的 `NowPlayingCapsule` 为准，不要按文件名猜。

---

## 63. 在线歌曲红心不亮，但 Folia 是亮的

- **现象**：同一首在线歌曲在 Folia 中红心点亮，本插件显示空心；歌手、封面和点击后的写入都正常。
- **原因**：`likeStateOf` 从 `onlineStore.liked[track.path]` 取状态，但客户端只在右键菜单里按单曲请求 `/online/liked`，从未调用已有的 `/online/liked-ids`；`onlineStore.liked` 初始化为 `{}` 后一直为空。不是歌单、不是 UI 图标，也不是 `favoriteSet` 的问题。
- **处理**：`loadProviders()` 在来源列表返回后，对每个 `loggedIn` 的来源调用 `loadLikedIds`，按 `online:<provider>:` 前缀替换该来源的键，再合并进全局 map；Host 已返回完整 `track.path`，客户端也兼容裸 id。
- **防回归**：在线红心状态必须来自 provider 的喜欢集合；修改 `likeStateOf` 或来源加载时，先验证 `onlineStore.liked` 有对应 provider 的键。

---

## 64. 网易云歌单只加载 1000 首

- **现象**：某些平台的歌单只显示固定数量：网易云 1000、波点 100、汽水 60、酷狗标准版 300、酷狗概念版 2000/4000。
- **原因**：Host 的 `playlistSongs` 只请求第一页，把单页 `limit/pagesize` 当成了总数。Folia 的 provider 接口是 `getPlaylistTracks(id, limit, offset)`，UI 按页继续请求。
- **处理**：网易云按 `trackCount` 以 500 首循环；波点按 100 首、汽水按 60 首并用 `hasMore`、酷狗标准版按 300 首、概念版按 100/200 首继续翻页，直到 total、hasMore 结束或短页。QQ 自建/喜欢已有分页，Navidrome/本地无固定上限。
- **防回归**：任何“全量列表”接口都要核对上游分页语义；单请求 `limit` 不能当作总数，必须用 `trackCount`/`hasMore`/短页终止。

---

## 65. 花火/绘光的歌词变成竖排

- **现象**：同一首歌词在花火或绘光里偶尔排成竖列，Folia 参考实现是横排；切换歌词/重新播放时又会变。
- **原因**：两个样式的源码与 Folia 逐字节一致，但 `visualizerGeometrySeed` 传错了。Folia 用 `displaySong.id`（`App.tsx`），本插件用完整 `trackPath`；在线歌曲因此是 `online:provider:id`，所有按 seed 决定的 shot/layout 分支都跟着变，其中包含竖排 variant。
- **处理**：`NowPlaying` 统一用在线 `onlineId`、本地 `id` / `path` 生成 `visualizerSeed`，同时传给背景、样式解析和 `LyricStage`；不要再传 `track.path`。
- **防回归**：Folia 样式源码保持上游逐字节；行为差异先查传入的 seed / lines / duration，不要先改样式实现。

---

## 66. 智能平衡只有常量像 Folia

- **现象**：目标 -14 LUFS、+6 dB 等常量与 Folia 相同，但同一首歌的 dB 和播放中移动仍可能不同。
- **原因**：本地只实现了 file/played/tag/live/typical 五级来源；缺少 profile/head/platform，typical 不去重，实时 meter 用本地简化记录，文件缓存的是最终 gain，播放中也没有 blend hold。
- **处理**：生产规则直接使用 `MPAudio.chooseBalance` / `planBalanceMove` / `whyNotWholePlay`；记录改为 file/played 的 loudness+peak，typical 按歌曲 key 去重；文件分析改用 22.05kHz + Folia K-weighting/gated loudness；播放中按规则 ramp/hold。
- **防回归**：不要把“常量一致”当成算法一致；修改平衡时先核对 Folia 的输入顺序、记录结构和 mover 返回值。

---

## 67. 在线平台增益走 stream 头，缓存重播会丢

- **现象**：首次解析在线播放地址时平衡能用平台增益，缓存音频重播又退回 typical/live。
- **原因**：平台增益只在 `/online/stream` 解析 CDN 地址时存在，媒体缓存的文件元数据没有保存 `replayGain`；缓存命中路径直接读文件，没有 header。
- **处理**：当前先通过 stream 响应头传 `x-music-track-gain/peak`；后续应把增益写入媒体缓存元数据，在缓存命中时恢复。
- **防回归**：不要用平台名硬编码“有增益”；只有真实字段才进 `platformDb`。

---

## 68. profile 不是“有字段就算对齐”

- **现象**：本插件已有 `music.profile.v1`，但 Folia 的 automix profile 是独立预分析服务，会分析当前和下一首，并为 Navidrome 只读头部。
- **原因**：播放器只能测量已经取到的当前曲 blob；没有下一首预取，也没有 partial head。
- **处理**：当前只把真实测出的整曲 `programLoudness/peak/leadIn` 作为 profile；没有下一首或头部数据时传 null。
- **防回归**：不要把当前曲的 file 记录改名成 profile 来冒充 automix；要补的是调度和字节读取规则。

---

## 69. 缓存命中会绕过平台增益

- **现象**：首次解析在线流时 `platformDb` 有值，之后命中媒体缓存又变回 null。
- **原因**：`replayGain` 原先只存在于 `/online/stream` 的 fresh 分支，缓存元数据没有保存。
- **处理**：`mediaCache.store` 持久化四个数值增益字段，`serveCachedAudio` 重新写 `x-music-*-gain/peak` 响应头；`/online/replaygain` 也先查缓存。
- **防回归**：新增缓存字段时必须同时更新 `lookup`、`store`、缓存清理测试和响应头路径。

---

## 70. Navidrome 的 head 不能整曲下载

- **现象**：profile 调度直接把 Navidrome 下一首当本地曲整曲下载，浪费带宽。
- **原因**：Folia 对 library server 只读文件头部；整曲分析属于本地文件或已缓存音频。
- **处理**：对 Navidrome 用 `Range: bytes=0-1572863` 取前缀，解码成功才写 `partial: true` 的 profile；失败不重试、不占播放。
- **防回归**：`head` 只来自 partial profile；没有 partial 数据时传 null。

---

## 71. 完整 profile 不能再当四个字段用

- **现象**：`profile.js` 原来只存 `programLoudness/peak/leadIn/partial`，接上 Folia `trackProfile` 后其它字段被丢掉。
- **原因**：profile 存储写入时重新构造了四个字段，而不是保存分析结果。
- **处理**：`noteProfile` 现在保存完整 profile 对象；`profileFor` 返回完整对象，平衡只取自己需要的字段。
- **防回归**：给 profile 加字段时先改 `analyseTrack`/bundle，再确认存储没有字段白名单。

---

## 72. profile Worker 不能假设 Blob URL 一直有效

- **现象**：用 `__mpProfileBundle.toString()` 构造 Blob Worker，主线程和 Worker 都要能独立加载分析代码。
- **原因**：bundle 是 IIFE 函数而不是模块；直接 `import` 不可用，且 Worker 里没有主线程的全局变量。
- **处理**：Worker 代码内重新调用 `__mpProfileBundle()`；创建/运行失败时回退主线程分析，播放不被阻塞。
- **防回归**：不要在主线程和 Worker 各维护一份 profile 算法；源只改 `src/client/services/automix/**`，再跑 `build-profile`。

---

## 73. gridFromBeats 不是模型推理

- **现象**：`gridFromBeats` 已能生成 bpm/downbeat，但没有 Beat This 模型时 profile 仍然走 Folia 的频谱估算。
- **原因**：模型推理在 Electron/GPU 侧，插件没有权重和桥；`gridFromBeats` 只负责把已有拍点折成均匀网格。
- **处理**：把 `gridFromBeats` 暴露给未来的模型调用方；没有 `grid` 时不要伪造拍点，让 `analyseTrack` 走 fallback。
- **防回归**：不要用估算出的 bpm 反推假 `BeatGrid` 再传给模型路径；两条证据不能混。

---

## 74. 旧 profile 不能跨版本继续用

- **现象**：分析字段/算法升级后，旧 `music.profile.v1` 仍被平衡读取，结果和当前 `trackProfile` 不一致。
- **原因**：存储对象没有版本校验，字段齐全就被当成有效。
- **处理**：完整 profile 带 `TRACK_PROFILE_VERSION`；`profileFor` 在版本存在且不匹配时返回 null，让 `analyseTrack` 重新生成。
- **防回归**：算法版本变化时同时更新 bundle 和 profile 版本；不要只改分析代码。

---

## 75. 有 profile 不等于 crossfade 会用

- **现象**：profile 已存 bpm/beatOffset，`planBlendShape` 仍传 `nextBeatIn: null`，过渡没有卡拍。
- **原因**：消费端没有把 profile 的拍点相位换算成 incoming 的下一拍时间。
- **处理**：`prepareCrossfade` 用 `bpm`/`beatOffset` 计算 `nextBeatIn`，把 `planBlendShape` 的 `overlap` 写回计划。
- **防回归**：新增 profile 字段后要同时接线消费端；只存不用等于没做。

---

## 模板

新坑照这个写，编号连续，标题一句话；控制在 4 行以内。

```md
## N. 一句话现象（区域）

- **现象**：用户看到什么 / 什么操作失败。
- **原因**：根因，具体到文件/变量/版本。
- **处理**：怎么修，涉及哪些文件/命令。
- **防回归**：测试断言 / 守卫 / review 检查点。
```
