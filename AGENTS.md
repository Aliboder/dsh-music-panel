# AGENTS.md

`dsh-music-panel` — DeepSeek Harness（DSH）的本地音乐插件。Host 在 `index.js` / `src/host/**`（扫描、标签、歌词、路由、在线源、持久化），Client 在 `src/client/**`（面板、播放器、Folia 歌词舞台；Folia 源码在 `src/folia/**`）。

## 命令

```bash
npm test                                  # 全量 Node 测试
npm run check                             # 语法 + i18n key + client 同步
node scripts/build-client.mjs             # 改 src/client/** 后重建 client.js
node scripts/build-client.mjs --check     # 只检查 client.js 是否最新
node scripts/install-local.mjs desktop    # 把当前构建装进 DSH profile（验证前必做，装完完全退出再启动）
node scripts/build-audio.mjs              # 改 src/audio/** 或 Folia 音频上游后重建音频 bundle
node scripts/build-audio.mjs --check      # 只检查音频 bundle 是否最新


node scripts/build-lyrics.mjs             # 改 src/client/utils/lyrics/** 或 src/client/render/lyrics/entry.ts 后
node scripts/build-icu-folia.mjs          # 重新生成 icu-folia 词典（需要 A_other/upstream/folia-major-main 检出）
node scripts/build-pendolo.mjs            # 改 Folia 歌词样式 bundle 后
node scripts/build-backgrounds.mjs
node scripts/build-styles.mjs

node scripts/build-vendor.mjs             # 仅升级 framer 时
node scripts/build-vendor-three.mjs       # 仅升级 three 时
node scripts/build-vendor-pixi.mjs        # 仅升级 pixi 时
```

## 边界

✅ **总是**

- 改 `src/client/**` 后运行 `node scripts/build-client.mjs`，提交前跑 `--check`。
- 改 UI/Folia 后至少跑 `npm test` 和 `npm run check`。
- **新增或修改任何界面组件前，先读 `A_other/docs/theme-guidelines.md`。** 无特别说明时，组件实现一律按该文档执行：宿主组件优先 → 本仓原语 → 一次性布局；只用 `--dsw-*` token；浅/深色都要成立；不做假控件。若需求与该文档冲突，先说明冲突并确认，不要自行另起一套样式。
- **新增任何持久化/存储时，必须先读 `A_other/docs/data-reset.md`，同步扩充“清空插件所有数据”的范围、分类与测试。** 存储包括 Host 文件/目录、localStorage、IndexedDB、CacheStorage、内存缓存、远端 session；只加存储不更新清理视为未完成。
- Folia 音频用 0–255 频谱；暂停时停止更新 bands。
- **改播放/音频链路前先读 [音频引擎重建执行计划](A_other/docs/audio-engine-rebuild-plan.md)。** 不恢复旧播放图、旧增益公式或旧音频 UI；范围或决策变化先改计划文档，再改代码。
- 修改 Folia 源码前，先确认是边界问题还是上游问题，并在 `CHANGELOG.md` 说明。
- 使用真实状态和真实数据；未实现的功能要明确标注。
- 改 `client.js`、bundle、Folia 或歌词管线前，先查 `A_other/docs/pitfalls.md` 的对应条目；解决新坑后按「现象 → 原因 → 处理 → 防回归」当场补一条，简洁、只增不改，不要把结论只留在对话里。
- 每做完一步修改就打一个 git 存档点（`git commit`），message 写清这一步做了什么、为什么，回退时能直接找到；没验证过的改动不要攒进存档点。

⚠️ **先确认**

- 升级 React、framer、three、pixi 或 R3F。
- 修改 `src/client/vendor/**` 或 `src/folia/*.bundle.js`。
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
index.js, src/host/**        Host
src/client/**                Client fragments（由 src/client/manifest.json 定序，拼成 client.js）
  app/ i18n/ services/ stores/ components/ styles/ render/ vendor/ types/ utils/
src/folia/**                 Folia 源码、bundle、Tailwind
src/shared/types.ts          Host/Client 共享类型
scripts/                     构建
test/                        Node 测试
A_other/                    非插件资料（releases/design/docs/shared/upstream）
```

> 构建产物、播放/Folia、歌词、安装与数据相关的具体陷阱，全部记在
> [踩坑记录](A_other/docs/pitfalls.md)；改这些区域前先查对应条目，不要在这里重复维护。

## 参考

- [README](README.md)
- [主题与组件开发规范](A_other/docs/theme-guidelines.md)
- [数据清理实现说明](A_other/docs/data-reset.md)
- [平台架构](A_other/docs/provider-architecture.md)
- [Folia 移植说明](A_other/docs/folia-porting.md)
- [歌词获取与 Folia 对齐执行计划](A_other/docs/lyric-alignment-plan.md)
- [在线缓存向 Folia 对齐计划](A_other/docs/cache-alignment-plan.md)
- [音频引擎重建执行计划](A_other/docs/audio-engine-rebuild-plan.md)
- [踩坑记录](A_other/docs/pitfalls.md)
- [发布流程](A_other/docs/release.md)
- [CHANGELOG](CHANGELOG.md)
- [第三方与许可证](THIRD_PARTY_NOTICES.md)


