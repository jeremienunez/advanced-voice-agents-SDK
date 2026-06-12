/* Stochastic blink + idle micro-movement, pure and seed-replayable.
   Empirical anchors (asserted by BDD): blink rates silence ≈19/min,
   speaking ≈24.7, listening ≈27.6 (Bentivoglio 1997, PMID 6948307);
   blink ≈120ms with a faster closing phase; inter-blink intervals
   right-skewed over a 300ms refractory floor; resting breath ≈0.25Hz. */

import { OrbSeededRng } from "./orb-rng.js";

const REFRACTORY_MS = 300;
const BLINK_CLOSE_SHARE = 0.4;

/** Blinks per minute by session mood: 0 idle · 1 listening · 2 speaking
    · 3 muted (withdrawn — below silence baseline by design). */
export function blinkRateForMood(mood: 0 | 1 | 2 | 3): number {
  switch (mood) {
    case 1:
      return 27.6;
    case 2:
      return 24.7;
    case 3:
      return 14;
    default:
      return 19;
  }
}

/** Deterministic blink onset times (ms) across a window: exponential
    inter-blink intervals over a hard refractory floor. The same seed
    consumes the same uniform stream whatever the rate, so counts are
    monotone in rate per seed. First onset is strictly after the window
    start — a fresh window always begins with eyes open. */
export function blinkSchedule(seed: number, ratePerMin: number, windowMs: number): number[] {
  const rng = new OrbSeededRng(seed);
  const meanMs = 60_000 / ratePerMin;
  const tailMean = Math.max(1, meanMs - REFRACTORY_MS);
  const onsets: number[] = [];
  let t = 0;
  for (;;) {
    t += REFRACTORY_MS - tailMean * Math.log(1 - rng.next());
    if (t >= windowMs) return onsets;
    onsets.push(t);
  }
}

/** Lid closure 0..1 at `phaseMs` after a blink onset: raised-cosine
    close over 40% of the duration, slower open over the remaining 60%. */
export function blinkLid(phaseMs: number, durationMs = 120): number {
  if (phaseMs <= 0 || phaseMs >= durationMs) return 0;
  const close = durationMs * BLINK_CLOSE_SHARE;
  if (phaseMs < close) return 0.5 * (1 - Math.cos((Math.PI * phaseMs) / close));
  return 0.5 * (1 + Math.cos((Math.PI * (phaseMs - close)) / (durationMs - close)));
}

export interface IdleMicro {
  /** 0..1 breathing cycle at ≈0.25Hz (resting rate). */
  readonly breath: number;
  /** Slow fixational gaze drift, bounded and continuous. */
  readonly driftX: number;
  readonly driftY: number;
  /** Sparse micro-saccade step, constant within a ~2.5s fixation. */
  readonly saccade: number;
}

/** Idle liveness layer: pure function of (time, seed). */
export function idleMicro(timeMs: number, seed: number): IdleMicro {
  const t = timeMs / 1000;
  const p1 = hash01(seed) * Math.PI * 2;
  const p2 = hash01(seed + 1) * Math.PI * 2;
  const bucket = Math.floor(timeMs / 2500);
  return {
    breath: 0.5 - 0.5 * Math.cos(Math.PI * 2 * 0.25 * t),
    driftX: 0.06 * Math.sin(Math.PI * 2 * 0.023 * t + p1) + 0.04 * Math.sin(Math.PI * 2 * 0.041 * t + p2),
    driftY: 0.04 * Math.sin(Math.PI * 2 * 0.017 * t + p2) + 0.03 * Math.sin(Math.PI * 2 * 0.037 * t + p1),
    saccade: (hash01(seed * 73_856_093 + bucket) * 2 - 1) * 0.04,
  };
}

function hash01(n: number): number {
  let t = (n + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
}
