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
export { applyLyricStaffPolicy } from '../../utils/lyrics/staffCreditsPolicy';
export { applyChorusRangesByTime, applyDetectedChorusEffects } from '../../utils/lyrics/chorusEffects';
export { isPureMusicLyricLines, isPureMusicLyricText } from '../../utils/lyrics/pureMusic';
import { applyLyricStaffPolicy } from '../../utils/lyrics/staffCreditsPolicy';
import { applyChorusRangesByTime, applyDetectedChorusEffects } from '../../utils/lyrics/chorusEffects';
import type { ChorusRange } from '../../utils/lyrics/chorusEffects';
import type { LyricData } from '../../types';

/**
 * Parse one raw lyric source exactly as Folia does.
 *
 * @param source Folia's discriminated union (local / qrc / netease / navidrome / embedded)
 * @param options Folia's processing options (interludes, chorus ranges, song id)
 */
export function parse(source: RawLyricSource, options: Record<string, unknown> = {}) {
  return LyricParserFactory.parse(source, options as never);
}

/**
 * The display-time pass Folia's `createLyricsSetter` applies, in the same order:
 * the staff-credit policy first, then chorus decoration (ranges by time, or the
 * text-repetition fallback when no ranges are known).
 *
 * Not ported here: the user's per-song word segmentation store and icu-folia's
 * automatic segmentation (the plugin has neither a settings surface nor the Vite
 * virtual dictionary the engines load from); both are no-ops in Folia until those
 * exist, and neither changes the line/word timings this pipeline produces.
 */
export function prepare(lyrics: LyricData | null, options: {
  policy?: 'keep' | 'smart' | 'hide';
  chorusRanges?: ChorusRange[];
} = {}): LyricData | null {
  if (!lyrics) return null;
  let next = applyLyricStaffPolicy(lyrics, { policy: options.policy ?? 'smart' });
  if (!next) return null;
  if (next.lines.some((line) => line.isChorus)) return next;
  const ranges = Array.isArray(options.chorusRanges) ? options.chorusRanges : [];
  if (ranges.length > 0) return applyChorusRangesByTime(next, ranges);
  const rebuilt = next.lines.map((line) => `[00:00.00]${line.fullText}`).join('\n');
  return applyDetectedChorusEffects(next, rebuilt);
}
