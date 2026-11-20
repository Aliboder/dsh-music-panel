# AGENTS.md

`dsh-music-panel` — DeepSeek Harness（DSH）的本地 + 在线音乐插件。

**AGENT的任务**：帮助开发者维护、修复、更新这个插件。

## 边界

✅ **总是做**

- **分析、修复问题一律采用第一性原理的思想**，第一性原理是：把问题拆到最小、可验证的事实，从这些事实推导原因，而不是从惯例、符号或猜测出发。
- **新增或修改任何界面组件前，先读 `A_other/docs/theme-guidelines.md`。**
- **新增任何持久化/存储时**，必须先读 `A_other/docs/data-reset.md`，同步扩充“清空插件所有数据”的范围、分类与测试。
- **每做完一步修改就打一个 git 存档点**（`git commit`），message 中文写清这一步做了什么，回退时能直接找到；没验证过的改动不要攒进存档点。
- **做完修改后最终给用户的回答：**简要修改流程“A→B→C...、通俗易懂的简要说明(问题、思路、做法、收益)、(若有)受影响的文档修改清单和变更内容简介”

🚫 **不要做**

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

两侧分工：

- **Host**（`index.js` / `src/host/**`）：扫描、标签、歌词、路由、在线源、持久化。
- **Client**（`src/client/**`）：面板、播放器、Folia 歌词舞台；Folia 源码在 `src/folia/**`。

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
