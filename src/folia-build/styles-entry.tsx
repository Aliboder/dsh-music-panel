import classic from '../../folia/src/components/visualizer/classic/entry';
import still from '../../folia/src/components/visualizer/still/entry';
import tilt from '../../folia/src/components/visualizer/tilt/entry';
import partita from '../../folia/src/components/visualizer/partita/entry';
import claddagh from '../../folia/src/components/visualizer/claddagh/entry';
import cadenza from '../../folia/src/components/visualizer/cadenza/entry';
import fume from '../../folia/src/components/visualizer/fume/entry';
import machi from '../../folia/src/components/visualizer/machi/entry';
import monet from '../../folia/src/components/visualizer/monet/entry';
import lumiere from '../../folia/src/components/visualizer/lumiere/entry';
import sonnet from '../../folia/src/components/visualizer/sonnet/entry';
import tempera from '../../folia/src/components/visualizer/tempera/entry';
import hanabi from '../../folia/src/components/visualizer/hanabi/entry';
import nebbia from '../../folia/src/components/visualizer/nebbia/entry';
import diorama from '../../folia/src/components/visualizer/diorama/entry';
import metaphor from '../../folia/src/components/visualizer/metaphor/entry';

// src/render/folia/styles-entry.tsx
// Explicit style registry (Vite's import.meta.glob is replaced). Entries are Folia's;
// the build aliases their settings/preview imports to boundary stubs.

export const FOLIA_STYLE_ENTRIES = {
    classic,
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
    metaphor,
};

// Folia's cover-derived theme generator (used by every style when the page provides a cover).
export { generateBuiltinDualTheme } from '../../folia/src/utils/builtinTheme/generateBuiltinDualTheme';
export { extractColors } from '../../folia/src/utils/colorExtractor';
export { DEFAULT_THEME, DAYLIGHT_THEME } from '../../folia/src/services/baseThemes';
export { applyLyricStaffPolicy } from '../../folia/src/utils/lyrics/staffCreditsPolicy';
export { DEFAULT_CLASSIC_TUNING, DEFAULT_TILT_TUNING, DEFAULT_PARTITA_TUNING, DEFAULT_FUME_TUNING, DEFAULT_CLADDAGH_TUNING, DEFAULT_HANABI_TUNING, DEFAULT_CADENZA_TUNING, DEFAULT_SONNET_TUNING, DEFAULT_MONET_TUNING } from '../../folia/src/types';



export { DEFAULT_MACHI_TUNING } from '../../folia/src/components/visualizer/machi/types';
export { DEFAULT_LUMIERE_TUNING, DEFAULT_DIORAMA_TUNING, DEFAULT_TEMPERA_TUNING } from '../../folia/src/types';
export { DEFAULT_NEBBIA_TUNING } from '../../folia/src/components/visualizer/nebbia/types';
export { DEFAULT_METAPHOR_TUNING } from '../../folia/src/components/visualizer/metaphor/types';
