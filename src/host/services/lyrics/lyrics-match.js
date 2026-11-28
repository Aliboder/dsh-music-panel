/**
 * Lyric candidate scoring — a port of Folia's `src/utils/lyrics/matchScore.ts`.
 *
 * The model is deliberately identical to Folia's so the two pick the same
 * candidate for the same song:
 *   - title 45 / artist 25 / album 30, normalised by wanakana (kana → romaji)
 *     plus OpenCC (traditional → simplified) and punctuation stripping
 *   - duration is a **multiplier**, not an addend
 *   - any missing identity component caps the score at 74, one below the
 *     75 acceptance threshold, so a title match alone can never borrow lyrics
 *
 * @module dsh-music-panel/lyrics-match
 */

import * as OpenCC from 'opencc-js'
import * as wanakana from 'wanakana'

const t2sConverter = OpenCC.Converter({ from: 't', to: 'cn' })

import { calculateMatchScoreDetails as calculateFoliaMatchScoreDetails } from '../../vendor/lyrics-folia/match.bundle.mjs'
import { songResultOf } from './lyrics-folia.js'

export const SCORE_WEIGHTS = { title: 45, artist: 25, album: 30 }
export const AUTO_MATCH_MIN_SCORE = 75
export const AUTO_MATCH_COMPONENT_MISS_SCORE_CAP = 74

/** Version markers: a bracketed word that is part of the song's identity. */
const VERSION_MARKER = /(instrumental|inst|off\s*vocal|karaoke|remix|mix|version|ver\.?|cover|live|edit|arrange|伴奏|カラオケ|インスト|リミックス|remaster|remastered)/iu

/** Lower-case, kana→romaji, traditional→simplified, punctuation removed. */
export function normalizeLyricMatchText(value) {
  const romajiValue = wanakana.toRomaji(String(value ?? ''))
  const simpValue = t2sConverter(romajiValue)
  return simpValue
    .toLowerCase()
    .replace(/[\p{P}\p{S}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Title normalisation drops feat. credits and non-identity brackets. */
export function normalizeTitleForMatch(value) {
  return normalizeLyricMatchText(
    String(value ?? '')
      .replace(/[([（【]\s*(feat|featuring|ft)\.?\s+[^)\]）】]+[)\]）】]/giu, '')
      .replace(/\b(feat|featuring|ft)\.?\s+.+$/iu, '')
      .replace(/[([（【]([^)\]）】]+)[)\]）】]/gu, (match, content) =>
        VERSION_MARKER.test(content) ? match : '',
      ),
  )
}

/** Jaccard character-set similarity over normalised strings. */
export function stringSimilarity(left, right, normalizer = normalizeLyricMatchText) {
  const a = normalizer(left)
  const b = normalizer(right)
  if (a === '' || b === '') return 0
  if (a === b) return 1
  if (a.includes(b) || b.includes(a)) {
    return Math.min(a.length, b.length) / Math.max(a.length, b.length)
  }
  const setA = new Set(a)
  const setB = new Set(b)
  let intersection = 0
  for (const character of setA) {
    if (setB.has(character)) intersection += 1
  }
  const union = new Set([...setA, ...setB]).size
  return union > 0 ? intersection / union : 0
}

function splitArtists(artistText) {
  return String(artistText ?? '')
    .split(/[,&、/]|feat\.?|ft\.?|featuring|与/i)
    .map((name) => normalizeLyricMatchText(name))
    .filter((name) => name.length > 0)
}

function calculateArtistSimilarity(target, search) {
  const targetArtists = splitArtists(target)
  const searchArtists = splitArtists(search)
  if (targetArtists.length === 0 || searchArtists.length === 0) {
    return stringSimilarity(target, search)
  }

  let matchCount = 0
  for (const left of targetArtists) {
    for (const right of searchArtists) {
      if (
        left === right ||
        (left.length >= 3 && right.includes(left)) ||
        (right.length >= 3 && left.includes(right))
      ) {
        matchCount += 1
        break
      }
    }
  }

  const tokenSim = matchCount / Math.max(targetArtists.length, searchArtists.length)
  const mainArtistMatched =
    targetArtists[0] !== undefined &&
    searchArtists[0] !== undefined &&
    (targetArtists[0] === searchArtists[0] ||
      (targetArtists[0].length >= 3 && searchArtists[0].includes(targetArtists[0])) ||
      (searchArtists[0].length >= 3 && targetArtists[0].includes(searchArtists[0])))
  const mainBonus = mainArtistMatched ? Math.max(tokenSim, 0.7) : tokenSim
  return Math.max(mainBonus, stringSimilarity(target, search))
}

/** Duration tolerance, in milliseconds, exactly as Folia grades it. */
export function calculateDurationScore(targetMs, searchMs) {
  if (!(targetMs > 0) || !(searchMs > 0)) return { multiplier: 0.9, matched: null }
  const diff = Math.abs(targetMs - searchMs)
  if (diff <= 1000) return { multiplier: 1, matched: true }
  if (diff <= 3000) return { multiplier: 0.95, matched: true }
  if (diff <= 5000) return { multiplier: 0.75, matched: false }
  if (diff <= 10000) return { multiplier: 0.35, matched: false }
  return { multiplier: 0.1, matched: false }
}

/**
 * Component details for one candidate, in Folia's shape.
 *
 * @param {{ title: string, artist: string, album?: string, durationMs?: number }} track
 * @param {{ title?: string, name?: string, artist?: string, album?: string, durationMs?: number, durationSec?: number }} candidate
 */
export function calculateMatchScoreDetails(target, candidate) {
  const converted = songResultOf(candidate, candidate && candidate.provider)
  return calculateFoliaMatchScoreDetails({
    title: String(target?.title ?? ''),
    artist: String(target?.artist ?? ''),
    ...(target?.album ? { album: String(target.album) } : {}),
    durationMs: Number(target?.durationMs) || 0,
  }, converted)
}

/** Score 0..100 for one candidate — now Folia's own matchScore (src/folia/utils/lyrics), via the host adapter. */
export function calculateMatchScore(track, candidate) {
  return calculateMatchScoreDetails(track, candidate).score
}

/**
 * Best candidate at or above `AUTO_MATCH_MIN_SCORE`, or null.
 * @returns {{ candidate: object, score: number } | null}
 */
export function pickBestLyricCandidate(track, candidates) {
  if (!Array.isArray(candidates) || candidates.length === 0) return null
  let best = null
  let bestScore = 0
  for (const candidate of candidates) {
    const score = calculateMatchScore(track, candidate)
    if (score > bestScore) {
      bestScore = score
      best = candidate
    }
  }
  if (best === null || bestScore < AUTO_MATCH_MIN_SCORE) return null
  return { candidate: best, score: bestScore }
}