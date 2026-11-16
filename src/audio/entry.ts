// Boundary entry for the Folia audio subsystem.
//
// Everything below this file is Folia's own source under `A_other/upstream`.
// This file only re-exports the parts the DSH plugin wires into its player;
// it must not grow its own DSP.

import { buildPlaybackGraph } from '../../A_other/upstream/folia-major-main/src/services/playbackGraph'
import {
  applyAudioEqualizerSettings,
  connectAudioEqualizerGraph,
  MOD_EQUALIZER_GLIDE_SECONDS,
  planAudioEqualizerApply,
} from '../../A_other/upstream/folia-major-main/src/services/audioEqualizerGraph'
import { createAudioEffectChain } from '../../A_other/upstream/folia-major-main/src/services/audioEffects/effectChain'
import {
  connectAutomixDeck,
  connectStemBus,
  connectStemDeck,
  rampGain,
  rampGainDb,
  resetThrow,
  resetTone,
  scheduleBandBlend,
  scheduleCrossfade,
  scheduleEchoThrow,
  scheduleStemWindow,
  softLimit,
} from '../../A_other/upstream/folia-major-main/src/services/automix/crossfadeGraph'
import { createDeckAnalyser } from '../../A_other/upstream/folia-major-main/src/services/automix/deckAnalyser'
import { createBalanceMeter } from '../../A_other/upstream/folia-major-main/src/services/volumeBalance/balanceMeter'
import {
  createPlaybackFadeController,
  PLAYBACK_FADE_SECONDS,
} from '../../A_other/upstream/folia-major-main/src/services/playbackFade'
import {
  AUDIO_EQUALIZER_BANDS,
  DEFAULT_AUDIO_EQUALIZER_SETTINGS,
  audioEqualizerBandShape,
  normalizeAudioEqualizerGains,
  resolveAudioEqualizerSettings,
} from '../../A_other/upstream/folia-major-main/src/utils/audioEqualizer'
import {
  AUDIO_EFFECT_CONTROLS,
  DEFAULT_AUDIO_EFFECT_SETTINGS,
  normalizeAudioEffects,
} from '../../A_other/upstream/folia-major-main/src/utils/audioEffects'

export {
  AUDIO_EQUALIZER_BANDS,
  AUDIO_EFFECT_CONTROLS,
  DEFAULT_AUDIO_EFFECT_SETTINGS,
  DEFAULT_AUDIO_EQUALIZER_SETTINGS,
  MOD_EQUALIZER_GLIDE_SECONDS,
  PLAYBACK_FADE_SECONDS,
  applyAudioEqualizerSettings,
  audioEqualizerBandShape,
  buildPlaybackGraph,
  connectAudioEqualizerGraph,
  connectAutomixDeck,
  connectStemBus,
  connectStemDeck,
  createAudioEffectChain,
  createBalanceMeter,
  createDeckAnalyser,
  createPlaybackFadeController,
  normalizeAudioEffects,
  normalizeAudioEqualizerGains,
  planAudioEqualizerApply,
  rampGain,
  rampGainDb,
  resetThrow,
  resetTone,
  resolveAudioEqualizerSettings,
  scheduleBandBlend,
  scheduleCrossfade,
  scheduleEchoThrow,
  scheduleStemWindow,
  softLimit,
}
