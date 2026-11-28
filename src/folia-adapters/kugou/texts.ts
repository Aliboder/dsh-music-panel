/**
 * 酷狗音源模组的文字：把上游语言表（sources/kugou/locales/*.json）接到 Folium 的 FoliumText 面上。
 *
 * 上游的 core 只经 env.text()（拿 FoliumText，交给宿主显示）和 env.translate()（拿当前语言的字符串，
 * 用作集合名字）读文字；桌面版由宿主把 i18nKey 换成译文。本插件在 Host 里跑，没有那层翻译，
 * 所以这里两份都实现：key() 原样交回 { i18nKey, params }，text() 直接查表出字符串，
 * resolveText() 用于把上游 DTO 里的 FoliumText 在出口处换成字符串。
 *
 * @module dsh-music-panel/folia-adapters/kugou/texts
 */
import zhCN from '../../../folia/sources/kugou/locales/zh-CN.json'
import en from '../../../folia/sources/kugou/locales/en.json'
import inLocale from '../../../folia/sources/kugou/locales/in.json'
import vi from '../../../folia/sources/kugou/locales/vi.json'

/** Folium 的 FoliumTextKey：语言表里的一个键，加 {{name}} 的取值。 */
export interface FoliumTextKey {
  readonly i18nKey: string
  readonly params?: Readonly<Record<string, string | number>>
}

/** Folium 的 FoliumLabel：每种语言一条文字。 */
export type FoliumLabel = Readonly<Record<string, string>>

/** Folium 的 FoliumText。 */
export type FoliumText = string | FoliumLabel | FoliumTextKey | null | undefined

const TABLES: Record<string, Record<string, unknown>> = {
  'zh-CN': zhCN as Record<string, unknown>,
  en: en as Record<string, unknown>,
  id: inLocale as Record<string, unknown>,
  in: inLocale as Record<string, unknown>,
  vi: vi as Record<string, unknown>,
}

const DEFAULT_LANGUAGE = 'zh-CN'

/** 语言表是嵌套的，键写成点号路径（name.short）。 */
const lookup = (table: Record<string, unknown> | undefined, key: string): string | null => {
  if (!table) return null
  let node: unknown = table
  for (const part of key.split('.')) {
    if (node === null || typeof node !== 'object') return null
    node = (node as Record<string, unknown>)[part]
  }
  return typeof node === 'string' ? node : null
}

/** {{name}} 的取值替换，和宿主那边的写法一致。 */
const substitute = (text: string, params?: Readonly<Record<string, string | number>>): string => {
  if (!params) return text
  return text.replace(/\{\{(\w+)\}\}/g, (whole, name: string) => (
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : whole
  ))
}

const isTextKey = (value: unknown): value is FoliumTextKey => (
  Boolean(value) && typeof value === 'object' && typeof (value as FoliumTextKey).i18nKey === 'string'
)

/** 一个语言下的 SourceTexts：上游 core 要的 env.text / env.translate，加出口用的 resolveText。 */
export interface SourceTexts {
  /** FoliumText：语言表键加取值。 */
  key(key: string, params?: Record<string, string | number>): FoliumTextKey
  /** 当前语言下的字符串。 */
  text(key: string, params?: Record<string, string | number>): string
  /** 把上游交回的 FoliumText 换成当前语言的字符串。 */
  resolveText(value: FoliumText): string
  /** 当前语言。 */
  readonly language: string
}

export const createSourceTexts = (language: string = DEFAULT_LANGUAGE): SourceTexts => {
  const preferred = TABLES[language] ?? TABLES[DEFAULT_LANGUAGE]
  const fallback = TABLES.en
  const text = (key: string, params?: Record<string, string | number>): string => {
    const found = lookup(preferred, key) ?? lookup(fallback, key) ?? lookup(TABLES[DEFAULT_LANGUAGE], key)
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
