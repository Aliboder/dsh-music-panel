# AGENTS.md

`dsh-music-panel` — DeepSeek Harness（DSH）的本地 + 在线音乐插件。

**AGENT的任务**：帮助开发者维护、修复、更新这个插件。

参考Folia的源代码（只读勿改）：dsh-music/A_other/upstream/folia-major-main

## 边界

✅ **总是做**

- **分析、修复问题一律采用第一性原理的思想**，第一性原理是：把问题拆到最小、可验证的事实，从这些事实推导原因，而不是从惯例、符号或猜测出发。
- **动在线平台的歌单/推荐/写入（addToPlaylist、playlistSongs、recommendedCollections、myPlaylists）前，先看 [在线平台对齐清单](A_other/docs/在线平台对齐清单.md)**：id 归属、读写同一客户端、能力声明与实现同一次提交。
- **新增或修改任何界面组件前，先加载并使用 skill `dsh-component-development`**（项目内已安装于 `.dsh/skills/`）。
- **新增任何持久化/存储时**，同步扩充“清空插件所有数据”的范围、分类与测试：Host 文件/目录、localStorage、IndexedDB、CacheStorage、内存缓存、远端 session 都算；只加存储不更新清理视为未完成。
- **文档命名一律用中文**：新建或改名的说明文档都用中文文件名（如 `踩坑记录.md`、`发布手册.md`），路径里也不夹带英文标题。例外只有平台约定的 `README.md` / `CHANGELOG.md` / `AGENTS.md` / `LICENSE` / `THIRD_PARTY_NOTICES.md`，以及 `vendor/`、`official/` 这类上游镜像。
- **每做完一步修改就打一个 git 存档点**（`git commit`），message 中文写清这一步做了什么，回退时能直接找到；没验证过的改动不要攒进存档点。
- **最终给用户的回答格式：**简要修改流程 代码块“段A→段B→段C...、通俗易懂的简要说明（问题、思路、做法、收益）、(若有)受影响的文档修改清单和变更内容简介（代码块）、存档点代码块（axxbxx：优化了...）”
- 当我让你参考folia的代码或者对齐代码时，能照搬folia的代码就照搬，不要只借鉴思路。
- **Folia 移植目录必须与上游仓库根 1:1**：镜像统一放在 `folia/`，三条树的相对路径与上游一致——`folia/src/**` ↔ 上游 `src/**`、`folia/sources/<id>/**` ↔ 上游 `sources/<id>/**`、`folia/packages/<包>/**` ↔ 上游 `packages/<包>/**`。镜像是有意的最小可用子集（上游多出来的文件可以不搬），但**路径不许自创、上游不存在的文件不得混进 `folia/`**。
- **镜像内容默认逐字节相同**：确有插件适配的，登记在 `folia/mirror.manifest.json`（含登记时的上游 SHA256，上游一变就报错复核）；`node scripts/check-folia-mirror.mjs` 校验路径、内容与清单，已并入 `npm run check` 与 `npm test`。需要改行为时，优先把改动放进 `src/folia-adapters/` 而不是改镜像。细则见 [Folia 移植规范](A_other/docs/Folia移植规范.md)。
- **适配层按上游路径组织**：替换上游某个模块的替身放在 `src/folia-adapters/<上游相对路径>`（如 `src/folia-adapters/services/onlineMusic/providerRegistry.ts` ↔ 上游 `src/services/onlineMusic/providerRegistry.ts`），文件头写「替身上游：…」；宿主面（RPC / net / seal / pageStore 等没有单一上游文件的实现）、shims 与 vendor 仍按用途分组。构建入口与 bundle 放 `src/folia-build/` 与 `src/host/vendor/`。
- 相关文档描述内容实际发生变更时，要更新文档。

🚫 **不要做**

- **发版必须等用户明确说“发版”**：不要修改版本号、打 tag、创建 GitHub Release 或发布 npm；但每次修改通过验证后，要立即用 `node scripts/install-local.mjs desktop` 把当前构建替换到本机 DSH profile 供用户做最新测试。

## 命令

```bash
npm test                                  # 全量 Node 测试
npm run check                             # 语法 + i18n key + client 同步 + 各 bundle 是否最新
node scripts/build-client.mjs             # 改 src/client/** 后重建 client.js
node scripts/build-client.mjs --check     # 只检查 client.js 是否最新
node scripts/check-folia-mirror.mjs        # 校验 folia/ 镜像：路径 1:1、内容逐字节（适配清单除外）
node scripts/check-folia-mirror.mjs --list-missing   # 另列出还没镜像的上游文件
node scripts/check-folia-mirror.mjs --update         # 把有意的适配登记/更新进 mirror.manifest.json
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
client.js                    Client 构建产物（src/client + folia/ 片段拼接而成）
src/host/                    Host：Node 侧，随包发布（见 package.json files）
  http/                      /music/* 路由（routes/、routes.js）+ URL 安全检查
  providers/                 在线源适配：sources（注册表 + 网易云/QQ/酷狗/波点/汽水/本地）、login、vendor
    sources/folia-bridge/     四个平台共用的「Folia 定义 → 本插件源对象」映射
    sources/<平台>-folia/     移植源注册：kugou（委派表）、netease / qq / bodian / qishui（源对象）
    vendor/<平台>-folia/      各平台 bundle（含网易云工作线程用的 .cjs）
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
folia/                       Folia 镜像，与上游仓库根 1:1（最小子集）
  src/**                     上游 src/** 的镜像
  sources/<id>/**            上游 sources/<id>/** 的镜像
  packages/<包>/**           上游 packages/<包>/** 的镜像
  mirror.manifest.json       与上游内容不同（插件适配）的文件清单，校验脚本据此放行并盯上游变动
  README.md                  镜像规则、如何继续移植
src/folia-adapters/          插件适配：shims / vendor / 插件特有实现
src/folia-build/             构建入口与 bundle（styles / backgrounds / pendolo / css）
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
- **构建产物**（都提交进仓，改源码后由对应脚本重建）：`client.js`、`src/client/audio/engine.bundle.js`、`src/client/render/lyrics/lyrics.bundle.js`、`src/client/services/automix/profile.bundle.js`、`src/folia-build/*.bundle.js`、`src/client/vendor/*.bundle.js`、`src/host/vendor/kugou-folia/source.bundle.mjs`（`node scripts/build-kugou-folia.mjs`）、`src/host/vendor/{bodian,qishui,qq,netease}-folia/source.bundle.mjs` 与 `src/host/vendor/lyrics-folia/match.bundle.mjs`（`node scripts/build-folia-source.mjs <平台|lyrics>`，`--check` 已并入 `npm run check`）。

> 构建产物、播放/Folia、歌词、安装与数据相关的具体陷阱，全部记在
> [踩坑记录](A_other/docs/踩坑记录.md)；改这些区域前先查对应条目，不要在这里重复维护。

## 参考

- [README](README.md)
- [组件开发规范（可移植）](A_other/组件开发规范/README.md)
- [主题与组件开发规范](A_other/docs/主题与组件开发规范.md)
- [踩坑记录](A_other/docs/踩坑记录.md)
- [在线平台对齐清单](A_other/docs/在线平台对齐清单.md)
- [Folia 移植规范](A_other/docs/Folia移植规范.md)（镜像目录、适配层、校验、移植流程）
- [目录结构图](A_other/docs/目录结构图.html)
- [发布流程](A_other/docs/发布手册.md)
- [CHANGELOG](CHANGELOG.md)
- [第三方与许可证](THIRD_PARTY_NOTICES.md)
