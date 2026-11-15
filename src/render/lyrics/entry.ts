/**
 * Build entry for Folia's lyric pipeline.
 *
 * `src/utils/lyrics/**` is a verbatim copy of Folia's tree (parsers for LRC / enhanced
 * LRC / YRC / QRC / KRC / TTML, the staff-credit policy, chorus effects, render hints).
 * The plugin's client is a plain concatenation, so this entry bundles the parser into
 * `lyrics.bundle.js` and the client calls `MPFoliaLyrics.parse` instead of rolling its
 * own LRC parser.
 */
import { LyricParserFactory } from '../../utils/lyrics/LyricParserFactory';
import type { RawLyricSource } from '../../utils/lyrics/types';

export { LyricParserFactory } from '../../utils/lyrics/LyricParserFactory';
export { detectNonTtmlTimedLyricFormat } from '../../utils/lyrics/formatDetection';
export { ensureLyricDataRenderHints } from '../../utils/lyrics/renderHints';
export { resolveLyricProcessingOptions } from '../../utils/lyrics/filtering';

/**
 * Parse one raw lyric source exactly as Folia does.
 *
 * @param source Folia's discriminated union (local / qrc / netease / navidrome / embedded)
 * @param options Folia's processing options (interludes, chorus ranges, song id)
 */
export function parse(source: RawLyricSource, options: Record<string, unknown> = {}) {
  return LyricParserFactory.parse(source, options as never);
}
