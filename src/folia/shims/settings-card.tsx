import React from 'react';

// src/render/folia/shims/settings-card.tsx
// Folia's settings window is not hosted yet: every settings panel/card and the settings
// kit resolve to no-ops here, while the entries that declare them stay verbatim.

const Stub = () => null;

export const CommonBackgroundSettingsCard = Stub;
export const LatentBackgroundSettingsCard = Stub;
export const MonetBackgroundSettingsCard = Stub;
export const NomandBackgroundSettingsCard = Stub;
export const SoraBackgroundSettingsCard = Stub;
export const UrlBackgroundSettingsCard = Stub;

export const CappellaSettingsPanel = Stub;
export const ClassicSettingsPanel = Stub;
export const CadenzaSettingsPanel = Stub;
export const CladdaghSettingsPanel = Stub;
export const DioramaSettingsPanel = Stub;
export const FumeSettingsPanel = Stub;
export const HanabiSettingsPanel = Stub;
export const LumiereSettingsPanel = Stub;
export const MachiSettingsPanel = Stub;
export const MonetSettingsPanel = Stub;
export const NebbiaSettingsPanel = Stub;
export const PartitaSettingsPanel = Stub;
export const SonnetSettingsPanel = Stub;
export const StillSettingsPanel = Stub;
export const TemperaSettingsPanel = Stub;
export const TiltSettingsPanel = Stub;

export const Tooltip = Stub;
export const SettingsKitThemeContext = React.createContext(null);
export const NEBBIA_APPEAR_LABEL_KEYS: Record<string, string> = {};
export const NEBBIA_FADE_LABEL_KEYS: Record<string, string> = {};
export const Group = Stub;
export const Row = Stub;
export const PictureGrid = Stub;
export const Slider = Stub;
export const Select = Stub;
export const Toggle = Stub;

export default Stub;

// Machi camera bar / settings controls: rendered only on the player page; DSH styling is not used here.
const passthrough = (name: string) => {
    const Component = (props: any) => React.createElement(name, props, props && props.children);
    return Component;
}
export const Button = passthrough('button');
export const Segmented = passthrough('div');
export const Tabs = passthrough('div');
export const SliderControl = () => null;
export const ToggleControl = () => null;
export const settingsTokens = () => ({});
export const percent = (value: number) => `${Math.round(value * 100)}%`;
export const times = (value: number) => `${value}×`;
