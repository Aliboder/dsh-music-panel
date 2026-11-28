#!/usr/bin/env node
/**
 * Bundle a ported Folia source module for the Host.
 *
 *   node scripts/build-folia-source.mjs bodian        # rebuild one platform
 *   node scripts/build-folia-source.mjs --check        # fail when any committed bundle is stale
 *
 * The upstream module stays TypeScript in folia/ (mirrored byte for byte); esbuild
 * compiles it with the plugin's host surfaces in src/folia-adapters/ into one ESM file the
 * Host loads. Nothing of the module's logic is rewritten here.
 *
 * @module dsh-music-panel/build-folia-source
 */
import { build } from 'esbuild'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const KIT_INDEX = join(ROOT, 'folia/packages/folium-source-kit/src/index.ts')

/** 每个平台：入口、产物、要在运行时从 node_modules 解析的包（打进 bundle 之外）。 */
const PLATFORMS = {
  bodian: {
    entry: 'src/folia-build/bodian-host-entry.ts',
    out: 'src/host/vendor/bodian-folia/source.bundle.mjs',
    external: ['bodian-music-api'],
  },
  qishui: {
    entry: 'src/folia-build/qishui-host-entry.ts',
    out: 'src/host/vendor/qishui-folia/source.bundle.mjs',
    external: ['qishui-music-api'],
  },
  qq: {
    entry: 'src/folia-build/qq-host-entry.ts',
    out: 'src/host/vendor/qq-folia/source.bundle.mjs',
    external: ['@yakult-green-tea/qq-music-api'],
  },
  lyrics: {
    entry: 'src/folia-build/lyrics-match-host-entry.ts',
    out: 'src/host/vendor/lyrics-folia/match.bundle.mjs',
    // 上游匹配链要的宿主接口，用插件侧替身；两个 npm 依赖留到运行时解析。
    external: ['wanakana', 'opencc-js/t2cn'],
    alias: {
      // 替身与上游同相对路径：src/folia-adapters/<上游相对路径>。
      '../../services/onlineMusic/providerRegistry': 'src/folia-adapters/services/onlineMusic/providerRegistry.ts',
      '../../services/onlineMusic/crossSource': 'src/folia-adapters/services/onlineMusic/crossSource.ts',
      // AMLL 库的网络访问是宿主的事（与在线源一样），匹配逻辑仍由上游决定问什么、怎么用。
      './providers/amllDbProvider': 'src/folia-adapters/utils/lyrics/providers/amllDbProvider.ts',
      // 上游 mods/folium/lyricsSource.ts 用 `@/` 指向 src；镜像后指回 src/folia，解析工作交给进程内替身。
      '@/utils/lyrics/adapters/LocalFileLyricAdapter': 'folia/src/utils/lyrics/adapters/LocalFileLyricAdapter.ts',
      '@/utils/lyrics/filtering': 'folia/src/utils/lyrics/filtering.ts',
      '@/utils/lyrics/parserCore': 'folia/src/utils/lyrics/parserCore.ts',
      '@/utils/lyrics/foliaLyricDocument': 'folia/src/utils/lyrics/foliaLyricDocument.ts',
      '@/utils/lyrics/chorusResolver': 'folia/src/utils/lyrics/chorusResolver.ts',
      '@/utils/lyrics/workerClient': 'src/folia-adapters/utils/lyrics/workerClient.ts',
    },
  },
  netease: {
    entry: 'src/folia-build/netease-host-entry.ts',
    out: 'src/host/vendor/netease-folia/source.bundle.mjs',
    external: ['@neteasecloudmusicapienhanced/api'],
    // 上游 main 入口用 @folia/source-deps 找钉死的包目录。
    alias: { '@folia/source-deps': 'src/folia-adapters/source-host/source-deps.ts' },
    // 网易云的后端跑在工作线程里，线程是一个磁盘文件：把上游 main 下的 .cjs 原样放到 bundle 旁边，
    // neteaseApiWorker.cjs 改名成 worker.cjs（上游 main 入口按这个文件名找它）。
    files: [
      ['folia/sources/netease/main/neteaseApiWorker.cjs', 'src/host/vendor/netease-folia/worker.cjs'],
      ['folia/sources/netease/main/neteaseBackend.cjs', 'src/host/vendor/netease-folia/neteaseBackend.cjs'],
      ['folia/sources/netease/main/neteaseApiStartup.cjs', 'src/host/vendor/netease-folia/neteaseApiStartup.cjs'],
      ['folia/sources/netease/main/neteaseApiHost.cjs', 'src/host/vendor/netease-folia/neteaseApiHost.cjs'],
      ['folia/sources/netease/main/neteaseLoginDiagnostics.cjs', 'src/host/vendor/netease-folia/neteaseLoginDiagnostics.cjs'],
      ['folia/sources/netease/main/neteaseLoginIdentity.cjs', 'src/host/vendor/netease-folia/neteaseLoginIdentity.cjs'],
      ['folia/sources/netease/main/networkRecorder.cjs', 'src/host/vendor/netease-folia/networkRecorder.cjs'],
      ['folia/sources/netease/main/networkErrorText.cjs', 'src/host/vendor/netease-folia/networkErrorText.cjs'],
      ['folia/sources/netease/main/upstreamAddressOrder.cjs', 'src/host/vendor/netease-folia/upstreamAddressOrder.cjs'],
      ['folia/sources/netease/main/backendLifecycle.cjs', 'src/host/vendor/netease-folia/backendLifecycle.cjs'],
      ['folia/sources/netease/main/lazyJsdom.cjs', 'src/host/vendor/netease-folia/lazyJsdom.cjs'],
    ],
  },
}

const foliumAliases = (external, alias = {}) => ({
  name: 'folia-package-aliases',
  setup(context) {
    context.onResolve({ filter: /^@folia\/folium-source-kit$/ }, () => ({ path: KIT_INDEX }))
    for (const [name, target] of Object.entries(alias)) {
      context.onResolve({ filter: new RegExp('^' + name.replace(/[/@.]/g, (c) => '\\' + c) + '$') }, () => ({ path: join(ROOT, target) }))
    }
    for (const name of external) {
      context.onResolve({ filter: new RegExp('^' + name.replace(/[/@.]/g, (c) => '\\' + c) + '(/.*)?$') }, (args) => ({ path: args.path, external: true }))
    }
  },
})

const headerOf = (id) => [
  '// Generated by scripts/build-folia-source.mjs - do not edit by hand.',
  '// Sources: A_other/upstream/folia-major-main/sources/' + id + ', mirrored verbatim to folia/sources/' + id + ',',
  '// compiled together with the plugin-side host surfaces in src/folia-adapters/source-host/.',
  '',
].join('\n')

const bundleOf = async (id) => {
  const platform = PLATFORMS[id]
  if (!platform) throw new Error('unknown platform: ' + id)
  const result = await build({
    entryPoints: [join(ROOT, platform.entry)],
    write: false,
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: ['node20'],
    minify: false,
    sourcemap: false,
    logLevel: 'silent',
    legalComments: 'none',
    loader: { '.ts': 'ts', '.json': 'json' },
    // 上游源码里有 import.meta.env.DEV / MODE（Vite 约定）：按生产构建固定。
    define: {
      'import.meta.env.DEV': 'false',
      'import.meta.env.PROD': 'true',
      'import.meta.env.MODE': '"production"',
      'import.meta.env.SSR': 'false',
    },
    banner: { js: 'import { createRequire as __mpCreateRequire } from "node:module"; import { fileURLToPath as __mpFileURLToPath } from "node:url"; const require = __mpCreateRequire(import.meta.url); const __filename = __mpFileURLToPath(import.meta.url); const __dirname = __mpFileURLToPath(new URL(".", import.meta.url)).replace(/[\\\\/]$/, "");' },
    plugins: [foliumAliases(platform.external ?? [], platform.alias ?? {})],
  })
  return headerOf(id) + result.outputFiles[0].text.replace(/\r\n/g, '\n')
}

const argv = process.argv.slice(2)
const check = argv.includes('--check')
const ids = argv.filter((value) => !value.startsWith('--'))

try {
  const targets = ids.length > 0 ? ids : Object.keys(PLATFORMS)
  let stale = 0
  for (const id of targets) {
    const platform = PLATFORMS[id]
    if (!platform) throw new Error('unknown platform: ' + id)
    const out = join(ROOT, platform.out)
    const text = await bundleOf(id)
    // 与 bundle 一起服务的文件（网易云的工作线程是磁盘文件）逐字节复制过去。
    const extraFiles = (platform.files ?? []).map(([from, to]) => ({ to: join(ROOT, to), text: readFileSync(join(ROOT, from)) }))
    if (check) {
      let current = ''
      try { current = readFileSync(out, 'utf8') } catch { current = '' }
      let filesStale = 0
      for (const file of extraFiles) {
        let onDisk = null
        try { onDisk = readFileSync(file.to) } catch { onDisk = null }
        if (onDisk === null || !onDisk.equals(file.text)) filesStale += 1
      }
      if (current !== text || filesStale > 0) {
        console.log('STALE ' + id + (filesStale > 0 ? ' (' + filesStale + ' companion file(s))' : ''))
        stale += 1
      } else {
        console.log('OK ' + id + ' (' + text.length + ' bytes' + (extraFiles.length > 0 ? ', ' + extraFiles.length + ' companion files' : '') + ')')
      }
    } else {
      mkdirSync(dirname(out), { recursive: true })
      writeFileSync(out, text, 'utf8')
      for (const file of extraFiles) {
        mkdirSync(dirname(file.to), { recursive: true })
        writeFileSync(file.to, file.text)
      }
      console.log('BUILT ' + id + ' (' + text.length + ' bytes' + (extraFiles.length > 0 ? ', ' + extraFiles.length + ' companion files' : '') + ')')
    }
  }
  if (check && stale > 0) process.exitCode = 1
} catch (error) {
  const errors = error.errors || []
  console.log('ERRORS ' + errors.length)
  console.log(errors.slice(0, 20).map((item) => (item.location ? item.location.file.split('folia-mods/').pop() + ':' + item.location.line + ' ' : '') + item.text).join('\n'))
  process.exitCode = 1
}
