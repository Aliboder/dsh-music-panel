# 智能平衡与 Folia 全量对齐执行计划

状态：规则、记录、文件分析、播放集成、ReplayGain peak 与测试已完成；profile/head/platform 只在有真实数据时传入，未伪造。

目标：让本插件的「智能平衡」与 Folia 的 `volumeBalance` 使用同一套规则、测量、记录、播放中移动策略和文件分析口径；不是只对齐目标值。

## 现状结论

本地 [volume-balance.js](src/client/services/player/effects/volume-balance.js) 与 [balance-meter.js](src/client/services/player/effects/balance-meter.js) 是简化实现：

- 缺少 Folia 的 `profile`、`head`、`platform` 输入；
- typical 没有按歌曲去重；
- 本地文件记录只保存最终 gain，不保存 loudness/peak；
- 实时 meter 的完整 Folia 实现已经在 `src/client/audio/engine.bundle.js` 中，但播放器用的是另一套简化记录/判定；
- 播放中移动没有 `blendAudible` 的 hold；
- 整曲判定缺少 clip/lead-in；
- 文件分析使用 OfflineAudioContext 自定义路径，和 Folia 的 22.05 kHz 解码/同一套 K-weighting 不完全一致。

## 目标架构

```text
Folia MPAudio（engine.bundle.js）
  chooseBalance
  planBalanceMove
  whyNotWholePlay
  createBalanceMeter
        │
        ▼
player balance controller
  records: file / played / typical
  inputs: file, played, profile, tag, head, platform, live, typical
  one decision per play, one allowed move
        │
        ▼
gain node + UI hint
```

## 阶段

### 阶段 1：规则核心

- 优先调用 `MPAudio.chooseBalance` / `planBalanceMove` / `whyNotWholePlay`；
- 无音频 bundle 的测试环境保留纯 JS 回退；
- 删除本地简化顺序的独立决策逻辑，避免两份规则漂移。

### 阶段 2：记录模型

- `music.balance.v1` 从 `{songs:path->{loudness,peak}}` 升级为 `{songs:path->{file,played}, typical:[{key,gainDb}]}`；
- 兼容旧数据，旧单条记录迁移为 `played`；
- typical 按歌曲 key 去重，只保留最近 20 首；
- 文件测量写入 `file`，整曲播放写入 `played`。

### 阶段 3：文件分析

- 解码使用 22.05 kHz 分析率；
- 使用 Folia 的 K-weighting、400 ms/100 ms 分块、绝对/相对 gate；
- 输出 `loudness + peak`，不再缓存最终 gain；
- 文件读取前先用 record 的 file/played/tag/typical 决策。

### 阶段 4：播放集成

- 每次决策传入完整输入：
  `file, played, profile, tag, head, platformDb, live, typicalDb`；
- 播放开始前 set，播放中按 Folia 的 early/late/blend hold 规则最多移动一次；
- 文件测量完成后重新决策，而不是直接覆盖 gain；
- 整曲播放用 `whyNotWholePlay` 判定 clip/lead-in/seek/结尾；
- UI 的 dB 使用最终 applied gain，不显示未应用的建议值。

### 阶段 5：测试与验收

- 规则 parity 测试：相同输入和 Folia 规则输出一致；
- typical 去重测试；
- meter 可听步数/低通测试；
- 移动 hold / ramp 测试；
- 文件测量与 record 迁移测试；
- 全量 `pnpm test` / `npm run check`。

## 不能伪造的输入

Folia 的 `profile` 来自 automix 整曲 profile，`head` 来自文件头部估算；本插件没有 automix profile 链。对这类输入：

- 有真实数据才传；
- 没有就传 null，让 `chooseBalance` 按 Folia 的后备顺序继续；
- 不为“看起来一致”造假 profile/head。

因此“同一首歌、同一组真实输入”下可以保证算法一致；没有 profile/head 的来源仍会按 Folia 的 fallback 走，但不会凭空产生 Folia 没有的分析结果。
