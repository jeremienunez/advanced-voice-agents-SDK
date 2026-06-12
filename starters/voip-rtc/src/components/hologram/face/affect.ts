/* Affect-channel targets: a mood-derived baseline (parity with the old
   moodExpression poses) that an LLM-signaled affect overrides and then
   decays back from (τ = 6s — after 3τ the face is within 5% of the
   baseline, asserted by BDD). Asymmetry is a seeded per-instance lateral
   bias, bounded so it reads alive, never lopsided. */

import type { VoiceAffectLabel } from "@voiceagentsdk/core/client/browser";

export interface AffectSignal {
  readonly label: VoiceAffectLabel;
  readonly intensity: number;
  /** Reception timestamp (ms, same clock as nowMs). */
  readonly at: number;
}

export interface AffectChannelTargets {
  mouthSmileL: number;
  mouthSmileR: number;
  mouthFrownL: number;
  mouthFrownR: number;
  browInnerUp: number;
  browOuterUpL: number;
  browOuterUpR: number;
  browDown: number;
  eyeSquint: number;
  eyeWiden: number;
  headYaw: number;
  headPitch: number;
  headRoll: number;
}

/** Signed channels keep the [-1,1] range; everything else clamps 0..1. */
const SIGNED_KEYS: ReadonlySet<keyof AffectChannelTargets> = new Set([
  "headYaw",
  "headPitch",
  "headRoll",
]);

const DECAY_TAU_MS = 6000;

export function affectTargets(
  affect: AffectSignal | null,
  mood: 0 | 1 | 2 | 3,
  nowMs: number,
  seed = 1,
): AffectChannelTargets {
  const t = moodBaseline(mood);
  if (affect && affect.label !== "neutral") {
    const age = Math.max(0, nowMs - affect.at);
    const i = clamp01(affect.intensity) * Math.exp(-age / DECAY_TAU_MS);
    /* lateral bias: magnitude floored away from zero, sign seeded */
    const magnitude = 0.03 + hash01(seed) * 0.12;
    const bias = hash01(seed + 7) < 0.5 ? -magnitude : magnitude;
    switch (affect.label) {
      case "smile":
        t.mouthSmileL += 0.6 * i * (1 + bias);
        t.mouthSmileR += 0.6 * i * (1 - bias);
        /* Duchenne: a felt smile narrows the lower lids */
        t.eyeSquint += 0.3 * i;
        break;
      case "concern":
        t.mouthFrownL += 0.45 * i * (1 + bias);
        t.mouthFrownR += 0.45 * i * (1 - bias);
        t.browInnerUp += 0.5 * i;
        t.headPitch -= 0.25 * i;
        break;
      case "surprise":
        t.browOuterUpL += 0.7 * i * (1 + bias);
        t.browOuterUpR += 0.7 * i * (1 - bias);
        t.browInnerUp += 0.3 * i;
        t.eyeWiden += 0.55 * i;
        break;
      case "thinking":
        t.browDown += 0.55 * i;
        t.eyeSquint += 0.3 * i;
        /* gaze aversion: look away to one seeded side */
        t.headYaw += (hash01(seed + 3) < 0.5 ? -1 : 1) * 0.18 * i;
        break;
    }
  }
  for (const key of Object.keys(t) as Array<keyof AffectChannelTargets>) {
    t[key] = SIGNED_KEYS.has(key)
      ? Math.min(1, Math.max(-1, t[key]))
      : clamp01(t[key]);
  }
  return t;
}

function moodBaseline(mood: 0 | 1 | 2 | 3): AffectChannelTargets {
  const t: AffectChannelTargets = {
    mouthSmileL: 0,
    mouthSmileR: 0,
    mouthFrownL: 0,
    mouthFrownR: 0,
    browInnerUp: 0,
    browOuterUpL: 0,
    browOuterUpR: 0,
    browDown: 0,
    eyeSquint: 0,
    eyeWiden: 0,
    headYaw: 0,
    headPitch: 0,
    headRoll: 0,
  };
  if (mood === 1) {
    /* listening: attentive — wide eyes, tilted head, hint of a smile */
    t.browInnerUp = 0.25;
    t.mouthSmileL = 0.1;
    t.mouthSmileR = 0.1;
    t.eyeWiden = 0.6;
    t.headRoll = 0.35;
  } else if (mood === 2) {
    /* speaking: warm */
    t.mouthSmileL = 0.2;
    t.mouthSmileR = 0.2;
  } else if (mood === 3) {
    /* muted: withdrawn — dropped corners, lowered brows, bowed head */
    t.mouthFrownL = 0.25;
    t.mouthFrownR = 0.25;
    t.browDown = 0.3;
    t.headPitch = -0.6;
  }
  return t;
}

function hash01(n: number): number {
  let t = (n + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}
