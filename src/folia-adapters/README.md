# Folia 适配层（`src/folia-adapters/`）

插件侧的东西都在这里：替换上游模块的替身、宿主面实现、构建期 shims 与 vendored 包。
上游镜像本身在 `folia/`（规则见 [`folia/README.md`](../folia/README.md)），构建入口与 bundle 在 `src/folia-build/`。

## 替换上游模块的替身（与上游同相对路径）

| 这里 | 替的是上游 | 为什么 |
|---|---|---|
| `services/onlineMusic/providerRegistry.ts` | `src/services/onlineMusic/providerRegistry.ts` | 平台的 provider 由插件注册表注入 |
| `services/onlineMusic/crossSource.ts` | `src/services/onlineMusic/crossSource.ts` | 可参与匹配的源名单由插件提供 |
| `utils/lyrics/providers/amllDbProvider.ts` | `src/utils/lyrics/providers/amllDbProvider.ts` | AMLL 的网络访问收进宿主 AMLL 客户端 |
| `utils/lyrics/workerClient.ts` | `src/utils/lyrics/workerClient.ts` | Node 没有 Web Worker，进程内解析 |

每个文件头都写着「替身上游：…」。新增替身时放到 `src/folia-adapters/<上游相对路径>`，并在构建入口里用 alias 接上。

## 宿主面（没有单一上游文件）

- `source-host/`：给四个 Folia 音源模组（bodian / qishui / qq / netease）的宿主 API——`rpc`、`net.fetch`/`request`、`media.allow`、`legacy.store`、`seal`、`pageStore`、`texts`、`errors`、`source-deps`。
- `kugou/`：酷狗模组自己的宿主面（rpc、seal、pageStore、legacyStore、texts、packageReady 等）。

## 其它

- `shims/`：构建期替身（framer-motion、lucide-react、i18n、settings-card、ttml 等），把上游组件接到插件 client。
- `vendor/`：因为插件只发一个 client 文件而 vendored 的 npm 包（pixi、paper-shaders、pretext、twgl、r3f）。
- `components/visualizer/backgrounds/monet/monetBackgroundPipeline.ts`：Monet 背景在 `OffscreenCanvas` 上的适配版（同一套绘制）。

