#!/usr/bin/env node
/**
 * 校验 `folia/` 镜像是否仍与上游同路径、且内容受控。
 *
 * 布局（与上游仓库根 1:1）：
 *   folia/src/**      ↔ 上游 src/**
 *   folia/sources/**  ↔ 上游 sources/**
 *   folia/packages/** ↔ 上游 packages/**
 * 规则：
 *   1. 镜像里的每个文件都必须在上游同相对路径存在（镜像不许多文件）；
 *   2. 镜像只允许这三棵树 + README.md + mirror.manifest.json；
 *   3. 内容默认必须逐字节相同；确有插件适配的，登记在 mirror.manifest.json 的 adapted 里，
 *      并记录登记时的上游 SHA256——上游一变就报错，逼人复核；
 *   4. 上游有、镜像没有的文件不算错（镜像是有意的最小可用子集），--list-missing 可列出来。
 *
 * 用法：
 *   node scripts/check-folia-mirror.mjs               校验（失败退出码 1）
 *   node scripts/check-folia-mirror.mjs --list-missing 额外列出还没镜像的上游文件
 *   node scripts/check-folia-mirror.mjs --update      把当前「同路径但内容不同」的文件登记为适配（有意行为才用）
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
export const UPSTREAM = join(ROOT, 'A_other', 'upstream', 'folia-major-main')
export const MIRROR = join(ROOT, 'folia')
export const MANIFEST = join(MIRROR, 'mirror.manifest.json')
export const TREES = ['src', 'sources', 'packages']
const ALLOWED_ROOT_ENTRIES = new Set(['README.md', 'mirror.manifest.json', ...TREES])

const sha = (file) => createHash('sha256').update(readFileSync(file)).digest('hex')

function walk(dir, base = dir, out = []) {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name)
    if (statSync(abs).isDirectory()) walk(abs, base, out)
    else out.push({ abs, rel: abs.slice(base.length + 1).split('\\').join('/') })
  }
  return out
}

export function readManifest() {
  if (!existsSync(MANIFEST)) return { version: 1, adapted: [] }
  try { return JSON.parse(readFileSync(MANIFEST, 'utf8')) } catch { return { version: 1, adapted: [] } }
}

function listMirrorFiles() {
  const files = []
  for (const tree of TREES) {
    const dir = join(MIRROR, tree)
    if (existsSync(dir)) files.push(...walk(dir).map((file) => ({ ...file, tree, rel: tree + '/' + file.rel })))
  }
  return files
}

function upstreamSha(rel) {
  const up = join(UPSTREAM, rel)
  return existsSync(up) ? sha(up) : null
}

/** 校验镜像；返回 { ok, errors, adapted, adaptedStale, checked, upstreamFiles, missing }。 */
export function checkFoliaMirror(options = {}) {
  const errors = []
  if (!existsSync(MIRROR)) return { ok: false, errors: ['folia/ 不存在'], checked: 0 }
  if (!existsSync(UPSTREAM)) {
    return { ok: true, skipped: true, errors: [], checked: 0, upstreamFiles: 0, missing: [], reason: '上游检出不存在，跳过镜像校验' }
  }
  for (const entry of readdirSync(MIRROR)) {
    if (!ALLOWED_ROOT_ENTRIES.has(entry)) errors.push('folia/' + entry + '：镜像根只允许 README.md / mirror.manifest.json / ' + TREES.join('/') + '/')
  }
  const manifest = readManifest()
  const adapted = new Map((Array.isArray(manifest.adapted) ? manifest.adapted : []).map((entry) => [entry.path, entry]))
  const files = listMirrorFiles()
  const usedAdapted = new Set()
  let checked = 0
  for (const file of files) {
    const upSha = upstreamSha(file.rel)
    checked += 1
    if (upSha === null) { errors.push('镜像多出 ' + file.rel + '：上游没有这个文件'); continue }
    const ownSha = sha(file.abs)
    if (ownSha === upSha) continue
    const entry = adapted.get(file.rel)
    if (entry === undefined) {
      errors.push('内容不同 ' + file.rel + '：刷新上游，或在 mirror.manifest.json 登记为适配（--update）')
      continue
    }
    usedAdapted.add(file.rel)
    if (entry.upstreamSha256 !== upSha) {
      errors.push('上游已变化 ' + file.rel + '：核对适配是否仍适用，再跑 --update 更新记录')
    }
  }
  for (const [path] of adapted) {
    if (!usedAdapted.has(path)) errors.push('清单多余 ' + path + '：该文件已与上游相同或不在镜像里，--update 可清理')
  }
  const mirrored = new Set(files.map((file) => file.rel))
  const missing = []
  let upstreamFiles = 0
  for (const tree of TREES) {
    const dir = join(UPSTREAM, tree)
    if (!existsSync(dir)) continue
    for (const file of walk(dir)) {
      upstreamFiles += 1
      const rel = tree + '/' + file.rel
      if (!mirrored.has(rel)) missing.push(rel)
    }
  }
  const result = { ok: errors.length === 0, errors, checked, upstreamFiles, adapted: usedAdapted.size, missing }
  if (options.listMissing === true) result.missing = missing.sort()
  else delete result.missing
  return result
}

/** 把当前「同路径但内容不同」的文件登记为适配（有意行为才用）。 */
export function updateManifest() {
  const adapted = []
  for (const file of listMirrorFiles()) {
    const upSha = upstreamSha(file.rel)
    if (upSha === null) continue
    if (sha(file.abs) === upSha) continue
    adapted.push({ path: file.rel, upstreamSha256: upSha })
  }
  adapted.sort((left, right) => left.path.localeCompare(right.path))
  const manifest = {
    version: 1,
    baseline: new Date().toISOString().slice(0, 10),
    note: '与上游同相对路径、但内容经过插件适配的文件。新增差异必须先登记（--update 仅用于有意的适配）；其余文件必须与上游逐字节相同。',
    adapted,
  }
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n')
  return adapted.length
}

const isMain = process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  if (process.argv.includes('--update')) {
    const count = updateManifest()
    console.log('mirror manifest updated: ' + count + ' adapted files')
    process.exitCode = 0
  } else {
    const result = checkFoliaMirror({ listMissing: process.argv.includes('--list-missing') })
    if (result.skipped === true) {
      console.log('mirror skipped: ' + result.reason)
    } else if (!result.ok) {
      for (const error of result.errors) console.error('ERROR ' + error)
      process.exitCode = 1
    } else {
      console.log('mirror OK (' + result.checked + ' files, ' + result.adapted + ' adapted; upstream ' + result.upstreamFiles + ')')
      if (process.argv.includes('--list-missing') && Array.isArray(result.missing) && result.missing.length > 0) {
        console.log('未镜像的上游文件（' + result.missing.length + '）：')
        for (const file of result.missing.slice(0, 200)) console.log('  ' + file)
        if (result.missing.length > 200) console.log('  …')
      }
    }
  }
}
