import classic from './components/visualizer/classic/entry';
import still from './components/visualizer/still/entry';
import tilt from './components/visualizer/tilt/entry';
import partita from './components/visualizer/partita/entry';
import claddagh from './components/visualizer/claddagh/entry';
import cadenza from './components/visualizer/cadenza/entry';
import fume from './components/visualizer/fume/entry';
import cappella from './components/visualizer/cappella/entry';
import machi from './components/visualizer/machi/entry';
import monet from './components/visualizer/monet/entry';
import lumiere from './components/visualizer/lumiere/entry';
import sonnet from './components/visualizer/sonnet/entry';
import tempera from './components/visualizer/tempera/entry';
import hanabi from './components/visualizer/hanabi/entry';
import nebbia from './components/visualizer/nebbia/entry';
import diorama from './components/visualizer/diorama/entry';

// src/render/folia/styles-entry.tsx
// Explicit style registry (Vite's import.meta.glob is replaced). Entries are Folia's;
// the build aliases their settings/preview imports to boundary stubs.

export const FOLIA_STYLE_ENTRIES = {
    classic,
    cappella,
    machi,
    still,
    tilt,
    partita,
    claddagh,
    cadenza,
    fume,
    monet,
    lumiere,
    sonnet,
    tempera,
    hanabi,
    nebbia,
    diorama,
};

// Folia's cover-derived theme generator (used by every style when the page provides a cover).
export { generateBuiltinDualTheme } from './utils/builtinTheme/generateBuiltinDualTheme';
export { extractColors } from './utils/colorExtractor';
export { DEFAULT_THEME, DAYLIGHT_THEME } from './services/baseThemes';
export { applyLyricStaffPolicy } from './utils/lyrics/staffCreditsPolicy';
export { DEFAULT_CLASSIC_TUNING, DEFAULT_TILT_TUNING, DEFAULT_PARTITA_TUNING, DEFAULT_FUME_TUNING, DEFAULT_CLADDAGH_TUNING, DEFAULT_HANABI_TUNING, DEFAULT_CADENZA_TUNING, DEFAULT_SONNET_TUNING, DEFAULT_CAPPELLA_TUNING, DEFAULT_MONET_TUNING } from './types';



export { DEFAULT_MACHI_TUNING } from './components/visualizer/machi/types';
export { DEFAULT_LUMIERE_TUNING } from './types';
