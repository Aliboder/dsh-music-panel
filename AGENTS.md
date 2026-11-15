# AGENTS.md

`dsh-music-panel` — DeepSeek Harness（DSH）的本地音乐插件。Host 在 `index.js` / `lib/**`（扫描、标签、歌词、路由、在线源、持久化），Client 在 `src/**`（面板、播放器、Folia 歌词舞台）。

## 命令

```bash
npm test                                  # 全量 Node 测试
npm run check                             # 语法 + i18n key + client 同步
node scripts/build-client.mjs             # 改 src/** 后重建 client.js
node scripts/build-client.mjs --check     # 只检查 client.js 是否最新


node scripts/build-lyrics.mjs             # 改 src/utils/lyrics/** 或 src/render/lyrics/entry.ts 后
node scripts/build-pendolo.mjs            # 改 Folia 歌词样式 bundle 后
node scripts/build-backgrounds.mjs
node scripts/build-styles.mjs

node scripts/build-vendor.mjs             # 仅升级 framer 时
node scripts/build-vendor-three.mjs       # 仅升级 three 时
node scripts/build-vendor-pixi.mjs        # 仅升级 pixi 时
```

## 边界

✅ **总是**

- 改 `src/**` 后运行 `node scripts/build-client.mjs`，提交前跑 `--check`。
- 改 UI/Folia 后至少跑 `npm test` 和 `npm run check`。
- Folia 音频用 0–255 频谱；暂停时停止更新 bands。
- 修改 Folia 源码前，先确认是边界问题还是上游问题，并在 `CHANGELOG.md` 说明。
- 使用真实状态和真实数据；未实现的功能要明确标注。
- 每做完一步修改就打一个 git 存档点（`git commit`），message 写清这一步做了什么、为什么，回退时能直接找到；没验证过的改动不要攒进存档点。

⚠️ **先确认**

- 升级 React、framer、three、pixi 或 R3F。
- 修改 `src/vendor/**` 或 `src/render/folia/*.bundle.js`。
- 改变 Folia 样式注册、顺序、默认样式或迁移逻辑。
- 改音频输出/WebAudio 路由。

🚫 **不要**

- 直接编辑 `client.js`；它是拼接产物。
- 假设 Host 是 React 19；Host 固定 React 18.3.1，不要自带第二个 React 渲染宿主 slot。
- 重新引入已移除功能：`classic`、`cappella`（群唱）、`machi`（町景）、`scenes/cinema`（影厅）。
- 加假按钮、假数据或只改标签的“功能”。
- 把 Tailwind 的 `@property` 嵌进 `.mp-np`。
- 提交用户音乐、封面、歌词缓存或登录凭据。

## 架构

```text
index.js, lib/**             Host
src/                         Client fragments（拼成 client.js）
  vendor/                    React 18 shims、framer、three、pixi
  render/styles/             样式 stage 与 Folia 边界
  render/folia/              Folia 源码、bundle、Tailwind
  ui/                        面板、播放器、设置 sheet
  *.js                       prefs/player/i18n/theme
scripts/                     构建
test/                        Node 测试
docs/                        移植/架构说明
```

## 必须知道的坑

- `client.js` 是 `src/**` 拼接的 IIFE factory；所有 fragment 共享作用域，顶层声明必须唯一。`.bundle.js` 跳过重复扫描。
- Tailwind 有两份：`folia-tailwind.css` 是生成结果，`folia-tailwind.js` 才是 `client.js` 注入的字符串。只改 `.css` 会导致线上仍是旧样式。
- Folia 背景用 `useTransform(spring, [10,200], ...)`；频谱归一化到 0..1 会让背景完全静止。使用 FFT 2048、按 Hz 分段、`process(value, boost)` 输出 0–255。
- 暂停判断应看真实 `<audio>` 的 `paused/ended`，不要只信 snapshot；暂停时不要继续写 bands。
- Folia 资源 URL 需相对 `document.baseURI` 解析为绝对地址；Vite 的 `import.meta.glob` 不存在。
- Folia 的 paper-shaders 包装靠 React 19 的 ref-as-prop；宿主固定 React 18.3.1，必须用 vendored 的 `forwardRef` 包装（否则背景无鼓动、暂停不停）。详见 [docs/pitfalls.md](docs/pitfalls.md)。
- 改背景/样式源码或 `src/render/folia/vendor/**` 后，先重建对应 bundle（`build-backgrounds` / `build-pendolo` / `build-styles`），再 `build-client`；`client.js --check` 不会发现 bundle 过期。
- `VisualizerShell` 必须 `forwardRef` 转发容器 ref，否则心象的 ResizeObserver 拿不到尺寸。
- 已移除功能对应的偏好要迁移到 `monet`；新增迁移保持同样行为。

## 参考

- [README](README.md)
- [Folia 移植说明](docs/folia-porting.md)
- [踩坑记录](docs/pitfalls.md)
- [CHANGELOG](CHANGELOG.md)
- [第三方与许可证](THIRD_PARTY_NOTICES.md)