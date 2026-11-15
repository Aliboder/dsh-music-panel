# 踩坑记录（Folia 背景 / 音频）

按「现象 → 原因 → 处理」记；遇到同类问题先查这里。新坑只增不改，保持简短。

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

- **原因**：`backgrounds.bundle.js` 是独立产物，`node scripts/build-client.mjs --check` 只校验
  `client.js` 的拼接，不会发现 bundle 过期。
- **处理**：改背景源码或 `vendor/paper-shaders*` 后，顺序固定为
  `node scripts/build-backgrounds.mjs` → `node scripts/build-client.mjs`。
  时计/样式同理：`build-pendolo.mjs` / `build-styles.mjs`。

## 3. bands 归一化成 0..1，背景完全静止

- **原因**：Folia 背景用 `useTransform(spring, [10, 200], [0.95, 1.45])`，输入必须保持 0–255；
  0..1 永远落在映射的第一档。
- **处理**：`process(v, boost) = (v / 255) ** boost * 255`，五条 band 与 `audioPower` 都输出 0–255
   （见 `src/render/styles/folia-audio.js`）。

## 4. 「鼓动很弱」不一定是带宽，可能是分析器 smoothing

- **原因**：插件旧 analyser `smoothingTimeConstant = 0.82`，Folia 是 **0.6**；额外平滑把鼓点抹圆。
- **处理**：`src/50-player.js` 改为 0.6。插件自己的频谱条会做峰值归一化，不会因此变噪。

## 5. 莫奈底部频谱条比 Folia 钝

- **原因**：没提供 `audioBands.spectrum`，`Monet AudioOverlay` 回退到五段 band 插值。
- **处理**：每帧 `new Uint8Array(wave)` 写入 `spectrum`。不要直接复用 analyser 的 buffer
  （下一帧会覆盖已经发给 MotionValue 的值）。

## 6. 暂停时背景仍缓慢变化

- Folia 的隐现暂停时是 `base × 0.12`，**不是 0**，观感是「几乎停住」。先确认第 1 条的 ref
  是否生效，再判断 12% 慢速是否符合预期。

## 7. 不是所有背景都吃音频

- 只有 **隐现（latent）** 与 **通用（common，几何图形）** 吃音频。莫奈/漫游/空/嵌入在上游就是
  封面或时间驱动，静止是设计如此，别当 bug 修。
- 「通用」的封面流体层本身不随音频；要流体+混合的扭曲形变请选「隐现 → 混合」。

## 8. 看到的还是旧背景（模糊封面 + 斜线）

- **原因**：旧 ambient 背景的封面回响层（`.mp-np-bg` 的 `is-echo`）还在运行中的旧 client 里；
  新播放页不再渲染它。
- **处理**：重启 DSH 或刷新页面；确认 `client.js` 是新的。

## 9. 没歌词时页面中央一直有「暂无歌词」

- 已移除两处占位（`src/ui/04-now-playing.js`、`src/ui/04-player-page.js`）及对应 CSS。
  `page.noLyrics` 的 i18n key 仍保留，暂未使用。
