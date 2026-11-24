// Plugin shim: Machi reads the global quality/pin; the plugin has no pin store yet.
import type { LyricRenderQuality } from '../../../../shared/types'
const QUALITY: LyricRenderQuality = { scale: 1, antialias: 'auto' }
export const useGlobalLyricRenderQuality = (): LyricRenderQuality => QUALITY
export const useLyricRenderQualityPin = (): unknown | null => null
