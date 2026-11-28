# Folia 模组镜像（`src/folia-mods/`）

上游 `src/` 以外的树按相对路径原样复制到这里，一个字节都不改；本插件的宿主面、接线和改动都在
`src/folia-adapters/`，构建入口在 `src/folia-build/`，产物在 `src/host/vendor/`。

## 现在镜像了什么

| 这里 | 上游 | 说明 |
| --- | --- | --- |
| `sources/kugou/` | `sources/kugou/` | 酷狗音源模组（Folium 2）：`core/` 是音源定义与请求，`main/` 是 KuGouMusicApi 桥与入口，`client/` 是注册入口，`locales/` 是它自己的文字 |
| `packages/folium-source-kit/` | `packages/folium-source-kit/` | 音源模组共用的纯函数（`errorFields`、`withLoginRequestLimit`、`krcDecrypt` 等） |

## 这次镜像的上游身份

- 上游版本：`0.8.2`（`A_other/upstream/folia-major-main/package.json`），酷狗模组 `1.0.0`（`sources/kugou/mod.json`）
- 镜像文件指纹：`4b985786b45f19ba53781c100aa3eae657c5dacdea3b0b801aa63fcfc931dc2a`
  （28 个文件的逐文件 SHA-256 按路径排序拼接后再取 SHA-256）
- 镜像日期：2026-11-28

## 怎么同步下一次上游

1. 把上游这两棵树整份覆盖过来（`sources/kugou/**`、`packages/folium-source-kit/**`）；
2. 逐文件核对哈希：镜像里每个文件都必须与上游同路径文件一致（`Get-FileHash` 对比，0 差异）；
3. `node scripts/build-kugou-folia.mjs` 重建 bundle，再 `node test/host/kugou-folia-bundle.test.mjs`；
4. 上游动了宿主面（`api.*` / `folium.*`）或依赖版本时，先改 `src/folia-adapters/kugou/`，不要改镜像。

镜像文件禁止手改：适配要改行为时改适配层，或在 `src/folia-adapters/` 里包一层，不要动这里。
