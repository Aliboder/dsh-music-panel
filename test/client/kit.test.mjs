/**
 * The portable kit (A_other/组件开发规范) is the generic, copy-paste version of the
 * rules this plugin follows. It must stay self-contained and free of plugin specifics.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { spawnSync } from 'node:child_process'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const kit = join(root, 'A_other/组件开发规范')

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const next = join(dir, entry.name)
    if (entry.isDirectory()) walk(next, out)
    else out.push(next)
  }
  return out
}

test('the kit passes its own self-check', () => {
  const result = spawnSync(process.execPath, ['脚本/check-kit.mjs'], { cwd: kit, encoding: 'utf8' })
  assert.equal(result.status, 0, (result.stderr || '') + (result.stdout || ''))
  assert.match(result.stdout, /组件规范自检通过/)
})

test('the kit is generic and self-contained', () => {
  const files = walk(kit).filter((file) => /\.(md|js|css|json)$/.test(file))
  const forbidden = ['mp-', 'dsh-music', 'music', '歌曲', '歌词', '队列']
  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    for (const word of forbidden) {
      assert.ok(!text.includes(word), file + ' must not contain ' + word)
    }
  }
  const readme = readFileSync(join(kit, 'README.md'), 'utf8')
  assert.match(readme, /给 AI 的阅读顺序/, 'the README tells AI what to read first')
  assert.ok(existsSync(join(kit, '模板/host-ui.js')))
  assert.ok(existsSync(join(kit, '模板/primitives.example.js')))
  assert.ok(existsSync(join(kit, '脚本/check-kit.mjs')))
})

test('the kit contracts cover the shared components', () => {
  const contract = JSON.parse(readFileSync(join(kit, '契约/components.json'), 'utf8'))
  assert.ok(contract.components.length >= 12)
  for (const entry of contract.components) {
    assert.ok(existsSync(join(kit, entry.doc)), entry.name + ' has a component page')
  }
  const geometry = JSON.parse(readFileSync(join(kit, '契约/geometry.json'), 'utf8'))
  assert.equal(geometry.switch.width, 36)
  assert.equal(geometry.switch.height, 20)
  assert.equal(geometry.switch.thumb, 16)
  assert.equal(geometry.hairline, 0.5)
})
console.log('kit.test.mjs ok')
