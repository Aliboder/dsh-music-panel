/**
 * 取流失败的分类：Folia `services/onlineMusic/failure/onlineFailureCase.ts` 的规则（移植到 Host）。
 * 音源自己的 describeFailure 先说话，其次按错误码 / HTTP 状态 / 限流落到一种情况；
 * stopsPlayback 决定失败时停不停（autoSkipUnplayable 打开时，unplayable 的几种也跳过）。
 */

import assert from 'node:assert/strict'
import { classifyOnlineFailure, stopsPlayback, ONLINE_FAILURE_CASES } from '../../src/host/services/playback/online-failure.js'

// 音源自己点名的情况优先。
assert.equal(classifyOnlineFailure({ detail: { case: 'entitlement-required' } }).case, 'entitlement-required')
assert.equal(classifyOnlineFailure({ detail: { case: 'no-audio' } }).case, 'no-audio')
assert.equal(classifyOnlineFailure({ detail: { signedOut: true } }).case, 'sign-in-needed')

// 共用错误码。
assert.equal(classifyOnlineFailure({ errorCode: 'auth-required' }).case, 'sign-in-needed')
assert.equal(classifyOnlineFailure({ errorCode: 'not-configured' }).case, 'not-configured')
assert.equal(classifyOnlineFailure({ errorCode: 'network' }).case, 'unreachable')
assert.equal(classifyOnlineFailure({ errorCode: 'timeout' }).case, 'unreachable')
assert.equal(classifyOnlineFailure({ errorCode: 'not-playable' }).case, 'no-audio')
assert.equal(classifyOnlineFailure({ errorCode: 'unsupported' }).case, 'unknown', 'unsupported alone is not a named case')

// HTTP 状态与限流。
assert.equal(classifyOnlineFailure({ status: 429 }).case, 'retry-later')
assert.equal(classifyOnlineFailure({ retryAfterMs: 5000 }).case, 'retry-later')
assert.equal(classifyOnlineFailure({ status: 503 }).case, 'unreachable')
assert.equal(classifyOnlineFailure({ status: 404 }).case, 'refused')
assert.equal(classifyOnlineFailure({}).case, 'unknown')

// 停不停：登录/会员/购买会停，自动跳过打开时会员/购买可以跳过；纯网络失败不停。
assert.equal(stopsPlayback('sign-in-needed', false), true)
assert.equal(stopsPlayback('sign-in-needed', true), true, 'signing in fixes the next song too')
assert.equal(stopsPlayback('subscription-required', false), true)
assert.equal(stopsPlayback('subscription-required', true), false, 'auto skip may skip a membership-only song')
assert.equal(stopsPlayback('purchase-required', true), false)
assert.equal(stopsPlayback('no-audio', false), false)
assert.equal(stopsPlayback('unreachable', false), false)
assert.equal(stopsPlayback('not-a-case', false), false)

// 表与 Folia 同名同语义：每种情况都有 stops（未知的走 unknown）。
assert.equal(ONLINE_FAILURE_CASES.unknown.stops, false)
assert.equal(ONLINE_FAILURE_CASES['sign-in-needed'].stops, true)
assert.equal(ONLINE_FAILURE_CASES['subscription-required'].unplayable, true)

console.log('online-failure.test ok')
