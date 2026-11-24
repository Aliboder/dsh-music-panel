import classic from '../folia/components/visualizer/classic/entry';
import still from '../folia/components/visualizer/still/entry';
import tilt from '../folia/components/visualizer/tilt/entry';
import partita from '../folia/components/visualizer/partita/entry';
import claddagh from '../folia/components/visualizer/claddagh/entry';
import cadenza from '../folia/components/visualizer/cadenza/entry';
import fume from '../folia/components/visualizer/fume/entry';
import cappella from '../folia/components/visualizer/cappella/entry';
import machi from '../folia/components/visualizer/machi/entry';
import monet from '../folia/components/visualizer/monet/entry';
import lumiere from '../folia/components/visualizer/lumiere/entry';
import sonnet from '../folia/components/visualizer/sonnet/entry';
import tempera from '../folia/components/visualizer/tempera/entry';
import hanabi from '../folia/components/visualizer/hanabi/entry';
import nebbia from '../folia/components/visualizer/nebbia/entry';
import diorama from '../folia/components/visualizer/diorama/entry';

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
export { generateBuiltinDualTheme } from '../folia/utils/builtinTheme/generateBuiltinDualTheme';
export { extractColors } from '../folia/utils/colorExtractor';
export { DEFAULT_THEME, DAYLIGHT_THEME } from '../folia/services/baseThemes';
export { applyLyricStaffPolicy } from '../folia/utils/lyrics/staffCreditsPolicy';
export { DEFAULT_CLASSIC_TUNING, DEFAULT_TILT_TUNING, DEFAULT_PARTITA_TUNING, DEFAULT_FUME_TUNING, DEFAULT_CLADDAGH_TUNING, DEFAULT_HANABI_TUNING, DEFAULT_CADENZA_TUNING, DEFAULT_SONNET_TUNING, DEFAULT_CAPPELLA_TUNING, DEFAULT_MONET_TUNING } from '../folia/types';



export { DEFAULT_MACHI_TUNING } from '../folia/components/visualizer/machi/types';
export { DEFAULT_LUMIERE_TUNING, DEFAULT_DIORAMA_TUNING, DEFAULT_TEMPERA_TUNING } from '../folia/types';
