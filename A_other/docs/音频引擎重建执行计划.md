# 音频引擎重建执行计划与约束

状态：**生效中，作为本轮工作的契约。**

基线：`dsh-music-panel` 0.36.0，分支 `refactor/structure`，起点提交 `691da85`。

对照：`A_other/upstream/folia-major-main`（Folia 0.7.28）。

分析报告：[audio-engine-alignment.md](audio-engine-alignment.md)。

> 本文件回答“做什么、不做什么、按什么顺序、什么算完成”。

> 与分析报告冲突时，以本文件的**已锁定决策**为准；要改决策，先改本文件并提交，再改代码。

---

## 1. 目标

把插件客户端的音频播放引擎整体替换为 **Folia 的播放子系统**，在 **Web Audio 路由**下做到用户几乎听不出、看不出是两套播放器。

不是“把我们的引擎修得更像”，而是：

- Folia 的音频代码是唯一实现。
- 我们自己的播放图、增益公式、crossfade、EQ、平衡表全部删除。
- 我们只保留 DSH 的 Host、音乐库、在线源、歌词、面板和必要的边界适配。

### 完成定义

全部满足才算完成：

1. **代码同源**：`A_other/upstream/folia-major-main/src/services/**` 的音频文件不被修改；只在 `src/audio/shims/**` 和 `src/audio/entry.ts` 做边界。
2. **主链路一致**：`deck → replayGain → trim → tone → fade → mix → EQ → effects → playbackFade → volume → analyser → out`。
3. **没有我们的私货**：不再有 `-16 LUFS` 目标、常驻 `DynamicsCompressor`、EQ preamp/自动 headroom、单 meter、手写 crossfade 曲线。
4. **每 deck 增益归属一致**：`replayGain` / `trim` / `tone` / `fade` 分开，互不覆盖。
5. **过渡一致**：crossfade/tone/echo 的行为、取消、暂停、seek 中途过渡都与 Folia 对齐。
6. **音量平衡一致**：`-14 LUFS`、每 deck 一个 BS.1770 meter、换 deck 后读数跟随、整曲学习记录。
7. **播放淡入淡出一致**：0.2 s、150 ms drain、代际 token、flush。
8. **音频设置/UI 一致**：EQ + 音效、播放淡入淡出、输出设备、过渡模式按 Folia 的模型和默认值。
9. **系统集成一致**：Media Session 进度、`audioSession.type`、可用的输出设备。
10. **旧引擎删除**：不保留双引擎、旧 crossfade、旧 EQ/平衡逻辑作为 fallback。
11. **验证通过**：自动测试 + `check` + 真实播放手工验收。

---

## 2. 范围

### 做

- Web Audio 播放链路。
- 双 deck、播放/暂停/seek/上一首/下一首/音量/静音。
- EQ 与音效链。
- crossfade、tone、echo、过渡取消/暂停/seek 行为。
- 音量平衡（智能平衡/ReplayGain）。
- 播放淡入淡出。
- Media Session 进度、`audioSession`。
- 音频相关设置与 UI。
- 我们 Host 的音源接入（Blob/在线缓存）作为边界适配。

### 不做（本轮）

- Folia 的 HiFi/mpv 路由。
- Folia 的外部播放器接管（Spotify/QQ 自带播放器等）。
- 依赖 native 的输出设备切换实现；只在浏览器支持 `setSinkId` 时做能力探测。
- automix 的 beat_this/htdemucs 模型与分轨，第一阶段不做；先对齐 crossfade + tone/echo fallback。
- 非音频界面重做。
- 旧音频设置的数据迁移。

### 明确不引入

- 不新增第三方运行时依赖（esbuild 已是 devDependency）。
- 不把 Folia 的 React 应用壳、zustand 全量 store、UI kit 搬进插件。
- 不为了“像”而伪造模型结果、假频谱或假过渡。

---

## 3. 已锁定决策

改动这些决策必须先更新本文件。

| # | 决策 | 理由 |
|---|---|---|
| D1 | 用 esbuild 把 Folia TS 音频模块打成 `src/client/audio/engine.bundle.js`，**编译复用**，不手写 JS 翻译 | 手写等价实现必然分叉；bundle 能保持上游文件原样 |
| D2 | 只有一个引擎，不保留旧引擎做 fallback | 双实现会互相抢增益、抢 meter、抢 deck |
| D3 | Folia 拥有音频；插件拥有 Host/队列/统计/歌词 | 边界清晰，避免把播放状态散回 UI |
| D4 | 删除 EQ preamp、自动 headroom、常驻 limiter | 这三项是 Folia 没有的私货，直接破坏“中性链路透明” |
| D5 | 播放淡入淡出默认开启，先不加设置项 | 与 Folia 默认一致；设置项可在音频 UI 阶段补 |
| D6 | 音频相关 UI 换成 Folia 模型；非音频 UI 不动 | 只换引擎不换设置，用户设不出同样的声音 |
| D7 | 音源继续用 Blob（本地/在线都先落 Blob） | 桌面端 HTTP 流 seek 的已知问题；先对齐音频图，不混入音源改造 |
| D8 | 旧音频设置/EQ 自定义不迁移，重置为新默认 | 用户已确认“我们的都可以舍弃”；静默塞旧值会制造第二套语义 |
| D9 | 上游音频文件不改；需要适配时在 `src/audio/shims/**` 写 shim | 保持 `git diff` 可审计 |
| D10 | automix 模型/分轨不在本轮 | 用户 2026-11-17 明确决定：先不做模型，保持无模型普通 crossfade；不下载、不分发 133MB 权重 |
| D11 | 只对齐 Web Audio route | 插件没有 mpv/native 层，HiFi 是另一条运行时 |

---

## 4. 目标架构

```text
A_other/upstream/folia-major-main/src/services/**
        │  原样引用
        ▼
src/audio/entry.ts                边界入口：只 re-export
src/audio/shims/**                边界：stems、store、provider 的空实现
        │  esbuild
        ▼
src/client/audio/engine.bundle.js 生成物，提交进仓库
        │
        ▼
src/client/services/player/engine.js   非 React 控制器：双 deck、图、fade、meter
        │
        ▼
src/client/services/player/player.js   现有 player.* 外壳：队列、统计、恢复、Media Session
        │
        ▼
UI（播放器/设置）                     音频设置改为 Folia 模型
```

### 各层职责

| 层 | 负责 | 不负责 |
|---|---|---|
| `src/audio/entry.ts` | re-export 上游模块 | 不写 DSP、不写业务 |
| `src/audio/shims/**` | 顶掉模型/store/provider 依赖 | 不实现音频算法 |
| `engine.bundle.js` | 上游音频代码的编译产物 | 不手改 |
| `player/engine.js` | AudioContext、双 deck、图、meter、fade、音量 | 不管队列、统计、歌词、UI |
| `player.js` | 队列、当前曲目、恢复、统计、错误、Media Session | 不再自己建图/算增益 |
| UI | 设置与展示 | 不直接碰 AudioNode |

### 构建命令

```bash
node scripts/build-audio.mjs          # 重建音频 bundle
node scripts/build-audio.mjs --check  # 检查 bundle 是否最新
node scripts/build-client.mjs         # 重建 client.js
node scripts/build-client.mjs --check
```

`check` 已包含 `build-audio --check`。

---

## 5. 阶段计划

每个阶段结束必须：测试通过 → `check` 通过 → 提交 → 更新本文件“当前状态”。

### P0 基线与契约（已完成）

- 分析报告。
- 本执行计划。
- 确认边界与锁定决策。

**Gate**：文档提交，后续改动引用本文件。

### P1 纯音频图 bundle（已完成）

- `src/audio/entry.ts` 引入 `playbackGraph`、`audioEqualizerGraph`、`audioEffects`、`audioEqualizer`。
- `scripts/build-audio.mjs` 生成 `engine.bundle.js`。
- `audio-graph.test.mjs` 用 fake `AudioContext` 断言图顺序、EQ 形状、透明效果链。

**Gate**：bundle 能加载；图顺序正确；测试通过。

### P2 deck/crossfade/balance/fade bundle（已完成）

- 引入 `connectAutomixDeck`、`scheduleCrossfade`、`scheduleBandBlend`、`scheduleEchoThrow`。
- 引入 `createDeckAnalyser`、`createBalanceMeter`、`createPlaybackFadeController`。
- shim 掉 `stems`、`stemGesture`、`useAudioSettingsStore`。
- `audio-graph.test.mjs` 断言 deck 四段增益链。
- `audio-folia.test.mjs` 断言 crossfade 曲线、band 曲线、balance 规则、fade 控制器、`scheduleCrossfade`。
- `audio-folia.test.mjs` 断言 bundle 不含 `htdemucs` / `beat_this` / 模型调度。
- bundle 体积约 65 KB（源码文本），低于 150 KB 上限。

**Gate**：通过；`engine.bundle.js` 可由 `--check` 复现。

### P3 非 React 播放控制器

#### P3a 图适配器（已完成）

新增 `src/client/services/player/folia-graph.js`：

- 管理 `AudioContext`、主动 `<audio>`、spare `<audio>`、两个 deck chain、共享图、master gain、analyser。
- `ensure()` 惰性建图；`attach(element)` 接管主动元素并创建 spare。
- `setVolume` / `setMuted` 写 master gain；建图后把元素 `volume` 固定为 1，避免双重衰减。
- `setEq(settings)` 写 Folia EQ + effects。
- `getWave()`、`getFadeGraph()`、`getDeckChain()`、`getMixNode()`。
- `folia-graph.test.mjs` 用 fake context 验证图、音量、EQ、spare deck、dispose。

**Gate**：通过；`check` 与全量测试通过。

#### P3b 传输控制器（已完成）

新增 `src/client/services/player/folia-transport.js`：

- `load(deck, src, { autoplay, startAt })`
- `play(deck)` / `pause(deck)` / `seek(deck, sec)` / `stop(deck)`
- `crossfadeTo(deck, src, { seconds, crossover, hold, together, startAt })`
- `setPlaybackFade(bool)`，接 `createPlaybackFadeController`
- `setDeckReplayGain(deck, db)` / `setDeckTrim(deck, db)` / `getBalanceMeter(deck)` / `getDeckAnalyser(deck)`
- 状态回调：`onState`, `onTime`, `onError`, `onEnded`
- `folia-transport.test.mjs` 用 fake graph/element 验证 load、autoplay、pause、seek、crossfade、ended、stop、dispose、deck gain。

**Gate**：通过；`check` 与全量测试通过。

### P4 替换 `player.js` 内部（高风险）

当前进度：**P4b 主传输与事件已接上，旧图 dead code 已删除；crossfade 仍是旧实现，计划在 P6a 换成 Folia 的 transport/曲线**。`attachAudio` 同时创建 graph 与 transport；`load` 通过 `loadActiveSource` 走 `transport.load`；`play` / `pause` / `seek` / `stop` 走 transport；`transport` 的 `onState` / `onTime` / `onEnded` / `onError` 驱动现有状态逻辑；`swapDecks` 同步 transport 的 active deck。旧 crossfade 仍在使用 deck chain 的 `replayGain`/`fade` 别名。

#### P4 替换映射

| 旧实现 | 新实现 |
|---|---|
| `attachAudio` + `ensureSecondary` | `createFoliaGraph` + `createFoliaTransport` |
| `ensureAnalyser` 内联建图 | `graph.ensure()` |
| `getWave` | `graph.getWave()` |
| `setVolume` / `setMuted` | `graph.setVolume` / `setMuted` |
| `setEq` + `eqNodes` | `graph.setEq` + Folia EQ settings |
| `trimNode` / `preampNode` / `limiterNode` | 删除；Folia deck `replayGain`/`trim`/`tone`/`fade` |
| `setReplayGain` / `setTagGain` / `setNormalize` | 接 Folia `chooseBalance`；先由 transport 写每 deck `replayGain` |
| `load()` 里设 `audio.src` | 保留 Blob 获取；交给 `transport.load(deck, url, { autoplay:false })` |
| `play()` / `pause()` / `seek()` | `transport.play` / `pause` / `seek` |
| `prepareCrossfade` / `beginCrossfadePlayback` / `swapDecks` / `adoptIncoming` | `transport.crossfadeTo`（P6a 再补齐 tone/echo） |
| `bind` / `unbind` 的媒体事件 | `transport` 的 `onState` / `onTime` / `onError` / `onEnded` |
| `audio` 变量 | `transport.getDeckState(activeDeck)` + `graph.getDeckElement(activeDeck)`（只读时） |
| `balanceMeter` / `createBalanceMeter` | Folia 每 deck meter；transport 暴露 `getBalanceMeter(deck)` |
| `analyzeLoudnessBlob` / `balanceMeter` 学习 | Folia `createBalancePlay` + `noteWholeReading`；不再离线解码整曲 |

#### P4 执行顺序

1. **先加 transport 的增益接口**：`setDeckReplayGain(deck, db)`、`setDeckTrim(deck, db)`、`getBalanceMeter(deck)`、`getDeckAnalyser(deck)`。**已完成**。
2. **替换 `attachAudio`**：创建 graph + transport；把 `audioA` 交给 graph，spare deck 由 graph 创建。
3. **替换图相关 API**：`ensureAnalyser`、`getWave`、`setVolume`、`setMuted`、`setEq` 先切到新 graph，旧图变量删除。
4. **替换 `load` 的落点**：Blob 仍由 `player.js` 获取，`audio.src` 改为 `transport.load`；`autoplay` 仍走 `playAfterLoudness` 的时机。
5. **替换传输**：`play` / `pause` / `seek` / `next` / `prev` 走 transport；保留队列/统计/恢复逻辑。
6. **替换事件**：用 transport 回调驱动 `onTime` / `onPlay` / `onPause` / `onEnded` / `onError` 的现有状态逻辑；删除 `bind` / `unbind`。
7. **替换 crossfade**：先接 `transport.crossfadeTo` 的固定曲线；P6a 再加 tone/echo 和完整规划。
8. **删除旧图代码**：`trimNode`、`limiterNode`、`preampNode`、`eqNodes`、`buildEqNodes`、`applyEq`、`applyTrimGain`、`applyNormalizeGain`、`balanceMeter`、`createBalanceMeter` 调用。
9. **保留**：队列、顺序、循环、恢复、统计、错误、Media Session 外壳、leader 选举。

#### P4 Gate

- 旧图代码完全删除，没有第二套增益。
- 切歌、暂停、seek、crossfade 手工通过。
- 全量测试通过。
- 真实本地/在线各一首播放正常。

### P5 音频 UI/设置对齐

- [x] P5a：EQ 编辑页加入 Folia 9 个音效滑杆；`eqEffects` 进入 prefs/player；preamp/headroom UI 与存储语义删除。
- [x] P5a-2：EQ 曲线数学改成首 lowshelf / 末 highshelf，与 Folia 图一致。
- [x] P5b-1：预设页换成 Folia 的 6 个 sound preset（gains + effects 一起应用）。
- [x] P5b-2：自定义区换成 Folia 的 `custom1` / `custom2` 两个槽，保存曲线 + 音效；AutoEQ 设备库保留为本插件扩展。
- [x] P5c：输出设备选择（`setSinkId`）；无能力时不显示假控件。
- [x] P5d：播放淡入淡出开关（默认开，写 `playbackFade`，transport 即时生效）。

**Gate**：

- 用户能在 UI 里设出与 Folia 相同的音频状态。
- 刷新后设置保持。
- 没有假按钮/假选项。

### P6 过渡完整度

P6a（先做）：

- crossfade fallback：tone 三段、echo throw、crossover/together 参数、取消/暂停/seek。
- 不做 beat grid/stems，但行为要像 Folia 没有模型时的 fallback。

P6b（本轮不做，用户已决定）：

- beat_this / htdemucs / stems / automixSession 的完整模型路径。
- 需要确认模型分发、GPU/CPU 预算、包体积、启动时间。
- 用户 2026-11-17 决定：先不做模型，保持无模型普通 crossfade；不下载、不分发权重。
- 事实更正：Folia 的权重不是 249MB ONNX，而是 `beat_this-wgsl.bin` 41MB + `htdemucs-wgsl.bin` 92MB，共约 133MB，随安装包分发。
- 没有权重时 `trackProfile`/`stems` 只能走无模型 fallback；以后要做，先重新确认是否接受这 133MB。

**Gate**：本轮不适用；未实现，不用假数据冒充。

### P7 系统集成

- `MediaSession.setPositionState`。**已完成**。
- `navigator.audioSession.type = 'playback'`（存在时）。**已完成**。
- `AudioContext.setSinkId`（存在时）。**已完成**。
- 输出设备选择只在能力可用时出现。**已完成**。

**Gate**：Windows 媒体面板进度正确；无设备能力时不显示假控件。

### P8 清理与交付

- 删除旧 `src/client/services/player/effects/{loudness,eq,crossfade,transition,balance-meter,volume-balance}.js` 中不再使用的部分。
- 删除旧 `player.js` 中的图代码。
- 更新 `AGENTS.md`、`A_other/docs/pitfalls.md`、`CHANGELOG.md`、`README`。
- 更新 `A_other/docs/audio-engine-alignment.md` 的“当前状态”。
- 全量测试、`check`、真实播放验收。

---

## 6. 验收矩阵

| 项 | 自动 | 手工 | 通过条件 |
|---|---|---|---|
| 图顺序 | `audio-graph.test.mjs` | — | deck 四段 → mix → EQ → effects → fade → volume → analyser |
| EQ 形状 | 同上 | 31 Hz/16 kHz fader | 首 lowshelf、末 highshelf、Q=1.4 |
| 中性链路 | 同上 | 关 EQ/effects 听感 | 没有 limiter/preamp/headroom |
| deck 增益 | 新增单测 | 过渡 A/B | replayGain/trim/tone/fade 分开 |
| crossfade | 曲线单测 | 切歌 | 曲线、tone、echo、取消行为一致 |
| 平衡 | 规则/meter 单测 | 智能平衡 | `-14`，换 deck 跟随，整曲学习正确 |
| 播放 fade | 控制器单测 | 鼓点暂停/恢复 | 0.2 s + 150 ms drain，无 click |
| 音频 UI | 渲染测试 | 实际操作 | 能设出 Folia 同等状态 |
| Media Session | fake 测试 | Windows 面板 | 进度正确 |
| 旧引擎删除 | grep/结构测试 | — | 没有旧 trim/limiter/-16 |
| 回归 | 全量 `node --run test` | 本地/在线各一首 | 全绿、无音频异常 |

**“几乎一致”的判定**：

- 中性设置下，插件链路没有 Folia 之外的节点/增益。
- 同一组 EQ/effects 设置，频响与 Folia 同源（同一份代码）。
- 同一操作序列（播放、暂停、seek、切歌、过渡取消），状态与听感一致。
- 不要求 PCM 逐样本 null test：MediaElement + 浏览器图无法稳定做 null；以节点同源 + 频响/曲线测试 + A/B 听感为准。

---

## 7. 硬性约束与停止条件

出现以下情况**停下来**，先更新本文件或找用户确认，不继续写：

1. 需要修改 `A_other/upstream/folia-major-main` 里的音频文件。
2. 需要新增运行时依赖。
3. 需要改非音频 UI。
4. 需要模型/分轨才能继续。
5. 新旧引擎同时出声。
6. 测试或 `check` 失败。
7. 需要改旧存储键或做数据迁移。
8. bundle 超过 150 KB 且无法解释。

### 代码约束

- 不手改 `src/client/audio/engine.bundle.js`。
- 不把 Folia 的 React hook 直接搬进 `player.js`。
- 不在 `player.js` 里重新实现 Folia 已有的曲线/增益。
- 每个阶段单独提交，提交信息写清“做了什么、为什么”。
- 改音频/构建/播放路径前先看 `A_other/docs/pitfalls.md`；新坑当场补条目。
- 新 UI 组件按 `A_other/docs/theme-guidelines.md`。
- 新增存储按 `A_other/docs/data-reset.md` 扩充清空范围。

---

## 8. 风险清单

| 风险 | 处理 |
|---|---|
| `createMediaElementSource` 每个元素只能一次 | context 重建时整图重建；deck 元素不复用旧 source |
| React 18.3.1 与 Folia UI 依赖 | 音频控制器不用 React；UI 单独适配 |
| autoplay 策略 | engine 的 `play()` 必须在用户手势里；保持现有 `playAfterLoudness` 的时机 |
| crossfade 定时器与暂停/seek 竞态 | 用 Folia 的 session/controller 语义，不自己加 timer |
| 旧测试依赖 `player.getWave`/eq | 适配层保留这些方法，内部转新 engine |
| `balanceMeter` 每 deck 的 CPU | 只在播放/过渡时 tick；沿用 Folia 的 25 ms 采样 |
| bundle 体积 | 当前约 59 KB；>150 KB 停下检查是否拉进模型/无关代码 |
| AGPL 许可 | 插件本身 AGPL-3.0-only，保留 `THIRD_PARTY_NOTICES.md` 与来源说明 |
| 旧 EQ 数据 | 不迁移，重置；在设置里说明一次 |

---

## 9. 当前状态

### 已完成

- [x] 差异报告 `audio-engine-alignment.md`。
- [x] 本执行计划。
- [x] `src/audio/entry.ts` + `scripts/build-audio.mjs`。
- [x] `playbackGraph` / `audioEqualizerGraph` / `audioEffects` bundle。
- [x] `connectAutomixDeck` / `scheduleCrossfade` / tone/echo / balance meter / fade controller bundle。
- [x] `stems` / `stemGesture` / `useAudioSettingsStore` shim。
- [x] `audio-graph.test.mjs`：图顺序、EQ 形状、deck 四段链。
- [x] `audio-folia.test.mjs`：crossfade/band 曲线、balance 规则、fade 控制器、模型未进 bundle。
- [x] `folia-graph.js` + `folia-graph.test.mjs`：双 deck 图适配、master gain、EQ、spare deck。
- [x] `folia-transport.js` + `folia-transport.test.mjs`：load/play/pause/seek/crossfade/stop、deck gain/meter。
- [x] `player.js` P4a：`attachAudio` / `ensureAnalyser` / 音量 / 静音 / EQ 切到 `foliaGraph`；旧 limiter/preamp 不再创建。
- [x] `player.js` P4b-1：`loadActiveSource` + `play`/`pause`/`seek`/`stop` 切到 `foliaTransport`；`swapDecks` 同步 active deck。
- [x] `player.js` P4b-2：transport 事件驱动状态；`bind` / `unbind` / `ensureSecondary` / `wireSecondary` / `buildEqNodes` 删除。
- [x] `player-folia-wiring.test.mjs`：源级守卫，防止旧 limiter/preamp 图和旧传输回潮。
- [x] `player-folia-runtime.test.mjs`：fake AudioContext 下 attach/ensure/volume/EQ/dispose。
- [x] P6a-1：Folia crossfade 曲线 + 静音 intro 修复。
- [x] P7-1：Media Session `setPositionState` + `audioSession.type='playback'`。
- [x] P5a：Folia 音效滑杆 + `eqEffects` 存储；preamp/headroom UI 删除。
- [x] P5a-2：EQ 曲线改为 shelf 形状。
- [x] P5c：`AudioContext.setSinkId` + 设置页输出设备选择（能力探测）。
- [x] P5b-1：EQ 预设页换成 Folia 的 6 个 sound preset。
- [x] P5b-2：Folia `custom1` / `custom2` 两个自定义槽。
- [x] P4b-3：crossfade deck/adopt 交给 Folia transport。
- [x] P4b-4：crossfade 目标 -14 + 每 deck meter 跟随 active deck。
- [x] P5d：播放淡入淡出设置开关。
- [x] P6a-2a：crossover 交给 Folia `planBlendShape`。
- [x] `check` 包含 `build-audio --check`。
- [x] 提交：`a6f1e36`、`691da85`、`dfefec4`、`e24e049`、`865d54d`、`be69113`、`5d17122`、`0aa572d`、`2c2304f`、`2b1f644`、`f0051a2`、`31569d7`、`ab064b8`、`536f94f`、`665a712`、`d63c8a1`、`67f42ab`、`5b73fad`、`51fb95b`、`ee64b3d`、`235e96d`、`3ab031c`。

### 已收口 / 明确不做

- [x] P4a / P4b-1 / P4b-2 / P4b-3 / P4b-4：图、传输、事件、crossfade、balance meter 全部切到 Folia。
- [x] P5a / P5a-2 / P5b-1 / P5b-2 / P5c / P5d：音效、shelf 曲线、6 个预设、2 个自定义槽、输出设备、播放淡入淡出。
- [x] P6a-1 / P6a-2a：Folia 曲线、静音 intro、`planBlendShape` crossover。
- [x] P7-1：Media Session 进度 + `audioSession.type`。
- [x] P6a-2b：**不做**。用户决定先用普通的；不加 tone/echo 的额外分析。
- [x] P6b：**不做**。不下载/不分发 133MB 模型；保持无模型 fallback。

### 验收

- [x] 自动测试全绿。
- [x] `check` 全绿。
- [x] 用户 2026-11-17 真实试听确认当前版本没有听感问题。
- [x] Desktop 安装副本已同步。

### 下一步

本轮范围完成，没有待写代码。后续只有维护或重新开启模型/自动混音时才继续。

---

## 10. 变更控制

- 本文件是执行契约；范围/决策变化先改这里，再改代码。
- 每个阶段结束时更新“当前状态”和“下一步”。
- 分析报告可以继续补充细节，但不能覆盖本文件的锁定决策。
- 如果实现中发现某个“锁定决策”不可行，停下来写清楚原因、影响和替代方案，等确认后再动。
