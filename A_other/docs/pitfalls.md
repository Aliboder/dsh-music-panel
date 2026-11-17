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

## 模板

新坑照这个写，编号连续，标题一句话；控制在 4 行以内。

```md
## N. 一句话现象（区域）

- **现象**：用户看到什么 / 什么操作失败。
- **原因**：根因，具体到文件/变量/版本。
- **处理**：怎么修，涉及哪些文件/命令。
- **防回归**：测试断言 / 守卫 / review 检查点。
```
