# Folia 镜像（`folia/`）

这里逐字节镜像 Folia 仓库（`A_other/upstream/folia-major-main`，只读）里本插件真正用到的那部分源码。
目录与上游**仓库根** 1:1，没有自创目录、没有第二套前缀：

| 本仓库 | 上游 |
|---|---|
| `folia/src/**` | `src/**` |
| `folia/sources/<id>/**` | `sources/<id>/**` |
| `folia/packages/<包>/**` | `packages/<包>/**` |

镜像是有意的**最小可用子集**：上游有、这里没有的文件不算错（`--list-missing` 可以列出来看看还差什么）；
反过来，镜像里多出上游没有的文件是错误。

## 内容规则

- 默认**逐字节相同**。要改行为，把改动放进 `src/folia-adapters/`（替上游模块的替身放在与上游相同的相对路径，文件头写「替身上游：…」），不要改镜像。
- 确有插件适配、必须改镜像内文件的（目前全部集中在 `src/components/visualizer/**` 等视觉器/样式相关的 52 个文件），登记在
  [`mirror.manifest.json`](mirror.manifest.json)：每条记录登记时的上游 SHA256。上游一变，校验脚本就报错，逼人复核适配是否仍需要。
- 构建入口与 bundle 在 `src/folia-build/` 与 `src/host/vendor/`，不在这里。

## 命令

```bash
node scripts/check-folia-mirror.mjs                # 路径 1:1 + 内容逐字节（适配清单除外）
node scripts/check-folia-mirror.mjs --list-missing # 另列出还没镜像的上游文件
node scripts/check-folia-mirror.mjs --update       # 有意适配后重写清单（会记录当前上游 SHA256）
```

`npm run check` 与 `npm test` 都会跑第一条；没有上游检出时脚本会说明并跳过。

## 继续移植一个上游文件

1. 按上游相对路径复制到 `folia/` 下同路径（`src/**` → `folia/src/**`，`sources/**` → `folia/sources/**`）。
2. 需要替换宿主接口时，在 `src/folia-adapters/<上游相对路径>` 写替身，用构建入口的 esbuild alias 接上。
3. 跑 `node scripts/check-folia-mirror.mjs`；内容不同且是**有意**适配才跑 `--update`。
4. 用它替换插件里对应的旧实现，跑 `npm test` / `npm run check`。

