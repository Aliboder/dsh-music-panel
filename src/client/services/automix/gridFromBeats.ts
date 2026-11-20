/**
 * The Beat This! grid boundary used by trackProfile.
 *
 * The full app has the model runner elsewhere. Here the profile analysis uses
 * Folia's own tempo/downbeat estimator when no grid is supplied, so this module
 * only carries the types and a null answer.
 */

export interface BeatGrid {
    beats: number[];
    downbeats: number[];
}

export interface BeatThisGrid {
    bpm: number;
    outroBpm: number | null;
    beatOffset: number;
    downbeatOffset: number | null;
    headDownbeatOffset: number | null;
    beatsPerBar: number;
}

export function gridFromBeats(_grid: BeatGrid, _options: { partial?: boolean } = {}): BeatThisGrid | null {
    return null;
}
