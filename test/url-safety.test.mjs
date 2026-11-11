import assert from 'node:assert/strict'
import { assertPublicHttpUrl, isAllowedCoverUrl } from '../lib/url-safety.js'

assert.equal(isAllowedCoverUrl('https://p1.music.126.net/x.jpg'), true)
assert.equal(isAllowedCoverUrl('https://y.gtimg.cn/music/photo_new/x.jpg'), true)
assert.equal(isAllowedCoverUrl('https://imge.kugou.com/x.jpg'), true)
assert.equal(isAllowedCoverUrl('http://127.0.0.1/x.jpg'), false)
assert.equal(isAllowedCoverUrl('http://localhost/x.jpg'), false)
assert.equal(isAllowedCoverUrl('file:///etc/passwd'), false)

await assert.rejects(() => assertPublicHttpUrl('http://127.0.0.1/secret'), /不合法|内网|本机/)
await assert.rejects(() => assertPublicHttpUrl('http://localhost/secret'), /不合法|内网|本机/)
await assert.rejects(() => assertPublicHttpUrl('file:///etc/passwd'), /不合法/)
assert.ok(await assertPublicHttpUrl('https://8.8.8.8/x.jpg'))

console.log('url-safety.test.mjs ok')


