/**
 * 组件规范自检：链接、契约、文档覆盖、CSS 规则、专用词。
 * 运行：node 脚本/check-kit.mjs
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const failures = []

function fail(message) { failures.push(message) }
function read(path) { return readFileSync(join(root, path), 'utf8') }

function walk(dir, out = []) {
  for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
    const next = dir === '.' ? entry.name : dir + '/' + entry.name
    if (entry.isDirectory()) walk(next, out)
    else out.push(next)
  }
  return out
}

const files = walk('.')
const markdown = files.filter((file) => file.endsWith('.md'))
const jsonFiles = files.filter((file) => file.endsWith('.json'))

// 1. 相对链接
for (const file of markdown) {
  const text = read(file)
  for (const match of text.matchAll(/\]\(([^)]+)\)/g)) {
    const href = match[1].trim()
    if (/^(https?:|mailto:|#)/.test(href)) continue
    const target = join(root, dirname(file), href.split('#')[0])
    if (!existsSync(target)) fail(file + ': 链接不存在 -> ' + href)
  }
}

// 2. 契约 JSON
const contracts = {}
for (const file of jsonFiles) {
  try { contracts[file] = JSON.parse(read(file)) } catch (error) { fail(file + ': JSON 解析失败 ' + error.message) }
}
const components = contracts['契约/components.json']?.components
if (!Array.isArray(components) || components.length < 10) fail('契约/components.json: 组件条目不足')
for (const entry of components || []) {
  if (!entry.name || !entry.adapter || !entry.doc) fail('契约/components.json: 条目缺 name/adapter/doc')
  if (!existsSync(join(root, entry.doc))) fail('契约/components.json: 文档不存在 -> ' + entry.doc)
}
const geometry = contracts['契约/geometry.json']
for (const key of ['radius', 'button', 'input', 'segment', 'segmentTabs', 'switch', 'pill']) {
  if (!geometry || geometry[key] === undefined) fail('契约/geometry.json: 缺 ' + key)
}

// 3. CSS 规则
const css = read('模板/theme.example.css')
if (!/width:36px;height:20px/.test(css)) fail('模板/theme.example.css: 开关应为 36×20')
if (!/width:16px;height:16px/.test(css)) fail('模板/theme.example.css: 开关滑块应为 16')
if (!/--segment-tabs-inset/.test(css)) fail('模板/theme.example.css: 页签缺内衬变量')
if (!/\.ui-segment-indicator/.test(css)) fail('模板/theme.example.css: 分段缺指示块')
for (const [index, line] of css.split('\n').entries()) {
  if (/#[0-9a-fA-F]{3,8}/.test(line) && !/--dsw-alias/.test(line)) {
    fail('模板/theme.example.css:' + String(index + 1) + ': 出现硬编码颜色，改用 token')
  }
}

// 4. 专用词（防止把某个具体插件的东西带进来）
const forbidden = ['mp-', 'dsh-music', 'music', '歌曲', '歌词', '队列']
for (const file of files.filter((item) => /\.(md|js|css|json)$/.test(item))) {
  const text = read(file)
  for (const word of forbidden) {
    if (text.includes(word)) fail(file + ': 出现专用词「' + word + '」')
  }
}

// 5. 组件文档覆盖
const componentDocs = files.filter((file) => file.startsWith('04-组件/') && file.endsWith('.md'))
if (componentDocs.length < 10) fail('04-组件/: 文档不足 10 篇')
for (const entry of components || []) {
  if (!componentDocs.some((file) => file === entry.doc)) fail('组件缺独立文档 -> ' + entry.name)
}

if (failures.length > 0) {
  console.error('检查失败 ' + String(failures.length) + ' 项：')
  for (const message of failures) console.error(' - ' + message)
  process.exit(1)
}
console.log('组件规范自检通过：' + String(componentDocs.length) + ' 篇组件页，' + String(components.length) + ' 个契约条目，' + String(markdown.length) + ' 篇文档')
