import type { Vector2, Vector4 } from "three";
import { blinkAmount, clamp01, moodExpression } from "./holo-motion.js";

/** Frame inputs for one hologram instance.
    Moods: 0 idle · 1 listening · 2 speaking · 3 muted */
export interface HoloFrame {
  readonly timeMs: number;
  readonly level: number;
  readonly mood: 0 | 1 | 2 | 3;
  /** 0..1 — how assembled the figure is (builder materialization). */
  readonly presence?: number;
  /** -1..1 on both axes — the bust turns toward the pointer. */
  readonly gaze?: { readonly x: number; readonly y: number };
  /** Draw a faded reflection below the bust, as if projected on glass. */
  readonly mirror?: boolean;
}

export interface HoloUniformMap {
  readonly uRes: { value: Vector2 };
  readonly uTime: { value: number };
  readonly uLevel: { value: number };
  readonly uBlink: { value: number };
  readonly uGlitch: { value: number };
  readonly uEcho: { value: number };
  readonly uMood: { value: number };
  readonly uPresence: { value: number };
  readonly uGaze: { value: Vector2 };
  readonly uMirror: { value: number };
  readonly uExpr: { value: Vector4 };
}

/** Eases the mood expression and advances the per-instance glitch LCG —
    the stateful half of the legacy renderer, kept on the JS side so the
    pure holo-motion functions stay the single source of truth. */
export class HoloFigure {
  private glitch = 0;
  private glitchSeed = 1;
  private readonly expr = { smile: 0, widen: 0, bow: 0, tilt: 0 };

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
    u.uBlink.value = blinkAmount(frame.timeMs);
    u.uGlitch.value = this.glitch;
    u.uMood.value = frame.mood;
    u.uPresence.value = clamp01(frame.presence ?? 1);
    u.uGaze.value.set(frame.gaze?.x ?? 0, frame.gaze?.y ?? 0);

    const target = moodExpression(frame.mood);
    this.expr.smile += (target.smile - this.expr.smile) * 0.04;
    this.expr.widen += (target.widen - this.expr.widen) * 0.04;
    this.expr.bow += (target.bow - this.expr.bow) * 0.04;
    this.expr.tilt += (target.tilt - this.expr.tilt) * 0.04;
    u.uExpr.value.set(this.expr.smile, this.expr.widen, this.expr.bow, this.expr.tilt);
  }
}
