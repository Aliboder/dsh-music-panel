/**
 * Lyric match service — the backend of the "匹配歌词" window.
 *
 * Ported from Folia: `onlineMetadataSearchService` scores every candidate with the
 * same `calculateMatchScoreDetails` the automatic pick uses, and a source answers
 * candidates for one platform (or for the AMLL TTML DB, which is keyed by that
 * platform's song ids but searched by name).
 *
 * Media come from the unified source layer (`omni`), never from public web APIs, so
 * the window searches through the same transport playback uses.
 *
 * @module dsh-music-panel/lyrics-match-service
 */

import { calculateMatchScoreDetails } from './lyrics-match.js'
import { buildLyricsUrl } from './amll.js'

/** The tabs of the window, in Folia's order. */
export const MATCH_SOURCES = [
  { id: 'netease', label: 'NetEase Cloud Music', kind: 'platform' },
  { id: 'amll', label: 'AMLLDB', kind: 'catalog' },
  { id: 'qq', label: 'QQ Music', kind: 'platform' },
  { id: 'kugou', label: 'KuGou Music', kind: 'platform' },
  { id: 'bodian', label: 'Bodian Music', kind: 'platform' },
]

const AMLL_SEARCH_URL = 'https://api.amll.dev/v1/lyrics/search'

function toCandidate(source, song, target) {
  const details = calculateMatchScoreDetails(target, {
    title: song.title,
    artist: song.artist,
    album: song.album,
    durationMs: Number(song.durationMs) || (Number(song.durationSec) || 0) * 1000,
  })
  return {
    source,
    id: String(song.id ?? ''),
    title: String(song.title ?? ''),
    artists: Array.isArray(song.artistsDetail)
      ? song.artistsDetail.map((entry) => entry.name)
      : String(song.artist ?? '')
          .split(/\s*\/\s*/)
          .filter(Boolean),
    album: String(song.album ?? ''),
    coverUrl: String(song.coverUrl ?? song.cover ?? ''),
    durationMs: Number(song.durationMs) || (Number(song.durationSec) || 0) * 1000,
    score: details.score,
    titleMatched: details.titleMatched,
    durationMatched: details.durationMatched,
  }
}

/**
 * @param {{
 *   omni: { searchPage: Function, lyric: Function },
 *   providerStore?: { cookie: Function },
 *   fetchImpl?: typeof fetch,
 *   amllBaseUrl?: string,
 *   timeoutMs?: number,
 * }} deps
 */
export function createLyricMatchService(deps) {
  const fetchImpl = deps.fetchImpl ?? fetch
  const timeoutMs = deps.timeoutMs ?? 6000

  async function searchPlatform(source, query, target) {
    const cookie = deps.providerStore === undefined ? '' : await deps.providerStore.cookie(source)
    const paged = await deps.omni.searchPage(source, query, { cookie }, 1)
    const rows = Array.isArray(paged.results) ? paged.results : []
    return rows
      .map((song) => toCandidate(source, song, target))
      .sort((left, right) => right.score - left.score)
  }

  async function searchAmll(query, target) {
    const search = new URLSearchParams({ q: query, pageSize: '20' })
    const url = `${deps.amllBaseUrl ?? 'https://api.amll.dev'}/v1/lyrics/search?${search.toString()}`
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) })
    if (!response.ok) return []
    const body = await response.json()
    const items = Array.isArray(body?.data?.items) ? body.data.items : Array.isArray(body?.items) ? body.items : []
    return items
      .map((item) => {
        // AMLL is keyed by the platform's song id: prefer the NetEase id, then QQ's.
        const id =
          (Array.isArray(item.ncmMusicIds) && item.ncmMusicIds[0]) ||
          (Array.isArray(item.qqMusicIds) && item.qqMusicIds[0]) ||
          ''
        if (String(id) === '') return null
        const title = Array.isArray(item.musicNames) ? String(item.musicNames[0] ?? '') : ''
        const artist = Array.isArray(item.artistNames) ? item.artistNames.join(' / ') : ''
        const album = Array.isArray(item.albumNames) ? String(item.albumNames[0] ?? '') : ''
        const details = calculateMatchScoreDetails(target, { title, artist, album })
        return {
          source: 'amll',
          id: String(id),
          title,
          artists: Array.isArray(item.artistNames) ? item.artistNames : [],
          album,
          coverUrl: '',
          durationMs: 0,
          score: details.score,
          titleMatched: details.titleMatched,
          durationMatched: details.durationMatched,
        }
      })
      .filter((entry) => entry !== null)
      .sort((left, right) => right.score - left.score)
  }

  return {
    sources() {
      return MATCH_SOURCES.map((source) => ({ id: source.id, label: source.label }))
    },

    /**
     * @param {{ source: string, query: string, target: { title: string, artist?: string, album?: string, durationMs?: number } }} input
     */
    async search(input) {
      const source = MATCH_SOURCES.find((entry) => entry.id === input.source)
      if (source === undefined) return { source: input.source, candidates: [], error: 'unknown source' }
      const query = String(input.query ?? '').trim()
      if (query === '') return { source: source.id, candidates: [], error: '' }
      try {
        const candidates =
          source.id === 'amll'
            ? await searchAmll(query, input.target)
            : await searchPlatform(source.id, query, input.target)
        return { source: source.id, candidates, error: '' }
      } catch (error) {
        return { source: source.id, candidates: [], error: String(error?.message ?? error) }
      }
    },

    /**
     * What the preview panel shows for one candidate.
     *
     * @param {{ source: string, id: string, platform?: 'ncm'|'qq' }} input
     */
    async preview(input) {
      const id = String(input.id ?? '').trim()
      if (id === '') return { lrc: '', translation: '', romaji: '', lines: null, wordLevel: false }
      if (input.source === 'amll') {
        const url = buildLyricsUrl(input.platform === 'qq' ? 'qq' : 'ncm', id, deps.amllBaseUrl)
        const response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) })
        if (!response.ok) return { lrc: '', translation: '', romaji: '', lines: null, wordLevel: false }
        const body = await response.json()
        const { parseTtml } = await import('./amll.js')
        const lines = parseTtml(body?.data?.lyrics)
        return {
          lrc: lines === null ? '' : lines.map((line) => line.text).join('\n'),
          translation: '',
          romaji: '',
          lines,
          wordLevel: lines !== null && lines.some((line) => Array.isArray(line.words)),
        }
      }
      const cookie = deps.providerStore === undefined ? '' : await deps.providerStore.cookie(String(input.source))
      const lyric = await deps.omni.lyric(String(input.source), id, { cookie })
      return {
        lrc: String(lyric?.lrc ?? ''),
        translation: String(lyric?.translation ?? ''),
        romaji: String(lyric?.romaji ?? ''),
        lines: Array.isArray(lyric?.lines) ? lyric.lines : null,
        wordLevel: lyric?.wordLevel === true,
      }
    },
  }
}
