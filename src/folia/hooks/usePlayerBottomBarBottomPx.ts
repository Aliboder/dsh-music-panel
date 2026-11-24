// Plugin shim: the player page's transport pill sits 16px above the bottom edge and is about
// 64px tall, so the shared bottom subtitle (and machi's camera bar) clear it instead of
// sitting on the page edge, which parked the translation line under the pill.
//
// Folia's own numbers are base 32 + clearance 80; this page's bar is 16 lower, so the
// clearance stays and the base follows the bar: 16 + 80 = 96. With the chrome hidden the
// subtitle keeps Folia's 32px breathing room instead of dropping back onto the edge.
const SUBTITLE_BOTTOM_WITH_BAR_PX = 96
const SUBTITLE_BOTTOM_WITHOUT_BAR_PX = 32

export const usePlayerSubtitleBottomPx = (isPlayerChromeHidden = false): number => (
    isPlayerChromeHidden ? SUBTITLE_BOTTOM_WITHOUT_BAR_PX : SUBTITLE_BOTTOM_WITH_BAR_PX
)
export const usePlayerSubtitleYieldsToDock = (): boolean => false
