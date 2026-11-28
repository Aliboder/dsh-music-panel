/**
 * `folia/` 镜像与上游对齐（结构 + 内容受控）。
 *
 * 校验脚本本身就是规则：镜像里每个文件必须在上游同相对路径存在；内容必须逐字节相同，
 * 除非登记在 folia/mirror.manifest.json 的 adapted 里（并记录登记时的上游哈希）。
 * 这个测试保证规则一直在检验，而不是只在发布前跑一次。
 */

import assert from 'node:assert/strict'
import { checkFoliaMirror } from '../../scripts/check-folia-mirror.mjs'

const result = checkFoliaMirror()

if (result.skipped === true) {
  console.log('folia-mirror.test skipped: ' + result.reason)
} else {
  assert.equal(result.ok, true, 'mirror errors:\n' + result.errors.join('\n'))
  assert.equal(result.checked > 900, true, 'mirror should cover the ported files')
  assert.equal(result.adapted > 0, true, 'adapted files are listed in folia/mirror.manifest.json')
  assert.equal(result.adapted < 120, true, 'adapted list must stay a reviewable exception list')
  console.log('folia-mirror.test ok (' + result.checked + ' files, ' + result.adapted + ' adapted)')
}
