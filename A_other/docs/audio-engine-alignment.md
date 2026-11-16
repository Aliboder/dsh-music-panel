# 播放引擎与 Folia 的差异报告与对齐方案

状态：**历史分析**。本报告写于改造前；P0/P1 的播放链路问题已在 [audio-engine-rebuild-plan.md](audio-engine-rebuild-plan.md) 的 P4/P5/P7 中修复。P6b 的模型/分轨按用户 2026-11-17 的决定不做。

基线：`dsh-music-panel` 0.36.0，分支 `refactor/structure`。

对照：`A_other/upstream/folia-major-main`（Folia 0.7.28）。

---

## 0. 一句话结论

**可视化用的音频分析已经对齐了，播放引擎没有。**

`src/client/render/styles/folia-audio.js` 的 FFT、smoothing、21.5 Hz 分段、五条 band、`power` 曲线、`spectrum` 拷贝都与上游一致；但底层播放链路仍是插件自己的简化实现：双 deck 的增益归属、音量位置、限幅器、EQ 形状、播放淡入淡出和音量平衡表都与 Folia 不同。

其中有 **4 个实际正确性问题**，不是“风格差异”：

1. 过渡入轨的响度目标用错：正常轨是 **-14 LUFS**，crossfade 入轨用 **-16 LUFS**，且丢失 ReplayGain 标签增益。
2. 音量平衡表在 crossfade 换 deck 后仍绑在旧 `<audio>` 上，并且两个 deck 的 `timeupdate` 都会 tick 同一个表。
3. 主音量写在 `<audio>.volume` 上，图里的 `gainNode` 始终是 1；限幅器却一直在链路里，音量与限幅/EQ 的相对关系不可控。
4. 暂停/播放是硬切，没有 Folia 的 0.2 s 淡出/淡入与 150 ms drain；接上 Web Audio 后更容易听到 click/pop。

---

## 1. 对照范围

| 层 | Folia | 当前插件 |
|---|---|---|
| 播放源 | `songAudioSource.ts`、`onlinePlayback.ts`、媒体缓存、预取、恢复 | `player.load()` 整文件 fetch 成 Blob；在线有 Host 缓存和下一首预取 |
| 双 deck / 过渡 | `useAutomixDecks.ts`、`automixSession.ts`、`crossfadeGraph.ts` | `player.js` 内 `audio` / `audioB` 两 deck，`effects/crossfade.js` 决定重叠 |
| 主图 | `playbackGraph.ts` | `player.ensureAnalyser()` 内联建图 |
| 每 deck 增益 | `replayGain` + `trim` + `tone` + `fade` 四段 | 一个 `trim` 兼任响度/标签增益；crossfade 另有一个 `trimB` |
| 音量 | 图内 `gainNode`，在 effects 之后 | `<audio>.volume`，图内 `gainNode` 恒为 1 |
| 限幅 | 正常链路没有限幅；只有 stem 过渡的 soft limiter | 正常链路常驻 `DynamicsCompressor` |
| EQ | 10 段，首段 lowshelf、末段 highshelf，Q=1.4 | 10 段全 peaking，Q=1.41，另有 preamp + 自动 headroom |
| 音效 | `audioEffects` 完整链（滤波、饱和、bit crush、wow、黑胶噪声、宽度、压缩、混响） | 无 |
| 播放淡入淡出 | `playbackFade.ts`，默认开 | 无 |
| 分析器 | 共享图末端 `fftSize=2048`、`smoothing=0.6` | 相同参数，但前面多了 limiter |
| 音量平衡 | 每 deck 一个 BS.1770 表，25 ms tick，检测 seek/gap/wrap | 单表，`timeupdate` tick，无 per-deck |
| 输出 | `AudioContext.setSinkId`、`audioSession.type='playback'` | 默认输出，无 sink，无 audioSession |
| Media Session | 元数据 + `setPositionState` | 元数据 + playbackState，无 position |
| 错误恢复 | 媒体缓存、转码回退、stall 检查、源 revision | 简单 errorStreak 跳过 |

---

## 2. 两条链路

### 2.1 当前插件

```text
<audio A> ──► fade ──► trim ──► preamp ──┐
                                          ├──► EQ10(全 peaking) ──► limiter ──► gain(1.0) ──► analyser ──► destination
<audio B> ──► fadeB ─► trimB ─► preamp ──┘
                                          （B 只在 crossfade 时接入）

音量/静音：<audio>.volume / <audio>.muted
```

对应代码：

- `ensureAnalyser()`：[src/client/services/player/player.js](../../src/client/services/player/player.js#L1615)
- EQ 节点：[player.js#L761](../../src/client/services/player/player.js#L761)
- limiter：[player.js#L1626](../../src/client/services/player/player.js#L1626)
- analyser：[player.js#L1633](../../src/client/services/player/player.js#L1633)
- 音量：[player.js#L2078](../../src/client/services/player/player.js#L2078)
- 静音：[player.js#L2085](../../src/client/services/player/player.js#L2085)

### 2.2 Folia

```text
<audio A> ──► replayGain ──► trim ──► tone(low/mid/high) ──► fade ──┐
                                                                      ├──► mix ──► EQ10 ──► effects ──► playbackFade ──► [room] ──► volume ──► analyser ──► out
<audio B> ──► replayGain ──► trim ──► tone(low/mid/high) ──► fade ──┘
```

对应代码：

- 图顺序：[playbackGraph.ts#L48](../upstream/folia-major-main/src/services/playbackGraph.ts#L48)–[L101](../upstream/folia-major-main/src/services/playbackGraph.ts#L101)
- 每 deck 链：[crossfadeGraph.ts#L103](../upstream/folia-major-main/src/services/automix/crossfadeGraph.ts#L103)
- 过渡曲线：[crossfadeGraph.ts#L626](../upstream/folia-major-main/src/services/automix/crossfadeGraph.ts#L626)
- 播放淡入淡出：[playbackFade.ts#L18](../upstream/folia-major-main/src/services/playbackFade.ts#L18)
- EQ 形状：[audioEqualizerGraph.ts#L28](../upstream/folia-major-main/src/services/audioEqualizerGraph.ts#L28)

关键差别不只是“少了几个节点”，而是**谁拥有哪个增益**：

- Folia 的 `replayGain` 归每首曲目的响度/标签增益，`trim` 归过渡期间的平衡修正，`fade` 归交叉淡化，`volume` 归用户音量。四者分开，互不覆盖。
- 当前插件把响度、ReplayGain、过渡补偿都压进 `trim` / `trimB`，而 `volume` 又跑到图外，所以一旦 crossfade 或用户改音量，几个控制权会互相干扰。

### 2.3 已经对齐的部分

| 项 | 状态 |
|---|---|
| 分析器 FFT 大小 | ✅ `fftSize=2048`，与上游一致 |
| 分析器 smoothing | ✅ `0.6`，与上游一致 |
| 频段换算 | ✅ 固定 `21.5 Hz/bin`，与上游一致 |
| 五条 band + `audioPower` | ✅ 同样的 Hz 范围、boost 曲线、0–255 输出 |
| `spectrum` | ✅ 每帧 `new Uint8Array(wave)` 拷贝，避免 MotionValue 被下一帧覆盖 |
| 暂停时停止写 bands | ✅ 由 `foliaAudioBands()` 返回 null 实现，调用方保留最后一帧 |
| 双 deck 交叉淡化 | ✅ 存在，且是等功率曲线；只是增益归属和过渡决策比 Folia 简化 |
| 10 段 EQ | ✅ 频点与上游相同（31–16k） |
| Media Session 元数据/按键 | ✅ 有 title/artist/cover 和 play/pause/prev/next/seekto |

这些不要回退；下面的对齐是在此基础上改播放链，不是重做可视化音频桥。

---

## 3. 差异清单

### P0 — 正确性问题

| # | 项 | Folia | 当前插件 | 影响 |
|---|---|---|---|---|
| P0-1 | 过渡入轨目标响度 | 与正常播放共用同一套 balance 规则，目标 **-14 LUFS** | 自动响度开启时，crossfade 入轨用 `LOUDNESS_TARGET = -16`；标签模式下入轨不乘 ReplayGain 标签增益 | 自动响度下，同响度的两首歌入轨比正常播放轻 **2 dB**；带 ReplayGain 标签的曲目在过渡时标签增益丢失，接管后可能突然变响/变轻 |
| P0-2 | 音量平衡表归属 | 每个 deck 一个 meter，按 deck 生命周期 reset | 一个 meter 绑在创建时的 `audio` 上；`onTime` 对两个 deck 都调用 `balanceMeter.tick()`；`swapDecks()` 后没有迁移/重建 | crossfade 后 meter 继续读旧 deck；两个 deck 的 timeupdate 重复喂同一个表；`liveLoudness()`、`play()`、整曲读数都会错，进而污染“智能平衡”的记录 |
| P0-3 | 音量与限幅位置 | 音量在图内、effects 之后；正常链路无 limiter | 音量在 `<audio>.volume`；图内 `gainNode` 恒为 1；limiter 常驻 | 音量与 limiter/EQ 的相对关系不可控；关掉 EQ 后信号仍经过 limiter，不是透明链路；大音量/大 EQ 提升时 limiter 会压动态 |
| P0-4 | 暂停/播放 | 0.2 s 淡出，暂停后 drain 150 ms，再淡入 | 直接 `audio.pause()` / `audio.play()` | Web Audio 图上容易听到 click/pop；暂停会硬切尾音；恢复时首帧直接满音量 |

#### P0-1 细节

正常播放的平衡决策在 `chooseBalance()`，目标是 `VOLUME_BALANCE_TARGET_DB = -14`：

- [volume-balance.js#L9](../../src/client/services/player/effects/volume-balance.js#L9)
- [volume-balance.js#L45](../../src/client/services/player/effects/volume-balance.js#L45)

crossfade 入轨却绕开了这套决策：

- 自动响度模式：`LOUDNESS_TARGET = -16`（[loudness.js#L10](../../src/client/services/player/effects/loudness.js#L10)），用 `LOUDNESS_TARGET - lufs` 算增益（[player.js#L1219](../../src/client/services/player/player.js#L1219)），再写 `normalizeGainB = prepared.trim`（[player.js#L1338](../../src/client/services/player/player.js#L1338)）。
- 标签模式：`wantTrim = normalizeVolume !== false` 为 false，`prepared.trim` 直接是 1，入轨完全不带 `replayGainFactor`。

而 `setReplayGain()` 只写当前 deck 的 `trimNode`：

- [player.js#L2001](../../src/client/services/player/player.js#L2001)

所以过渡入轨既没有 -14 目标，也没有标签增益。这不是“听感偏好”，是两条路径用了两套数字。

#### P0-2 细节

- meter 创建时绑定 `audio`：[player.js#L1660](../../src/client/services/player/player.js#L1660)
- `onTime` 在 active 判断之前就 tick：[player.js#L519](../../src/client/services/player/player.js#L519)
- `swapDecks()` 只交换元素/节点/URL/增益，不交换 meter：[player.js#L1401](../../src/client/services/player/player.js#L1401)
- `createBalanceMeter()` 内部用传入的 `audio` 读 `currentTime`：[balance-meter.js#L161](../../src/client/services/player/effects/balance-meter.js#L161)

结果：crossfade 期间 B 的 `timeupdate` 会 tick 一个绑在 A 上的表；crossfade 结束后 `audio` 已经是 B，表还是 A。`onEnded()` 也在 active 判断之前 commit 读数（[player.js#L593](../../src/client/services/player/player.js#L593)），旧 deck 结束时可能把读数记到当前曲目上。智能平衡的“整曲播放后学习”和“播放中修正”都建立在这个表上。

#### P0-3 细节

- `effectiveVolume()` / `applyOutputVolume()` 写的是元素音量：[player.js#L703](../../src/client/services/player/player.js#L703)
- 图里的 `gainNode` 只被创建和连接，没有音量写入：[player.js#L1632](../../src/client/services/player/player.js#L1632)
- limiter 固定 `threshold=-1.5`、`ratio=20`、`attack=0.003`、`release=0.15`：[player.js#L1626](../../src/client/services/player/player.js#L1626)

Folia 把 `gainNode` 明确放在 effects 之后，并注明原因（黑胶噪声、bit crush、punch 都是绝对量，前置音量会改变它们的行为）：

- [playbackGraph.ts#L61](../upstream/folia-major-main/src/services/playbackGraph.ts#L61)–[L100](../upstream/folia-major-main/src/services/playbackGraph.ts#L100)

当前插件没有这些效果，但同样的问题存在于 limiter：limiter 是绝对阈值，放在音量前/后、以及用户音量是否进入它，会改变它对动态的处理。现在这条关系没有定义。

### P1 — 听感/行为差异

| # | 项 | Folia | 当前插件 | 影响 |
|---|---|---|---|---|
| P1-1 | EQ 首末段形状 | 首段 lowshelf、末段 highshelf，中间 peaking，Q=1.4 | 10 段全部 peaking，Q=1.41 | 31 Hz 与 16 kHz 的搁架斜率不同；极端频段提升/衰减的听感与 Folia 不一致 |
| P1-2 | EQ 总增益 | 只有 10 个 filter，无 preamp、无自动 headroom | preamp + 自动 headroom（最多 -6 dB）+ limiter | 同一组 fader 在本插件更轻；用户看到的曲线包含 headroom，和上游不是同一条曲线 |
| P1-3 | 音效链 | 滤波、饱和、bit crush、wow、黑胶噪声、立体声宽度、punch、混响 | 无 | 这是功能缺口，不是 bug；但“向 Folia 对齐”如果包含音效，需要新增 UI 和存储 |
| P1-4 | 过渡形状 | 每 deck 三段 tone（low/mid/high）+ 可选 echo throw + 可配置 crossover/together | 只有等功率曲线；入轨只在最后 2.5 s 升起 | 当前过渡更简单，遇到底鼓/贝斯重叠时容易“糊”；没有 echo throw 的“切断”感 |
| P1-5 | 静音开头跳过 | 按 `introSilentSec` 跳过真正静音的开头 | `crossfadePlan()` 读 `next.introSilentSec`，但 `prepareCrossfade()` 只传 `introQuietSec` | 代码里的“跳过静音开头”实际永远不会触发；静音 intro 仍然从头播放 |
| P1-6 | 播放淡入淡出 | 0.2 s，暂停后 drain 150 ms，代际 token 防竞态 | 无 | 与 P0-4 同一问题，单列为行为差异 |
| P1-7 | Media Session 进度 | `setPositionState`，系统面板有进度 | 只设 metadata / playbackState | Windows 媒体面板/锁屏的进度条不更新或不准 |
| P1-8 | 输出设备 | `AudioContext.setSinkId` 恢复保存的设备 | 只有系统默认输出 | 不能选输出设备；切换设备后上下文仍在默认设备 |
| P1-9 | 分析器前级 | 共享图末端，前面是 effects + volume | 前面是 limiter + 恒 1 的 gain | 频谱会被 limiter 压过；Folia 的频谱是“实际听到的信号”去掉 limiter 后的结果 |

#### P1-5 细节

`crossfadePlan()` 期望：

```js
var silentIntro = Number(next && next.introSilentSec)
```

见 [crossfade.js#L73](../../src/client/services/player/effects/crossfade.js#L73)。

调用方只传了：

```js
{ introQuietSec: incoming.envelope ? incoming.envelope.introQuietSec : 0 }
```

见 [player.js#L1270](../../src/client/services/player/player.js#L1270)。

所以 `silentIntro` 恒为 0，`startInNext` 恒为 0。这个功能目前是死代码。

### P2 — 策略/平台差异

| # | 项 | Folia | 当前插件 | 影响 |
|---|---|---|---|---|
| P2-1 | 音源获取 | 本地 Blob；在线优先缓存/预取，直链可用；有源 revision 和恢复 | 本地/在线都整文件 fetch 成 Blob；在线有 Host 缓存和下一首预取 | 大文件首播内存峰值和等待时间更高；换来桌面端可靠的 seek |
| P2-2 | 错误恢复 | 媒体缓存校验、转码回退、stall 检查、跳过策略 | `errorStreak > 3` 或队列只剩一首就停 | 网络抖动/坏源时恢复能力弱 |
| P2-3 | 音频会话类型 | `navigator.audioSession.type = 'playback'` | 未设置 | 移动端/部分桌面音频会话行为不同；桌面影响小 |
| P2-4 | 自动混音 | 节拍、分轨、tone、echo、stem gesture、智能过渡 | 只有首尾响度包络 | 不是本轮能“搬代码”对齐的量级；需要模型和大量状态机 |

---

## 4. 对用户的实际影响

按用户能感知的顺序：

1. **过渡时音量会跳。** 同响度曲目入轨轻 2 dB；带 ReplayGain 标签的曲目在过渡时标签增益消失，接管后可能突然变响。
2. **智能平衡越用越不准。** crossfade 后 meter 读错 deck，整曲读数会被记到错误的歌上；下一首的“典型增益”也会被污染。
3. **EQ 开大时动态被压。** limiter 常驻，用户调低音量也不能让它退出；关 EQ 也不是透明链路。
4. **暂停/播放有硬切感。** 接上 Web Audio 后更明显，尤其是暂停在鼓点/尾音上。
5. **EQ 的 31 Hz / 16 kHz 与 Folia 不同。** 同一组 fader 听起来不一样。
6. **系统媒体面板没有进度。** Windows 锁屏/媒体浮层只显示歌名，不显示位置。
7. **过渡层次少。** 没有 tone/echo，贝斯重叠时更容易糊；这不是错误，但和 Folia 的自动混音不是一个东西。

---

## 5. 对齐方案

### 5.1 原则

1. **对齐“处理链和增益归属”，不照搬 Folia 的 React/automix 状态机。**
2. **不改现有 UI、预设库、设置项。** 音效链、输出设备选择、自动混音如果要做，单独排期。
3. **先修 P0，再谈音色。** 先让两条路径用同一套增益和目标，再改 EQ/limiter。
4. **每一步可回退、可测试。** 先加纯函数和 fake AudioContext 测试，再替换 `player.js` 的建图。

### 5.2 目标链路

第一阶段的目标不是一次做到 Folia 的全部节点，而是先把“谁拥有哪个增益”摆正：

```text
<audio A> ──► replayGainA ──► trimA ──► toneA(flat) ──► fadeA ──┐
                                                                  ├──► mix ──► EQ10 ──► masterGain ──► analyser ──► out
<audio B> ──► replayGainB ──► trimB ──► toneB(flat) ──► fadeB ──┘
```

- `replayGain`：每首歌的响度/标签增益，由 balance 决策写入。
- `trim`：过渡期间的平衡修正，平时为 1。
- `tone`：先建三段 flat（0 dB），为后续 tone/echo 留位置；没有 UI 时不改变声音。
- `fade`：交叉淡化曲线，只由 crossfade 写入。
- `mix`：两 deck 汇合点。
- `EQ10`：共享，只建一次。
- `masterGain`：用户音量/静音，放在 EQ 之后、analyser 之前。
- `analyser`：末端，画的是实际输出。

limiter 第一版**先移除**；如果实测大 EQ 提升会削波，再讨论是否加“只在输出超过 0 dBFS 时工作的 soft limiter”，而不是现在的常驻压缩器。

### 5.3 分阶段

#### 阶段 1：主图与音量（P0-3）

改动：

- 新增 `src/client/services/player/audio-graph.js`：
  - `buildPlaybackGraph(context, { connectDecks, eqSettings, volume, muted })`
  - 返回 `{ mix, eqNodes, masterGain, analyser, deckChains }`
- `player.ensureAnalyser()` 改为调用它，不再内联建图。
- `setVolume` / `setMuted` 写 `masterGain.gain`，不再写 `<audio>.volume`（图存在时把元素音量固定为 1）。
- 移除 `limiterNode` 和 `DynamicsCompressor`。
- 每 deck 建 `replayGain` / `trim` / `tone` / `fade` 四个节点，但阶段 1 只把现有 `normalizeGain` 写进 `trim`，`replayGain` 先置 1；阶段 2 再把响度/标签增益迁到 `replayGain`，避免一步改两件事。
- `attachAudio()` 重建图时同时重建两个 deck 链，保持幂等；`createMediaElementSource` 每个元素只能调用一次，旧 context 关闭后旧 source 不再复用。

测试：

- fake AudioContext 断言连接顺序：`deck → replayGain → trim → tone → fade → mix → EQ → masterGain → analyser → destination`。
- 断言 `setVolume(0.5)` 只改 `masterGain.gain`，不改 `<audio>.volume`。
- 断言 limiter 不存在。
- `node --run test`、`node --run check`。

验收：

- 播放本地/在线各一首，调音量、静音、开 EQ，声音连续，无突然变轻/变响。
- 关 EQ 时与未建图前的响度一致（同一首歌 A/B）。

#### 阶段 2：每 deck 增益与平衡表（P0-1、P0-2）

改动：

- 每 deck 一个 `balanceMeter`；把阶段 1 留在 `trim` 里的响度/标签增益迁到 `replayGain`，`trim` 只留过渡修正。
- `prepareCrossfade()` 对入轨调用与正常播放相同的 `chooseBalance()`，把结果写 `replayGainB`；不再用 `LOUDNESS_TARGET -16`。
- `normalizeGainB` 删除；入轨增益 = `chooseBalance().effectiveGainDb`，与 active deck 同源。
- `swapDecks()` 同时交换 `replayGain` / `trim` / `fade` / meter 的“当前 deck”引用。
- `onTime` 只 tick 当前事件所属 deck 的 meter；`isActiveEvent` 判断提前到 tick 之前。
- crossfade 期间两个 meter 都 tick（和 Folia 一样），但读数只归各自 deck；settle 后旧 deck 的 meter 停止。
- `commitBalanceReading()` 使用当前 deck 的 meter；整曲读数只写当前曲目。

测试：

- 同一首曲目，正常播放和作为 crossfade 入轨时 `effectiveGainDb` 相同。
- 有 ReplayGain 标签时，入轨 `replayGain` 包含标签增益。
- `swapDecks()` 后 meter 跟随新 deck；旧 deck 的 `timeupdate` 不再写入当前读数。
- 目标响度断言为 `-14`，不是 `-16`。

验收：

- 同一首歌分别用“直接播放”和“作为下一首过渡进来”两种方式听，接管瞬间无音量跳变。
- 过渡后打开“音频增益”提示，读数对应新曲目。

#### 阶段 3：播放淡入淡出（P0-4）

改动：

- 新增 `src/client/services/player/playback-fade.js`，按 Folia `playbackFade.ts` 的语义移植：
  - `fadeOutThen(action)`：0.2 s 降到 0，再执行 pause；pause 后 150 ms 把节点恢复到 1。
  - `prepareFadeIn()` / `runFadeIn()`：play 前先置 0，play 成功后 0.2 s 升起。
  - 代际 token：resume、第二次 pause、换歌都会让 pending pause 失效。
  - `flush()`：换歌时把 pending pause 立即执行，避免旧歌在图里以满音量继续。
- `pause()`、`play()`、`load()`、`next()`、`prev()`、`seek()` 接入。
- crossfade 期间不执行普通 fade-in（交叉曲线已经接管）。
- 无 Web Audio 图时退回原来的直接 pause/play。

测试：

- 纯控制器测试：fade out 时长、pause 调用时机、drain 恢复、cancel、flush、token 失效。
- 断言换歌不会把旧歌的 pending pause 落到新歌上。

验收：

- 在鼓点/尾音上暂停、恢复、连续切歌，无 click/pop。
- 暂停后立刻播放，不出现“先满音量再淡入”。

#### 阶段 4：EQ 形状与透明链路（P1-1、P1-2、P1-9）

改动：

- `buildEqNodes()` 改为：
  - 第 1 段 `lowshelf`，最后一段 `highshelf`，中间 `peaking`。
  - Q 使用 `1.4`（与 Folia 一致）。
- 保留现有 `preamp` / 自动 headroom（这是插件已有 UI 和文案），但明确它是**插件扩展**，不是 Folia 的 EQ。
- 如果要求严格逐样本一致，再去掉 headroom 和 preamp；那会改变现有 UI 文案，需要单独确认。
- `analyser` 保持在 `masterGain` 之后；频谱不再经过 limiter。

测试：

- 断言 10 个 filter 的 `type` 顺序。
- 断言 Q=1.4。
- 断言 analyser 在 masterGain 之后。
- 现有 EQ 曲线测试更新（首末段响应会变）。

验收：

- 31 Hz / 16 kHz 极端 fader 的听感与 Folia 同预设接近；中频不变。
- 关 EQ 时链路透明（无 limiter、无额外增益）。

#### 阶段 5：Media Session 与平台小项（P1-7、P1-8、P2-3）

改动：

- `syncMediaSession()` 增加 `navigator.mediaSession.setPositionState({ duration, position, playbackRate })`，在 `timeupdate`、`durationchange`、play/pause 时更新；没有 duration 时清空。
- `ensureAnalyser()` 创建 context 前设置 `navigator.audioSession.type = 'playback'`（存在时）。
- 输出设备：如果 DSH Web/Desktop 的 `AudioContext.setSinkId` 可用，再单独做设置项；没有 UI 前不承诺。
- 这些不涉及音质，放在音质对齐之后。

测试：

- fake mediaSession 断言 position state 的 duration/position。
- 无 duration 时不抛错。

#### 阶段 6（可选）：过渡音色与 echo

只有确认“过渡也要像 Folia 的自动混音”时才做：

- 每 deck 加 `tone` 三段（low shelf / mid bell / high shelf），flat 时透明。
- 加 echo throw（send/delay/feedback），默认关闭；在 crossfade 的 cut 点打开。
- 先不做 beat grid、stems、automix 规划；这些需要模型和大量状态机，不属于“搬代码”。

如果只要求“不要糊”，做到 tone 三段即可；echo 是风格，不是正确性。

---

## 6. 不建议本轮对齐的部分

| 项 | 原因 |
|---|---|
| Folia 的 automix/节拍/分轨 | 依赖 beat_this、htdemucs、GPU/CPU 调度和大量状态机；不是播放链路的“搬代码” |
| HiFi / mpv 路由 | 插件没有主进程 mpv 和信号路径，属于另一套运行时 |
| 外部播放器路由 | 插件没有平台播放器接管 |
| 音频输出设备选择 | 需要 DSH 提供 `setSinkId` 能力和 UI；没有 UI 前只做能力探测 |
| 音效链完整 UI | 会新增大量控件、预设、存储和 i18n；和“界面不变”冲突 |
| 整文件 Blob 改直链 | 桌面端已知 `currentTime` 写入在 HTTP 流上不可靠；Blob 是为 seek 可靠性做的取舍，先保留 |

---

## 7. 验收总表

每个阶段都要过：

- `node --run test` 全绿。
- `node --run check` 全绿（语法 + i18n + `client.js` 同步）。
- `node scripts/build-client.mjs` 后 `client.js` 是最新。
- 手工听感：
  - 本地 FLAC / 在线缓存曲各一首。
  - 直接播放、crossfade 进入、暂停/恢复、seek、连续切歌。
  - EQ 关闭/开启、极端 fader、preamp。
  - Folia 可视化（至少 latent/common + monet 频谱）仍随音乐动，暂停停。
- 不触碰用户音乐文件、DSH 会话/设置、其他插件。

---

## 8. 需要确认的取舍

1. **EQ 的 preamp/headroom 是否保留？**
   - 保留：现有 UI/文案不变，但与 Folia 不是逐样本一致。
   - 去掉：更接近 Folia，但提升段可能削波，且要改 `eq.preamp` 文案。
2. **播放淡入淡出是否默认开？**
   - 默认开：和 Folia 一致，听感更好；没有 UI 开关。
   - 加设置项：多一个 UI 和存储，超出本轮“不改界面”。
3. **过渡只修增益，还是加 tone/echo？**
   - 只修增益：解决音量跳和糊，改动小。
   - 加 tone/echo：更接近 Folia 的过渡质感，但需要新的过渡参数和测试。
4. **音源是否继续整文件 Blob？**
   - 继续：seek 可靠，内存峰值高。
   - 改直链：首播快、内存低，但要复测桌面 seek 的已知问题。

---

## 9. 代码地图

| 关注点 | 当前 | Folia 对照 |
|---|---|---|
| 建图 | [player.js#L1615](../../src/client/services/player/player.js#L1615) | [playbackGraph.ts](../upstream/folia-major-main/src/services/playbackGraph.ts) |
| 每 deck 链 | [player.js#L1098](../../src/client/services/player/player.js#L1098) | [crossfadeGraph.ts#L103](../upstream/folia-major-main/src/services/automix/crossfadeGraph.ts#L103) |
| 过渡决策 | [crossfade.js](../../src/client/services/player/effects/crossfade.js) | [transitionPlanner.ts](../upstream/folia-major-main/src/services/automix/transitionPlanner.ts) |
| 过渡分析 | [transition.js](../../src/client/services/player/effects/transition.js) | [deckAnalyser.ts](../upstream/folia-major-main/src/services/automix/deckAnalyser.ts) |
| 响度 | [loudness.js](../../src/client/services/player/effects/loudness.js) | [trackAudio.ts](../upstream/folia-major-main/src/services/analysis/trackAudio.ts) |
| 平衡规则 | [volume-balance.js](../../src/client/services/player/effects/volume-balance.js) | [balanceRules.ts](../upstream/folia-major-main/src/services/volumeBalance/balanceRules.ts) |
| 平衡表 | [balance-meter.js](../../src/client/services/player/effects/balance-meter.js) | [balanceMeter.ts](../upstream/folia-major-main/src/services/volumeBalance/balanceMeter.ts) |
| EQ | [eq.js](../../src/client/services/player/effects/eq.js) | [audioEqualizerGraph.ts](../upstream/folia-major-main/src/services/audioEqualizerGraph.ts) |
| 音效 | 无 | [effectChain.ts](../upstream/folia-major-main/src/services/audioEffects/effectChain.ts) |
| 播放淡入淡出 | 无 | [playbackFade.ts](../upstream/folia-major-main/src/services/playbackFade.ts) |
| 可视化音频桥 | [folia-audio.js](../../src/client/render/styles/folia-audio.js) | [usePlaybackVisualizerBridge.ts](../upstream/folia-major-main/src/components/app/playback/bridges/usePlaybackVisualizerBridge.ts) |

---

## 10. 建议执行顺序

```text
阶段 1  主图 + 音量 + 移除 limiter        ← 先修结构，不改音色
阶段 2  每 deck 增益 + balance meter      ← 修 -16/-14 和换 deck 读错
阶段 3  播放淡入淡出                      ← 修 click/pop
阶段 4  EQ 形状 + 透明链路                ← 修音色差异
阶段 5  Media Session / audioSession      ← 平台小项
阶段 6  tone/echo（可选）                 ← 过渡质感
```

阶段 1–3 是“正确性对齐”，不建议跳过；阶段 4 会改变现有 EQ 听感，需要你确认是否接受；阶段 6 是风格增强，不是修 bug。
