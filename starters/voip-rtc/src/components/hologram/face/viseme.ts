/* ThreeLS-style audio-driven mouth shaping (Llorach et al. 2016,
   threelipsync): the relative power split across 4 bands (0-500 /
   500-700 / 700-3000 / 3000-6000 Hz, from the SDK snapshot) picks the
   mouth SHAPE while the envelope keeps gating how much it shows.
   Source formulas adapted from absolute AnalyserNode energies to our
   relative distribution: kiss -> mouthFunnel (hollow mid + low-mid
   formant gate), lipsClosed -> mouthClose (sibilant high band),
   mouthOpen -> jawOpen (low bands minus highs). Without spectral data
   (HologramBust preview, legacy streams) the mapping degrades exactly
   to the envelope-only path. */

import { mouthTargetsFromAudio, type AudioEnvelope } from "./audio.js";

export type BandLevels = readonly [number, number, number, number];

export interface MouthTargets {
  jawOpen: number;
  mouthClose: number;
  mouthFunnel: number;
  glowMouth: number;
}

export function mouthTargets(
  env: AudioEnvelope,
  bands: BandLevels | null,
): MouthTargets {
  const fallback = { ...mouthTargetsFromAudio(env), mouthFunnel: 0 };
  if (!bands) return fallback;
  const total = bands[0] + bands[1] + bands[2] + bands[3];
  if (total < 0.5) return fallback;

  const voiced = env.envelope;
  /* open vowels: energy below 700Hz drops the jaw, sibilants veto it */
  const jawOpen = clamp01((bands[0] + bands[1]) * 1.4 - bands[3] * 0.8) *
    clamp01(voiced * 1.15);
  /* kiss/"oo": hollow 700-3000 band, gated by the 500-700 formant */
  const gate = bands[1] >= 0.2 ? 1 : bands[1] * 5;
  const mouthFunnel = clamp01((0.45 - bands[2]) * 2.2) * gate * voiced;
  /* sibilants close the lips even while sound plays; sustained silence
     keeps pressing them (envelope path) */
  const mouthClose = Math.max(env.silence, clamp01((bands[3] - 0.1) * 3));

  return { jawOpen, mouthClose, mouthFunnel, glowMouth: fallback.glowMouth };
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}
