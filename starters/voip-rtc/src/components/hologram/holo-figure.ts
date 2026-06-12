import type { Vector2 } from "three";
import type { AffectSignal } from "./face/affect.js";
import { FaceRig } from "./face/rig.js";
import type { BandLevels } from "./face/viseme.js";
import { clamp01 } from "./holo-motion.js";

/** Frame inputs for one hologram instance.
    Moods: 0 idle · 1 listening · 2 speaking · 3 muted */
export interface HoloFrame {
  readonly timeMs: number;
  readonly level: number;
  /** Spectral split of the output audio — viseme mouth shaping. */
  readonly levelBands?: BandLevels | null;
  readonly mood: 0 | 1 | 2 | 3;
  /** 0..1 — how assembled the figure is (builder materialization). */
  readonly presence?: number;
  /** -1..1 on both axes — the bust turns toward the pointer. */
  readonly gaze?: { readonly x: number; readonly y: number };
  /** Draw a faded reflection below the bust, as if projected on glass. */
  readonly mirror?: boolean;
  /** LLM-signaled affect (latest), drives the expression channels. */
  readonly affect?: AffectSignal | null;
  /** Reduced-motion contract: a single calm pose — eyes open, no blink
      schedule, no idle drift. */
  readonly still?: boolean;
}

export interface HoloUniformMap {
  readonly uRes: { value: Vector2 };
  readonly uTime: { value: number };
  readonly uLevel: { value: number };
  readonly uGlitch: { value: number };
  readonly uEcho: { value: number };
  readonly uMood: { value: number };
  readonly uPresence: { value: number };
  readonly uGaze: { value: Vector2 };
  readonly uMirror: { value: number };
  readonly uCtrl: { value: Float32Array };
}

/** The stateful half of the renderer: per-instance glitch LCG plus the
    face rig (springs, blink schedule, audio envelope). All motion math
    stays in the pure modules — this only sequences them. */
export class HoloFigure {
  private glitch = 0;
  private glitchSeed = 1;
  private readonly rig: FaceRig;

  constructor(private readonly seed = 4242) {
    this.rig = new FaceRig(seed);
  }

  update(frame: HoloFrame, u: HoloUniformMap, size: { width: number; height: number }): void {
    /* deterministic-enough glitch pulses, seeded per instance */
    this.glitchSeed = (this.glitchSeed * 16807) % 2147483647;
    if (this.glitchSeed / 2147483647 < 0.012) {
      this.glitch = (this.glitchSeed / 2147483647) * 2 - 1;
    }
    this.glitch *= 0.86;

    u.uRes.value.set(size.width, size.height);
    u.uTime.value = frame.timeMs * 0.001;
    u.uLevel.value = frame.level;
    u.uGlitch.value = this.glitch;
    u.uMood.value = frame.mood;
    u.uPresence.value = clamp01(frame.presence ?? 1);

    const micro = this.rig.update(frame, u.uCtrl.value);
    u.uGaze.value.set(
      clampSigned((frame.gaze?.x ?? 0) + (micro ? micro.driftX + micro.saccade : 0)),
      clampSigned((frame.gaze?.y ?? 0) + (micro ? micro.driftY : 0)),
    );
  }
}

function clampSigned(v: number): number {
  return Math.min(1, Math.max(-1, v));
}
