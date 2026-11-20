# 平台增益与 automix profile 对齐计划

状态：在线平台增益已接入；automix profile 待接入。

目标：把 Folia 的 `platformDb` 与 `profile/head` 两类真实数据接入智能平衡；没有真实数据时保持 null，不伪造。

## 一、在线平台增益

Folia 在解析播放地址时保留平台返回的响度字段：

- 网易云 `data[0].gain`；
- 酷狗 `volume` / `volume_peak`；
- YTM `loudnessDb`；
- Navidrome OpenSubsonic `replayGain`。

进入平衡时：

```text
local / navidrome → tag（+4 dB）
online            → platformDb（不 +4）
```

本插件步骤：

1. 网易云 `getDownloadURL` 保留 `gain`；
2. 酷狗 `getDownloadURL` 保留 `volume` / `volume_peak`；
3. `providers.resolveStream` 统一返回 `replayGain`；
4. `/online/stream` 通过 `x-music-*-gain/peak` 响应头把增益交给客户端；
5. 客户端把响应头写入当前播放的 platform gain；
6. `balanceInputs.platformDb` 使用它，切歌时清空；
7. 测试字段解析和响应头。

缓存音频目前没有增益元数据，离线/缓存重播仍可能拿不到 platformDb；后续把增益写入媒体缓存元数据。

## 二、automix profile

Folia 的 profile 来自 `profileService.ts`：

- 只分析当前播放和下一首；
- 本地文件整曲读；
- Navidrome 只读头部；
- 在线只在缓存命中或允许下载时读；
- 22.05 kHz 解码，BS.1770 测 `programLoudness` / `peak`；
- 保存 `leadIn`、`partial`、`programIsWholeTrack`；
- 平衡读取存储 profile：无 balance record 时把整曲 `programLoudness` 当 `file`；
- 播放时整曲 profile 作为 `profile`，只测头部时作为 `head`。

本插件步骤：

1. 新增 profile 存储：`programLoudness`、`peak`、`leadIn`、`partial`、分析键；
2. 复用现有 22.05 kHz / Folia K-weighting 测量；
3. 只对当前/下一首调度，串行；
4. 优先本地文件、Navidrome 头部；在线只读已有缓存；
5. 平衡读取 profile：没有 file record 时作为 file；
6. `balanceInputs` 传 `profile` / `head`，整曲判定传 `leadIn`；
7. 清理 `music.profile.*` 存储并纳入数据清理；
8. 测试 profile 输入、leadIn、无数据 fallback。

## 验收

- 平台增益：NetEase/Kugou 返回真实字段时，客户端能拿到并进入 `platformDb`；
- profile：本地播放/下一首能产生整曲 profile；无缓存在线曲不偷下载；
- parity：相同输入下 chooseBalance 与 Folia 输出一致；
- 全量测试、check、安装。
