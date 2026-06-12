/* The stateful face-rig orchestrator: gathers control targets from the
   audio envelope, the LLM/mood affect mapper and the micromotion layer,
   advances the analytic springs, and writes the 20 controls into the
   uCtrl uniform array in FACE_CONTROL_KEYS order. */

import { affectTargets, type AffectSignal } from "./affect.js";
import { foldAudioLevel, initialAudioEnvelope } from "./audio.js";
import {
  foldEmphasis,
  initialEmphasis,
  livelinessForMood,
  speakingBob,
} from "./liveliness.js";
import { mouthTargets, type BandLevels } from "./viseme.js";
import {
  clampControls,
  FACE_CONTROL_KEYS,
  neutralControls,
} from "./controls.js";
import { createSpringState, stepControls } from "./springs.js";
import {
  blinkLid,
  blinkRateForMood,
  blinkSchedule,
  idleMicro,
  type IdleMicro,
} from "../holo-micromotion.js";

export interface FaceRigFrame {
  readonly timeMs: number;
  readonly level: number;
  /** Relative 4-band spectral split of the output audio (ThreeLS) —
      shapes the mouth into viseme-like poses when available. */
  readonly levelBands?: BandLevels | null;
  readonly mood: 0 | 1 | 2 | 3;
  readonly affect?: AffectSignal | null;
  /** Reduced-motion: one complete calm pose — eyes open, no idle layer. */
  readonly still?: boolean;
}

const BLINK_HORIZON_MS = 20_000;

export class FaceRig {
  private springs = createSpringState();
  private audio = initialAudioEnvelope();
  private emphasis = initialEmphasis();
  private lastTimeMs: number | null = null;
  private blinkOnsets: number[] = [];
  private blinkRate = 0;
  private blinkEpoch = Number.NEGATIVE_INFINITY;

  constructor(private readonly seed = 4242) {}

  /** Advances the rig one frame. Returns the idle micro sample so the
      caller can fold gaze drift into uGaze (null on still frames). */
  update(frame: FaceRigFrame, out: Float32Array): IdleMicro | null {
    const dt =
      this.lastTimeMs === null
        ? 16
        : Math.min(100, Math.max(1, frame.timeMs - this.lastTimeMs));
    this.lastTimeMs = frame.timeMs;
    this.audio = foldAudioLevel(this.audio, frame.level, dt);

    const targets = neutralControls();
    Object.assign(targets, mouthTargets(this.audio, frame.levelBands ?? null));
    Object.assign(targets, affectTargets(frame.affect ?? null, frame.mood, frame.timeMs, this.seed));

    const liveliness = livelinessForMood(frame.mood);
    if (!frame.still) {
      /* stressed onsets flash the brows and nod the head, refractory-bound */
      this.emphasis = foldEmphasis(this.emphasis, this.audio.attack, frame.timeMs);
      targets.browInnerUp += 0.35 * this.emphasis.pulse;
      targets.headPitch += -0.05 * this.emphasis.pulse +
        speakingBob(this.audio.envelope, frame.timeMs) * liveliness.bobGain;
    }

    const micro = frame.still ? null : wander(idleMicro(frame.timeMs, this.seed), liveliness.gazeWander);
    const lid = frame.still ? 0 : this.lidAt(frame.timeMs, frame.mood);
    targets.eyeBlinkL = lid;
    targets.eyeBlinkR = lid;
    targets.breath = micro ? micro.breath : 0.5;

    this.springs = frame.still
      ? { values: clampControls(targets), velocities: neutralControls() }
      : stepControls(this.springs, targets, dt);
    for (let i = 0; i < FACE_CONTROL_KEYS.length; i += 1) {
      out[i] = this.springs.values[FACE_CONTROL_KEYS[i]];
    }
    return micro;
  }

  /** Stochastic lid: regenerates the seeded schedule when the mood rate
      changes or the horizon is exhausted. A fresh epoch always starts
      with eyes open (first onset strictly after the epoch). */
  private lidAt(timeMs: number, mood: 0 | 1 | 2 | 3): number {
    const rate = blinkRateForMood(mood);
    if (
      rate !== this.blinkRate ||
      timeMs < this.blinkEpoch ||
      timeMs >= this.blinkEpoch + BLINK_HORIZON_MS
    ) {
      this.blinkRate = rate;
      this.blinkEpoch = timeMs;
      this.blinkOnsets = blinkSchedule(this.seed + Math.floor(timeMs), rate, BLINK_HORIZON_MS);
    }
    const phase = timeMs - this.blinkEpoch;
    let lid = 0;
    for (const onset of this.blinkOnsets) {
      if (onset > phase) break;
      lid = Math.max(lid, blinkLid(phase - onset));
    }
    return lid;
  }
}

/** Engagement scales the idle gaze wander (eye contact when speaking). */
function wander(micro: IdleMicro, scale: number): IdleMicro {
  return {
    ...micro,
    driftX: micro.driftX * scale,
    driftY: micro.driftY * scale,
    saccade: micro.saccade * scale,
  };
}
