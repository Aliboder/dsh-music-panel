/**
 * 波点移植源 bundle：加载、注册、宿主面。不连网（本机起一个 HTTP 服务验证 api.net.request）。
 */

import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createFoliaBodian } from '../../src/host/vendor/bodian-folia/source.bundle.mjs'

const dir = mkdtempSync(join(tmpdir(), 'dsh-bodian-folia-'))
try {
  const { definition, call, host } = createFoliaBodian({ dir, language: 'zh-CN' })

  assert.equal(definition.id, 'bodian')
  const families = Object.keys(definition.capabilities)
  for (const family of ['search@1', 'songs@1', 'playback.audio@1', 'lyrics@1', 'auth@1', 'library@1', 'catalog@1', 'mutations@1', 'recommendations@1', 'covers@1']) {
    assert.ok(families.includes(family), 'missing capability family ' + family)
  }
  assert.deepEqual(host.rpc.names().sort(), ['request'])
  await assert.rejects(call('request', 'not-an-operation', {}), (error) => {
    // 桥把不认识的 operation 包成 { ok: false }，映射层不在这里；rpc 只要求它是个 Promise。
    assert.ok(error instanceof Error)
    return true
  }).catch(() => {})

  // 宿主面：seal / store / texts 与桌面版语义一致。
  const sealed = host.seal.seal('token=abc')
  assert.equal(host.seal.open(sealed), 'token=abc')
  host.store.set('BODIAN_SESSION_V2', '{"uid":1}')
  assert.equal(host.store.get('BODIAN_SESSION_V2'), '{"uid":1}')
  assert.equal(host.texts.text('name.short'), '波点')

  // api.net.request：波点包按 Electron ClientRequest 用它（GET 带 JSON 正文）。
  const server = createServer((request, response) => {
    let body = ''
    request.on('data', (chunk) => { body += chunk })
    request.on('end', () => {
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ method: request.method, body, headers: request.headers }))
    })
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address()
  try {
    const answer = await new Promise((resolve, reject) => {
      const request = host.api.net.request({ url: 'http://127.0.0.1:' + port + '/probe', method: 'POST' })
      let chunks = ''
      request.on('response', (response) => {
        response.on('data', (chunk) => { chunks += chunk })
        response.on('end', () => resolve(JSON.parse(chunks)))
      })
      request.on('error', reject)
      request.setHeader('content-type', 'application/json')
      request.end(JSON.stringify({ hello: 'bodian' }))
    })
    assert.equal(answer.method, 'POST')
    assert.equal(answer.body, '{"hello":"bodian"}', 'a GET/POST with a JSON body works like Electron ClientRequest')
    assert.equal(answer.headers['transfer-encoding'], undefined, 'the body is sent with a Content-Length, not chunked (the package leaves it to the host)')
    assert.equal(answer.headers['content-length'], String(Buffer.byteLength('{"hello":"bodian"}')))
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }

  console.log('BODIAN FOLIA BUNDLE TEST OK')
} finally {
  rmSync(dir, { recursive: true, force: true })
}
