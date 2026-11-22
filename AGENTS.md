# AGENTS.md

`dsh-music-panel` — DeepSeek Harness（DSH）的本地 + 在线音乐插件。

**AGENT的任务**：帮助开发者维护、修复、更新这个插件。

参考Folia的源代码（只读勿改）：dsh-music/A_other/upstream/folia-major-main

## 边界

✅ **总是做**

- **分析、修复问题一律采用第一性原理的思想**，第一性原理是：把问题拆到最小、可验证的事实，从这些事实推导原因，而不是从惯例、符号或猜测出发。
- **新增或修改任何界面组件前，先加载并使用 skill `dsh-component-development`**（项目内已安装于 `.dsh/skills/`；完整规范见 `A_other/组件开发规范/`）。
- **新增任何持久化/存储时**，同步扩充“清空插件所有数据”的范围、分类与测试：Host 文件/目录、localStorage、IndexedDB、CacheStorage、内存缓存、远端 session 都算；只加存储不更新清理视为未完成。
- **文档命名一律用中文**：新建或改名的说明文档都用中文文件名（如 `踩坑记录.md`、`发布手册.md`），路径里也不夹带英文标题。例外只有平台约定的 `README.md` / `CHANGELOG.md` / `AGENTS.md` / `LICENSE` / `THIRD_PARTY_NOTICES.md`，以及 `vendor/`、`official/` 这类上游镜像。
- **每做完一步修改就打一个 git 存档点**（`git commit`），message 中文写清这一步做了什么，回退时能直接找到；没验证过的改动不要攒进存档点。
- **最终给用户的回答：**简要修改流程 代码块“段A→段B→段C...、通俗易懂的简要说明（问题、思路、做法、收益）、(若有)受影响的文档修改清单和变更内容简介（代码块）、存档点代码块（axxbxx：优化了...）”
- 相关文档描述内容实际发生变更时，要更新文档。

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
index.js                     Host 入口：Cordis 插件（name="music"），只做装配与接线
cordis.patch.yml             DSH bundle patch：注册 music 服务与默认 config
client.js                    Client 构建产物（src/client + src/folia 片段拼接而成）
src/host/                    Host：Node 侧，随包发布（见 package.json files）
  http/                      /music/* 路由（routes/、routes.js）+ URL 安全检查
  providers/                 在线源适配：sources（注册表 + 网易云/QQ/酷狗/波点/汽水/本地）、login、vendor
  services/                  core（契约/端口/错误）、media（扫描/标签/缓存/回收站）、lyrics、playback
  stores/                    持久化：settings / stats / favorites / playlists / accounts / media-cache
  assets/                    icu-folia 词典、歌词样式缩略图
src/client/                  Client：浏览器侧片段，按 manifest.json 顺序拼成 client.js
  app/                       插件注册（plugin.js）、宿主 UI 挂载（host-ui.js）、runtime
  panel-v3/                  面板外壳：p3-shell / p3-nav / p3-pages / p3-dialogs / p3-overlay
  components/                library / online / ui / common / visualizer
  services/                  player（含 effects/）、lyrics、api、automix、beatFx、analysis
  render/                    Folia 舞台：registry + stage，canvas / pixi / three 三档渲染
  audio/ styles/ stores/     音频引擎 bundle、主题与配色、状态
  i18n/ types/ utils/ vendor/
src/audio/                   音频引擎 TS 源码 → 构建为 src/client/audio/engine.bundle.js
src/folia/                   Folia 上游源码、i18n、*.bundle.js、Tailwind
src/shared/types.ts          Host/Client 共享类型
scripts/                     构建与检查脚本（见「命令」）
test/                        client / host / integration / manual
locale/                      zh/en 插件元数据：插件列表标题、简介、使用详情路径
docs/                        使用详情-英文.md / 使用详情.md、截图与预览图
A_other/                     非插件资料：design / docs / releases / shared / upstream
```

分工：

- **Host**：承担重活与全部外部访问——扫库与标签、歌词抓取与匹配、在线源与登录、媒体缓存写入、`/music/*` HTTP。浏览器侧不直连外部平台，凭据和缓存都落在 Host 的数据目录。
- **Client**：只消费 Host 的 HTTP 接口，负责面板、播放器、队列与歌词舞台；片段顺序由 `src/client/manifest.json` 定死。
- **构建产物**（都提交进仓，改源码后由对应脚本重建）：`client.js`、`src/client/audio/engine.bundle.js`、`src/client/render/lyrics/lyrics.bundle.js`、`src/client/services/automix/profile.bundle.js`、`src/folia/*.bundle.js`、`src/client/vendor/*.bundle.js`。

> 构建产物、播放/Folia、歌词、安装与数据相关的具体陷阱，全部记在
> [踩坑记录](A_other/docs/踩坑记录.md)；改这些区域前先查对应条目，不要在这里重复维护。

## 参考

- [README](README.md)
- [组件开发规范（可移植）](A_other/组件开发规范/README.md)
- [主题与组件开发规范](A_other/docs/主题与组件开发规范.md)
- [踩坑记录](A_other/docs/踩坑记录.md)
- [目录结构图](A_other/docs/目录结构图.html)
- [发布流程](A_other/docs/发布手册.md)
- [CHANGELOG](CHANGELOG.md)
- [第三方与许可证](THIRD_PARTY_NOTICES.md)
