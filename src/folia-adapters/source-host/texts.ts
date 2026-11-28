/**
 * 音源模组的文字：把镜像来的 locales/*.json 接到 Folium 的 FoliumText 面上。
 *
 * 上游 core 只经 env.text()（拿 FoliumText，交给宿主显示）与 env.translate()（拿当前语言的字符串）
 * 读文字；插件在 Host 里跑，没有那层翻译，所以两份都实现：key() 原样交回 { i18nKey, params }，
 * text() 直接查表出字符串，resolveText() 用于把上游 DTO 里的 FoliumText 在出口处换成字符串。
 *
 * @module dsh-music-panel/folia-adapters/source-host/texts
 */

export interface FoliumTextKey {
  readonly i18nKey: string
  readonly params?: Readonly<Record<string, string | number>>
}

export type FoliumLabel = Readonly<Record<string, string>>
export type FoliumText = string | FoliumLabel | FoliumTextKey | null | undefined

export type LocaleTable = Record<string, unknown>

const DEFAULT_LANGUAGE = 'zh-CN'

const lookup = (table: Record<string, unknown> | undefined, key: string): string | null => {
  if (!table) return null
  let node: unknown = table
  for (const part of key.split('.')) {
    if (node === null || typeof node !== 'object') return null
    node = (node as Record<string, unknown>)[part]
  }
  return typeof node === 'string' ? node : null
}

const substitute = (text: string, params?: Readonly<Record<string, string | number>>): string => (
  params ? text.replace(/\{\{(\w+)\}\}/g, (whole, name: string) => (
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : whole
  )) : text
)

const isTextKey = (value: unknown): value is FoliumTextKey => (
  Boolean(value) && typeof value === 'object' && typeof (value as FoliumTextKey).i18nKey === 'string'
)

export interface SourceTexts {
  key(key: string, params?: Record<string, string | number>): FoliumTextKey
  text(key: string, params?: Record<string, string | number>): string
  resolveText(value: FoliumText): string
  readonly language: string
}

export const createSourceTexts = (locales: Record<string, LocaleTable>, language: string = DEFAULT_LANGUAGE): SourceTexts => {
  const preferred = locales[language] ?? locales[DEFAULT_LANGUAGE]
  const fallback = locales.en
  const text = (key: string, params?: Record<string, string | number>): string => {
    const found = lookup(preferred, key) ?? lookup(fallback, key) ?? lookup(locales[DEFAULT_LANGUAGE], key)
    return substitute(found ?? key, params)
  }
  const resolveText = (value: FoliumText): string => {
    if (typeof value === 'string') return value
    if (value === null || value === undefined) return ''
    if (isTextKey(value)) return text(value.i18nKey, value.params as Record<string, string | number> | undefined)
    const label = value as FoliumLabel
    return label[language] ?? label[DEFAULT_LANGUAGE] ?? label.en ?? Object.values(label)[0] ?? ''
  }
  return {
    language,
    key: (key, params) => (params === undefined ? { i18nKey: key } : { i18nKey: key, params }),
    text,
    resolveText,
  }
}
