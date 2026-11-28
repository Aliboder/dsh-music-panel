/**
 * 一次「拿不到播放地址」的失败分类 —— Folia `services/onlineMusic/failure/onlineFailureCase.ts` 的移植。
 *
 * 音源（移植源）把平台自己的错误说法（describeFailure）交上来；这里只按共用规则拼成一种有名字的情况，
 * 界面按情况说标题、决定停不停播放 / 要不要跳过（`stopsPlayback`）。
 *
 * case 表与 Folia 同名同语义：
 *   stops    播放停在失败上（用户自己能处理：登录、会员、购买、权限、试听、地区、服务没配好）
 *   unplayable 「无法播放时自动跳过」打开时也跳过（这首歌在这个账号上放不了）
 *   retry    没有下一首可跳时给「重试」
 * @module dsh-music-panel/playback/online-failure
 */

export const ONLINE_FAILURE_CASES = {
  unreachable: { stops: false, retry: true },
  'local-service-stopped': { stops: false, retry: true },
  'retry-later': { stops: false, retry: false },
  'sign-in-needed': { stops: true, retry: false },
  'account-refused': { stops: true, retry: false },
  'subscription-required': { stops: true, retry: false, unplayable: true },
  'purchase-required': { stops: true, retry: false, unplayable: true },
  'entitlement-required': { stops: true, retry: false, unplayable: true },
  'preview-only': { stops: true, retry: false, unplayable: true },
  'region-restricted': { stops: true, retry: false, unplayable: true },
  'not-configured': { stops: true, retry: false },
  'taken-down': { stops: false, retry: false },
  'no-audio': { stops: false, retry: false },
  'audio-unplayable': { stops: false, retry: false },
  'not-public': { stops: false, retry: false },
  refused: { stops: false, retry: true },
  unknown: { stops: false, retry: true },
}

/** 这次失败停不停下播放（Folia `stopsPlayback`）。 */
export function stopsPlayback(caseId, autoSkipUnplayable = false) {
  const rule = ONLINE_FAILURE_CASES[caseId] ?? ONLINE_FAILURE_CASES.unknown
  return rule.stops && !(autoSkipUnplayable === true && rule.unplayable === true)
}

// 音源 describeFailure（Folia 每家的 describeXxxFailure）已经点名的几种。
const DETAIL_CASES = new Set(Object.keys(ONLINE_FAILURE_CASES))

/** 普通错误码 → 情况（Folia 的 REFUSAL_CASES 与 caseIdOf 规则）。 */
export function classifyOnlineFailure(facts = {}) {
  const detail = facts.detail && typeof facts.detail === 'object' ? facts.detail : null
  if (detail && detail.signedOut === true && typeof detail.case !== 'string') return { case: 'sign-in-needed' }
  if (detail && typeof detail.case === 'string' && DETAIL_CASES.has(detail.case)) return { case: detail.case }
  const code = typeof facts.errorCode === 'string' ? facts.errorCode : ''
  if (code === 'auth-required') return { case: 'sign-in-needed' }
  if (code === 'not-configured') return { case: 'not-configured' }
  const status = Number(facts.status) || 0
  if (Number(facts.retryAfterMs) > 0 || status === 429) return { case: 'retry-later' }
  if (status >= 500) return { case: 'unreachable' }
  if (status >= 400) return { case: 'refused' }
  if (code === 'network' || code === 'timeout') return { case: 'unreachable' }
  if (code === 'not-playable') return { case: 'no-audio' }
  if (typeof detail?.code === 'string' || typeof detail?.message === 'string') return { case: 'refused' }
  return { case: 'unknown' }
}

/** 给界面的一行原话（平台自己的说法，日志与提示引用）。 */
export function failureQuote(failure) {
  if (!failure || typeof failure !== 'object') return ''
  if (typeof failure.message === 'string' && failure.message !== '') return failure.message
  if (Number(failure.status) > 0) return 'HTTP ' + failure.status
  return ''
}
