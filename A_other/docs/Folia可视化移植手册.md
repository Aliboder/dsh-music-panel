# Folia 可视化移植手册

本文件记录 `dsh-music-panel` 把 [Folia](https://github.com/chthollyphile/folia-major)（`folia-major-main` 0.7.28，AGPL-3.0）的歌词样式与背景移植进插件时必须遵守的规则、边界改动、验收标准，以及此前“照着写”失败的原因。遇到常见故障（背景不鼓动、暂停不停、bundle 过期等）先看 [踩坑记录](pitfalls.md)。

---

## 1. 原则

**只做两件事：原样复制，和在边界上适配。**

- 渲染器、引擎、着色器、镜头/分镜程序、逐字时间线、布局算法一律逐文件复制，不删镜头、不换实现、不“简化成能跑”。
- 只允许改“宿主接口”：React/framer/lucide 的加载方式、Vite 专有的注册发现、Worker 启动方式、设置面板、存储、i18n、音频/节拍数据。
- 任何“重写一个差不多的”都会在观感上与原版分叉；此前 8 个样式就是反例。

判断一段代码属于哪一类：

| 代码 | 归属 | 处理 |
|---|---|---|
| `components/visualizer/<style>/**`（渲染器、scene、program、shader） | 画面 | 原样复制 |
| `components/visualizer/{pixi,styleTransition,backgrounds,preview}` 的共享实现 | 画面 | 原样复制 |
| `utils/{lyrics,fontStacks,lyricRenderQuality,color*}` | 画面依赖 | 原样复制 |
| `entry.tsx`（注册元数据 + `render`） | 边界 | 复制；`import.meta.glob` 改为显式注册 |
| `tuning.ts` / `*SettingsPanel` / `*SettingsCard` / QuickControls | 设置 UI | 复制源码；构建时用 no-op stub 顶替，后续接设置窗 |
| `stores/*`、`services/{beatFx,analysis}/*`、`hooks/useLucideIcons` 等 | 宿主服务 | 写 shim（数据来自插件或固定关闭） |
| `backgrounds/*` 的 Worker（Monet） | 构建 | 保留绘制函数，Worker 换成 OffscreenCanvas 边界 |
| `types.ts`、`types/visualizerModes.ts` | 契约 | 原样复制 |

---

## 2. 可以原样移植的部分

以下内容在改完边界后**不需要改一行**：

1. **样式渲染器主体**：`VisualizerXxx.tsx`、`scene.ts`、`createXxxRuntime.ts`、`xxxProgram.ts`、`xxxLayout.ts`、`PendoloClockworkCanvas`、`diorama/DioramaScene`、`nebbia/nebbiaShaders` 等。
2. **Pixi 共享引擎**：`pixiRuntimeHost.ts`、`pixiSceneCache.ts`、`pixiProgramLinks.ts`、`pixiTextureBudget.ts`、`bloomFilter.ts`、`pixiWebGLContext.ts`（版本需与 Folia 一致，见 §3）。
3. **样式内部的编译/分镜/镜头/编排**：`paragraphStructure.ts`、`lumiereProgram.ts`、`sonnetProgram.ts`、`temperaProgram.ts`、`hanabiProgram.ts`、`timeline.ts`、`catalog.ts` 及全部 scene builder。
4. **着色器**：WGSL/GLSL 字符串、后处理链（bloom/lens/glitch/print/difference）、WebGL2 程序与 uniform 布局。
5. **文字测量与排版**：`cjkSemanticLayout.ts`、`graphemeTiming.ts`、`renderHints.ts`、`wordColoring.ts`、`textMeasureCache.ts`、pretext 调用。
6. **背景渲染器**：六种背景的 `entry.tsx` + `render`（除 registry 与 Worker 边界）。
7. **调色/主题使用方式**：样式读取 `Theme` 字段的方式；`colorMix`、`paperShaderUniforms`、`useBlendedColors`。
8. **tuning 默认值**：`DEFAULT_*_TUNING` 与 `tuning.ts` 的 `resolve/merge` 逻辑。

## 3. 必须改动的边界

| 边界 | Folia | 插件 | 改法 |
|---|---|---|---|
| 构建 | Vite + TSX + 代码分割 | 单文件 `client.js`（拼接生成） | 用 esbuild（`build-machi` 模式）把每个子树打成 IIFE bundle，再拼进 client |
| 样式发现 | `import.meta.glob('./*/entry.tsx')` | 无 Vite | 写显式 `registry.tsx`，逐个 import entry |
| React | 应用内 React 18 | 宿主注入的 React | 通过 `react-shim` / `jsx-runtime-shim` 复用宿主 React；`memo/createContext` 做薄 React 兜底 |
| framer-motion | npm 依赖 | 已内联的 `MPFramer` | 用 shim 从 `MPFramer` 取 `motion/useMotionValue/useTransform/useSpring` |
| lucide-react | npm 依赖 | 无 lucide | 生成图标 shim：按 Folia import 的图标名导出占位组件（视觉图标后续可换真路径） |
| 版本 | Pixi 8.21 / three 0.185 / R3F 9 | Pixi 8.21 / three r170 / R3F 8 | Pixi 与上游同 8.21；宿主 React 18.3.1 必须用 R3F 8（R3F 9 需要 React 19）；three 用 machi 预编译的 r170 |
| 设置 UI | 自家 settings kit | 无 | 构建时把 `*SettingsPanel` / `*SettingsCard` alias 到 no-op；先用默认 tuning |
| 存储 | zustand + localStorage | 插件 `prefs` | `useVisualizerSettingsStore` 等写 shim，读固定默认值 |
| i18n | react-i18next | 插件 `t()` | `react-i18next` shim 返回插件 `t` |
| 音频/节拍 | `motionSignals` + beat_this/htdemucs | 播放器 analyser（`src/client/render/styles/folia-audio.js`） | 按上游 `usePlaybackVisualizerBridge` 写五条 band、`audioPower` 与 `spectrum`（0–255、21.5 Hz 分段、同样的 power 曲线）；分析器 smoothing 与上游一致（0.6）；beat 服务仍固定关闭 |
| Paper Shaders 的 `ref` | React 19：函数组件把 `ref` 当普通 prop 透传 | React 18.3.1：`memo(function …)` 不转发 ref | 把 vendored `paper-shaders-react/dist/shaders/*.js` 的 7 个包装改成 `memo(forwardRef(...))` 并把 `ref` 传给 `ShaderMount`；否则 latent 的逐帧 `setSpeed`/`setUniforms`（音频扭曲、暂停减速）和 nomand 的首帧检测全部失效 |
| 主题 | 封面色板提取 | 插件 accent | 已移植 `builtinTheme`+`themeColorMath`：按封面色生成 Folia 的 light/dark 主题，样式与背景共用一次提取缓存；AI/自定义主题仍不接 |
| 歌词数据 | raw → 解析器 → `Line[]`（start/end/fullText/words/renderHints） | 在线与本地都由 Host 交出 raw，客户端跑同一份解析器与显示前处理 | 不再有第二套解析：`mpPrepareLyrics` 按 Folia setter 的顺序跑规则/staff/副歌/分词；只有无时间轴的纯文本与旧生产者仍走 `legacyLinesToFolia` 边界转换 |
| 内置头像/表情 | Vite `import.meta.glob` | 单文件 bundle | 素材按 Folia 原图放在 `cappella/{avatar,emo}`，由宿主的 `/music/assets` 路由提供；`avatarImages/emoImages` 仅替换发现方式 |
| 笔顺数据 | 构建时从 AnimCJK 下载 | 无数据 | 暂缺 `nebbia-strokes.json`，雾笺使用上游的字体骨架回退；不影响其他样式 |
| Worker | `new Worker(new URL(...))` | 单文件 | 保留绘制函数，改 OffscreenCanvas/主线程队列（Monet）；其他样式无 Worker |
| CSS | Tailwind | 自有 CSS | 把渲染器实际用到的 utility 与 `GeometricBackground.css` 写进 `FOLIA_CSS`；不改组件 className |
| 字体/素材 | 自托管字体、头像/表情/笔顺数据 | 无 | 字体用系统栈；缺素材的样式（cappella/nebbia）先走上游 fallback，不伪造素材 |

## 4. 验收标准

一个样式只有全部满足才算“移植完成”：

1. **代码同源**：渲染器目录与上游逐文件一致（`git diff` 为空）；只允许 boundary 文件不同。
2. **确定性对照**：固定 `seed`、固定歌词、固定 `currentTime`，在相同视口/DPR 下截图；与 Folia 同参数截图做像素差，差异只能来自主题/字体/背景，并逐项记录。
3. **生命周期**：样式只创建一次；换句不重建画布/WebGL/Pixi/Three 上下文；时间由 ticker/MotionValue 驱动，不在 React 每帧 setState。
4. **输入完整**：`Line` 含 `fullText/startTime/endTime/words`；`Theme` 含背景/主/副/强调/词色/字体栈/字重；`audioPower` 与五条 band 是活跃的 `MotionValue`。
5. **共享视觉层**：背景、字幕/翻译、样式切换过渡与 Folia 一致（至少不影响样式画面）。
6. **回退**：bundle/WebGL/字体不可用时回退普通文本列表，页面不白屏、不报错。
7. **性能**：1080p 下首帧 ≤ 2s（冷启动 shader 编译样式单独记录）；稳定后不持续掉帧；无每帧 React 重渲染。
8. **回归**：`npm test` 全绿、`client.js --check` 通过。

## 5. 为什么此前只有“时计”是对的，其他样式都有问题

1. **它们不是移植，是 74–161 行的示意稿**：`pixi-hanabi.js` 只有 26 个白点；Folia 的 hanabi 是 12,867 行的分镜/烟花池/字形图集/拼贴；`three-machi.js` 是 3 个方块，Folia machi 是 14,200 行引擎。代码规模差 50–150 倍，调参不可能补齐。
2. **舞台生命周期错误**：旧 `canvas/pixi/three` stage 的 effect 依赖包含 `props.active`，每换一句销毁重建画布/WebGL/Pixi；`props.now` 被闭包冻结，句内时间不走；`state.time` 每句归零。画面因此卡顿、跳变、粒子/雨/镜头重置。
3. **输入模型缺失**：只传 `lines/active/now/accent`，没有 Folia 的 `MotionValue` 时钟、`Theme`、音频带、`words` 逐字时间线、`renderHints`，引擎无法按原设计工作。
4. **共享视觉层缺失**：没有背景注册表、样式切换过渡、字幕/翻译层、后期处理（bloom/lens/print），这些占 Folia 观感的一半。
5. **资源与版本不一致**：没有 Folia 的字体栈、头像/表情/笔顺素材；Pixi/three/R3F 版本不同，着色器 shim 不成立。
6. **没有确定性验收**：测试只做结构冒烟，没有像素对照，所以“看起来不对”无法在合并前发现。

## 6. 当前移植状态

| 项 | 状态 |
|---|---|
| 时计 `pendolo` | ✅ 渲染器原样；边界完整（时钟/Line/Theme/band）；设置在默认值 |
| 静止 `still` / 云阶 `partita` / 浮名 `fume` / 莫奈 `monet` / 倾诉 `tilt` / 回环 `claddagh` / 心象 `cadenza` | ✅ 渲染器原样（`styles.bundle.js` 编译） |
| 绘光 `lumiere` / 商籁 `sonnet` / 凝彩 `tempera` / 花火 `hanabi` | ✅ 渲染器原样；Pixi 8.21 已 vendor |
| 雾笺 `nebbia` | ✅ 渲染器原样；笔顺数据缺省时走上游骨架回退 |
| 群唱 `cappella` / 町景 `machi` / 经典 `classic` | ⛔️ 按 AGENTS.md 移除，不再注册（`FOLIA_STYLE_META` 里没有它们） |
| 六种背景 | ✅ 渲染器原样；Monet Worker 改 OffscreenCanvas；设置仅模式选择 |
| 镜台 `diorama` | ✅ 渲染器原样；`@react-three/fiber@8.18.0` 已 vendor，React 18 下 Canvas/CameraRig/DioramaScene 正常出画（首帧需要等场景 raster 完成）；渲染异常时由样式错误边界回退为纯文本歌词 |

已启用的样式共 14 个：`still / partita / fume / monet / tilt / claddagh / cadenza / lumiere / sonnet / tempera / hanabi / nebbia / diorama / pendolo`。经典（`classic`）、群唱（`cappella`）、町景（`machi`）按 AGENTS.md 的边界移除，默认样式是 `monet`。

### 本次移植中实际做的边界工作

- `styles.bundle.js`：esbuild + IIFE；`import.meta.glob` 换成显式 `styles-entry.tsx`；`*SettingsPanel`、`settingsPanels`、`panelRows`、`modal/settings/kit` 走 no-op；`react-i18next`/`i18next` 走 identity；`@/mods/*` 走空注册表。
- Pixi：vendor `pixi.js@8.21.0`（`vendor/pixi/pixi.min.mjs`），与 Folia 同版本。
- framer-motion：复用插件已内联的 `MPFramer`；`useDragControls` 等缺失 API 提供带 `subscribe` 的兼容对象。
- 歌词/主题/音频：`FoliaStyleHost` 构造 `MotionValue` 时钟、五条 band、Folia `Line[]`（含 `words`）与 `Theme`；样式只挂载一次，换句不重建。
- 歌词样式注册顺序按 Folia 的 `order` 排序（静止 10、莫奈 20、浮名 30、花火 40、时计 60、云阶 80、倾诉 90、回环 100、心象 110、绘光 120、商籁 130、凝彩 140、雾笺 150、镜台 160）。
- 歌词本身：在线与本地都走 `src/client/utils/lyrics/**` 的解析器（`lyrics.bundle.js`），显示前处理按 Folia setter 的顺序在 `mpPrepareLyrics`（`src/client/services/lyrics/lyrics.js`）里跑；中文分词用 Host 提供的 icu-folia 数据，手动词级分词按歌曲保存在 `lyric_segmentations`。




