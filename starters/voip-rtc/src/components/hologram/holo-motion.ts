/* Pure motion math for the hologram: everything here is a function of
   its inputs alone, so blink and gaze stay replayable in the BDD harness. */

/** Periodic double-blink: pure function of time, replayable. */
export function blinkAmount(timeMs: number): number {
  const phase = timeMs % 4600;
  const one = pulse(phase, 0, 140);
  const two = pulse(phase, 220, 140);
  return Math.max(one, two * 0.8);
}

/** Pointer position → normalized gaze, clamped to [-1,1]. y grows
    upward so a pointer above the stage lifts the chin. */
export function gazeTarget(
  pointerX: number,
  pointerY: number,
  rect: { left: number; top: number; width: number; height: number },
): { x: number; y: number } {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const x = (pointerX - cx) / (rect.width / 2 || 1);
  const y = (cy - pointerY) / (rect.height / 2 || 1);
  return { x: clamp(x, -1, 1), y: clamp(y, -1, 1) };
}

export interface MoodExpression {
  /** -1..1 — mouth corners: up when positive, down when negative. */
  readonly smile: number;
  /** 0..1 — how open the eyes are beyond rest. */
  readonly widen: number;
  /** 0..1 — head pitched down. */
  readonly bow: number;
  /** -1..1 — head rolled toward one shoulder. */
  readonly tilt: number;
}

/** Micro-expression targets per session mood. Pure and replayable; the
    renderer eases toward these so state changes read as a living face:
    0 idle · 1 listening (attentive tilt, eyes open) · 2 speaking (warm
    smile) · 3 muted (bowed head, dropped corners). */
export function moodExpression(mood: 0 | 1 | 2 | 3): MoodExpression {
  switch (mood) {
    case 1:
      return { smile: 0.15, widen: 0.6, bow: 0, tilt: 0.35 };
    case 2:
      return { smile: 0.55, widen: 0.25, bow: 0, tilt: 0 };
    case 3:
      return { smile: -0.35, widen: 0, bow: 0.6, tilt: 0 };
    default:
      return { smile: 0, widen: 0, bow: 0, tilt: 0 };
  }
}

export function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function pulse(t: number, start: number, width: number): number {
  const x = (t - start) / width;
  if (x < 0 || x > 1) return 0;
  return 1 - Math.abs(x * 2 - 1);
}
