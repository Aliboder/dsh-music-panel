# 发布手册

面向维护者（以及协助发布的 Agent）。目标：一次发布 30 分钟内完成，每一步都能验证，出问题知道从哪一步重来。

本仓库的发布由两部分组成：**GitHub Release（打 tag 时创建）** 与 **npm 发布（push tag 时由 GitHub Actions 的 Trusted Publishing 完成）**。本机不需要 npm 登录。

---

## 0. 环境

本机 PATH 里没有 `node` / `npm`，用 DSH runtime 里的绝对路径：

```powershell
$NODE = 'C:\Users\Aliboder\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe'
$PNPM = 'C:\Users\Aliboder\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\pnpm\bin\pnpm.mjs'
$GH   = 'C:\Program Files\GitHub CLI\gh.exe'
```

- `gh` 已登录 `Aliboder`（`repo` + `workflow` 权限），push 与 release 都靠它。
- npm 发布走 `.github/workflows/publish.yml` 的 **Trusted Publishing（OIDC）**，不读本机凭据。本机 `~/.npmrc` 里的 npmjs token 已失效（`whoami` 401），**不要**为发布会话去翻或替换 token。
- 本机默认 registry 是 npmmirror；查询 npm 时显式加 `--registry https://registry.npmjs.org/`，或用下一节的 HTTP 轮询。

### 网络：push 必须走加速器

这台机器开着 FlClash 加速器（系统代理 `127.0.0.1:7899`）。**git 与 gh 的代理是分开的**：

- **git（push / fetch / ls-remote）**：全局 `~/.gitconfig` 里已有
  `http.https://github.com/.proxy = http://127.0.0.1:7899`，所有 GitHub 流量自动走加速器。
  不要再往仓库里设 `http.proxy`：URL 专属配置会覆盖通用 `http.proxy`，重复配置只会让人误判。
  发版前验证一次：

  ```powershell
  $env:GIT_CURL_VERBOSE = '1'
  git ls-remote origin 2>&1 | Select-String 'proxy tunnel|Trying 127.0.0.1'
  # 期望看到：Trying 127.0.0.1:7899 … CONNECT github.com:443 HTTP/1.1 … 200 Connection established
  Remove-Item Env:GIT_CURL_VERBOSE
  ```

- **gh / npm / pnpm**：它们不读 git config，也不读 Windows 系统代理，默认是直连。需要走加速器时
  在命令里显式带上环境变量（每个新进程都要重设）：

  ```powershell
  $env:HTTPS_PROXY = 'http://127.0.0.1:7899'
  $env:HTTP_PROXY  = 'http://127.0.0.1:7899'
  & $GH release create vX.Y.Z --title "..." --notes-file <notes.md>
  ```

- 端口以 FlClash 里的“混合端口”为准；改了端口就同步改 `~/.gitconfig` 的那一行和上面的示例。
- `git push` 报 `Failed to connect to 127.0.0.1 port 7899` = 加速器没开，先开加速器再推。
- `gh` 直连偶尔也能通，但既然本机约定推更新走加速器，Release / Actions 相关命令统一带环境变量。

---

## 1. 发布前：必须全绿

```powershell
# 工作区必须干净（不要带着未验证的改动发布）
git status --short

# 全量测试 + check（把 package.json 里的 node 换成绝对路径）
$PKG = Get-Content package.json -Raw | ConvertFrom-Json
Invoke-Expression ($PKG.scripts.test.Replace('node ', "& '$NODE' "))
Invoke-Expression ($PKG.scripts.check.Replace('node ', "& '$NODE' "))
```

`check` 已包含 `node --check` 全量、i18n key 检查与 `client.js --check`，不需要再单独跑一遍。

构建物规则（改了什么就得重建什么，漏了 `--check` 不一定发现）：

| 改动的目录 | 发布前必须跑 |
|---|---|
| `src/client/**`（除 `src/client/utils/lyrics/**`、`src/client/render/lyrics/entry.ts`） | `node scripts/build-client.mjs` |
| `src/client/utils/lyrics/**` 或 `src/client/render/lyrics/entry.ts` | `node scripts/build-lyrics.mjs` → 再 `build-client` |
| 背景 / 样式 / pendolo 源码或 `src/folia/vendor/**` | `build-backgrounds` / `build-styles` / `build-pendolo` → 再 `build-client` |
| `src/host/assets/icu-folia/**` | `node scripts/build-icu-folia.mjs`（需要 folia 检出，不要手改） |

> `client.js` / `*.bundle.js` 都是生成物，**不要手改**。

打包自检（`npm pack --dry-run` 在无 npm 环境下用 pnpm 代替）：

```powershell
$tmp = Join-Path $ENV:TEMP ('pack-' + ((New-Guid).ToString('N').Substring(0, 6)))
New-Item -ItemType Directory $tmp | Out-Null
& $NODE $PNPM pack --pack-destination $tmp
tar -tzf (Get-ChildItem $tmp -Filter *.tgz).FullName | Select-Object -First 20
```

确认：版本号正确、包含 `client.js` / `src/host/**` / `LICENSE` / `THIRD_PARTY_NOTICES.md`、**不包含**用户音乐、歌词缓存、登录凭据、`.auth-state/`。看完删除临时目录。

### 本机开发安装（桌面版与 web 共用）

桌面版（以及 `dsh web`）加载的是 profile 里的**副本**：`<DSH_HOME>/profiles/<profile>/node_modules/dsh-music-panel`，仓库里的改动不会自动进去；`web` profile 的这个目录是指向 desktop 副本的 junction。所以本机验证改动时：

```powershell
# 先按上面的构建物规则重建（至少 build-client；改了样式/音频 bundle 还要各自的 build）
& $NODE scripts/build-client.mjs
& $NODE scripts/install-local.mjs desktop
```

脚本会先跑 `build-client.mjs --check` 拒绝过期产物，把旧安装备份到 `<DSH_HOME>/backups/`，再复制 `index.js` / `client.js` / `src/host` / `locale` 等（保留插件自己的 `node_modules`）。装完**完全退出** DSH 再启动——只刷新窗口只重载客户端，Host 仍是旧的。验证：比较仓库与 `<installed>/client.js` 的 sha256。

---

## 2. 改版本与文档

1. **`package.json` 的 `version`**：semver（功能发布用 minor，修复用 patch）。
   改完**必须** `node scripts/build-client.mjs`：`APP_VERSION` 被写进 `client.js`，不重建时 `check` 会报 `client.js is stale`。
2. **CHANGELOG**：把顶部 `## Unreleased` 整段改成 `## x.y.z — YYYY-MM-DD`（保留小节结构），然后在其上方补一个新的空 `## Unreleased` 给下个版本用。
3. **README**：顶部 release 徽章改成 `release-x.y.z`；测试文件数量若变了，顺手改 `npm test # N test files`。
4. **许可与第三方**：新增依赖、新增移植来源 → 更新 `THIRD_PARTY_NOTICES.md`。
   本项目必须保持 **AGPL-3.0-only**（`src/folia/**`、`src/client/utils/lyrics/**` 是 Folia 的 AGPL 移植），不能换成更宽松的协议。Folia 归属固定在 README 的「参考与致谢 / Credits」里，仓库地址 <https://github.com/chthollyphile/folia-major>。
5. **提交**：`chore(release): x.y.z —— <一句话主题>`，把 CHANGELOG / README / package.json / 重建后的 client.js 放在同一个提交里。

发布前再想一遍：这一版有没有 **用户会踩到的行为变化**（偏好迁移、需要重新登录、设置改名）。有就必须写进 Release 的「升级提示」。

---

## 3. 打 tag 并推送

```powershell
git tag -a vX.Y.Z -m "dsh-music-panel X.Y.Z — <主题>"
git push origin main
git push origin vX.Y.Z
```

- push tag 会触发 `publish.yml` → npm 发布，以及 `ci.yml`（main + tag 各跑一次）。
- **推送前确认 FlClash 在跑**（git 走 `127.0.0.1:7899`，见 §0「网络」）；失败时先看是不是代理端口没起来。
- tag 一旦推送就不要移动（**只有“撤回发布”按 §7.1 删除 tag 是例外**）；发布失败优先“修工作流 + 手动 dispatch”，而不是 force-push tag。

---

## 4. GitHub Release：写给用户，不是贴 CHANGELOG

Release 页是用户看到的门面，**不要**把 CHANGELOG 整段贴上去（会出现大量内部实现和一个名字被反复提及的参考项目）。CHANGELOG 是开发者记录；Release 只写用户能感知的东西。

写法规约：

- 一段话说明这版解决什么，然后 6–10 条要点，顺序：**新功能 → 改进 → 修复 → 升级提示 → 许可**。
- 每条都写成用户视角：做什么、在哪打开（如「设置 → 音乐 → 自动使用最佳歌词」）、会看到什么变化。
- 不写内部类名、文件路径、函数名、测试数量、CI 细节。
- 修复条目只写用户遇到的现象，不写根因。
- Folia 只在最后一行许可归属里出现一次（带链接）；细节留在 README / `THIRD_PARTY_NOTICES.md`。
- 任何需要用户动手的变化（重新登录、偏好重置、路径变更）单列「升级提示」。

模板：

```markdown
X.Y.Z <主题>：<一句话说明这版带来什么>

- **<最亮的新功能>**：<用户视角描述>；<在哪打开 / 怎么用>
- **<新功能 2>**：…
- <改进 1>
- 修复：<用户会看到的现象>
- 修复：<现象 2>

- 升级提示：<需要用户做的事>
- 许可：<仅在许可/归属有变化时写这一行>
```

创建/修改：

```powershell
& $GH release create vX.Y.Z --title "X.Y.Z <主题>" --notes-file <notes.md>
# 已创建但正文要改：
& $GH release edit vX.Y.Z --title "X.Y.Z <主题>" --notes-file <notes.md>
```

---

## 5. npm 发布与排错

正常路径（推荐）：push tag → Actions 的 `publish` 任务：

1. `npm install --no-audit --no-fund --no-package-lock --allow-remote=root`
2. `npm test` + `npm run check`
3. 检查该版本是否已发布（已发布则跳过，幂等）
4. `npm publish --access public`（Provenance / Trusted Publishing）

**不要**跳过测试直接 `npm publish`，也不要用本机 token 手动发布。

### 已知坑

- **npm 12 默认 `allow-remote=none`**：`kugoumusicapi` 是 GitHub tarball 依赖，安装时会 `EALLOWREMOTE`。工作流里必须 `--allow-remote=root`。
  该参数是枚举（`all` / `none` / `root`），写成裸 `--allow-remote` 会被当成 `true`，警告后仍然拒绝；`root` = 只放行本项目 `package.json` 声明的 remote 规格，不放行传递依赖。
- **修完工作流后要重新 dispatch**：tag 上那次失败运行使用的是 tag 里的旧工作流，`rerun` 不会带上修复。用 `gh workflow run publish.yml --ref main`。
- **npm 12 发布是异步处理的**：CLI 会提示 “Your package is being processed and may take a few minutes to become available”。`registry.npmjs.org/latest` 可能延迟数分钟（0.36.0 实测约 5 分钟）。不要因为查不到就重复发布；用轮询：

```powershell
for ($i = 0; $i -lt 20; $i++) {
  $u = 'https://registry.npmjs.org/dsh-music-panel/latest?x=' + ((New-Guid).ToString('N'))
  $v = (Invoke-RestMethod $u).version
  if ($v -eq 'X.Y.Z') { break }
  Start-Sleep -Seconds 15
}
```

- `npm whoami` 401 与本流程无关（Trusted Publishing 不读 token），不要因此去动凭据。

---

## 6. 发布后验证

- [ ] `https://registry.npmjs.org/dsh-music-panel/latest`：`version` = 新版本，`license` = `AGPL-3.0-only`
- [ ] npm tarball 抽查：`tar -xzf` 后确认 README 有 Folia 致谢段、有 `LICENSE` / `THIRD_PARTY_NOTICES.md`
- [ ] `gh release view vX.Y.Z`：标题与正文是面向用户的版本，不是 CHANGELOG 原文；非 draft / prerelease
- [ ] Actions：`ci`（main、tag）与 `publish` 均为 success
- [ ] 安装验证（可选但推荐）：在测试 profile `pnpm add dsh-music-panel@X.Y.Z`，完整重启 DSH，侧栏图标与「关于」里的版本正确
- [ ] 本文件收尾：这次遇到的新坑补进第 5 节

---

## 7. 回滚 / 撤回

分两种：**这个版本有严重问题、要彻底下架**（撤回），与**发布流程出错但版本可用**（重发 / 补丁）。

### 7.1 彻底撤回一个刚发布的版本

1. **GitHub**：删 Release 和 tag（`--cleanup-tag` 会一起删远端 tag）：

   ```powershell
   & $GH release delete vX.Y.Z --yes --cleanup-tag
   git tag -d vX.Y.Z
   git ls-remote --tags origin | Select-String 'vX\.Y\.Z'   # 确认远端已无该 tag
   ```

   Release 列表里上一版会自动重新成为 Latest。tag 一删，`publish.yml` 就不会再被触发，
   不存在“再推一次就误发布”的风险。

2. **npm**：72 小时内可以撤回单个版本。**Trusted Publishing / OIDC 只支持 publish，不能 unpublish**，
   必须由账号本人登录（本机 `~/.npmrc` 的 token 失效时尤其如此）：

   ```powershell
   & $NODE $PNPM login --registry https://registry.npmjs.org/            # 2FA 账号需要 OTP
   & $NODE $PNPM unpublish dsh-music-panel@X.Y.Z --registry https://registry.npmjs.org/
   & $NODE $PNPM dist-tag add dsh-music-panel@<上一版> latest --registry https://registry.npmjs.org/
   ```

   核对：registry 的 `versions` 里已没有 X.Y.Z，`dist-tags.latest` 指回上一版。
   **同版本号 24 小时内不能重新发布**：0.36.0 撤回后，修复版直接发 0.36.1。

3. **代码**：默认**不**回退 main —— 撤回的是发布物，不是提交。若确实要退回代码，
   用 `git revert <提交>` 再发补丁版，不要强推历史。

4. 收尾：CHANGELOG 记一条「发布撤回」（原因 + 下一个版本号），修好之前不要重新打同名 tag。

### 7.2 发布流程出错但版本可用

- 重发：`gh workflow run publish.yml --ref main`（工作流自带“是否已发布”检查，幂等）。
- 修了工作流之后不要 `rerun` 旧 tag 的运行，那条运行用的是 tag 里的旧工作流。
- 超过 72 小时不能 unpublish，只能
  `npm deprecate dsh-music-panel@X.Y.Z "原因，请升级到 X.Y.Z+1"`。

---

## 附：关键文件

| 文件 | 作用 |
|---|---|
| `.github/workflows/publish.yml` | tag / 手动 dispatch → 测试 → npm Trusted Publishing |
| `.github/workflows/ci.yml` | push / PR → 测试 + check + pack:check |
| `package.json` | `version`、`files`（发布内容）、`scripts` |
| `CHANGELOG.md` | 开发者变更记录（按版本分段） |
| `README.md` | 用户文档 + 参考与致谢 + License |
| `THIRD_PARTY_NOTICES.md` | 第三方与 Folia 的逐项许可 |
