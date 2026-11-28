/**
 * 「匹配歌词」的 Folia 算法宿主适配层。
 *
 * 算法（打分、来源顺序、候选挑选、自动匹配的两次重试、AMLL 探测时机）全部来自
 * `src/host/vendor/lyrics-folia/match.bundle.mjs`（即 folia/src/utils/lyrics 的逐字节镜像）；
 * 这里只做三件事：把我们的平铺歌对象换成上游的 SongResult、把上游的 LyricData 换回我们的行，
 * 以及用调用方注入的 io（搜索/取词/AMLL）搭出上游要的 provider。
 *
 * @module dsh-music-panel/lyrics-folia
 */
import {
  autoMatchBestLyric,
  calculateMatchScoreDetails,
  configureAmllDb,
  configureLyricsMatch,
} from '../../vendor/lyrics-folia/match.bundle.mjs'

/** 我们的平铺歌 → 上游 SongResult（字段名不同，语义直译）。 */
export function songResultOf(song, sourceId) {
  const item = song && typeof song === 'object' ? song : {}
  const data = item.data && typeof item.data === 'object' ? item.data : {}
  const artist = String(item.artist ?? item.artists?.[0]?.name ?? '')
  const durationMs = Number(item.durationMs) || (Number(item.durationSec) || 0) * 1000
  return {
    id: String(item.id ?? ''),
    name: String(item.title ?? item.name ?? ''),
    artists: artist === '' ? [] : artist.split(/\s*\/\s*/u).filter(Boolean).map((name) => ({ name })),
    album: { id: item.albumId ?? 0, name: String(item.album ?? '') },
    durationMs,
    ...(item.coverUrl ? { coverUrl: String(item.coverUrl) } : {}),
    ...(Array.isArray(item.aliases) ? { aliases: item.aliases } : {}),
    ...(Array.isArray(item.translatedNames) ? { translatedNames: item.translatedNames } : {}),
    ...(sourceId === 'qq' ? { qqMid: String(data.songmid ?? data.mid ?? item.id ?? '') } : {}),
    sourceRef: { kind: 'online', providerId: sourceId, providerData: { ...data } },
  }
}

/** 我们的行（{t,end,text,words}，秒）→ 上游 LyricData。 */
export function lyricDataOf(lines, extra = {}) {
  const source = Array.isArray(lines) ? lines : []
  return {
    lines: source.map((line) => ({
      fullText: String(line.text ?? line.fullText ?? ''),
      startTime: Number(line.t ?? line.startTime) || 0,
      endTime: Number(line.end ?? line.t ?? line.startTime) || 0,
      words: Array.isArray(line.words)
        ? line.words.map((word) => ({ text: String(word.text ?? ''), startTime: Number(word.t) || 0, endTime: Number(word.end ?? word.t) || 0 }))
        : [],
      ...(typeof line.translation === 'string' && line.translation !== '' ? { translation: line.translation } : {}),
    })),
    isWordByWord: extra.wordLevel === true || source.some((line) => Array.isArray(line.words) && line.words.length > 0),
  }
}

/** 上游 LyricData → 我们的行（秒），附带是否为逐字。 */
export function linesOf(lyricData) {
  const lines = Array.isArray(lyricData?.lines) ? lyricData.lines : []
  return {
    lyrics: lines.map((line) => ({
      t: Number(line.startTime) || 0,
      end: Number(line.endTime) || Number(line.startTime) || 0,
      text: String(line.fullText ?? ''),
      ...(Array.isArray(line.words) && line.words.length > 0
        ? { words: line.words.map((word) => ({ t: Number(word.startTime) || 0, end: Number(word.endTime) || 0, text: String(word.text ?? '') })) }
        : {}),
      ...(typeof line.translation === 'string' && line.translation !== '' ? { translation: line.translation } : {}),
    })),
    wordLevel: lyricData?.isWordByWord === true || lines.some((line) => Array.isArray(line.words) && line.words.length > 0),
  }
}

const providerLyricsOf = (fetched) => {
  if (fetched === null || typeof fetched !== 'object') return null
  const lines = Array.isArray(fetched.lines) ? fetched.lines : []
  if (lines.length === 0) return null
  return {
    lyrics: lyricDataOf(lines, { wordLevel: fetched.wordLevel === true }),
    mainText: typeof fetched.lrc === 'string' ? fetched.lrc : null,
    isPureMusic: fetched.pureMusic === true,
    chorusRanges: [],
  }
}

/**
 * 用调用方的 io 配好上游匹配链：每个平台一个 provider，AMLL 走调用方的客户端。
 */
function configureFromIo(io) {
  const order = Array.isArray(io.order) && io.order.length > 0 ? io.order : []
  const fetched = new Map()
  const candidates = new Map()
  const search = typeof io.search === 'function' ? io.search : async () => []
  const fetchLyric = typeof io.fetchLyric === 'function' ? io.fetchLyric : async () => null
  const sources = []
  for (const sourceId of order) {
    if (sourceId === 'amll') continue
    sources.push({
      id: sourceId,
      platform: true,
      provider: {
        search: {
          searchSongs: async (query, limit) => {
            const found = await search(sourceId, query, limit)
            const items = (Array.isArray(found) ? found : []).map((song) => {
              const converted = songResultOf(song, sourceId)
              // 同一轮重复搜索（标题别名重试）会拿到同样的 id：把这一次的原始候选挂在对象上，
              // 取词时优先用它，避免把上一轮的候选当成这一轮。
              converted.dshMatchCandidate = song
              candidates.set(sourceId + ':' + converted.id, song)
              return converted
            })
            return { items }
          },
        },
        lyrics: {
          getLyrics: async (song) => {
            const key = sourceId + ':' + String(song.id)
            const original = song && typeof song === 'object' ? song.dshMatchCandidate : undefined
            const result = await fetchLyric(sourceId, String(song.id), original ?? candidates.get(key))
            if (result !== null && typeof result === 'object') fetched.set(key, result)
            return providerLyricsOf(result)
          },
          getChorusRanges: async () => [],
          prefersOwnWordByWord: false,
        },
      },
    })
  }
  configureLyricsMatch({ sources, ready: order })
  configureAmllDb({
    fetchLyrics: async (platform, ids) => {
      if (typeof io.fetchAmll !== 'function') return null
      for (const id of ids) {
        const found = await io.fetchAmll(platform, id)
        if (found !== null && typeof found === 'object' && Array.isArray(found.lines) && found.lines.length > 0) {
          return lyricDataOf(found.lines, { wordLevel: found.wordLevel === true })
        }
      }
      return null
    },
  })
  return { candidates, fetched }
}

/** 自动匹配：上游的 autoMatchBestLyric，结果换回路由/记录用的形状。 */
export async function findBestLyricsViaFolia(track, io) {
  const title = String(track?.title ?? '').trim()
  if (title === '') return null
  const { candidates, fetched } = configureFromIo(io)
  const preferred = Array.isArray(io.order) && io.order.length > 0 ? io.order[0] : undefined
  const result = await autoMatchBestLyric(title, String(track?.artist ?? ''), Number(track?.durationMs) || 0, {
    ...(track?.album ? { album: String(track.album) } : {}),
    // 上游允许把非平台源（AMLL）设为偏好：它会在轮到它时先找网易云候选再探测 AMLL。
    ...(preferred ? { preferredSource: preferred } : {}),
    // 上游的别名重试把 title/artist 原样交给搜索：别名只给 title 时 artist 会是 undefined，
    // 它自己的 artist.trim() 会抛错。这里补成字符串（与旧实现一致），不改上游判断。
    ...(typeof io.searchAlias === 'function'
      ? { searchAlias: async () => {
          const alias = await io.searchAlias()
          if (alias === null || typeof alias !== 'object') return alias
          return {
            ...alias,
            ...(alias.artist === undefined ? { artist: String(track?.artist ?? '') } : {}),
            ...(alias.album === undefined && track?.album ? { album: String(track.album) } : {}),
          }
        } }
      : {}),
    ...(typeof io.alternateArtist === 'function' ? { alternateArtist: io.alternateArtist } : {}),
  })
  if (result === null) return null
  if (result.isPureMusic === true) {
    return { source: result.source ?? '', id: String(result.id ?? ''), isPureMusic: true, wordLevel: false, score: 0, lyrics: [] }
  }
  const converted = linesOf(result.lyrics)
  const key = String(result.source ?? '') + ':' + String(result.id ?? result.song?.id ?? '')
  const sourceResult = fetched.get(key) ?? null
  const details = calculateMatchScoreDetails({
    title,
    artist: String(track?.artist ?? ''),
    album: String(track?.album ?? ''),
    durationMs: Number(track?.durationMs) || 0,
  }, result.song)
  return {
    source: String(result.source ?? ''),
    id: String(result.id ?? result.song?.id ?? ''),
    score: Number(details.score) || 0,
    wordLevel: converted.wordLevel,
    lyrics: converted.lyrics,
    candidate: candidates.get(key) ?? result.song,
    ...(sourceResult && sourceResult.raw && typeof sourceResult.raw === 'object' ? { raw: sourceResult.raw } : {}),
    ...(sourceResult && typeof sourceResult.translation === 'string' && sourceResult.translation !== '' ? { translation: sourceResult.translation } : {}),
    ...(sourceResult && typeof sourceResult.romaji === 'string' && sourceResult.romaji !== '' ? { romaji: sourceResult.romaji } : {}),
  }
}

/** 打分：上游的实现，入参换成本插件的歌形状。 */
export function scoreDetailsOf(target, candidate) {
  return calculateMatchScoreDetails(target, songResultOf(candidate, target?.sourceId ?? candidate?.provider ?? ''))
}
