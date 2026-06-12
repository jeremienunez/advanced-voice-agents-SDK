/* Audio-driven mouth: a pure fold over the smoothed output level stream
   (PCM16 RMS from the SDK client, ~48ms cadence — attack resolution is
   bounded by that cadence; see TODO Palier 2). Envelope follows fast on
   the way up and relaxes slower, attack spikes on sharp onsets, silence
   integrates quiet time and resets hard on voice. */

export interface AudioEnvelope {
  /** 0..1 smoothed voice energy (fast attack ~40ms, release ~180ms). */
  readonly envelope: number;
  /** 0..1 onset detector, decays ~120ms once the level holds. */
  readonly attack: number;
  /** 0..1 integrated quiet time (~600ms to saturate), hard-reset by voice. */
  readonly silence: number;
}

const SILENCE_THRESHOLD = 0.04;

export function initialAudioEnvelope(): AudioEnvelope {
  return { envelope: 0, attack: 0, silence: 1 };
}

export function foldAudioLevel(prev: AudioEnvelope, level: number, dtMs: number): AudioEnvelope {
  const lv = clamp01(level);
  const dt = Math.max(0, dtMs);
  const rate = lv > prev.envelope ? 1 - Math.exp(-dt / 40) : 1 - Math.exp(-dt / 180);
  const envelope = prev.envelope + (lv - prev.envelope) * rate;
  const rise = Math.max(0, lv - prev.envelope);
  const attack = Math.max(prev.attack * Math.exp(-dt / 120), clamp01(rise * 4));
  const silence =
    lv >= SILENCE_THRESHOLD
      ? 0
      : prev.silence + (1 - prev.silence) * (1 - Math.exp(-dt / 600));
  return { envelope, attack, silence };
}

/** Mouth-region control targets for the face rig. */
export function mouthTargetsFromAudio(env: AudioEnvelope): {
  jawOpen: number;
  mouthClose: number;
  glowMouth: number;
} {
  return {
    jawOpen: clamp01(env.envelope * 1.15),
    mouthClose: env.silence,
    glowMouth: clamp01(env.envelope * 1.1 + env.attack * 0.25),
  };
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}
